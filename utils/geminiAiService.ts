import Constants from 'expo-constants';

export type AiVerdict = 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' | 'NEUTRAL';
export type AiThreatType = 'Phishing' | 'Malware' | 'Social Engineering' | 'Safe' | 'Neutral';

export interface GeminiAiInsight {
  verdict: AiVerdict;
  riskScore: number; // 0-100
  reason: string;
  threatType: AiThreatType;
  rawText?: string;
}

const DEFAULT_GEMINI_MODEL_ID = 'gemini-2.5-flash';

type GeminiRuntimeExtra = {
  geminiApiKey?: string;
  geminiModel?: string;
};

const getGeminiRuntimeExtra = (): GeminiRuntimeExtra => {
  const expoExtra = Constants.expoConfig?.extra as GeminiRuntimeExtra | undefined;
  const manifest2Extra = (Constants as any).manifest2?.extra?.expoClient?.extra as GeminiRuntimeExtra | undefined;
  const manifestExtra = (Constants as any).manifest?.extra as GeminiRuntimeExtra | undefined;

  return expoExtra ?? manifest2Extra ?? manifestExtra ?? {};
};

const getGeminiRuntimeConfig = () => {
  const extra = getGeminiRuntimeExtra();

  return {
    apiKey: extra.geminiApiKey,
    model: extra.geminiModel || DEFAULT_GEMINI_MODEL_ID,
    hasExpoExtra: Boolean(Constants.expoConfig?.extra),
    hasManifest2Extra: Boolean((Constants as any).manifest2?.extra?.expoClient?.extra),
    hasManifestExtra: Boolean((Constants as any).manifest?.extra),
  };
};

const SYSTEM_PROMPT_TEMPLATE = (
  scannedData: string,
) => `You are a Cyber Security Analyst. Analyze this URL/Text: '${scannedData}'. Task: Detect Zero-Day Phishing, Social Engineering, and Deception. Checks:
Typosquatting: Does it mimic a brand (e.g. 'paypa1')?
TLD Mismatch: Does a major bank/service use a suspicious extension (like .xyz, .top, .cc)?
Semantics: Does the URL contain urgency keywords ('verify', 'suspend', 'login')?
Output Format: Return ONLY a valid JSON object with double-quoted keys and string values using this structure: {"verdict":"SAFE | SUSPICIOUS | DANGEROUS","riskScore":0,"reason":"A short, sharp sentence explaining exactly why.","threatType":"Phishing | Malware | Social Engineering | Safe"}`;

const createNeutralInsight = (rawText: string, reason: string): GeminiAiInsight => ({
  verdict: 'NEUTRAL',
  riskScore: 50,
  reason,
  threatType: 'Neutral',
  rawText,
});

