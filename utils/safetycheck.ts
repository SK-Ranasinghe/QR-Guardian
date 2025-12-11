// utils/safetyCheck.ts
import Constants from 'expo-constants';
import { BRAND_PATTERNS } from './brandDatabase';
import { getCachedResult, setCachedResult } from './cache';
import { getScanHistory } from './historyService';
import { sendThreatUpdateNotification } from './notificationService';

export interface SafetyResult {
  isSafe: boolean;
  rating: 'SAFE' | 'CAUTION' | 'DANGEROUS';
  issues: string[];
  score: number;
  threats: string[];
}

// Read API key from config
const API_KEY = Constants.expoConfig?.extra?.googleSafeBrowsingApiKey;

export const checkGoogleSafeBrowsing = async (url: string): Promise<string[]> => {
  console.log('🔐 API Key Status:', API_KEY ? '✅ Loaded' : '❌ Missing');
  
  if (!API_KEY) {
    console.log('⚠️ Using mock data - API key not configured');
    // Mock threats for testing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (url.includes('test-malware')) {
      return ['MALWARE detected (Mock)'];
    }
    if (url.includes('test-phishing')) {
      return ['SOCIAL_ENGINEERING detected (Mock)'];
    }
    if (url.includes('bit.ly') || url.includes('tinyurl')) {
      return [];
    }
    
    return [];
  }

  const threats: string[] = [];

  try {
    console.log('🌐 Calling Google Safe Browsing API for:', url);
    
    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client: {
            clientId: "qr-guardian",
            clientVersion: "1.0.0"
          },
          threatInfo: {
            threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url: url }]
          }
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    console.log('📨 API Response:', data);
    
    if (data.matches && data.matches.length > 0) {
      data.matches.forEach((match: any) => {
        const threatType = match.threatType.replace('_', ' ').toLowerCase();
        threats.push(`${threatType} threat detected`);
      });
      console.log('🚨 Threats found:', threats);
    } else {
      console.log('✅ No threats detected');
    }
  } catch (error) {
    console.log('❌ Safe Browsing API error:', error);
    threats.push('Could not verify with security database');
  }

  return threats;
};

// Add this function to safetyCheck.ts (anywhere before monitorThreatChanges):
const extractDomain = (url: string): string => {
  try {
    let cleanUrl = url.toLowerCase().trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'http://' + cleanUrl;
    }
    const urlObj = new URL(cleanUrl);
    let domain = urlObj.hostname;
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }
    return domain;
  } catch {
    const cleanUrl = url.toLowerCase().trim();
    const match = cleanUrl.match(/(?:https?:\/\/)?(?:www\.)?([^\/:\?]+)/);
    return match ? match[1] : cleanUrl;
  }
};

// Try to resolve shortened URLs to their final destination
const resolveShortUrl = async (url: string): Promise<{ finalUrl: string; hops: number } | null> => {
  try {
    const response = await fetch(url, { method: 'HEAD' as any });
    const finalUrl = (response as any).url || url;
    const hops = finalUrl !== url ? 1 : 0;
    return { finalUrl, hops };
  } catch (error) {
    console.log('❌ Failed to resolve short URL:', error);
    return null;
  }
};

export const monitorThreatChanges = async (url: string, currentResult: SafetyResult) => {
  try {
    const history = await getScanHistory();
    const previousScans = history.filter(item => 
      item.url.includes(extractDomain(url)) || 
      url.includes(extractDomain(item.url))
    );

    if (previousScans.length > 0) {
      const latestPrevious = previousScans[0];
      
      // Check if threat level changed significantly
      if (
        (latestPrevious.safetyRating === 'SAFE' && currentResult.rating !== 'SAFE') ||
        (latestPrevious.safetyRating !== 'DANGEROUS' && currentResult.rating === 'DANGEROUS')
      ) {
        await sendThreatUpdateNotification(
          extractDomain(url),
          latestPrevious.safetyRating,
          currentResult.rating
        );
      }
    }
  } catch (error) {
    console.error('Error monitoring threat changes:', error);
  }
};

