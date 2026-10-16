// Parses DXF ENTITIES into a flat list grouped by layer, same group-code walk used throughout this
// session's manual analysis (code 0 = new entity, code 8 = layer, 10/20 = point x/y, repeated for
// polylines). Deliberately minimal: only what the plan-measure "ossature" tool needs (INSERT block
// placements and their layer), not a general CAD interpreter - a DWG's full entity set is huge and
// most of it (dimensions, hatches, viewports) isn't relevant to spacing analysis.
export function parseDxfEntities(text) {
	const lines = String(text || '').split(/\r?\n/);
	const entities = [];
	let current = null;
	let currentType = null;
	const flush = () => {
		if (current) entities.push({ type: currentType, fields: current });
		current = null;
		currentType = null;
	};
	for (let i = 0; i < lines.length - 1; i += 2) {
		const codeLine = lines[i].trim();
		const value = lines[i + 1];
		if (codeLine === '0') {
			flush();
			currentType = value.trim();
			current = {};
			continue;
		}
		if (!current) continue;
		const code = Number(codeLine);
		if (!Number.isFinite(code)) continue;
		if (!current[code]) current[code] = [];
		current[code].push(value);
	}
	flush();
	return entities;
}

// TEXT/MTEXT entities only - the dimension labels and spec notes a drafter actually printed on the
// drawing (côtes, "entraxe 400", material notes). Read exactly as printed, same "index to cross-check"
// honesty as extractPlanTextCallouts for a PDF's text layer - never interpreted as an INSERT's block
// name/scale would be, and never paired back to a nearby block, since a DXF carries no reliable
// "this label belongs to that block" link the way a real CAD viewer's screen proximity would show.
// MTEXT splits its content across repeated group-code-1/3 fragments, which is joined back into one string.
export function extractTextEntities(entities) {
	const items = [];
	for (const { type, fields } of entities) {
		if (type !== 'TEXT' && type !== 'MTEXT') continue;
		const text = [...(fields[1] || []), ...(fields[3] || [])].join('').trim();
		if (!text) continue;
		items.push({ layer: fields[8]?.[0] || '', text });
	}
	return items;
}
// INSERT block placements only (the unit this tool reasons about - one ossature rail segment, one
// bracket, one panel - is almost always modeled as a block reference, same as every layer analyzed
// manually earlier this session). Layer/x/y are the only fields the spacing analysis needs.
export function extractInserts(entities) {
	const inserts = [];
	for (const { type, fields } of entities) {
		if (type !== 'INSERT') continue;
		const layer = fields[8]?.[0];
		const x = Number(fields[10]?.[0]);
		const y = Number(fields[20]?.[0]);
		if (!layer || !Number.isFinite(x) || !Number.isFinite(y)) continue;
		inserts.push({ layer, x, y });
	}
	return inserts;
}

// Groups a sorted list of coordinates into "zones" (same wall/bay) wherever two consecutive values
// are further apart than gapThreshold - same technique used throughout this session's manual DWG
// analysis to split one long axis (e.g. the whole facade width) into separate walls/bays before
// computing spacing within each, so a big jump between unrelated walls never gets reported as a
// single huge "gap" the way a naive single-pass diff would.
function clusterValues(values, gapThreshold) {
	const sorted = [...values].sort((a, b) => a - b);
	const clusters = [];
	let current = [sorted[0]];
	for (let i = 1; i < sorted.length; i += 1) {
		if (sorted[i] - current[current.length - 1] > gapThreshold) {
			clusters.push(current);
			current = [sorted[i]];
		} else {
			current.push(sorted[i]);
		}
	}
	if (current.length) clusters.push(current);
	return clusters;
}

// For one layer's INSERT positions: first splits the points into zones (separate walls/bays) by
// clustering the ZONE axis, then - within each zone - reports the distinct positions and gaps along
// the SPACING axis. This two-step order matters: ossature heights repeat similarly from bay to bay,
// so clustering directly on height (as an earlier version of this function did) merged every bay's
// row of brackets into one meaningless mega-cluster. Clustering on X first (one zone per wall/bay),
// then reading Y-gaps only within that zone, is the same two-pass approach used by hand throughout
// this session's manual DWG analysis - spacingAxis='y' for "which height does each rail go at" per
// wall, spacingAxis='x' for "how far apart are the brackets along one rail".
// precisionMm rounds coordinates before dedup (DXF floating point noise, e.g. 9089.199999996 vs
// 9089.2, would otherwise show as two near-identical "distinct" positions 0.0001mm apart).
export function axisSpacing(inserts, { spacingAxis = 'y', zoneGapThresholdMm = 2000, precisionMm = 1 } = {}) {
	if (!['x', 'y'].includes(spacingAxis)) throw new Error('spacingAxis must be "x" or "y"');
	const zoneAxis = spacingAxis === 'y' ? 'x' : 'y';
	const round = (value) => Math.round(value / precisionMm) * precisionMm;
	const zoneValues = [...new Set(inserts.map((p) => round(p[zoneAxis])))];
	if (!zoneValues.length) return [];
	const zoneClusters = clusterValues(zoneValues, zoneGapThresholdMm);
	return zoneClusters.map((zonePositions) => {
		const zoneMin = zonePositions[0];
		const zoneMax = zonePositions[zonePositions.length - 1];
		const zoneInserts = inserts.filter((p) => round(p[zoneAxis]) >= zoneMin && round(p[zoneAxis]) <= zoneMax);
		const spacingValues = [...new Set(zoneInserts.map((p) => round(p[spacingAxis])))].sort((a, b) => a - b);
		const gaps = [];
		for (let i = 1; i < spacingValues.length; i += 1) gaps.push(Number((spacingValues[i] - spacingValues[i - 1]).toFixed(1)));
		return {
			zoneAxis, spacingAxis, zoneMin, zoneMax,
			// count: how many DISTINCT positions (rows) this wall has - what the ruler draws one tick per.
			// insertCount: how many actual block placements (physical pieces) fall in this wall - several
			// can legitimately share one rounded position (e.g. three rail segments at the same height
			// across a wide wall), so insertCount is always >= count and is the number an order needs.
			count: spacingValues.length, insertCount: zoneInserts.length, positions: spacingValues, gaps,
		};
	});
}

