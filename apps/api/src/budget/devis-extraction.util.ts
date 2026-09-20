export const parseAmount = (value: unknown): number => {
  const number = Number(
    String(value ?? '')
      .replace(/\s/g, '')
      .replace(/\.(?=\d{3}(?:\D|$))/g, '')
      .replace(',', '.'),
  );
  return Number.isFinite(number) ? number : 0;
};

export interface ExtractedDevisFields {
  number: string;
  client: string;
  chantier: string;
  total: number;
}

export const extractDevisFields = (text: string): ExtractedDevisFields => {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  const amountMatches = [...normalized.matchAll(/(?:net à payer|total\s+(?:ttc|t\.t\.c\.)|montant\s+total|total)\s*[:=]?\s*([\d\s.,]+)\s*(?:€|eur)?/gi)];
  const rawAmount = amountMatches.at(-1)?.[1] || '';
  return {
    number: normalized.match(/(?:devis|devis n(?:°|o)?|référence|reference)\s*[:#-]?\s*([A-Z0-9][A-Z0-9/_.-]{2,})/i)?.[1] || '',
    client: normalized.match(/(?:client|donneur d'ordre)\s*[:#-]?\s*([^|;]{2,80}?)(?=\s+(?:adresse|chantier|travaux|total|montant)\b|$)/i)?.[1]?.trim() || '',
    chantier: normalized.match(/(?:adresse du projet|adresse chantier|chantier|projet|lieu des travaux)\s*[:#-]?\s*([^|;]{2,160}?)(?=\s+(?:adresse|travaux|total|montant|net à payer|devis)\b|$)/i)?.[1]?.trim() || '',
    total: parseAmount(rawAmount),
  };
};

export interface ExtractedInvoiceFields {
  number: string;
  supplier: string;
  date: string;
  amount: number;
}

export const extractInvoiceFields = (text: string): ExtractedInvoiceFields => {
  const amountMatch = text.match(/(?:total|montant|amount|ukupno)\s*(?:ttc|t\.t\.c\.|eur|€)?\s*[:=]?\s*([\d\s.,]+)/i);
  const dateMatch = text.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/);
  const supplier = text.match(/(?:fournisseur|supplier|dobavljač|vendeur)\s*[:=-]?\s*([^|;]{2,80})/i)?.[1]?.trim() || '';
  const number = text.match(/(?:facture|invoice|facture n|račun|devis)\s*(?:n°|no|br\.?|#)?\s*[:=-]?\s*([A-Z0-9][A-Z0-9/_.-]{2,})/i)?.[1] || '';
  return {
    number,
    supplier,
    date: dateMatch?.[1] || '',
    amount: amountMatch ? parseAmount(amountMatch[1]) : 0,
  };
};

interface GeminiDevisResult {
  number?: string;
  client?: string;
  chantier?: string;
  total?: number | string;
}

export const inspectDevisWithGemini = async (file: { buffer: Buffer; mimetype?: string }): Promise<GeminiDevisResult | null> => {
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!geminiApiKey) return null;

  const model = (process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-3.6-flash').replace(/^models\//, '');
  const prompt = 'Read this French construction quote/devis PDF. Return only JSON with fields: number string, client string, chantier string, total number. Use the final TTC/net payable total when available. If a field is not visible, use empty string or 0.';

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: file.mimetype || 'application/pdf', data: file.buffer.toString('base64') } }] }],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error('Gemini devis inspect rejected', response.status, details.slice(0, 500));
    return null;
  }

  const result = await response.json();
  try {
    return JSON.parse(String(result.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim());
  } catch {
    return null;
  }
};
