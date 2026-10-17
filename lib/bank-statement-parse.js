// Reads a French bank statement ("relevé de comptes") PDF text layer into one row per operation -
// no AI, no guessing: every field (date, amount, type, who) comes straight from the characters the
// bank itself printed, the same "trust the document, not an inference" principle as parseDevisExcel.
// Verified line-by-line against a real Caisse d'Epargne Ile-de-France "relevé de comptes
// professionnel" (51 operations, every one accounted for - see test/bank-statement-parse.test.js).
// Other French banks use very similar wording (RETRAIT DAB / CB / PRLV / VIR SEPA / VIR. VERS), so the
// same patterns should carry over, but this has only been checked against that one bank's format.
//
// The PDF's own text layer does NOT give operation lines in one consistent column order: most rows
// come out as "<description> <amount>\t<date> <date>" (tab before the dates), but a transfer whose
// description text happens to be short enough to fit the date column's own text block instead comes
// out "<date> <date> <description> <amount>" (no tab). Both are handled below; relying on only one
// shape silently drops transactions rather than erroring, which is why this is checked against a real
// statement rather than invented samples.

const AMOUNT = /([+-]\s*[\d\s]+,\d{2})/;
const DATE = /(\d{2}\/\d{2}\/\d{4})/;
// "<desc+amount>\t<date> <date>" - the common shape.
const TAB_DATE_LAST = new RegExp(`^(.+)\\t${DATE.source}\\s+${DATE.source}\\s*$`);
// "<date> <date> <desc+amount>" - the shape a short description/transfer line sometimes takes instead.
const DATE_FIRST = new RegExp(`^${DATE.source}\\s+${DATE.source}\\s+(.+)$`);
const TRAILING_AMOUNT = new RegExp(`\\s*${AMOUNT.source}\\s*$`);
// A card-payment or ATM line is followed by "N.<card id> M <holder name>" on its own line - this is
// the one piece of ground truth for "who" that the statement itself provides; never inferred.
const CARD_HOLDER_LINE = /^N\.\d+\s+M\s+(.+)$/;
const SOLDE_LINE = /^SOLDE (DEBITEUR|CREDITEUR) AU \d{2}\/\d{2}\/\d{4}/;
// Page headers/footers/barcodes repeat on every page and would otherwise get mistaken for a
// transaction's continuation text (e.g. a virement's "note" line) if a transaction's own detail lines
// happen to be split across a page break. None of these can ever be a real operation's own text.
const NOISE_LINE = /^(DATE|D'OPERATION|VALEUR|MONTANT|EN EUR|-- \d+ of \d+ --|Relevé N°|Page \d|GI[+]?PH\d|Caisse d'Epargne|du Code Monétaire|Siège social|Agence\s*:|Tél\s*:|JE CONSERVE|CE DOCUMENT|Ce document ne constitue|Autorisation de découvert|Conditions d'arrêté|Taux d'intérêts|Commission|Lorsque le taux|\d{4,}\s*$|[\\ðôñõ÷ùó]+)/;

const parseFrenchAmount = (raw) => {
	const sign = raw.trim().startsWith('-') ? -1 : 1;
	const digits = raw.replace(/[+\-\s]/g, '').replace(',', '.');
	const value = Number(digits);
	return Number.isFinite(value) ? Math.round(value * sign * 100) / 100 : null;
};

// Merchant-name keyword lists for the one sub-classification the statement does NOT spell out itself
// (a CB line only says the merchant, not "fuel" or "meal") - kept short and specific on purpose: an
// unmatched merchant falls into 'autre achat' rather than being force-fit into the wrong bucket.
const FUEL_KEYWORDS = ['TOTAL', 'ESSO', 'DILCEM', 'SHELL', 'AVIA', 'BP ', 'AGIP'];
const MEAL_KEYWORDS = ['FOOD', 'GRILL', 'STEAKH', 'KEBAP', 'FACTORY', 'PAIN', 'BRAZZA', 'EXCELLENCE', 'RESTAURANT', 'BOULANG', 'PAVILL', 'BISTRO', 'PIZZA'];
const MATERIAUX_KEYWORDS = ['MATERIAUX', 'BRICORAMA', 'POINT P', 'BRICO DEPOT', 'KILOUTOU', 'LMFR', 'LEROY MERLIN', 'GEDIMAT', 'DISPANO', 'SAMSE', 'ACTION '];
const TRANSPORT_KEYWORDS = ['SNCF', 'RATP', 'UBER', 'AUTOROUTE', 'VINCI PARK', 'EFFIA'];
const matchesKeyword = (text, keywords) => keywords.some((keyword) => text.toUpperCase().includes(keyword));