// "Along one rail" spacing (how far apart are the brackets left-to-right on ONE specific row), as
// opposed to axisSpacing's "which height does each rail go at" (one value per row, across a wall).
// This needs an extra clustering level axisSpacing doesn't do: the same approximate height repeats
// on every wall across a whole facade (a ground-floor rail sits at a similar height everywhere), so
// clustering on wallAxis alone and then reading rowAxis gaps directly - the way axisSpacing's single
// pass works - would merge dozens of unrelated walls' rows into one meaningless mega-row the moment
// their heights happened to be close. Splitting wallAxis (coarse threshold, separates walls/bays)
// and THEN rowAxis (tight threshold, separates individual rail rows within one wall) is the same
// two-pass-by-hand approach this session used throughout: pick one wall, then pick one row in it,
// only then measure gaps along the row's own length.
export function rowSpacing(inserts, { wallAxis = 'x', wallGapThresholdMm = 2000, rowGapThresholdMm = 50, precisionMm = 1 } = {}) {
	if (!['x', 'y'].includes(wallAxis)) throw new Error('wallAxis must be "x" or "y"');
	const rowAxis = wallAxis === 'x' ? 'y' : 'x';
	const round = (value) => Math.round(value / precisionMm) * precisionMm;
	const wallValues = [...new Set(inserts.map((p) => round(p[wallAxis])))];
	if (!wallValues.length) return [];
	const wallClusters = clusterValues(wallValues, wallGapThresholdMm);
	const rows = [];
	for (const wallPositions of wallClusters) {
		const wallMin = wallPositions[0];
		const wallMax = wallPositions[wallPositions.length - 1];
		const wallInserts = inserts.filter((p) => round(p[wallAxis]) >= wallMin && round(p[wallAxis]) <= wallMax);
		const rowValues = [...new Set(wallInserts.map((p) => round(p[rowAxis])))];
		const rowClusters = clusterValues(rowValues, rowGapThresholdMm);
		for (const rowPositions of rowClusters) {
			const rowMin = rowPositions[0];
			const rowMax = rowPositions[rowPositions.length - 1];
			const rowInserts = wallInserts.filter((p) => round(p[rowAxis]) >= rowMin && round(p[rowAxis]) <= rowMax);
			const alongValues = [...new Set(rowInserts.map((p) => round(p[wallAxis])))].sort((a, b) => a - b);
			const gaps = [];
			for (let i = 1; i < alongValues.length; i += 1) gaps.push(Number((alongValues[i] - alongValues[i - 1]).toFixed(1)));
			rows.push({
				wallAxis, rowAxis, wallMin, wallMax, rowMin, rowMax,
				// See axisSpacing's note on count vs insertCount - same distinction here: count is distinct
				// along-row positions, insertCount is actual physical pieces (can exceed count when several
				// block segments round to the same position).
				count: alongValues.length, insertCount: rowInserts.length, positions: alongValues, gaps,
			});
		}
	}
	return rows;
}

// One row per layer: entity-type counts, so the UI can show "FACEB - OSSATURES HZ: 824 INSERT"
// without the user having to know DXF internals to pick the right layer.
export function summarizeLayers(entities) {
	const counts = new Map();
	for (const { type, fields } of entities) {
		const layer = fields[8]?.[0];
		if (!layer) continue;
		const key = `${layer}\u0000${type}`;
		counts.set(key, (counts.get(key) || 0) + 1);
	}
	const byLayer = new Map();
	for (const [key, count] of counts) {
		const [layer, type] = key.split('\u0000');
		if (!byLayer.has(layer)) byLayer.set(layer, { layer, total: 0, byType: {} });
		const entry = byLayer.get(layer);
		entry.byType[type] = count;
		entry.total += count;
	}
	return [...byLayer.values()].sort((a, b) => b.total - a.total);
}
