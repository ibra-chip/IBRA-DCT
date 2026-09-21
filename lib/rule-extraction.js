// Fast, regex-based extraction of concrete numeric rules (distances, minimums,
// thresholds) straight from the PDF's own text -- a cheap, reliable fallback
// when the slower embedded-image extraction is skipped (large/complex PDFs)
// or simply as a quick reference alongside it.
const RULE_PATTERN = /(\d+([.,]\d+)?\s*(mm|cm|m²|m2|%|kg\/m3|g\/cm3)|\bmini(mum)?\b|\bmaxi(mum)?\b|[≥≤±])/i;

export function extractPdfRules(text = '', { max = 10 } = {}) {
	const candidates = String(text)
		.split(/\r?\n|(?<=[.;:])\s+(?=[A-ZÀ-Ý])/)
		.map((line) => line.replace(/\s+/g, ' ').trim())
		.filter(Boolean);
	const seen = new Set();
	const rules = [];
	for (const line of candidates) {
		if (line.length < 8 || line.length > 220) continue;
		if (!RULE_PATTERN.test(line)) continue;
		const key = line.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		rules.push(line);
		if (rules.length >= max) break;
	}
	return rules;
}