function classify(description) {
	const text = description.trim();
	const upper = text.toUpperCase();
	if (upper.startsWith('RETRAIT')) return { type: 'retrait', category: 'Retrait espèces', party: null };
	if (upper.startsWith('CB ')) {
		// "CB <merchant> FACT ddmmyy" - the FACT date is the merchant's own invoice/receipt date, not
		// the bank's operation date; kept in `note` for reference, the operation date is what's used.
		const factMatch = text.match(/\s*FACT\s+(\d{6})\s*$/i);
		const merchant = factMatch ? text.slice(3, factMatch.index).trim() : text.slice(3).trim();
		let category = 'Autre achat';
		if (matchesKeyword(merchant, FUEL_KEYWORDS)) category = 'Carburant';
		else if (matchesKeyword(merchant, MEAL_KEYWORDS)) category = 'Repas';
		else if (matchesKeyword(merchant, MATERIAUX_KEYWORDS)) category = 'Matériaux / Location';
		else if (matchesKeyword(merchant, TRANSPORT_KEYWORDS)) category = 'Transport (train/bus)';
		return { type: 'carte', category, party: null, merchant, note: factMatch ? `Facture du ${factMatch[1].slice(0, 2)}/${factMatch[1].slice(2, 4)}/20${factMatch[1].slice(4, 6)}` : undefined };
	}
	if (upper.startsWith('PRLV')) return { type: 'prelevement', category: 'Prélèvement / Cotisation', party: text.replace(/^PRLV\s*/i, '').trim() };
	if (upper.startsWith('VIR SEPA')) return { type: 'virement_recu', category: 'Virement reçu', party: text.replace(/^VIR SEPA\s*/i, '').trim() };
	if (upper.startsWith('VIR.') && upper.includes('VERS')) return { type: 'virement_envoye', category: 'Virement envoyé', party: text.replace(/^VIR\.?\s*VERS\s*/i, '').trim() };
	if (upper.startsWith('*') || upper.includes('FRAIS')) return { type: 'frais', category: 'Frais bancaires', party: null };
	return { type: 'autre', category: 'Autre', party: null };
}

// Header figures (statement number, period, opening/closing balance) live outside the operations
// table, so this reads the raw text directly rather than the noise-filtered line list above. The
// closing balance is always the LAST "SOLDE ... AU" line in the document (the opening one is the
// first, right before the very first operation) - used only to let the review page show "does our
// own sum of parsed operations match the bank's stated balance change", the same sanity check this
// parser itself was verified against.
export function parseBankStatementSummary(rawText) {
	const numberMatch = rawText.match(/relevé de comptes mensuel N° (\d+) au (\d{2}\/\d{2}\/\d{4})/i);
	const accountMatch = rawText.match(/COMPTE COURANT N° ([\d\s]+\d)\s/);
	const soldeMatches = [...rawText.matchAll(/SOLDE (?:DEBITEUR|CREDITEUR) AU (\d{2}\/\d{2}\/\d{4})\s+([+-]\s*[\d\s]+,\d{2})/g)];
	const opening = soldeMatches[0];
	const closing = soldeMatches[soldeMatches.length - 1];
	return {
		statementNumber: numberMatch ? numberMatch[1] : null,
		periodEndDate: numberMatch ? numberMatch[2] : null,
		accountNumber: accountMatch ? accountMatch[1].trim() : null,
		openingBalance: opening ? parseFrenchAmount(opening[2]) : null,
		openingDate: opening ? opening[1] : null,
		closingBalance: closing && closing !== opening ? parseFrenchAmount(closing[2]) : null,
		closingDate: closing && closing !== opening ? closing[1] : null,
	};
}

export function parseBankStatementText(rawText) {
	const lines = rawText.split('\n').map((line) => line.trim()).filter((line) => line && !NOISE_LINE.test(line));
	const transactions = [];
	let current = null;
	const flush = () => { if (current) transactions.push(current); current = null; };
	const startTransaction = (operationDate, valueDate, descAndAmount) => {
		const amountMatch = descAndAmount.match(TRAILING_AMOUNT);
		if (!amountMatch) return; // malformed row - never guess an amount, drop rather than invent
		const descriptionStart = descAndAmount.slice(0, amountMatch.index).trim();
		const classification = classify(descriptionStart);
		current = { operationDate, valueDate, description: descriptionStart, amount: parseFrenchAmount(amountMatch[1]), person: null, ...classification };
	};
	for (const line of lines) {
		const tabMatch = line.match(TAB_DATE_LAST);
		if (tabMatch) { flush(); startTransaction(tabMatch[2], tabMatch[3], tabMatch[1]); continue; }
		const dateFirstMatch = line.match(DATE_FIRST);
		if (dateFirstMatch && TRAILING_AMOUNT.test(dateFirstMatch[3])) { flush(); startTransaction(dateFirstMatch[1], dateFirstMatch[2], dateFirstMatch[3]); continue; }
		if (!current) continue; // header/footer noise before the first operation or after the last
		if (SOLDE_LINE.test(line)) { flush(); continue; }
		const holderMatch = line.match(CARD_HOLDER_LINE);
		if (holderMatch && (current.type === 'carte' || current.type === 'retrait')) { current.person = holderMatch[1].trim(); continue; }
		// VIR SEPA / VIR. VERS put the real counterparty name or a free-text label on the next line
		// (e.g. "VIR SEPA MORJANI ABDESLAM" then "Travaux") - only the first continuation line is
		// reliably that human-readable text; later lines are bank reference codes ("-Réf. ...") or the
		// IBAN-ish "VERS <sort code>" line, which add nothing a person would want to see.
		if ((current.type === 'virement_recu' || current.type === 'virement_envoye') && current.note === undefined && !line.startsWith('-Réf') && !line.startsWith('VERS ')) {
			current.note = line;
		}
	}
	flush();
	return transactions;
}
