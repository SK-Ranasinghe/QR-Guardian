// utils/safetyCheck.ts
import Constants from 'expo-constants';
import { BRAND_PATTERNS } from './brandDatabase';
import { setCachedResult } from './cache';
import { getScanHistory } from './historyService';
import { sendThreatUpdateNotification } from './notificationService';

export interface SafetyResult {
  isSafe: boolean;
  rating: 'SAFE' | 'CAUTION' | 'DANGEROUS';
  issues: string[];
  score: number;
  threats: string[];
}

// Shannon entropy helper for DGA / randomness detection
const calculateEntropy = (value: string): number => {
  const clean = value.toLowerCase().trim();
  if (!clean) return 0;

  const freq: Record<string, number> = {};
  for (const ch of clean) {
    freq[ch] = (freq[ch] || 0) + 1;
  }

  const length = clean.length;
  let entropy = 0;

  Object.values(freq).forEach((count) => {
    const p = count / length;
    entropy -= p * Math.log2(p);
  });

  // === XSS / INJECTION FILTER (RAW PAYLOAD) ===

  const xssPatterns: RegExp[] = [
    /javascript:/i,
    /vbscript:/i,
    /<script/i,
    /eval\s*\(/i,
    /document\.cookie/i,
  ];

  const hasXss = xssPatterns.some((regex) => regex.test(value));

  if (hasXss) {
    const before = 0;
    console.log('🚫 XSS / injection pattern detected', { value, scoreBefore: before, scoreAfter: 0 });
  }

  return entropy;
};

const getLongestConsonantRun = (value: string): number => {
  let longest = 0;
  let current = 0;

  for (const ch of value.toLowerCase()) {
    if (/[bcdfghjklmnpqrstvwxyz]/.test(ch)) {
      current += 1;
      if (current > longest) {
        longest = current;
      }
    } else {
      current = 0;
    }
  }

  return longest;
};

const analyzeDomainRandomness = (domain: string) => {
  const labels = domain
    .split('.')
    .map((label) => label.toLowerCase().replace(/[^a-z0-9-]/g, ''))
    .filter(Boolean);

  const sample = [...labels]
    .map((label) => label.replace(/-/g, ''))
    .filter((label) => /[a-z0-9]/.test(label))
    .sort((a, b) => b.length - a.length)[0] ?? domain.replace(/[^a-z0-9]/g, '');

  const entropy = calculateEntropy(sample);
  const lettersOnly = sample.replace(/[^a-z]/g, '');
  const vowels = (lettersOnly.match(/[aeiou]/g) || []).length;
  const vowelRatio = lettersOnly.length ? vowels / lettersOnly.length : 0;
  const uniqueCharRatio = sample.length ? new Set(sample).size / sample.length : 0;
  const digitRatio = sample.length ? (sample.match(/\d/g) || []).length / sample.length : 0;
  const longestConsonantRun = getLongestConsonantRun(lettersOnly);

  let suspicionScore = 0;
  const signals: string[] = [];

  if (entropy >= 3.85) {
    suspicionScore += 4;
    signals.push('very high entropy');
  } else if (entropy >= 3.45 && sample.length >= 10) {
    suspicionScore += 2;
    signals.push('elevated entropy');
  } else if (entropy >= 3.05 && sample.length >= 18) {
    suspicionScore += 1;
    signals.push('moderate entropy on a very long label');
  }

  if (lettersOnly.length >= 12 && vowelRatio <= 0.18) {
    suspicionScore += 3;
    signals.push('extremely low vowel ratio');
  } else if (lettersOnly.length >= 14 && vowelRatio <= 0.25 && longestConsonantRun >= 5) {
    suspicionScore += 2;
    signals.push('consonant-heavy pattern');
  }

  if (longestConsonantRun >= 7) {
    suspicionScore += 4;
    signals.push('very long consonant run');
  } else if (longestConsonantRun >= 5 && entropy >= 3.1) {
    suspicionScore += 2;
    signals.push('long consonant run');
  }

  if (sample.length >= 14 && uniqueCharRatio >= 0.55) {
    suspicionScore += 1;
    signals.push('high character variation');
  }

  if (sample.length >= 10 && digitRatio >= 0.2) {
    suspicionScore += 2;
    signals.push('digit-heavy label');
  }

  let level: 'LOW' | 'MEDIUM' | 'HIGH' | null = null;
  let penalty = 0;

  if (suspicionScore >= 7) {
    level = 'HIGH';
    penalty = 30;
  } else if (suspicionScore >= 4) {
    level = 'MEDIUM';
    penalty = 20;
  } else if (suspicionScore >= 2) {
    level = 'LOW';
    penalty = 10;
  }

  return {
    sample,
    entropy,
    vowelRatio,
    uniqueCharRatio,
    digitRatio,
    longestConsonantRun,
    suspicionScore,
    level,
    penalty,
    signals,
  };
};

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
  const scanSeparator = '='.repeat(72);
  console.log(`\n${scanSeparator}`);
  console.log(`🔍 [SCAN START] ${new Date().toISOString()}`);
  console.log('🔗 URL:', url);
  console.log(scanSeparator);
  
  const issues: string[] = [];
  let score = 100;
  let threats: string[] = [];
  let minRating: 'SAFE' | 'CAUTION' | 'DANGEROUS' = 'SAFE';
  
  const lowerUrl = url.toLowerCase();

  // === LAYER 1: SCHEME PARSER (HIDDEN ACTIONS) ===

  // Wi-Fi Config (WIFI:) – detect even if embedded in a larger payload
  const wifiIndex = lowerUrl.indexOf('wifi:');
  if (wifiIndex !== -1) {
    const wifiPayload = url.slice(wifiIndex); // start from WIFI: onwards
    const before = score;
    const ssidMatch = wifiPayload.match(/S:([^;]*)/i);
    const ssid = ssidMatch && ssidMatch[1] ? ssidMatch[1] : 'unknown network';

    issues.push(`⚠️ Network Config: Attempting to connect to Wi-Fi network '${ssid}'.`);
    score -= 20;

    // Detect insecure Wi-Fi security types (WEP / open networks)
    const typeMatch = wifiPayload.match(/T:([^;]*)/i);
    const securityType = typeMatch && typeMatch[1] ? typeMatch[1].toUpperCase() : 'NOPASS';

    if (securityType === 'WEP' || securityType === 'NOPASS') {
      const beforeInsecure = score;
      issues.push('⚠️ Risk: Vulnerable network protocol (WEP/Open Wi‑Fi).');
      score -= 30;
      console.log('📡 Insecure Wi‑Fi security detected', {
        ssid,
        securityType,
        scoreBefore: beforeInsecure,
        scoreAfter: score,
      });
      minRating = 'DANGEROUS';
    } else if (minRating === 'SAFE') {
      minRating = 'CAUTION';
    }

    console.log('📡 Wi‑Fi scheme detected', { ssid, scoreBefore: before, scoreAfter: score });
  } else {
    // Heuristic: some scanners decode Wi‑Fi QR into plain "SSID PASSWORD" text.
    // If it looks like two tokens and not a URL, treat it as a Wi‑Fi style payload.
    const looksLikeWifiText =
      !lowerUrl.includes('://') &&
      !lowerUrl.startsWith('tel:') &&
      !lowerUrl.startsWith('smsto:');

    const parts = url.trim().split(/\s+/);

    if (looksLikeWifiText && parts.length === 2) {
      const [ssidText, passwordText] = parts;
      const before = score;
      issues.push(
        `⚠️ Network Config: QR appears to share Wi-Fi access for network '${ssidText}'.`,
      );
      score -= 20;

      issues.push('⚠️ Risk: Wi‑Fi credentials shared in plain text via QR. Treat this network as untrusted.');
      score -= 20;

      console.log('📡 Heuristic Wi‑Fi pattern detected', {
        ssid: ssidText,
        passwordLength: passwordText.length,
        scoreBefore: before,
        scoreAfter: score,
      });

      if (minRating === 'SAFE') {
        minRating = 'CAUTION';
      }
    }
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

  // === LAYER 2: DOMAIN ANALYSIS (TYPOSQUATTING, DGA, ETC.) ===

  const domain = extractDomain(url).toLowerCase();

  const domainRandomness = analyzeDomainRandomness(domain);
  if (domainRandomness.sample.length >= 6) {
    console.log('📈 Domain randomness analysis:', {
      domain,
      sample: domainRandomness.sample,
      entropy: domainRandomness.entropy,
      vowelRatio: domainRandomness.vowelRatio,
      uniqueCharRatio: domainRandomness.uniqueCharRatio,
      digitRatio: domainRandomness.digitRatio,
      longestConsonantRun: domainRandomness.longestConsonantRun,
      suspicionScore: domainRandomness.suspicionScore,
      signals: domainRandomness.signals,
    });

    if (domainRandomness.level) {
      const before = score;
      const levelLabel =
        domainRandomness.level === 'HIGH'
          ? 'High'
          : domainRandomness.level === 'MEDIUM'
          ? 'Medium'
          : 'Low';
      const signalSummary = domainRandomness.signals.slice(0, 2).join(', ');
      issues.push(
        `⚠️ Domain Randomness (${levelLabel}): Host looks machine-generated (${signalSummary}).`,
      );
      score -= domainRandomness.penalty;
      console.log('🤖 Domain randomness risk detected', {
        domain,
        entropy: domainRandomness.entropy,
        level: domainRandomness.level,
        penalty: domainRandomness.penalty,
        signals: domainRandomness.signals,
        scoreBefore: before,
        scoreAfter: score,
      });
      if (domainRandomness.level !== 'LOW' && minRating === 'SAFE') {
        minRating = 'CAUTION';
      }
    }
  }

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

  // === XSS / INJECTION FILTER (RAW PAYLOAD) ===

  const xssPatterns: RegExp[] = [
    /javascript:/i,
    /vbscript:/i,
    /<script/i,
    /eval\s*\(/i,
    /document\.cookie/i,
  ];

  const hasXss = xssPatterns.some((regex) => regex.test(url));

  if (hasXss) {
    const before = score;
    issues.push('🚫 Critical: Malicious code injection detected (XSS-style payload).');
    score -= 50;
    console.log('🚫 XSS / injection pattern detected', { url, scoreBefore: before, scoreAfter: score });
    minRating = 'DANGEROUS';
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

  // 3b. Open Redirect detector (URL inside URL)
  const firstHttpIndex = lowerUrl.indexOf('http://');
  const firstHttpsIndex = lowerUrl.indexOf('https://');
  const firstIndex =
    firstHttpIndex === -1
      ? firstHttpsIndex
      : firstHttpsIndex === -1
      ? firstHttpIndex
      : Math.min(firstHttpIndex, firstHttpsIndex);

  if (firstIndex !== -1) {
    const rest = lowerUrl.slice(firstIndex + 8); // skip initial scheme roughly
    const nestedHttpIndex = rest.search(/https?:\/\//);

    if (nestedHttpIndex !== -1) {
      const before = score;
      issues.push('⚠️ Caution: Possible open redirect detected (URL parameter contains another URL).');
      score -= 30;
      console.log('🔁 Open redirect pattern detected', { url, scoreBefore: before, scoreAfter: score });
      if (minRating === 'SAFE') minRating = 'CAUTION';
    }
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
  console.log(`${scanSeparator}\n`);

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