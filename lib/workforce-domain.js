export const cleanSiret = (value) => String(value || '').replace(/\D/g, '');

export const normalizeProjectIds = (value, projects = []) => {
	const values = Array.isArray(value) ? value : value ? [value] : [];
	const available = new Set((projects || []).map((project) => project.id));
	return [...new Set(values.map((projectId) => String(projectId).trim()).filter((projectId) => available.has(projectId)))];
};

export const workerInitials = (name) => String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?';

export const companyKeyForUser = (user = {}) => {
	const siret = cleanSiret(user.employerSiret || user.siret || '');
	if (siret) return `siret:${siret}`;
	if (user.invitedBy) return `owner:${user.invitedBy}`;
	if (['admin', 'gerant', 'manager'].includes(user.role) && user.id) return `owner:${user.id}`;
	const company = String(user.employerCompany || user.company || '').trim().toLowerCase().replace(/\s+/g, '-');
	return company ? `company:${company}` : `user:${user.id || 'unknown'}`;
};

export const isAllowedIdentityAsset = (file) => {
	if (!file || Number(file.size || 0) > 5 * 1024 * 1024) return false;
	const mime = String(file.mimetype || '').toLowerCase();
	const name = String(file.originalname || '').toLowerCase();
	return (mime === 'image/jpeg' || mime === 'image/png' || /\.(?:jpe?g|png)$/.test(name));
};