export const analyzeUrl = async (url: string): Promise<SafetyResult> => {
  // Check cache first
  const cached = getCachedResult(url);
  if (cached) {
    console.log('📦 Using cached result for:', url);
    return cached;
  }

  console.log('🔍 Analyzing URL:', url);
  
  const issues: string[] = [];
  let score = 100;
  let threats: string[] = [];
  let minRating: 'SAFE' | 'CAUTION' | 'DANGEROUS' = 'SAFE';
  const lowerUrl = url.toLowerCase();

  // === LAYER 1: SCHEME PARSER (HIDDEN ACTIONS) ===

  // Wi-Fi Config (WIFI:)
  if (lowerUrl.startsWith('wifi:')) {
    const before = score;
    const ssidMatch = url.match(/S:([^;]*)/i);
    const ssid = ssidMatch && ssidMatch[1] ? ssidMatch[1] : 'unknown network';
    issues.push(`⚠️ Network Config: Attempting to connect to Wi-Fi network '${ssid}'.`);
    score -= 20;
    console.log('📡 Wi-Fi scheme detected', { ssid, scoreBefore: before, scoreAfter: score });
    if (minRating === 'SAFE') minRating = 'CAUTION';
  }

  // Premium SMS (SMSTO:)
  if (lowerUrl.startsWith('smsto:')) {
    // Format: SMSTO:number:message
    const before = score;
    const smsPayload = url.slice(6); // after "SMSTO:"
    const [number, ...messageParts] = smsPayload.split(':');
    const message = messageParts.join(':') || '""';
    const trimmedNumber = number || 'unknown number';
    issues.push(`⚠️ Financial Risk: Triggers an SMS to ${trimmedNumber} with message '${message}'.`);
    score -= 50;
    console.log('💰 Premium SMS scheme detected', { number: trimmedNumber, message, scoreBefore: before, scoreAfter: score });
    minRating = 'DANGEROUS';
  }

  // Premium SMS (fallback format, e.g., "1337\nSUBSCRIBE $50" or "1337 SUBSCRIBE $50")
  if (!lowerUrl.startsWith('smsto:')) {
    const smsLines = url.split(/\r?\n/);
    const firstLine = smsLines[0]?.trim() || '';
    const restLines = smsLines.slice(1).join(' ').trim();

    const phoneLike = /^\+?[0-9]{3,}$/.test(firstLine);
    const hasMessage = restLines.length > 0 || /\s+/.test(url.trim());

    if (phoneLike && hasMessage) {
      const before = score;
      const number = firstLine;
      const message = restLines || url.replace(firstLine, '').trim();
      issues.push(`⚠️ Financial Risk: Triggers an SMS to ${number} with message '${message || '""'}'.`);
      score -= 50;
      console.log('💰 Premium SMS (fallback format) detected', { number, message, scoreBefore: before, scoreAfter: score });
      minRating = 'DANGEROUS';
    }
  }

  // Direct Call (TEL:)
  if (lowerUrl.startsWith('tel:')) {
    const before = score;
    const phoneNumber = url.substring(4) || 'unknown number';
    issues.push(`⚠️ Privacy Risk: Initiates an automatic phone call to ${phoneNumber}.`);
    score -= 20;
    console.log('📞 TEL scheme detected', { phoneNumber, scoreBefore: before, scoreAfter: score });
    if (minRating === 'SAFE') minRating = 'CAUTION';
  }

  // Direct Call (fallback: plain phone number like "+94771234567")
  if (!lowerUrl.startsWith('tel:')) {
    const trimmed = url.trim();
    const phoneLike = /^\+?[0-9]{6,}$/.test(trimmed);

    if (phoneLike) {
      const before = score;
      const phoneNumber = trimmed;
      issues.push(`⚠️ Privacy Risk: Initiates an automatic phone call to ${phoneNumber}.`);
      score -= 20;
      console.log('📞 TEL (fallback phone number) detected', { phoneNumber, scoreBefore: before, scoreAfter: score });
      if (minRating === 'SAFE') minRating = 'CAUTION';
    }
  }

  // === LAYER 2: TYPOSQUATTING DETECTOR (FAKE BRANDS) ===

  const domain = extractDomain(url).toLowerCase();

  // IDN / Homograph Attack Detector (Punycode)
  if (domain.startsWith('xn--')) {
    const before = score;
    issues.push('⚠️ Homograph Risk: This domain uses IDN/Punycode and may imitate a trusted brand.');
    score -= 50;
    console.log('🌐 IDN/Punycode domain detected', { domain, scoreBefore: before, scoreAfter: score });
    minRating = 'DANGEROUS';
  }

  const leetify = (value: string) =>
    value
      .replace(/0/g, 'o')
      .replace(/1/g, 'l')
      .replace(/3/g, 'e')
      .replace(/4/g, 'a')
      .replace(/5/g, 's')
      .replace(/7/g, 't')
      .replace(/@/g, 'a')
      .replace(/\0/g, '');

  const cleanedDomain = leetify(domain);
  const brands = BRAND_PATTERNS;

  for (const brand of brands) {
    const brandName = brand.name;
    const officialHit = brand.officialDomains.some((official) => domain === official);

    // Skip if we are on an official domain
    if (officialHit) continue;

    const looksLikeBrand = cleanedDomain.includes(brandName);

    if (looksLikeBrand) {
      const before = score;
      issues.push(`⚠️ Phishing Alert: This URL mimics ${brandName} but is likely fake.`);
      score -= 40;
      console.log('🎭 Typosquatting detected', { brand: brandName, domain, cleanedDomain, scoreBefore: before, scoreAfter: score });
      if (minRating !== 'DANGEROUS') {
        minRating = 'DANGEROUS';
      }
    }
  }

  // === LAYER 3: KEYWORD SCANNER (SENSITIVE CONTENT) ===

  const sensitiveKeywordsV2 = ['password', 'admin', 'config', 'login', 'verify'];
  const hasSensitiveKeywordsV2 = sensitiveKeywordsV2.some((keyword) =>
    lowerUrl.includes(keyword)
  );

  if (hasSensitiveKeywordsV2) {
    const before = score;
    const matched = sensitiveKeywordsV2.filter((keyword) => lowerUrl.includes(keyword));
    issues.push('⚠️ Sensitive Content: URL contains security-sensitive keywords.');
    score -= 15;
    console.log('🔐 Sensitive keyword(s) detected', { matched, scoreBefore: before, scoreAfter: score });
    if (minRating === 'SAFE') minRating = 'CAUTION';
  }

  // === EXISTING HEURISTICS (URL structure, TLDs, etc.) ===

  // 1. URL Shorteners (HIGH RISK)
  const shorteners = [
    'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 
    'ow.ly', 'is.gd', 'buff.ly', 'adf.ly',
    'shorturl.at', 'cutt.ly', 'shorte.st', 'tiny.cc',
    'bit.do', 'lnkd.in', 'rebrand.ly', 'tiny.one', 't.ly', 'rb.gy'
  ];
  
  const hasShortener = shorteners.some(shortener => 
    lowerUrl.includes(shortener)
  );
  
  if (hasShortener) {
    const before = score;
    issues.push('🚩 Uses URL shortener - may hide malicious destination');
    score -= 35;
    console.log('🔗 URL shortener detected', { scoreBefore: before, scoreAfter: score });

    const resolved = await resolveShortUrl(url);
    if (resolved && resolved.finalUrl && resolved.finalUrl !== url) {
      const redirectNote = resolved.hops > 0
        ? ` (approx. ${resolved.hops} redirect)`
        : '';
      issues.push(`🔁 Short URL expands to: ${resolved.finalUrl}${redirectNote}`);
    }
  }

  // 2. HTTP vs HTTPS (MEDIUM RISK)
  if (url.startsWith('http://')) {
    const before = score;
    issues.push('⚠️ Uses HTTP (not secure) instead of HTTPS');
    score -= 25;
    console.log('🌐 Insecure HTTP detected', { scoreBefore: before, scoreAfter: score });
  }

  // 3. Scam/Phishing Keywords (HIGH RISK)
  const scamKeywords = ['free', 'win', 'prize', 'reward', 'bonus', 'lottery', 'claim'];
  const hasScamKeywords = scamKeywords.some(keyword => 
    lowerUrl.includes(keyword)
  );
  
  if (hasScamKeywords) {
    const before = score;
    const matched = scamKeywords.filter(keyword => lowerUrl.includes(keyword));
    issues.push('🎣 Contains promotional keywords often used in scams');
    score -= 30;
    console.log('🎣 Scam keyword(s) detected', { matched, scoreBefore: before, scoreAfter: score });
  }

  // 5. IP Addresses (HIGH RISK)
  const ipAddressPattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
  if (ipAddressPattern.test(url)) {
    const before = score;
    issues.push('🖥️ Uses IP address instead of domain name (often suspicious)');
    score -= 30;
    console.log('🖥️ IP-based URL detected', { scoreBefore: before, scoreAfter: score });
  }

  // 6. Suspicious TLDs (MEDIUM RISK)
  const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.xyz', '.top'];
  const hasSuspiciousTLD = suspiciousTLDs.some(tld => 
    lowerUrl.includes(tld)
  );
  
  if (hasSuspiciousTLD) {
    const before = score;
    issues.push('🌐 Uses less common TLD often associated with spam');
    score -= 15;
    console.log('🌐 Suspicious TLD detected', { scoreBefore: before, scoreAfter: score });
  }

  // 7. Excessive Subdomains (LOW RISK)
  const subdomainCount = (url.match(/\./g) || []).length;
  if (subdomainCount > 4) {
    const before = score;
    issues.push('🔗 Excessive subdomains - could be hiding true destination');
    score -= 10;
    console.log('🧩 Excessive subdomains detected', { subdomainCount, scoreBefore: before, scoreAfter: score });
  }

  // === LIVE THREAT CHECK ===
  if (API_KEY) {
    threats = await checkGoogleSafeBrowsing(url);
    if (threats.length > 0 && !threats.includes('API configuration needed')) {
      const before = score;
      score -= 50;
      issues.push('🚨 KNOWN SECURITY THREATS DETECTED');
      console.log('🚨 Safe Browsing threats detected', { threats, scoreBefore: before, scoreAfter: score });
    }
  } else {
    issues.push('ℹ️ Security API not configured - using basic checks only');
  }

  // === ENHANCED RATING SYSTEM ===
  let rating: 'SAFE' | 'CAUTION' | 'DANGEROUS' = 'SAFE';
  
  if (score >= 80) rating = 'SAFE';
  else if (score >= 50) rating = 'CAUTION'; 
  else rating = 'DANGEROUS';

  // Enforce minimum severity based on high‑risk layers (schemes, typosquatting, keywords)
  const ratingWeight = (value: 'SAFE' | 'CAUTION' | 'DANGEROUS') =>
    value === 'SAFE' ? 0 : value === 'CAUTION' ? 1 : 2;

  if (ratingWeight(minRating) > ratingWeight(rating)) {
    console.log('⚖️ Upgrading rating due to minRating', { previousRating: rating, minRating });
    rating = minRating;
  }

  score = Math.max(0, Math.min(100, score));

  console.log('📊 Final Safety Result:', { 
    rating, 
    score, 
    issues: issues.length, 
    threats: threats.length 
  });

  const result = {
    isSafe: rating === 'SAFE',
    rating,
    issues: [...issues, ...threats],
    score,
    threats
  };

  // Cache the result
  setCachedResult(url, result);

  // Monitor for threat changes
  await monitorThreatChanges(url, result);
  
  return result;
};