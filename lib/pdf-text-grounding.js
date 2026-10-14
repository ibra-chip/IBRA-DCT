// pdf-parse inserts its own "-- N of M --" page separators into the returned text even when a page
// has zero real content (a scanned/photographed PDF with no text layer still gets labeled this way
// for every page). Left in, a long scanned document can look "textful" from separators alone, which
// would wrongly tell an AI prompt to trust that (empty) text as the authoritative source for numbers
// instead of reading them off the image - the opposite of the intent. Strip them before deciding
// whether a PDF has real extractable text.
export function cleanExtractedPdfText(text) {
	return String(text || '').replace(/--\s*\d+\s+of\s+\d+\s*--/g, '').trim();
}
// A technical callout on a French construction drawing ("ép.130mm - R=3,70", "40x40mm - ép.15/10è",
// "Ø8 tous les 250mm"...) always pairs a number with one of a handful of standard unit markers -
// generic across every trade (bardage, plomberie, structure, électricité...), never tied to one
// project's own vocabulary.
const CALLOUT_UNIT_PATTERN = /\d+(?:[.,]\d+)?\s*(?:mm|cm|m²|m2|kg|microns?)\b|\bml\b|R\s*=\s*\d+[.,]\d+|Ø\s*\d+|ép\.\s*\d+|lg\.\s*\d+/i;
// Standard French drafting shorthand for "this isn't finalized yet" - also generic across any
// discipline or author, not specific to this one project.
const OPEN_ITEM_PATTERNS = [/à\s+dimensionner/i, /à\s+définir/i, /à\s+valider/i, /non\s+défini/i, /reste\s+à\s+(?:préciser|définir|valider)/i];
// Reads only what the plan's own embedded PDF text already says - never OCR, never a raster read, so
// a scanned/photographed plan with no real text layer correctly returns nothing instead of a guess.
// Deliberately does NOT try to stitch a spec line back onto whichever line precedes it (a real label
// is routinely split across 2-4 separate lines in the extracted text, e.g. "Isolant Rockfaçade" then
// "ép.130mm - R=3,70" on the next line) - pdf-parse's plain text stream carries no reliable boundary
// between one label and the next, so guessing which lines belong together risks silently pairing the
// wrong name with the wrong spec. Each matching line is reported exactly as printed instead: an index
// of the real spec text on the plan to cross-check against the drawing, not a parsed materials table.
export function extractPlanTextCallouts(rawText) {
	const text = cleanExtractedPdfText(rawText);
	if (!text) return { callouts: [], openItems: [] };
	const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
	const calloutCounts = new Map();
	const openItems = [];
	const openItemSeen = new Set();
	for (const line of lines) {
		// A real label line is short - a long line is a paragraph/note that happens to mention a unit
		// somewhere in it, not a callout meant to stand on its own. A bare number+unit with nothing else
		// ("250mm" alone) is excluded - meaningless without the label it belongs to - but a line carrying
		// one of the short technical markers (ép., lg., R=, Ø) is kept even without a full word, since
		// "ép.130mm - R=3,70" is already a real, self-explanatory spec on its own.
		const hasMarker = /ép\.|lg\.|R\s*=|Ø/i.test(line);
		const hasWord = /[A-Za-zÀ-ÿ]{3,}/.test(line);
		if (line.length <= 90 && CALLOUT_UNIT_PATTERN.test(line) && (hasMarker || hasWord)) {
			calloutCounts.set(line, (calloutCounts.get(line) || 0) + 1);
		}
		if (line.length <= 140 && OPEN_ITEM_PATTERNS.some((pattern) => pattern.test(line)) && !openItemSeen.has(line)) {
			openItemSeen.add(line);
			openItems.push(line);
		}
	}
	const callouts = [...calloutCounts.entries()].map(([calloutText, count]) => ({ text: calloutText, count })).sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
	return { callouts, openItems };
}
