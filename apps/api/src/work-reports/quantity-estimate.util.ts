export interface QuantityEstimateResult {
  status: 'estimated' | 'not_configured';
  quantityUnit: 'm2' | 'ml';
  estimatedQuantity: number | null;
  confidence: number;
  answer: string;
  requiresHumanConfirmation: true;
}

const parseEstimate = (text: string): { estimatedQuantity?: number | string; confidence?: number; reason?: string } => {
  try {
    return JSON.parse(String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim());
  } catch {
    return {};
  }
};

const normalizeEstimate = (
  parsed: { estimatedQuantity?: number | string; confidence?: number; reason?: string },
  quantityUnit: 'm2' | 'ml',
  status: QuantityEstimateResult['status'],
): QuantityEstimateResult => {
  const estimatedQuantity = Number.isFinite(Number(parsed.estimatedQuantity)) ? Number(parsed.estimatedQuantity) : null;
  return {
    status,
    quantityUnit,
    estimatedQuantity,
    confidence: Number(parsed.confidence || 0),
    answer: parsed.reason || 'Nema pouzdane procjene. Dodajte mjeru, metar, laser, plan ili poznatu referencu pa potvrdite ručno.',
    requiresHumanConfirmation: true,
  };
};

export const estimateQuantityWithGemini = async (
  file: { buffer: Buffer; mimetype?: string },
  quantityUnit: 'm2' | 'ml',
): Promise<QuantityEstimateResult> => {
  const unitLabel = quantityUnit === 'ml' ? 'linear meters / mètres linéaires / ml' : 'square meters / mètres carrés / m²';
  const prompt = `Analyze the work photo and estimate the executed quantity in ${unitLabel}.
Return only JSON with: estimatedQuantity number or null, confidence number 0-1, reason string.
Never invent dimensions. Estimate only if the photo shows a visible measuring tool, a known module/element size, or clearly countable repeated elements with a known unit size. If there is no visible reference, estimatedQuantity must be null and reason must say what reference is missing.
For m² use visible height x width of executed work. For ml use visible linear length of executed work such as joints, rails, profiles, flashing, bands, base rails, edge trims or linear façade elements.`;

  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!geminiApiKey) return normalizeEstimate({}, quantityUnit, 'not_configured');

  const model = (process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-3.6-flash').replace(/^models\//, '');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: file.mimetype || 'image/jpeg', data: file.buffer.toString('base64') } }] }],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error('Gemini quantity estimate rejected', response.status, details.slice(0, 500));
    return normalizeEstimate({}, quantityUnit, 'not_configured');
  }

  const result = await response.json();
  return normalizeEstimate(parseEstimate(result.candidates?.[0]?.content?.parts?.[0]?.text), quantityUnit, 'estimated');
};
