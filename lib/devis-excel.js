// Reads a devis bill-of-quantities straight from an Excel file: no AI, no text-pattern guessing - just
// reading what's already in the cells, which is the most precise source possible (a cell either has
// "45" in it or it doesn't). Looks for a header row with recognizable French/English column names within
// the first few rows, then reads every row below it until the sheet ends.
import ExcelJS from 'exceljs';

const HEADER_PATTERNS = {
	description: /^(description|d[ée]signation|libell[ée]|intitul[ée]|d[ée]tail)$/i,
	quantity: /^(quantit[ée]s?|qt[ée]s?|qty)$/i,
	unit: /^(unit[ée]s?|u\.?)$/i,
	unitPrice: /^(prix\s*unitaire\s*(ht|ttc)?|p\.?u\.?(\s*ht)?|prix\s*u\.?)$/i,
	lineTotal: /^(total\s*(ht|ttc)?|montant\s*(ht|ttc)?)$/i,
	category: /^(cat[ée]gorie|lot|section|chapitre|poste)$/i,
};

const cellText = (row, column) => (column ? String(row.getCell(column).value ?? '').trim() : '');
const cellNumber = (row, column) => {
	if (!column) return 0;
	const raw = row.getCell(column).value;
	if (typeof raw === 'number') return raw;
	if (raw && typeof raw === 'object' && typeof raw.result === 'number') return raw.result; // a formula cell
	const parsed = Number(String(raw ?? '').replace(/\s/g, '').replace(',', '.'));
	return Number.isFinite(parsed) ? parsed : 0;
};

export async function parseDevisExcel(buffer) {
	const workbook = new ExcelJS.Workbook();
	try {
		await workbook.xlsx.load(buffer);
	} catch (error) {
		return { items: [], error: `Fichier Excel illisible : ${error.message}` };
	}
	const sheet = workbook.worksheets[0];
	if (!sheet || !sheet.rowCount) return { items: [], error: 'Aucune feuille ou aucune ligne trouvée dans le fichier Excel.' };

	let headerRowNumber = null;
	let columnMap = null;
	for (let rowNumber = 1; rowNumber <= Math.min(15, sheet.rowCount); rowNumber += 1) {
		const row = sheet.getRow(rowNumber);
		const map = {};
		row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
			const text = String(cell.value ?? '').trim();
			for (const [field, pattern] of Object.entries(HEADER_PATTERNS)) {
				if (!map[field] && pattern.test(text)) map[field] = colNumber;
			}
		});
		if (map.description && map.quantity) { headerRowNumber = rowNumber; columnMap = map; break; }
	}
	if (!headerRowNumber) return { items: [], error: 'Colonnes non reconnues : il faut au moins une colonne "Description" et une colonne "Quantité" dans les 15 premières lignes.' };

	const items = [];
	for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
		const row = sheet.getRow(rowNumber);
		const description = cellText(row, columnMap.description);
		if (!description) continue;
		const quantity = cellNumber(row, columnMap.quantity);
		const unitPrice = cellNumber(row, columnMap.unitPrice);
		const lineTotal = cellNumber(row, columnMap.lineTotal) || quantity * unitPrice;
		items.push({ description, quantity, unit: cellText(row, columnMap.unit), unitPrice, lineTotal, category: cellText(row, columnMap.category) || description });
	}
	if (!items.length) return { items: [], error: 'Aucune ligne avec une description trouvée sous les en-têtes détectés.' };
	return { items, error: null };
}

export function isExcelFile(file) {
	const name = String(file?.originalname || '').toLowerCase();
	const type = String(file?.mimetype || '');
	return name.endsWith('.xlsx') || name.endsWith('.xls')
		|| type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		|| type === 'application/vnd.ms-excel';
}
