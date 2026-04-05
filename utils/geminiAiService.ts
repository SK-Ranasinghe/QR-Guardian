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

const GEMINI_API_KEY = Constants.expoConfig?.extra?.geminiApiKey as string | undefined;
const GEMINI_MODEL_ID =
  (Constants.expoConfig?.extra?.geminiModel as string | undefined) || 'gemini-2.0-flash';

const SYSTEM_PROMPT_TEMPLATE = (
  scannedData: string,
) => `You are a Cyber Security Analyst. Analyze this URL/Text: '${scannedData}'. Task: Detect Zero-Day Phishing, Social Engineering, and Deception. Checks:
Typosquatting: Does it mimic a brand (e.g. 'paypa1')?
TLD Mismatch: Does a major bank/service use a suspicious extension (like .xyz, .top, .cc)?
Semantics: Does the URL contain urgency keywords ('verify', 'suspend', 'login')?
Output Format: Return ONLY a raw JSON object (no markdown) with this structure: { 'verdict': 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS', 'riskScore': number (0-100), 'reason': 'A short, sharp sentence explaining exactly why (e.g. Netflix domain using .xyz extension).', 'threatType': 'Phishing' | 'Malware' | 'Social Engineering' | 'Safe' }`;

const createNeutralInsight = (rawText: string, reason: string): GeminiAiInsight => ({
  verdict: 'NEUTRAL',
  riskScore: 50,
  reason,
  threatType: 'Neutral',
  rawText,
});

export const runGeminiAnalysis = async (scannedData: string): Promise<GeminiAiInsight | null> => {
  try {
    if (!GEMINI_API_KEY) {
      console.log('⚠️ [GeminiAI] API key is not configured in app.config.js');
      return null;
    }

    console.log('🧠 [GeminiAI] Starting AI analysis for:', scannedData);
    console.log('� [GeminiAI] Using Gemini model:', GEMINI_MODEL_ID);

    const prompt =
      SYSTEM_PROMPT_TEMPLATE(scannedData) +
      '\n\nAnalyze this and respond strictly with ONLY the JSON object described.';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.log('❌ [GeminiAI] HTTP error status', response.status, 'body:', errorText);
      return null;
    }

    const data: any = await response.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text ?? '')
        .join('\n') ?? '';

    if (!text) {
      console.log('⚠️ [GeminiAI] Empty text response from model');
      return null;
    }

    console.log('📨 [GeminiAI] Raw model text:', text);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const extractedJson = jsonMatch?.[0];

    if (!extractedJson) {
      console.log('⚠️ [GeminiAI] Could not find JSON object in response');
      return createNeutralInsight(
        text,
        'AI response did not contain a valid JSON block. Showing a neutral fallback result.'
      );
    }

    console.log('🧩 [GeminiAI] Extracted JSON block:', extractedJson);

    let parsed: any;
    try {
      parsed = JSON.parse(extractedJson);
    } catch (err) {
      console.log('⚠️ [GeminiAI] JSON parse error', err);
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

    console.log('✅ [GeminiAI] Parsed AI insight:', insight);
    return insight;
  } catch (error) {
    console.log('❌ [GeminiAI] Unexpected error during AI analysis:', error);
    return null;
  }
};
