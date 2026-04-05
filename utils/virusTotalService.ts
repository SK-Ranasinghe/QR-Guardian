import Constants from 'expo-constants';

export type VirusTotalVerdict = 'CLEAN' | 'SUSPICIOUS' | 'MALICIOUS';

export interface VirusTotalEngineDetection {
  engine: string;
  category: string;
  result: string;
}

export interface VirusTotalSummary {
  service: 'VirusTotal';
  permalink?: string;
  harmless: number;
  malicious: number;
  suspicious: number;
  undetected: number;
  timeout: number;
  verdict: VirusTotalVerdict;
  scanDate?: string;
  detections: VirusTotalEngineDetection[];
  engines: VirusTotalEngineDetection[];
}

const VT_API_KEY = Constants.expoConfig?.extra?.virusTotalApiKey as string | undefined;
const VT_LOG_SEPARATOR = '-'.repeat(72);

export const runVirusTotalScan = async (url: string): Promise<VirusTotalSummary | null> => {
  try {
    console.log(`\n${VT_LOG_SEPARATOR}`);
    console.log('🧪 [VirusTotal] Deep scan start');
    console.log('🔗 [VirusTotal] URL:', url);
    console.log(VT_LOG_SEPARATOR);

    if (!VT_API_KEY) {
      console.log('⚠️ [VirusTotal] API key is not configured in app.config.js');
      return null;
    }

    const submitResponse = await fetch('https://www.virustotal.com/api/v3/urls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-apikey': VT_API_KEY,
      },
      body: `url=${encodeURIComponent(url)}`,
    });

    if (!submitResponse.ok) {
      console.log('❌ [VirusTotal] Submit failed with status', submitResponse.status);
      return null;
    }

    const submitJson: any = await submitResponse.json();
    const analysisId: string | undefined = submitJson?.data?.id;

    if (!analysisId) {
      console.log('❌ [VirusTotal] Could not extract analysis id from submit response', submitJson);
      return null;
    }

    console.log('🆔 [VirusTotal] Analysis ID:', analysisId);

    let analysisJson: any | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const analysisResponse = await fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
        headers: {
          'x-apikey': VT_API_KEY,
        },
      });

      if (!analysisResponse.ok) {
        console.log('❌ [VirusTotal] Analysis fetch failed with status', analysisResponse.status);
        return null;
      }

      analysisJson = await analysisResponse.json();
      const status: string | undefined = analysisJson?.data?.attributes?.status;
      console.log(`🧪 [VirusTotal] Poll attempt ${attempt + 1}, status:`, status);

      if (status === 'completed') {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (!analysisJson) {
      console.log('❌ [VirusTotal] Analysis JSON was never retrieved');
      return null;
    }

    console.log('📨 [VirusTotal] Full analysis payload:', JSON.stringify(analysisJson, null, 2));

    const urlId: string | undefined =
      analysisJson?.data?.relationships?.url?.data?.id;

    let urlAttributes: any = null;

    if (urlId) {
      try {
        const urlResponse = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
          headers: {
            'x-apikey': VT_API_KEY,
          },
        });

        if (urlResponse.ok) {
          const urlJson: any = await urlResponse.json();
          urlAttributes = urlJson?.data?.attributes || null;
          console.log('📄 [VirusTotal] URL report payload:', JSON.stringify(urlJson, null, 2));
        } else {
          console.log(
            '⚠️ [VirusTotal] URL report fetch failed with status',
            urlResponse.status,
          );
        }
      } catch (err) {
        console.log('⚠️ [VirusTotal] Error while fetching URL report:', err);
      }
    } else {
      console.log('⚠️ [VirusTotal] No URL relationship found on analysis payload');
    }

    const attributes = analysisJson?.data?.attributes || {};
    const stats =
      urlAttributes?.last_analysis_stats ||
      attributes.last_analysis_stats ||
      attributes.stats;

    if (!stats) {
      console.log('⚠️ [VirusTotal] No stats found in analysis or URL report', {
        analysis: analysisJson,
        urlAttributes,
      });
      return null;
    }

    const harmless = stats.harmless ?? 0;
    const malicious = stats.malicious ?? 0;
    const suspicious = stats.suspicious ?? 0;
    const undetected = stats.undetected ?? 0;
    const timeout = stats.timeout ?? 0;

    let verdict: VirusTotalVerdict = 'CLEAN';
    if (malicious > 0) verdict = 'MALICIOUS';
    else if (suspicious > 0) verdict = 'SUSPICIOUS';

    const results =
      urlAttributes?.last_analysis_results ||
      attributes.last_analysis_results ||
      attributes.results ||
      {};
    const detections: VirusTotalEngineDetection[] = [];
    const engines: VirusTotalEngineDetection[] = [];

    for (const [engine, value] of Object.entries(results)) {
      const v: any = value;

      const rawCategory: string = v?.category || 'unknown';
      const upper = rawCategory.toUpperCase();
      let normalizedCategory: string = 'UNKNOWN';

      if (upper.includes('MALICIOUS')) normalizedCategory = 'MALICIOUS';
      else if (upper.includes('SUSPICIOUS')) normalizedCategory = 'SUSPICIOUS';
      else if (upper.includes('HARMLESS')) normalizedCategory = 'SAFE';
      else if (upper.includes('UNDETECTED')) normalizedCategory = 'UNDETECTED';

      const entry: VirusTotalEngineDetection = {
        engine,
        category: normalizedCategory,
        result: v?.result || v?.method || rawCategory,
      };

      engines.push(entry);

      if (v?.category === 'malicious' || v?.category === 'suspicious') {
        detections.push(entry);
      }
    }

    const scanTimestamp =
      urlAttributes?.last_analysis_date ||
      attributes.last_analysis_date ||
      attributes.date;
    const scanDate = scanTimestamp
      ? new Date(scanTimestamp * 1000).toISOString()
      : undefined;

    const summary: VirusTotalSummary = {
      service: 'VirusTotal',
      harmless,
      malicious,
      suspicious,
      undetected,
      timeout,
      verdict,
      scanDate,
      detections,
      engines,
      permalink: analysisJson?.data?.links?.self,
    };

    console.log('✅ [VirusTotal] Deep scan summary:', summary);
    return summary;
  } catch (error) {
    console.log('❌ [VirusTotal] Unexpected error during deep scan:', error);
    return null;
  } finally {
    console.log(`${VT_LOG_SEPARATOR}\n`);
  }
};