const extractJsonCandidate = (rawText: string): string | null => {
  const normalizedText = rawText
    .replace(/```json/gi, '```')
    .replace(/```/g, '')
    .trim();

  if (normalizedText.startsWith('{') && normalizedText.endsWith('}')) {
    return normalizedText;
  }

  let startIndex = -1;
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < normalizedText.length; index += 1) {
    const character = normalizedText[index];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (character === '\\') {
      isEscaped = true;
      continue;
    }

    if (character === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (character === '{') {
      if (depth === 0) {
        startIndex = index;
      }
      depth += 1;
      continue;
    }

    if (character === '}') {
      depth -= 1;
      if (depth === 0 && startIndex !== -1) {
        return normalizedText.slice(startIndex, index + 1);
      }
      if (depth < 0) {
        depth = 0;
        startIndex = -1;
      }
    }
  }

  return null;
};

const buildGeminiRequestBody = (prompt: string, includeJsonResponseMimeType: boolean) => {
  const body: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
  };

  if (includeJsonResponseMimeType) {
    body.generationConfig = {
      responseMimeType: 'application/json',
    };
  }

  return body;
};

const sendGeminiRequest = async (
  endpoint: string,
  prompt: string,
  includeJsonResponseMimeType: boolean,
) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildGeminiRequestBody(prompt, includeJsonResponseMimeType)),
  });

  return response;
};

export const runGeminiAnalysis = async (scannedData: string): Promise<GeminiAiInsight | null> => {
  try {
    const { apiKey, model, hasExpoExtra, hasManifest2Extra, hasManifestExtra } = getGeminiRuntimeConfig();

    if (!apiKey) {
      console.log(' [GeminiAI] API key is not configured in Expo extra config', {
        hasExpoExtra,
        hasManifest2Extra,
        hasManifestExtra,
        model,
      });
      return createNeutralInsight('', 'AI analysis is unavailable because the Gemini API key is missing in the app configuration.');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

    console.log(' [GeminiAI] Starting AI analysis for:', scannedData);
    console.log(' [GeminiAI] Runtime config:', {
      model,
      hasApiKey: true,
      keySuffix: apiKey.slice(-4),
      hasExpoExtra,
      hasManifest2Extra,
      hasManifestExtra,
    });

    const prompt =
      SYSTEM_PROMPT_TEMPLATE(scannedData) +
      '\n\nAnalyze this and respond strictly with ONLY the JSON object described.';

    let response = await sendGeminiRequest(endpoint, prompt, true);

    console.log(' [GeminiAI] HTTP response status:', response.status, response.statusText);

    if (!response.ok) {
      let errorText = await response.text().catch(() => '');

      if (
        response.status === 400 &&
        errorText.includes('responseMimeType')
      ) {
        console.log(' [GeminiAI] responseMimeType is not supported on this endpoint. Retrying without generationConfig.');
        response = await sendGeminiRequest(endpoint, prompt, false);
        console.log(' [GeminiAI] Retry HTTP response status:', response.status, response.statusText);

        if (response.ok) {
          errorText = '';
        } else {
          errorText = await response.text().catch(() => '');
        }
      }

      if (!response.ok) {
        console.log(' [GeminiAI] HTTP error status', response.status, 'body:', errorText);
        return createNeutralInsight(
          errorText,
          `AI analysis failed with HTTP ${response.status}. Showing a neutral fallback result.`
        );
      }
    }

    const data: any = await response.json();
    console.log(' [GeminiAI] Raw response payload:', JSON.stringify(data));
    const text: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text ?? '')
        .join('\n') ?? '';

    if (!text) {
      const finishReason = data?.candidates?.[0]?.finishReason;
      const promptFeedback = data?.promptFeedback;
      console.log(' [GeminiAI] Empty text response from model', { finishReason, promptFeedback });
      return createNeutralInsight(
        JSON.stringify(data),
        'AI analysis returned an empty response. Showing a neutral fallback result.'
      );
    }

    console.log(' [GeminiAI] Raw model text:', text);

    const extractedJson = extractJsonCandidate(text);

    if (!extractedJson) {
      console.log(' [GeminiAI] Could not find JSON object in response');
      return createNeutralInsight(
        text,
        'AI response did not contain a valid JSON block. Showing a neutral fallback result.'
      );
    }

    console.log(' [GeminiAI] Extracted JSON block:', extractedJson);

    let parsed: any;
    try {
      parsed = JSON.parse(extractedJson);
    } catch (err) {
      console.log(' [GeminiAI] JSON parse error', err);
      return createNeutralInsight(
        text,
        'AI response could not be parsed reliably. Showing a neutral fallback result.'
      );
    }

    const verdictValue = typeof parsed.verdict === 'string' ? parsed.verdict.toUpperCase() : 'NEUTRAL';
    const verdict: AiVerdict =
      verdictValue === 'SAFE' ||
      verdictValue === 'SUSPICIOUS' ||
      verdictValue === 'DANGEROUS' ||
      verdictValue === 'NEUTRAL'
        ? (verdictValue as AiVerdict)
        : 'NEUTRAL';
    const riskScore = typeof parsed.riskScore === 'number' ? parsed.riskScore : 0;
    const reason = typeof parsed.reason === 'string' ? parsed.reason : 'No reason provided.';
    const threatTypeValue = typeof parsed.threatType === 'string' ? parsed.threatType : 'Neutral';
    const threatType: AiThreatType =
      threatTypeValue === 'Phishing' ||
      threatTypeValue === 'Malware' ||
      threatTypeValue === 'Social Engineering' ||
      threatTypeValue === 'Safe' ||
      threatTypeValue === 'Neutral'
        ? (threatTypeValue as AiThreatType)
        : 'Neutral';

    const insight: GeminiAiInsight = {
      verdict,
      riskScore: Math.max(0, Math.min(100, riskScore)),
      reason,
      threatType,
      rawText: text,
    };

    console.log(' [GeminiAI] Parsed AI insight:', insight);
    return insight;
  } catch (error) {
    console.log(' [GeminiAI] Unexpected error during AI analysis:', error);
    return createNeutralInsight(
      error instanceof Error ? error.message : String(error),
      'AI analysis hit an unexpected error. Showing a neutral fallback result.'
    );
  }
};
