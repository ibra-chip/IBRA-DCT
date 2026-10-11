// pdf-parse inserts its own "-- N of M --" page separators into the returned text even when a page
// has zero real content (a scanned/photographed PDF with no text layer still gets labeled this way
// for every page). Left in, a long scanned document can look "textful" from separators alone, which
// would wrongly tell an AI prompt to trust that (empty) text as the authoritative source for numbers
// instead of reading them off the image - the opposite of the intent. Strip them before deciding
// whether a PDF has real extractable text.
export function cleanExtractedPdfText(text) {
	return String(text || '').replace(/--\s*\d+\s+of\s+\d+\s*--/g, '').trim();
}
