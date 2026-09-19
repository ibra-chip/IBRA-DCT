document.addEventListener('DOMContentLoaded', () => {
	const api = window.location.protocol === 'file:' ? 'http://localhost:3000/api' : `${window.location.origin}/api`;
	const loginModal = document.querySelector('#login-modal');
	const token = () => localStorage.getItem('ibra-auth-token');
	const toast = (message) => { const french = { 'Korisnik je dodat.': 'Utilisateur enregistré.', 'Poruka je sačuvana.': 'Message enregistré.', 'Radno vreme je sačuvano.': 'Temps de travail enregistré.', 'Radno vreme nije sačuvano.': 'Temps de travail non enregistré.', 'Korisnik nije dodat.': 'Utilisateur non enregistré.', 'Trošak nije sačuvan.': 'Dépense non enregistrée.', 'Devis nije sačuvan.': 'Devis non enregistré.', 'Devis i budžet su sačuvani.': 'Devis et budget enregistrés.' }; const translated = french[message] || String(message).replace('Dokument je obrisan.', 'Document supprimé.').replace('Dokument je preimenovan.', 'Document renommé.').replace('Kopija dokumenta je dodata.', 'Copie du document ajoutée.'); const el = document.querySelector('#toast'); el.textContent = translated; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); };
	const formatEUR = (value) => new Intl.NumberFormat('sr-Latn-RS', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
	const translations = { 'Dashboard':'Tableau de bord','Devis':'Devis','Nabavke':'Achats','Chantier kontrole':'Contrôles chantier','RGE / QUALIBAT':'RGE / QUALIBAT','Dokumenti i slike':'Documents et photos','Zadaci i komunikacija':'Tâches et communication','Korisnici':'Utilisateurs','Dokazni paket':'Dossier de preuves','Odjava':'Déconnexion','Kontrola pravilnog izvođenja radova':'Contrôle de la bonne exécution des travaux','Plan, fiche technique, fotografije i potvrda Conducteur-a u jednom toku.':'Plan, fiche technique, photos et validation du Conducteur dans un seul parcours.','Otvorene kontrole':'Contrôles ouverts','Radno vreme':'Temps de travail','Trošak rada ovog meseca':'Coût du travail ce mois-ci','Preostali budžet':'Budget restant','Materijal, alat i mašine':'Matériaux, outils et machines','Radnici':'Travailleurs','Sous-traitance':'Sous-traitance','Nema Devis-a':'Aucun devis','Bez kašnjenja':'Aucun retard','Début de travaux i rok':'Début des travaux et délai','Début de travaux: nije unet':'Début des travaux : non renseigné','Planirani rok: nije unet · Prilagođeni rok: nije izračunat':'Échéance prévue : non renseignée · Échéance ajustée : non calculée','Chantier kontrole':'Contrôles chantier','Dokumenti i slike':'Documents et photos','AIDE RGE / QUALIBAT':'AIDE RGE / QUALIBAT','ITE - znanje, kontrole i odgovori':'ITE - connaissances, contrôles et réponses','Za učenje i chantier provjeru':'Pour apprendre et contrôler le chantier','Pretraga pitanja i odgovora':'Recherche questions/réponses',"Traži po riječi, npr. RGE, pare-vapeur, BAR-EN-102, lame d'air, MaPrimeRenov":"Rechercher par mot-clé, ex. RGE, pare-vapeur, BAR-EN-102, lame d'air, MaPrimeRenov",'Upiši pojam...':'Saisir un terme...','RGE kontrolna lista':'Liste de contrôle RGE','Kompletno znanje po temama':'Connaissance complète par thèmes','Francuski tehnički termini su ostavljeni da odgovaraju RGE/QUALIBAT dokumentaciji.':'Les termes techniques français sont conservés pour correspondre à la documentation RGE/QUALIBAT.' };
	const runtimeFrench = {
		'Nabavke': 'Achats', 'Dokumenti i slike': 'Documents et photos', 'Zadaci i komunikacija': 'Tâches et communication', 'Korisnici': 'Utilisateurs',
		'Rizik chantier-a': 'Risque du chantier', 'KRITIČAN': 'CRITIQUE', 'PAŽNJA': 'ATTENTION', 'STABILAN': 'STABLE',
		'Bez kašnjenja': 'Aucun retard', 'dana kašnjenja': 'jours de retard', 'nije unet': 'non renseigné', 'nije izračunat': 'non calculé', 'Planirani rok:': 'Échéance prévue :', 'Prilagođeni rok:': 'Échéance ajustée :', 'Début de travaux:': 'Début des travaux :',
		'Nema promena.': 'Aucune modification.', 'Nema poruka.': 'Aucun message.', 'Nema troškova.': 'Aucune dépense.', 'Nema sačuvanih dokumenata.': 'Aucun document enregistré.',
		'Kontrola nije ažurirana.': 'Le contrôle n’a pas été mis à jour.', 'Kontrola je ažurirana.': 'Le contrôle a été mis à jour.', 'Završi': 'Terminer', 'Vrati na ispravku': 'Renvoyer pour correction', 'review': 'En revue', 'complete': 'Terminé', 'incomplete': 'Incomplet', 'Dokazni paket': 'Dossier de preuves', 'Nedostaje:': 'Manquants :', 'fiche-technique': 'fiche technique', 'photo-before': 'photo avant travaux', 'photo-during': 'photo pendant les travaux', 'photo-after': 'photo après travaux',
		'Radovi izvedeni prema projektu i pravilima struke': 'Travaux exécutés conformément au projet et aux règles de l’art', 'Bezbednost na gradilištu i zaštitna oprema': 'Sécurité sur le chantier et équipements de protection', 'Materijali, ugradnja i sledljivost': 'Matériaux, mise en œuvre et traçabilité', 'Fotografije i dokazi po fazama rada': 'Photographies et preuves par phase de travaux',
		'Radno vreme je odobreno.': 'Le temps de travail a été approuvé.', 'Radno vreme je odbijeno.': 'Le temps de travail a été refusé.',
		'Radno vreme nije sačuvano.': 'Le temps de travail n’a pas été enregistré.', 'Radno vreme je sačuvano.': 'Le temps de travail a été enregistré.',
		'Poruka nije poslata.': 'Le message n’a pas été envoyé.', 'Poruka je sačuvana.': 'Le message a été enregistré.',
		'Korisnik nije dodat.': 'L’utilisateur n’a pas été ajouté.', 'Korisnik je dodat.': 'L’utilisateur a été ajouté.',
		'Devis nije sačuvan': 'Le devis n’a pas été enregistré', 'Devis i budžet su sačuvani.': 'Le devis et le budget ont été enregistrés.',
		'PDF nije moguće automatski pročitati. Unesi vrednosti ručno.': 'Lecture automatique du PDF impossible. Saisissez les valeurs manuellement.',
		'PDF je pročitan delimično. Proveri označena polja pre čuvanja.': 'Le PDF a été lu partiellement. Vérifiez les champs avant l’enregistrement.',
		'Automatski pročitano iz:': 'Lu automatiquement depuis :', 'Nedostupno': 'Indisponible', 'Nema Devis-a': 'Aucun devis', 'Budžet:': 'Budget :', 'Nabavke:': 'Achats :', 'Rad:': 'Travail :', 'Ukupno potrošeno:': 'Total dépensé :', 'Preostalo:': 'Solde restant :',
		'Učitavanje...': 'Chargement...', 'Učitavanje': 'Chargement', 'Obračun:': 'Calcul :', 'Dani:': 'Jours :', 'Dnevica:': 'Taux journalier :', 'Satnica:': 'Taux horaire :',
		'Čitanje PDF-a...': 'Lecture du PDF...', 'Sačuvaj': 'Enregistrer', 'Dodaj': 'Ajouter', 'Pošalji': 'Envoyer', 'Prijava nije uspela.': 'Échec de la connexion.', 'Prijavljen korisnik': 'Utilisateur connecté', 'Dnevnica:': 'Taux journalier :', 'Nema unosa radnog vremena.': 'Aucune saisie de temps de travail.', 'user': 'Utilisateur', 'worker': 'Ouvrier / artisan', 'manager': 'Manager'
	};
	const translateRuntimeText = () => { if (language !== 'fr') return; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode); nodes.forEach((node) => { let text = node.nodeValue; Object.entries(runtimeFrench).forEach(([source, target]) => { text = text.split(source).join(target); }); if (text !== node.nodeValue) node.nodeValue = text; }); };
	let language = localStorage.getItem('ibra-language') || 'sr';
	let rgeQualibatKnowledge;
	const originalText = new Map();
	document.querySelectorAll('body *').forEach((element) => { if (element.children.length === 0) originalText.set(element, element.textContent); });
	const setLanguage = (next) => { language = next; localStorage.setItem('ibra-language', next); originalText.forEach((text, element) => { element.textContent = next === 'fr' ? (translations[text] || text) : text; }); document.querySelectorAll('.language-button').forEach((button) => button.classList.toggle('active', button.dataset.language === next)); if (rgeQualibatKnowledge) loadRgeQualibat(); };
	document.querySelectorAll('.language-button').forEach((button) => button.addEventListener('click', () => setLanguage(button.dataset.language)));
	setLanguage(language);
	const userForm = document.querySelector('#user-form');
	if (userForm && !userForm.elements.deliveryMethod) {
		const emailInput = userForm.elements.email;
		const phoneInput = userForm.elements.phone;
		const deliveryLabel = document.createElement('label');
		deliveryLabel.innerHTML = 'Način slanja<select name="deliveryMethod" required><option value="email">Email</option><option value="sms">Telefon / SMS</option></select>';
		userForm.insertBefore(deliveryLabel, emailInput.closest('label'));
		const deliverySelect = deliveryLabel.querySelector('select');
		const syncDeliveryFields = () => {
			const emailMode = deliverySelect.value === 'email';
			emailInput.required = emailMode;
			phoneInput.required = !emailMode;
		};
		deliverySelect.addEventListener('change', syncDeliveryFields);
		syncDeliveryFields();
	}
	translateRuntimeText();
	const userRateFields = document.querySelectorAll('.rate-field');
	const userRateObserver = new MutationObserver(() => {
		if (document.querySelector('#user-role')?.value === 'user') userRateFields.forEach((field) => { field.hidden = false; });
	});
	userRateFields.forEach((field) => userRateObserver.observe(field, { attributes: true, attributeFilter: ['hidden'] }));
	new MutationObserver(translateRuntimeText).observe(document.body, { childList: true, subtree: true });
	const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
	const request = async (path, options = {}) => { const response = await fetch(`${api}${path}`, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token()}` } }); if (!response.ok) throw new Error(await response.text()); return response.json(); };
	const ensureSystemStatus = () => {
		if (document.querySelector('#system-status-bar')) return;
		const header = document.querySelector('main > header');
		if (!header) return;
		const bar = document.createElement('div');
		bar.id = 'system-status-bar';
		bar.className = 'system-status-bar';
		bar.innerHTML = '<span id="online-state"></span><span>Cloud memory: Supabase</span><span>AI: Gemini free tier</span><span>Mode: production</span>';
		header.after(bar);
		const sync = () => {
			const online = navigator.onLine;
			const target = bar.querySelector('#online-state');
			target.textContent = online ? 'Online' : 'Offline';
			target.className = online ? 'system-pill online' : 'system-pill offline';
		};
		window.addEventListener('online', sync);
		window.addEventListener('offline', sync);
		sync();
	};
	ensureSystemStatus();
	const showView = (id) => { document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === id)); document.querySelectorAll('.nav').forEach((item) => item.classList.toggle('active', item.dataset.view === id)); document.querySelector('#page-title').textContent = document.querySelector(`[data-view="${id}"]`)?.textContent || 'IBRA-BA'; };
	const applyRole = (role) => {
		const access = {
			admin: ['dashboard-view','devis-view','purchases-view','chantier-view','rge-help-view','evidence-summary-view','documents-view','tasks-view','settings-view'],
			gerant: ['dashboard-view','devis-view','purchases-view','chantier-view','rge-help-view','evidence-summary-view','documents-view','tasks-view','settings-view'],
			manager: ['dashboard-view','devis-view','purchases-view','chantier-view','rge-help-view','evidence-summary-view','documents-view','tasks-view','settings-view'],
			conducteur: ['dashboard-view','devis-view','purchases-view','chantier-view','rge-help-view','evidence-summary-view','documents-view','tasks-view'],
			worker: ['dashboard-view','chantier-view','rge-help-view','evidence-summary-view','documents-view','tasks-view'],
			user: ['dashboard-view','chantier-view','rge-help-view','evidence-summary-view','documents-view','tasks-view']
		};
		const allowed = access[role] || ['dashboard-view','tasks-view'];
		document.querySelectorAll('.nav').forEach((item) => { item.hidden = !allowed.includes(item.dataset.view); });
		const canSeeFinancials = ['admin', 'gerant', 'manager'].includes(role);
		document.querySelector('#budget-card')?.toggleAttribute('hidden', !canSeeFinancials);
		document.querySelector('#payroll-card')?.toggleAttribute('hidden', !canSeeFinancials);
		if (!allowed.includes(document.querySelector('.view.active')?.id)) showView(allowed[0]);
	};
	document.querySelectorAll('.nav').forEach((button) => button.addEventListener('click', async () => { showView(button.dataset.view); if (button.dataset.view === 'devis-view' && currentUser) await loadBudget(); if (button.dataset.view === 'rge-help-view') await loadRgeQualibat(); }));

	async function loadDashboard() {
		const controls = await request('/projects/lot-a/chantier-controls');
		document.querySelector('#open-controls').textContent = controls.filter((item) => item.status !== 'complete').length;
		const schedule = await request('/projects/lot-a/schedule'); const financial = await request('/projects/lot-a/financial-summary'); const missingEvidence = (await request('/projects/lot-a/evidence-summary')).missing.length; const openControls = controls.filter((item) => item.status !== 'complete').length; const red = openControls >= 3 || missingEvidence >= 4 || (financial.budgetStatus === 'available' && financial.remaining < 0); const orange = !red && (openControls > 0 || missingEvidence > 0 || schedule.delayDays > 0); const risk = document.querySelector('#project-risk-card'); risk.classList.remove('risk-red','risk-orange','risk-green'); risk.classList.add(red ? 'risk-red' : orange ? 'risk-orange' : 'risk-green'); document.querySelector('#project-risk').textContent = red ? 'KRITIČAN' : orange ? 'PAŽNJA' : 'STABILAN';
		const canUpdate = ['admin', 'gerant', 'manager', 'conducteur', 'quality'].includes(currentUser?.role);
		document.querySelector('#controls').innerHTML = controls.map((item) => `<div class="list-item ${item.status === 'complete' ? 'ok' : item.status === 'incomplete' ? 'bad' : 'warn'}"><strong>${item.name}</strong><small>${item.owner} · ${item.status}</small>${canUpdate ? `<div class="control-actions"><button class="secondary control-action" data-control="${item.id}" data-status="complete">Završi</button><button class="secondary control-action" data-control="${item.id}" data-status="incomplete">Vrati na ispravku</button></div>` : ''}</div>`).join('');
		document.querySelectorAll('.control-action').forEach((button) => button.addEventListener('click', async () => { try { await request(`/chantier-controls/${button.dataset.control}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status: button.dataset.status }) }); await loadDashboard(); await loadEvidenceSummary(); await loadControlHistory(); toast('Kontrola je ažurirana.'); } catch (error) { try { const details = JSON.parse(error.message); toast(details.missing ? `Nedostaje dokaz: ${details.missing.join(', ')}` : 'Kontrola nije ažurirana.'); } catch { toast('Kontrola nije ažurirana.'); } } }));
	}
		async function loadEvidenceSummary() { 
			const result = await request('/projects/lot-a/evidence-summary'); 
			const panel = document.querySelector('#evidence-summary'); 
			panel.classList.toggle('complete', result.complete); 
			panel.classList.toggle('incomplete', !result.complete); 
			panel.innerHTML = `<h3>Dokazni paket</h3><p>${result.complete ? 'Kompletan dokazni lanac.' : `<strong>Nedostaje:</strong> ${result.missing.join(', ')}`}</p>`; 
		}
	async function loadRgeQualibat() {
		const questionsTarget = document.querySelector('#rge-questions');
		const checklistTarget = document.querySelector('#rge-checklist');
		const modulesTarget = document.querySelector('#rge-modules');
		if (!questionsTarget || !checklistTarget || !modulesTarget) return;
		if (!rgeQualibatKnowledge) {
			const response = await fetch('/knowledge-base/rge-qualibat-ite.json', { cache: 'no-store' });
			if (!response.ok) throw new Error('RGE knowledge unavailable');
			rgeQualibatKnowledge = await response.json();
			document.querySelector('#rge-search')?.addEventListener('input', loadRgeQualibat);
		}
		const french = language === 'fr';
		const localized = (item, field) => french ? (item[`${field}Fr`] || item[field]) : item[field];
		const query = document.querySelector('#rge-search')?.value?.trim().toLowerCase() || '';
		const questions = (rgeQualibatKnowledge.questions || []).filter((item) => !query || `${item.question} ${item.answer} ${item.questionFr || ''} ${item.answerFr || ''}`.toLowerCase().includes(query));
		questionsTarget.innerHTML = questions.length ? questions.map((item) => `<div class="list-item"><strong>${escapeHtml(localized(item, 'question'))}</strong><small>${escapeHtml(localized(item, 'answer'))}</small></div>`).join('') : `<small>${french ? 'Aucun résultat pour ce terme.' : 'Nema rezultata za taj pojam.'}</small>`;
		const checklist = french ? (rgeQualibatKnowledge.checklistFr || rgeQualibatKnowledge.checklist) : rgeQualibatKnowledge.checklist;
		checklistTarget.innerHTML = (checklist || []).map((item) => `<div class="list-item ok"><strong>${escapeHtml(item)}</strong></div>`).join('');
		modulesTarget.innerHTML = (rgeQualibatKnowledge.modules || []).map((module) => { const items = french ? (module.itemsFr || module.items) : module.items; return `<article class="rge-module"><h3>${escapeHtml(localized(module, 'title'))}</h3><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></article>`; }).join('');
	}
	async function loadControlHistory() { const history = await request('/projects/lot-a/control-history'); const target = document.querySelector('#control-history'); target.innerHTML = history.length ? history.slice().reverse().map((item) => `<div class="list-item"><strong>${item.from} → ${item.to}</strong><small>${item.controlId} · ${item.changedBy} · ${new Date(item.changedAt).toLocaleString()}</small></div>`).join('') : '<small>Nema promena.</small>'; }
	async function loadUsers() { const users = await request('/contacts'); const managerView = ['admin', 'gerant', 'manager'].includes(currentUser?.role); document.querySelector('#users').innerHTML = users.map((user) => `<div class="list-item"><strong>${user.name}</strong><small>${user.role} · ${user.email || 'bez e-maila'} · ${user.phone || 'bez telefona'}${user.siret ? ` · SIRET: ${user.siret}` : ''}${user.company ? ` · ${user.company}` : ''}${managerView && (user.dailyRate || user.hourlyRate) ? ` · Dnevno: ${formatEUR(user.dailyRate)} · Satnica: ${formatEUR(user.hourlyRate)}` : ''}</small></div>`).join(''); const recipient = document.querySelector('#recipient'); recipient.innerHTML = users.filter((user) => user.id !== currentUser.id).map((user) => `<option value="${user.id}">${user.name} · ${user.role}</option>`).join(''); }
	function ensureRendezvousForm() { if (document.querySelector('#rendezvous-form')) return; const panel = document.querySelector('#tasks-view .panel'); if (!panel) return; const form = document.createElement('form'); form.id = 'rendezvous-form'; form.innerHTML = `<h3>Demander un rendez-vous chantier</h3><small>La demande doit être faite entre 7 et 2 jours avant le rendez-vous. Tous les membres du chantier, y compris le Conducteur, seront informés.</small><label>Date du rendez-vous<input name="date" type="date" required /></label><label>Heure<input name="time" type="time" required /></label><label>Date d’absence<input name="absenceDate" type="date" required /></label><label>Motif<textarea name="reason" required></textarea></label><button class="secondary" type="submit">Envoyer la demande de rendez-vous</button>`; panel.append(form); form.addEventListener('submit', async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(form).entries()); values.projectId = 'lot-a'; try { await request('/rendezvous', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); form.reset(); await loadMessages(); toast('La demande a été enregistrée et transmise à toute l’équipe.'); } catch (error) { toast(`Rendez-vous non enregistré : ${error.message || 'erreur inconnue'}`); } }); }
	async function loadRendezvous() { const items = await request('/rendezvous'); const panel = document.querySelector('#tasks-view .panel'); if (!panel) return; const target = document.querySelector('#rendezvous-list') || (() => { const element = document.createElement('div'); element.id = 'rendezvous-list'; element.className = 'list'; panel.append(element); return element; })(); target.innerHTML = items.length ? `<h3>Rendez-vous enregistrés</h3>${items.slice().sort((first, second) => `${first.date} ${first.time}`.localeCompare(`${second.date} ${second.time}`)).map((item) => `<div class="list-item"><strong>${item.date} · ${item.time}</strong><small>Absence le ${item.absenceDate} · ${item.workerName}</small><div>${item.reason}</div></div>`).join('')}` : '<small>Aucun rendez-vous enregistré.</small>'; }
	async function loadMessages() { ensureRendezvousForm(); const messages = await request('/messages'); document.querySelector('#messages').innerHTML = messages.length ? messages.map((item) => `<div class="list-item"><strong>${item.senderName} → ${item.recipientName}</strong><div>${item.text}</div><small>${item.projectId} · ${new Date(item.createdAt).toLocaleString()}</small></div>`).join('') : '<small>Nema poruka.</small>'; await loadRendezvous(); }
	function ensurePayoutPanel() { if (document.querySelector('#payout-form')) return; const panel = document.querySelector('#tasks-view .panel'); if (!panel) return; const section = document.createElement('section'); section.className = 'panel payout-panel'; section.innerHTML = `<div class="section-head"><div><h2>Demandes de paiement</h2><small>Les jours sont envoyés le 1er du mois. Le paiement est prévu le 15.</small></div></div><form id="payout-form"><label>Mois à payer<input name="month" type="month" required /></label><label>Nombre de jours à payer<input name="days" type="number" min="0" step="1" required /></label><button class="primary" type="submit">Envoyer la demande au Gérant</button></form><div id="payout-list" class="list"></div></section>`; section.querySelector('#payout-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await request('/payout-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) }); event.currentTarget.reset(); await loadPayouts(); toast('La demande du 1er a été envoyée au Gérant. Paiement prévu le 15.'); } catch (error) { toast(`Demande non enregistrée : ${error.message || 'erreur inconnue'}`); } }); panel.after(section); }
	async function loadPayouts() { ensurePayoutPanel(); const items = await request('/payout-requests'); const target = document.querySelector('#payout-list'); if (!target) return; const managerView = ['admin', 'gerant', 'manager'].includes(currentUser?.role); target.innerHTML = items.length ? `<h3>${managerView ? 'Demandes reçues' : 'Mes demandes'}</h3>${items.slice().reverse().map((item) => `<div class="list-item"><strong>${item.month} · ${item.userName} · ${item.days} jours</strong><small>${managerView ? `${formatEUR(item.amount)} · ` : ''}Demande le ${item.submissionDate} · Paiement le ${item.paymentDate} · ${item.status}</small>${managerView && item.status === 'pending' ? `<button class="secondary payout-status" data-payout="${item.id}" data-status="approved">Approuver</button><button class="secondary payout-status" data-payout="${item.id}" data-status="rejected">Refuser</button>` : ''}</div>`).join('')}` : '<small>Aucune demande de paiement.</small>'; document.querySelectorAll('.payout-status').forEach((button) => button.addEventListener('click', async () => { await request(`/payout-requests/${button.dataset.payout}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: button.dataset.status }) }); await loadPayouts(); })); }
	const pointDistance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
	const polygonArea3d = (points) => {
		if (points.length < 3) return 0;
		const origin = points[0];
		let area = 0;
		for (let index = 1; index < points.length - 1; index += 1) {
			const a = { x: points[index].x - origin.x, y: points[index].y - origin.y, z: points[index].z - origin.z };
			const b = { x: points[index + 1].x - origin.x, y: points[index + 1].y - origin.y, z: points[index + 1].z - origin.z };
			area += Math.hypot(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x) / 2;
		}
		return area;
	};
	async function startArMeter(form, status) {
		const unit = form.elements.quantityUnit.value;
		if (!navigator.xr) { status.textContent = 'AR metar nije dostupan u ovom browseru. Probajte Android Chrome sa ARCore; na iPhone web AR mjerenje je ograniceno.'; return; }
		const supported = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
		if (!supported) { status.textContent = 'Telefon/browser ne podrzava WebXR AR mjerenje. Probajte Android Chrome sa Google Play Services for AR.'; return; }
		const overlay = document.createElement('div');
		overlay.className = 'ar-meter-overlay';
		overlay.innerHTML = `<canvas></canvas><div class="ar-meter-panel"><strong>AR metar - ${unit}</strong><small>${unit === 'ml' ? 'Dotaknite tacke po liniji/profilu. Minimum 2 tacke.' : 'Dotaknite uglove povrsine redom. Minimum 3 tacke.'}</small><span id="ar-meter-count">0 tacki</span><button class="primary" id="ar-meter-finish" type="button">Koristi mjeru</button><button class="secondary" id="ar-meter-cancel" type="button">Zatvori</button></div>`;
		document.body.append(overlay);
		const canvas = overlay.querySelector('canvas');
		const gl = canvas.getContext('webgl', { xrCompatible: true, alpha: true, antialias: true });
		const points = [];
		let session;
		let hitTestSource;
		let localReferenceSpace;
		let latestHitPose;
		const count = overlay.querySelector('#ar-meter-count');
		const close = async () => { if (session) await session.end().catch(() => {}); overlay.remove(); };
		try {
			await gl.makeXRCompatible();
			session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test', 'dom-overlay'], domOverlay: { root: overlay } });
			session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
			localReferenceSpace = await session.requestReferenceSpace('local');
			const viewerSpace = await session.requestReferenceSpace('viewer');
			hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
			session.addEventListener('end', () => overlay.remove());
			const onFrame = (_time, frame) => {
				session.requestAnimationFrame(onFrame);
				const pose = frame.getViewerPose(localReferenceSpace);
				const layer = session.renderState.baseLayer;
				gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
				gl.clearColor(0, 0, 0, 0);
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
				if (!pose || !hitTestSource) return;
				const hits = frame.getHitTestResults(hitTestSource);
				latestHitPose = hits[0]?.getPose(localReferenceSpace);
			};
			session.requestAnimationFrame(onFrame);
			overlay.addEventListener('pointerdown', (event) => {
				if (event.target.closest('button') || !latestHitPose) return;
				const matrix = latestHitPose.transform.matrix;
				points.push({ x: matrix[12], y: matrix[13], z: matrix[14] });
				count.textContent = `${points.length} tacki`;
			});
			overlay.querySelector('#ar-meter-cancel').addEventListener('click', close);
			overlay.querySelector('#ar-meter-finish').addEventListener('click', async () => {
				const value = unit === 'ml' ? points.slice(1).reduce((sum, point, index) => sum + pointDistance(points[index], point), 0) : polygonArea3d(points);
				if (!Number.isFinite(value) || value <= 0 || (unit === 'ml' && points.length < 2) || (unit === 'm2' && points.length < 3)) { count.textContent = unit === 'ml' ? 'Treba najmanje 2 tacke.' : 'Treba najmanje 3 tacke.'; return; }
				form.elements.quantity.value = value.toFixed(2);
				form.elements.quantityM2.value = unit === 'm2' ? value.toFixed(2) : '';
				form.elements.m2Source.value = `ar-${unit}`;
				status.textContent = `AR mjera: ${value.toFixed(2)} ${unit}. Sada slikajte posao kao dokaz i sacuvajte izvjestaj.`;
				await close();
				if (!form.elements.photo.files.length) form.elements.photo.click();
			});
		} catch (error) {
			overlay.remove();
			status.textContent = `AR metar nije pokrenut: ${error.message || 'browser nije dozvolio AR'}.`;
		}
	}
	function startPhotoMeter(form, status) {
		const file = form.elements.photo.files[0];
		const unit = form.elements.quantityUnit.value;
		if (!file) { status.textContent = 'Prvo izaberite ili uploadujte sliku koju hocete mjeriti.'; form.elements.photo.click(); return; }
		const image = new Image();
		const url = URL.createObjectURL(file);
		const overlay = document.createElement('div');
		overlay.className = 'photo-meter-overlay';
		overlay.innerHTML = `<canvas></canvas><div class="ar-meter-panel"><strong>Mjerenje iz uploadovane slike - ${unit}</strong><small>1) Upišite poznatu mjeru sa plana ili elementa. 2) Kliknite dvije tačke te poznate mjere. 3) Kliknite ${unit === 'ml' ? 'tačke linije/profila' : 'uglove površine'}.</small><label>Poznata mjera u metrima<input id="photo-meter-reference" type="number" min="0.01" step="0.01" placeholder="npr. 2.50" /></label><span id="photo-meter-status">Referenca: 0/2 tacke</span><button class="secondary" id="photo-meter-reset" type="button">Ponovi tacke</button><button class="primary" id="photo-meter-finish" type="button">Koristi mjeru</button><button class="secondary" id="photo-meter-cancel" type="button">Zatvori</button></div>`;
		document.body.append(overlay);
		const canvas = overlay.querySelector('canvas');
		const context = canvas.getContext('2d');
		const referencePoints = [];
		const measurePoints = [];
		const meterStatus = overlay.querySelector('#photo-meter-status');
		const close = () => { URL.revokeObjectURL(url); overlay.remove(); };
		const fit = () => {
			if (canvas.width !== window.innerWidth) canvas.width = window.innerWidth;
			if (canvas.height !== window.innerHeight) canvas.height = window.innerHeight;
			const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
			return { scale, x: (canvas.width - image.width * scale) / 2, y: (canvas.height - image.height * scale) / 2 };
		};
		const imagePoint = (event) => {
			const rect = canvas.getBoundingClientRect();
			const fitData = fit();
			return { x: (event.clientX - rect.left - fitData.x) / fitData.scale, y: (event.clientY - rect.top - fitData.y) / fitData.scale };
		};
		const distance2d = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);
		const polygonArea2d = (points) => Math.abs(points.reduce((sum, point, index) => {
			const next = points[(index + 1) % points.length];
			return sum + point.x * next.y - next.x * point.y;
		}, 0)) / 2;
		const drawPoint = (point, color) => {
			const fitData = fit();
			context.beginPath();
			context.arc(fitData.x + point.x * fitData.scale, fitData.y + point.y * fitData.scale, 5, 0, Math.PI * 2);
			context.fillStyle = color;
			context.fill();
		};
		const drawLine = (points, color, closePath = false) => {
			if (points.length < 2) return;
			const fitData = fit();
			context.beginPath();
			points.forEach((point, index) => {
				const x = fitData.x + point.x * fitData.scale;
				const y = fitData.y + point.y * fitData.scale;
				if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
			});
			if (closePath) context.closePath();
			context.strokeStyle = color;
			context.lineWidth = 3;
			context.stroke();
		};
		const render = () => {
			const fitData = fit();
			context.clearRect(0, 0, canvas.width, canvas.height);
			context.drawImage(image, fitData.x, fitData.y, image.width * fitData.scale, image.height * fitData.scale);
			drawLine(referencePoints, '#f4c86f');
			drawLine(measurePoints, '#31d3a4', unit === 'm2' && measurePoints.length > 2);
			referencePoints.forEach((point) => drawPoint(point, '#f4c86f'));
			measurePoints.forEach((point) => drawPoint(point, '#31d3a4'));
			meterStatus.textContent = referencePoints.length < 2 ? `Referenca: ${referencePoints.length}/2 tacke` : `Mjerenje: ${measurePoints.length} tacki`;
		};
		canvas.addEventListener('pointerdown', (event) => {
			if (event.target.closest('button,label,input')) return;
			const point = imagePoint(event);
			if (point.x < 0 || point.y < 0 || point.x > image.width || point.y > image.height) return;
			if (referencePoints.length < 2) referencePoints.push(point); else measurePoints.push(point);
			render();
		});
		overlay.querySelector('#photo-meter-reset').addEventListener('click', () => { referencePoints.length = 0; measurePoints.length = 0; render(); });
		overlay.querySelector('#photo-meter-cancel').addEventListener('click', close);
		overlay.querySelector('#photo-meter-finish').addEventListener('click', () => {
			const referenceLength = Number(overlay.querySelector('#photo-meter-reference').value);
			if (!Number.isFinite(referenceLength) || referenceLength <= 0) { meterStatus.textContent = 'Upisite poznatu mjeru u metrima.'; return; }
			if (referencePoints.length < 2) { meterStatus.textContent = 'Kliknite dvije tacke poznate mjere.'; return; }
			if ((unit === 'ml' && measurePoints.length < 2) || (unit === 'm2' && measurePoints.length < 3)) { meterStatus.textContent = unit === 'ml' ? 'Za ml kliknite najmanje 2 tacke.' : 'Za m2 kliknite najmanje 3 ugla.'; return; }
			const scale = referenceLength / distance2d(referencePoints[0], referencePoints[1]);
			const value = unit === 'ml' ? measurePoints.slice(1).reduce((sum, point, index) => sum + distance2d(measurePoints[index], point), 0) * scale : polygonArea2d(measurePoints) * scale * scale;
			form.elements.quantity.value = value.toFixed(2);
			form.elements.quantityM2.value = unit === 'm2' ? value.toFixed(2) : '';
			form.elements.m2Source.value = `photo-calibrated-${unit}`;
			status.textContent = `Mjera iz slike: ${value.toFixed(2)} ${unit}. Kalibracija: ${referenceLength} m. Sacuvajte izvjestaj ako je tacno.`;
			close();
		});
		window.addEventListener('resize', render, { once: true });
		image.onload = render;
		image.src = url;
	}
	function ensureProductionPanel() {
		if (document.querySelector('#production-form')) return;
		const panel = document.querySelector('#tasks-view .panel');
		if (!panel) return;
		const section = document.createElement('section');
		section.className = 'panel production-panel';
		section.innerHTML = `<div class="section-head production-head"><div><small>PRODUCTION CHANTIER</small><h2>Production et situations</h2><p>Photo preuve, mesure m2/ml, GPS et validation avant situation.</p></div><span class="status">Validation requise</span></div><form id="production-form" class="production-form"><div class="production-grid"><fieldset><legend>1. Preuve photo</legend><label>Photo du travail realise<input name="photo" type="file" accept="image/*" required /></label><label>Date<input name="date" type="date" required /></label></fieldset><fieldset><legend>2. Mesure</legend><label>Unite a calculer<select name="quantityUnit"><option value="m2">m2 - surface</option><option value="ml">ml - metre lineaire</option></select></label><div class="measure-actions"><button class="secondary" id="estimate-area" type="button">Estimer avec l'IA</button><button class="secondary" id="ar-meter" type="button">Mesurer avec camera AR</button><button class="secondary" id="photo-meter" type="button">Mesurer une photo uploadée</button></div><small id="area-estimate-status">IA utilise les plans/fiches. AR mesure en direct. Photo uploadée se mesure avec une calibration connue.</small></fieldset><fieldset><legend>3. Travaux</legend><label>Description des travaux<input name="description" required /></label><label><span data-quantity-label>Quantite IA ou AR</span><input name="quantity" type="number" min="0" step="0.01" value="" required readonly /></label><input name="quantityM2" type="hidden" value="" /></fieldset><fieldset><legend>4. Prix</legend><label><span data-rate-label>Prix par unite EUR</span><input name="unitRate" type="number" min="0" step="0.01" required /></label><small>La validation humaine du Conducteur ou du Gerant reste obligatoire avant la Situation.</small></fieldset></div><button class="primary production-submit" type="submit">Enregistrer la production</button></form><div class="production-results"><div id="production-summary" class="list"></div><div id="production-reports" class="list"></div></div>`;
		panel.after(section);
		const form = section.querySelector('#production-form');
		const quantityInput = form.elements.quantity;
		const updateUnitLabels = () => {
			const unit = form.elements.quantityUnit.value;
			section.querySelector('[data-quantity-label]').textContent = unit === 'ml' ? 'Longueur IA ou AR (ml)' : 'Surface IA ou AR (m2)';
			section.querySelector('[data-rate-label]').textContent = unit === 'ml' ? 'Prix par ml EUR' : 'Prix par m2 EUR';
			section.querySelector('#estimate-area').textContent = unit === 'ml' ? 'Estimer les ml avec l’IA' : 'Estimer les m2 avec l’IA';
		};
		form.elements.quantityUnit.addEventListener('change', () => { quantityInput.value = ''; form.elements.quantityM2.value = ''; form.elements.m2Source.value = ''; updateUnitLabels(); });
		updateUnitLabels();
		section.querySelector('#ar-meter').addEventListener('click', () => startArMeter(form, section.querySelector('#area-estimate-status')));
		section.querySelector('#photo-meter').addEventListener('click', () => startPhotoMeter(form, section.querySelector('#area-estimate-status')));
		section.querySelector('#estimate-area').addEventListener('click', async () => {
			const file = form.elements.photo.files[0];
			const unit = form.elements.quantityUnit.value;
			const status = section.querySelector('#area-estimate-status');
			if (!file) { status.textContent = "Selectionnez d'abord une photo."; return; }
			const body = new FormData();
			body.append('photo', file, file.name);
			body.append('quantityUnit', unit);
			body.append('projectId', 'lot-a');
			status.textContent = unit === 'ml' ? 'Analyse de la longueur visible avec plans du chantier...' : 'Analyse de la surface visible avec plans du chantier...';
			try {
				const result = await fetch(`${api}/ai/estimate-area`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body }).then(async (response) => { if (!response.ok) throw new Error(await response.text()); return response.json(); });
				if (result.estimatedQuantity === null || result.estimatedQuantity === undefined) { status.textContent = result.answer; return; }
				quantityInput.value = result.estimatedQuantity;
				form.elements.quantityM2.value = unit === 'm2' ? result.estimatedQuantity : '';
				form.elements.m2Source.value = `ai-${unit}`;
				status.textContent = `Proposition IA : ${result.estimatedQuantity} ${unit}. Confiance ${Math.round(Number(result.confidence || 0) * 100)}%. Verifiez et confirmez avant l'enregistrement. ${result.answer || ''}`;
			} catch (error) {
				status.textContent = `Estimation indisponible : ${error.message || 'erreur inconnue'}`;
			}
		});
		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			const body = new FormData(form);
			body.append('projectId', 'lot-a');
			try {
				const response = await fetch(`${api}/work-reports`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
				if (!response.ok) throw new Error(await response.text());
				form.reset();
				updateUnitLabels();
				await loadProduction();
				toast('La production a ?t? enregistr?e pour validation.');
			} catch (error) {
				toast(`Production non enregistr?e : ${error.message || 'erreur inconnue'}`);
			}
		});
	}
	function ensureCaptureMetadata() {
		const form = document.querySelector('#production-form');
		if (!form || document.querySelector('#capture-metadata')) return;
		const block = document.createElement('div');
		block.id = 'capture-metadata';
		block.innerHTML = `<input name="capturedAt" type="hidden" /><input name="latitude" type="hidden" /><input name="longitude" type="hidden" /><input name="m2Source" type="hidden" value="" /><label>Heure de la photo<input name="captureTime" type="time" required /></label><label>Lieu de la photo<input name="locationName" placeholder="Autorisation GPS requise" required /></label><small id="capture-status">La photo doit avoir une date, une heure et une position GPS.</small>`;
		form.querySelector('fieldset')?.append(block);
		const quantityInput = form.elements.quantity;
		form.elements.photo.addEventListener('change', () => {
			const now = new Date();
			form.elements.capturedAt.value = now.toISOString();
			form.elements.captureTime.value = now.toTimeString().slice(0, 5);
			form.elements.m2Source.value = '';
			form.elements.quantityM2.value = '';
			quantityInput.value = '';
			const status = block.querySelector('#capture-status');
			if (!navigator.geolocation) { status.textContent = 'GPS indisponible sur cet appareil.'; return; }
			status.textContent = 'Obtention de la position GPS...';
			navigator.geolocation.getCurrentPosition((position) => {
				form.elements.latitude.value = position.coords.latitude;
				form.elements.longitude.value = position.coords.longitude;
				if (!form.elements.locationName.value) form.elements.locationName.value = `GPS ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
				status.textContent = `Photo captur?e le ${now.toLocaleDateString('fr-FR')} ? ${form.elements.captureTime.value}, avec position GPS.`;
			}, () => { status.textContent = 'Autorisez la localisation pour enregistrer la photo.'; }, { enableHighAccuracy: true, timeout: 10000 });
		});
	}
	async function loadProduction() {
		ensureProductionPanel();
		ensureCaptureMetadata();
		const reports = await request('/work-reports');
		const today = new Date().toISOString().slice(0, 10);
		const summary = await request(`/projects/lot-a/situation-summary?date=${today}`);
		const summaryTarget = document.querySelector('#production-summary');
		const reportTarget = document.querySelector('#production-reports');
		if (!summaryTarget || !reportTarget) return;
		const managerView = ['admin', 'gerant', 'manager'].includes(currentUser?.role);
		const quantityLabel = (item) => `${Number(item.quantity ?? item.quantityM2 ?? 0).toFixed(2)} ${item.quantityUnit || 'm2'}`;
		const workerTotals = summary.byWorker?.map((item) => `${item.workerName}: ${Number(item.quantityM2 || 0).toFixed(2)} m2 ? ${Number(item.quantityMl || 0).toFixed(2)} ml${managerView ? ` ? ${formatEUR(item.amount)}` : ''}`).join(' | ') || 'Aucun detail par utilisateur';
		summaryTarget.innerHTML = `<div class="list-item"><strong>Situation du ${today}</strong><small>${summary.reportCount} rapport(s) approuve(s) ? ${Number(summary.quantityM2 || 0).toFixed(2)} m2 ? ${Number(summary.quantityMl || 0).toFixed(2)} ml${managerView ? ` ? ${formatEUR(summary.amount)}` : ''}</small><small>${workerTotals}</small><small>Calcul base uniquement sur les rapports approuves. Validation humaine requise.</small></div>`;
		const canReview = ['admin', 'gerant', 'manager', 'conducteur'].includes(currentUser?.role);
		reportTarget.innerHTML = reports.length ? `<h3>Rapports de production</h3>${reports.slice().reverse().map((item) => `<div class="list-item"><strong>${item.date} ? ${item.workerName} ? ${quantityLabel(item)}</strong><small>${item.description} ? ${managerView ? `${formatEUR(item.calculatedAmount)} ? ` : ''}${item.status} ? ${item.aiStatus} ? ${item.capturedAt} ? ${item.locationName}</small>${canReview && item.status === 'pending' ? `<button class="secondary production-status" data-report="${item.id}" data-status="approved">Approuver</button><button class="secondary production-status" data-report="${item.id}" data-status="rejected">Refuser</button>` : ''}</div>`).join('')}` : '<small>Aucun rapport de production.</small>';
		document.querySelectorAll('.production-status').forEach((button) => button.addEventListener('click', async () => { await request(`/work-reports/${button.dataset.report}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: button.dataset.status }) }); await loadProduction(); }));
	}
	async function loadWorkSequence() { const panel = document.querySelector('.ai-panel'); if (!panel || document.querySelector('#work-sequence')) return; const section = document.createElement('div'); section.id = 'work-sequence'; section.className = 'list'; section.innerHTML = '<h3>Ordre des travaux selon les plans</h3><small>Analyse de la documentation...</small>'; panel.append(section); try { const result = await request('/projects/lot-a/work-sequence'); section.innerHTML = `<h3>Ordre des travaux selon les plans</h3><small>${result.answer}</small>${result.steps?.length ? result.steps.map((step) => `<div class="list-item"><strong>${step.order}. ${step.title}</strong><small>${step.instruction} · Preuve requise : ${step.requiredEvidence || 'à confirmer'} · Source : ${step.sourcePage || 'à confirmer'}</small></div>`).join('') : '<small>La séquence ne peut pas être affichée sans documentation source et configuration AI.</small>'}`; } catch { section.innerHTML = '<h3>Ordre des travaux selon les plans</h3><small>Analyse indisponible. Ajoutez un plan ou une fiche technique PDF.</small>'; } }
	function renderAutoAnalysis(target, analysis) {
		if (!target || !analysis) return false;
		const french = language === 'fr';
		const section = (title, items) => items?.length ? `<div class="auto-analysis-section"><strong>${escapeHtml(title)}</strong><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : '';
		target.innerHTML = `<div class="list-item auto-analysis"><strong>${french ? 'Analyse automatique' : 'Automatska analiza'} · ${escapeHtml(analysis.workType)}</strong><small>${french ? 'Confiance' : 'Sigurnost'}: ${Math.round(Number(analysis.confidence || 0) * 100)}% · ${escapeHtml(analysis.fileName || '')}</small>${section(french ? 'Système' : 'Sistem', analysis.systems)}${section(french ? 'Matériaux détectés' : 'Prepoznati materijali', analysis.materials)}${section(french ? 'Comment exécuter' : 'Kako se radi', analysis.howTo)}${section(french ? 'Contrôles' : 'Šta kontrolisati', analysis.controls)}${section(french ? 'Preuves photos' : 'Šta slikati kao dokaz', analysis.evidence)}${section(french ? 'Risques / à confirmer' : 'Rizici / šta potvrditi', analysis.risks)}</div>`;
		return true;
	}
	async function loadTime() { const entries = await request('/time-entries'); const hours = entries.reduce((sum, item) => sum + Number(item.hours || 0), 0); const own = await request('/my-payroll-summary'); document.querySelector('#total-hours').textContent = `${hours.toFixed(2)} h`; const rates = document.querySelector('#time-rates') || (() => { const element = document.createElement('div'); element.id = 'time-rates'; document.querySelector('#time-summary').before(element); return element; })(); rates.textContent = `Dnevnica: ${formatEUR(own.dailyRate)} · Satnica: ${formatEUR(own.hourlyRate)}`; document.querySelector('#time-summary').textContent = `${own.hours.toFixed(2)} h`; document.querySelector('#time-days').textContent = `Dani: ${own.days}`; document.querySelector('#time-money').textContent = `Obračun: ${formatEUR(own.estimatedTotal)}`; const canApprove = ['admin','gerant','manager','conducteur'].includes(currentUser?.role); document.querySelector('#time-entries').innerHTML = entries.length ? entries.map((item) => `<div class="list-item"><strong>${item.workerName} · ${item.hours.toFixed(2)} h</strong><small>${item.date} · ${item.start}-${item.end} · ${item.status}</small>${canApprove && item.status === 'pending' ? `<button class="secondary approve-time" data-time="${item.id}" data-status="approved">Odobri</button><button class="secondary approve-time" data-time="${item.id}" data-status="rejected">Odbij</button>` : ''}</div>`).join('') : '<small>Nema unosa radnog vremena.</small>'; document.querySelectorAll('.approve-time').forEach((button) => button.addEventListener('click', async () => { await request(`/time-entries/${button.dataset.time}/status`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status:button.dataset.status }) }); await loadTime(); await loadPayroll(); toast(button.dataset.status === 'approved' ? 'Radno vreme je odobreno.' : 'Radno vreme je odbijeno.'); })); }
	async function loadPayroll() { try { const result = await request('/payroll/summary'); document.querySelector('#payroll-total').textContent = `${Number(result.total || 0).toFixed(2)} EUR`; } catch { document.querySelector('#payroll-total').textContent = 'Nedostupno'; } }
	async function loadFinancialSummary() { try { const result = await request('/projects/lot-a/financial-summary'); document.querySelector('#budget-remaining').textContent = result.budgetStatus === 'available' ? `${Number(result.remaining).toFixed(2)} EUR` : 'Nema Devis-a'; } catch { document.querySelector('#budget-remaining').textContent = 'Nedostupno'; } }
	document.querySelector('#ai-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const target = document.querySelector('#ai-answer'); target.innerHTML = '<small>Analiza dokumentacije...</small>'; try { const result = await request('/ai/technical-answer', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ projectId:'lot-a', question:new FormData(form).get('question'), responseLanguage: language }) }); target.innerHTML = `<div class="list-item"><strong>${result.status}</strong><div>${result.answer}</div><small>${result.sources?.map((source) => `${source.file} · strana ${source.page}`).join(' | ') || 'Bez izvora'}</small></div>`; } catch (error) { let message = 'AI odgovor trenutno nije dostupan.'; try { const details = JSON.parse(error.message); if (details.error === 'AI provider unavailable') message = 'AI provider nije dostupan. Proverite AI_API_KEY, AI_BASE_URL i izabrani model na serveru.'; } catch {} target.innerHTML = `<div class="list-item"><strong>Greška</strong><div>${message}</div></div>`; } });
	document.querySelector('#ai-source-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const file = document.querySelector('#ai-source-file').files[0]; const message = document.querySelector('#ai-source-message'); const answerTarget = document.querySelector('#ai-answer'); if (!file) return; const form = event.currentTarget; const body = new FormData(form); body.set('file', file, file.name); body.set('projectId', 'lot-a'); body.set('phase', 'general'); body.set('responseLanguage', language); try { if (answerTarget) answerTarget.innerHTML = '<small>Automatska provjera dokumenta...</small>'; const response = await fetch(`${api}/documents/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Izvor nije sa?uvan.'); form.reset(); document.querySelector('#work-sequence')?.remove(); await Promise.allSettled([loadEvidenceSummary(), loadDocuments(), loadWorkSequence()]); if (!renderAutoAnalysis(answerTarget, result.autoAnalysis)) answerTarget.innerHTML = `<div class="list-item"><strong>${language === 'fr' ? 'Document enregistr?' : 'Dokument je sa?uvan'}</strong><small>${escapeHtml(result.originalName || file.name)}</small><div>${language === 'fr' ? 'Analyse automatique disponible pour les PDF plan/fiche technique avec texte lisible.' : 'Automatska analiza radi za PDF plan/fiche technique koji ima ?itljiv tekst.'}</div></div>`; message.textContent = language === 'fr' ? `Source enregistr?e : ${result.originalName || file.name}. Analyse automatique termin?e.` : `Izvor je sa?uvan: ${result.originalName || file.name}. Automatska analiza je zavr?ena.`; } catch (error) { message.textContent = error.message || 'Izvor nije sa?uvan.'; if (answerTarget) answerTarget.innerHTML = '<small>Automatska analiza nije dostupna. Dokument je ipak mo?da sa?uvan; mo?ete postaviti pitanje ispod.</small>'; } });
	function ensureScheduleEditor(schedule) { if (!['admin', 'gerant', 'manager', 'conducteur'].includes(currentUser?.role) || document.querySelector('#schedule-form')) return; const panel = document.querySelector('.schedule-panel'); const form = document.createElement('form'); form.id = 'schedule-form'; form.className = 'schedule-editor'; form.innerHTML = `<h3>Modifier le calendrier</h3><label>Début des travaux<input name="startDate" type="date" value="${schedule.startDate || ''}" required /></label><label>Échéance prévue<input name="plannedEndDate" type="date" value="${schedule.plannedEndDate || ''}" required /></label><button class="primary" type="submit">Enregistrer le calendrier</button>`; panel.append(form); form.addEventListener('submit', async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(form).entries()); try { await request('/projects/lot-a/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); await loadSchedule(); toast('Le calendrier a été enregistré.'); } catch (error) { toast(`Calendrier non enregistré : ${error.message || 'erreur inconnue'}`); } }); const delayForm = document.createElement('form'); delayForm.id = 'delay-form'; delayForm.className = 'schedule-editor'; delayForm.innerHTML = `<h3>Déclarer un retard</h3><label>Catégorie<select name="category"><option value="weather">Météo</option><option value="materials">Retard des matériaux</option><option value="client">Client</option><option value="technical">Technique</option><option value="other">Autre</option></select></label><label>Nombre de jours<input name="days" type="number" min="1" step="1" required /></label><label>Motif du retard<textarea name="reason" required></textarea></label><button class="secondary" type="submit">Enregistrer le retard</button>`; panel.append(delayForm); delayForm.addEventListener('submit', async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(delayForm).entries()); try { await request('/projects/lot-a/delays', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); delayForm.reset(); await loadSchedule(); toast('Le retard a été enregistré.'); } catch (error) { toast(`Retard non enregistré : ${error.message || 'erreur inconnue'}`); } }); }
	async function loadSchedule() { const schedule = await request('/projects/lot-a/schedule'); const target = document.querySelector('#schedule-summary'); const status = document.querySelector('#schedule-status'); status.textContent = schedule.delayDays ? `${schedule.delayDays} jours de retard` : 'Aucun retard'; target.innerHTML = `<div class="list-item"><strong>Début des travaux : ${schedule.startDate || 'non renseigné'}</strong><small>Échéance prévue : ${schedule.plannedEndDate || 'non renseignée'} · Échéance ajustée : ${schedule.adjustedEndDate || 'non calculée'}</small></div>${schedule.delays.map((item) => `<div class="list-item"><strong>${item.category} · ${item.days} jours</strong><small>${item.reason}</small></div>`).join('')}`; ensureScheduleEditor(schedule); }
	async function loadDocuments() { const documents = await request('/documents'); const canManage = ['admin', 'gerant', 'manager'].includes(currentUser?.role); document.querySelector('#documents').innerHTML = documents.length ? documents.map((item) => `<div class="list-item"><strong>${item.originalName}</strong><small>${item.evidenceType || 'other'} · ${item.phase || 'general'} · ${Math.max(1, Math.round(item.size / 1024))} KB · ${item.projectId}</small>${canManage ? `<div class="document-actions"><button class="secondary rename-document" data-document="${item.id}">Preimenuj</button><button class="secondary copy-document" data-document="${item.id}">Kopiraj</button><button class="secondary delete-document" data-document="${item.id}">Obriši</button></div>` : ''}</div>`).join('') : '<small>Nema sačuvanih dokumenata.</small>'; document.querySelectorAll('.rename-document').forEach((button) => button.addEventListener('click', async () => { const item = documents.find((document) => document.id === button.dataset.document); const name = window.prompt('Novo ime dokumenta:', item?.originalName || ''); if (!name?.trim()) return; await request(`/documents/${button.dataset.document}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) }); await loadDocuments(); toast('Dokument je preimenovan.'); })); document.querySelectorAll('.copy-document').forEach((button) => button.addEventListener('click', async () => { await request(`/documents/${button.dataset.document}/copy`, { method: 'POST' }); await loadDocuments(); toast('Kopija dokumenta je dodata.'); })); document.querySelectorAll('.delete-document').forEach((button) => button.addEventListener('click', async () => { const item = documents.find((document) => document.id === button.dataset.document); if (!item || !window.confirm(`Obrisati dokument „${item.originalName}“?`)) return; await request(`/documents/${button.dataset.document}`, { method: 'DELETE' }); await loadDocuments(); await loadEvidenceSummary(); toast('Dokument je obrisan.'); })); }
	async function loadBudget() { const budget = await request('/projects/lot-a/budget'); const financial = await request('/projects/lot-a/financial-summary'); const target = document.querySelector('#budget-summary'); const form = document.querySelector('#budget-form'); if (budget.status === 'missing') { target.innerHTML = '<small>Nema ubačenog Devis-a.</small>'; return; } if (form) { form.querySelector('[name="devisNumber"]').value = budget.devisNumber || ''; form.querySelector('[name="client"]').value = budget.client || ''; form.querySelector('[name="chantierName"]').value = budget.chantierName || ''; form.querySelector('[name="projectId"]').value = budget.projectId || 'lot-a'; form.querySelector('[name="total"]').value = budget.total || ''; } target.innerHTML = `<div class="list-item"><strong>${budget.devisNumber} · ${budget.client}</strong><small>${budget.chantierName || 'Chantier'} · Devis PDF · Budžet: ${formatEUR(financial.budget)}</small><div>Nabavke: ${formatEUR(financial.purchases)} · Rad: ${Number(financial.approvedWorkHours).toFixed(2)} h · Ukupno potrošeno: ${formatEUR(financial.spent)}</div><strong>Preostalo: ${formatEUR(financial.remaining)}</strong></div>`; }
	async function loadPurchases() { const purchases = await request('/purchases'); const groups = { material: [], tools: [], machines: [], workers: [], subcontracting: [] }; purchases.forEach((item) => { if (groups[item.category]) groups[item.category].push(item); }); const render = (items, target, totalTarget) => { document.querySelector(`#${totalTarget}`).textContent = `${items.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2)} EUR`; document.querySelector(`#${target}`).innerHTML = items.length ? items.map((item) => `<div class="list-item"><strong>${item.category} · ${item.supplier}</strong><small>${item.description} · ${Number(item.amount).toFixed(2)} EUR · ${item.purchaseDate}</small></div>`).join('') : '<small>Nema troškova.</small>'; }; render([...groups.material, ...groups.tools, ...groups.machines], 'purchase-material-tools', 'purchase-total-material-tools'); render(groups.workers, 'purchase-workers', 'purchase-total-workers'); render(groups.subcontracting, 'purchase-subcontracting', 'purchase-total-subcontracting'); }
	function ensurePayoutPdfPanel() {
		ensureHoursPdfButton();
		if (document.querySelector('#payout-pdf-panel')) return;
		const panel = document.querySelector('#tasks-view .panel'); if (!panel) return;
		const section = document.createElement('section'); section.id = 'payout-pdf-panel'; section.className = 'panel';
		section.innerHTML = '<h3>PDF zahteva za platu</h3><small>Na kraju meseca preuzmite zahtev i pošaljite ga Gérant-u.</small><label>Mesec<input id="payout-pdf-month" type="month" required /></label><button class="secondary" id="download-payout-pdf" type="button">Preuzmi PDF zahteva</button><p id="payout-pdf-message" class="error"></p>';
		panel.after(section); section.querySelector('#payout-pdf-month').value = new Date().toISOString().slice(0, 7);
		section.querySelector('#download-payout-pdf').addEventListener('click', async () => {
			const month = section.querySelector('#payout-pdf-month').value; const message = section.querySelector('#payout-pdf-message');
			try { const items = await request('/payout-requests'); const item = items.filter((entry) => entry.month === month && (['admin', 'gerant', 'manager'].includes(currentUser?.role) || entry.userId === currentUser?.id)).at(-1); if (!item) throw new Error('Za izabrani mesec prvo pošaljite zahtev za platu.'); const response = await fetch(`${api}/payout-requests/${item.id}/pdf`, { headers: { Authorization: `Bearer ${token()}` } }); if (!response.ok) throw new Error('PDF nije moguće napraviti.'); const blob = await response.blob(); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `ibra-payout-${month}.pdf`; link.click(); URL.revokeObjectURL(link.href); message.textContent = 'PDF je preuzet.'; } catch (error) { message.textContent = error.message || 'PDF nije moguće preuzeti.'; }
		});
	}
	function ensureHoursPdfButton() {
		if (document.querySelector('#send-hours-pdf')) return;
		const form = document.querySelector('#time-form'); if (!form) return;
		const button = document.createElement('button'); button.type = 'button'; button.id = 'send-hours-pdf'; button.className = 'secondary'; button.textContent = 'Pošalji PDF sati gazdi'; form.append(button);
		button.addEventListener('click', async () => { try { await request('/time-entries/pdf/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: new Date().toISOString().slice(0, 7) }) }); toast('PDF sati je poslat gazdi.'); } catch { toast('PDF sati nije poslat. Proverite email podešavanja.'); } });
	}
	function ensureChangePasswordPanel() {
		if (document.querySelector('#change-password-panel')) return;
		const target = document.querySelector('main'); if (!target) return;
		const panel = document.createElement('form'); panel.id = 'change-password-panel'; panel.className = 'panel';
		panel.hidden = true;
		panel.innerHTML = '<h3>Promeni password</h3><small>Posle prve prijave zameni privremeni password svojim.</small><label>Trenutni password<input name="currentPassword" type="password" minlength="10" required /></label><label>Novi password<input name="newPassword" type="password" minlength="10" required /></label><label>Potvrdi novi password<input name="confirmPassword" type="password" minlength="10" required /></label><button class="primary">Sačuvaj novi password</button><p id="change-password-message" class="error"></p>';
		target.prepend(panel); document.querySelector('#change-password-button')?.addEventListener('click', () => { panel.hidden = !panel.hidden; }); panel.addEventListener('submit', async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(panel).entries()); const message = panel.querySelector('#change-password-message'); if (values.newPassword !== values.confirmPassword) { message.textContent = 'Novi password i potvrda se razlikuju.'; return; } try { const response = await request('/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); if (response.token) localStorage.setItem('ibra-auth-token', response.token); if (response.user) { currentUser = response.user; applyRole(currentUser.role); document.querySelector('#current-role').textContent = `${currentUser.name} - ${currentUser.role}`; } message.textContent = response.message || 'Password je promenjen.'; panel.reset(); panel.hidden = true; } catch (error) { try { message.textContent = JSON.parse(error.message).error || 'Password nije promenjen.'; } catch { message.textContent = 'Password nije promenjen.'; } } });
	}
	ensureChangePasswordPanel();
	let currentUser;
	const registrationForm = document.querySelector('#registration-form');
	const registrationSuccess = document.querySelector('#registration-success');
	const loginForm = document.querySelector('#login-form');
	const registrationRole = document.querySelector('#registration-role');
	const loginRole = loginForm?.elements.role;
	const updateLoginFields = () => { const role = loginRole?.value; const siret = document.querySelector('#login-siret-field'); const company = document.querySelector('#login-company-field'); if (siret) { siret.hidden = role !== 'gerant'; siret.querySelector('input').required = false; } if (company) { company.hidden = role !== 'conducteur'; company.querySelector('input').required = false; } };
	loginRole?.addEventListener('change', updateLoginFields);
	updateLoginFields();
	const updateRegistrationFields = () => {
		const isGerant = registrationRole?.value === 'gerant';
		const isConducteur = registrationRole?.value === 'conducteur';
		const siret = document.querySelector('#registration-siret');
		const company = document.querySelector('#registration-company');
		if (siret) { siret.hidden = !isGerant; siret.querySelector('input').required = isGerant; }
		if (company) { company.hidden = !isConducteur; company.querySelector('input').required = isConducteur; }
	};
	registrationRole?.addEventListener('change', updateRegistrationFields);
	updateRegistrationFields();
	const authChoice = document.querySelector('#auth-choice');
	const resetForm = document.querySelector('#reset-form');
	const showLogin = () => { if (authChoice) authChoice.hidden = true; registrationForm.hidden = true; registrationSuccess.hidden = true; resetForm.hidden = true; loginForm.hidden = false; loginForm.elements.phone.focus(); };
	const showRegistration = () => { authChoice.hidden = true; loginForm.hidden = true; registrationSuccess.hidden = true; registrationForm.hidden = false; };
	const loadInitialData = async () => {
		const loads = [loadDashboard(), loadEvidenceSummary(), loadRgeQualibat(), loadControlHistory(), loadBudget(), loadFinancialSummary(), loadSchedule(), loadUsers(), loadMessages(), loadTime(), loadPayroll(), loadDocuments(), loadPurchases(), loadProduction(), loadWorkSequence(), loadPayouts()];
		const results = await Promise.allSettled(loads);
		results.filter((result) => result.status === 'rejected').forEach((result) => console.warn('Initial load failed', result.reason));
		ensurePayoutPdfPanel(); ensureChangePasswordPanel();
	};
	const restoreSession = async () => {
		if (!localStorage.getItem('ibra-auth-token')) return;
		try {
			const result = await request('/me');
			currentUser = result.user; applyRole(currentUser.role); loginModal.classList.add('hidden'); document.querySelector('#current-role').textContent = `${currentUser.name} - ${currentUser.role}`;
			await loadInitialData();
		} catch { localStorage.removeItem('ibra-auth-token'); }
	};
	document.querySelector('#choose-login')?.addEventListener('click', showLogin);
	document.querySelector('#choose-registration')?.addEventListener('click', showRegistration);
	document.querySelector('#show-login')?.addEventListener('click', showLogin);
	document.querySelector('#show-registration')?.addEventListener('click', showRegistration);
	document.querySelector('#continue-to-password')?.addEventListener('click', () => { registrationSuccess.hidden = true; loginForm.hidden = false; document.querySelector('#back-to-success').hidden = false; loginForm.elements.password.focus(); });
	document.querySelector('#back-to-success')?.addEventListener('click', () => { loginForm.hidden = true; registrationSuccess.hidden = false; });
	registrationForm?.addEventListener('submit', async (event) => {
		event.preventDefault();
		const message = document.querySelector('#registration-message');
		message.textContent = 'Création du compte...';
		try {
			const payload = Object.fromEntries(new FormData(registrationForm).entries());
			if (payload.password !== payload.confirmPassword) throw new Error('Password i potvrda se razlikuju.');
			delete payload.confirmPassword;
			const result = await fetch(`${api}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
			const data = await result.json();
			if (!result.ok) throw new Error(data.error || 'Inscription impossible.');
			registrationForm.reset(); updateRegistrationFields(); registrationForm.hidden = true; registrationSuccess.hidden = false;
			const deliveryTarget = data.email || data.phone;
			document.querySelector('#registration-success-message').textContent = data.delivery === 'password-set' ? `Nalog je kreiran za ${deliveryTarget}. Prijavite se passwordom koji ste izabrali.` : `Lozinka je poslata na ${deliveryTarget}. Kliknite dalje kada želite da unesete password.`;
			loginForm.elements.phone.value = deliveryTarget || '';
			if (loginForm.elements.role && data.role) loginForm.elements.role.value = data.role;
		} catch (error) { message.textContent = error.message || 'Inscription impossible.'; }
	});
		document.querySelector('#login-form').addEventListener('submit', async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const errorTarget = document.querySelector('#login-error'); errorTarget.textContent = ''; try { const result = await fetch(`${api}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(form.entries())) }); if (!result.ok) { const details = await result.json().catch(() => ({})); const error = new Error(details.error || 'Login failed'); error.status = result.status; throw error; } const data = await result.json(); localStorage.setItem('ibra-auth-token', data.token); currentUser = data.user; applyRole(currentUser.role); loginModal.classList.add('hidden'); document.querySelector('#current-role').textContent = `${currentUser.name} · ${currentUser.role}`; await loadInitialData(); } catch (error) { errorTarget.textContent = error.status === 403 ? 'Izabrani profil ne odgovara ovom nalogu.' : 'Email/telefon ili password nisu tačni.'; } });
	document.querySelector('#forgot-password')?.addEventListener('click', () => { document.querySelector('#reset-request-panel')?.removeAttribute('hidden'); document.querySelector('#reset-contact')?.focus(); });
	document.querySelector('#send-reset')?.addEventListener('click', async () => {
			const contact = String(document.querySelector('#reset-contact')?.value || '').trim();
		if (!contact?.trim()) return;
		const error = document.querySelector('#login-error');
		try {
			const response = await fetch(`${api}/auth/request-reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact: contact.trim() }) });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || 'Reset nije dostupan.');
					error.textContent = result.resetUrl ? `Lien de réinitialisation : ${result.resetUrl}` : (result.message || 'Les instructions de réinitialisation ont été envoyées. Vérifiez aussi les courriers indésirables.');
		} catch (requestError) {
			error.textContent = requestError.message || 'Reset lozinke trenutno nije dostupan.';
		}
	});
	const resetToken = new URLSearchParams(window.location.search).get('reset');
	if (resetToken) {
			authChoice.hidden = true; registrationForm.hidden = true; registrationSuccess.hidden = true; loginForm.hidden = true; resetForm.hidden = false;
			resetForm.addEventListener('submit', async (event) => { event.preventDefault(); const message = resetForm.querySelector('#reset-message'); const values = Object.fromEntries(new FormData(resetForm).entries()); if (values.password !== values.confirmPassword) { message.textContent = 'Les mots de passe ne correspondent pas.'; return; } try { const response = await fetch(`${api}/auth/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: resetToken, password: values.password }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Réinitialisation impossible.'); message.textContent = 'Mot de passe enregistré. Vous pouvez vous connecter.'; resetForm.reset(); setTimeout(showLogin, 800); } catch (error) { message.textContent = error.message; } });
	} else { resetForm.hidden = true; loginForm.hidden = false; loginForm.elements.phone.focus(); }
	document.querySelector('#logout-button').addEventListener('click', () => { localStorage.removeItem('ibra-auth-token'); currentUser = undefined; document.querySelector('#change-password-panel')?.setAttribute('hidden', ''); document.querySelector('#login-form').reset(); document.querySelector('#registration-form')?.reset(); document.querySelector('#registration-form')?.setAttribute('hidden', ''); document.querySelector('#registration-success')?.setAttribute('hidden', ''); document.querySelector('#login-form').setAttribute('hidden', ''); authChoice?.removeAttribute('hidden'); loginModal.classList.remove('hidden'); });
	document.querySelector('#message-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await request('/messages', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ...Object.fromEntries(new FormData(event.currentTarget).entries()), projectId:'lot-a' }) }); event.currentTarget.reset(); await loadMessages(); toast('Poruka je sačuvana.'); } catch { toast('Poruka nije poslata.'); } });
	document.querySelector('#time-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await request('/time-entries', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) }); event.currentTarget.reset(); await loadTime(); toast('Radno vreme je sačuvano.'); } catch { toast('Radno vreme nije sačuvano.'); } });
	const userRoleField = document.querySelector('#user-role'); const updateUserRoleFields = () => { const role = userRoleField?.value; const siretField = document.querySelector('#siret-field'); const companyField = document.querySelector('#company-field'); const rateFields = document.querySelectorAll('.rate-field'); if (siretField) { siretField.hidden = role !== 'gerant'; siretField.querySelector('input').required = role === 'gerant'; } if (companyField) { companyField.hidden = role !== 'conducteur'; companyField.querySelector('input').required = role === 'conducteur'; } rateFields.forEach((field) => { field.hidden = !['conducteur', 'worker'].includes(role); }); }; userRoleField?.addEventListener('change', updateUserRoleFields); updateUserRoleFields();
		document.querySelector('#user-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const created = await request('/users', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) }); event.currentTarget.reset(); updateUserRoleFields(); await loadUsers(); const delivery = created.delivery === 'email' ? 'e-mail' : created.delivery === 'sms' ? 'SMS' : `lokalno: ${created.temporaryPassword}`; toast(`Korisnik je dodat. Lozinka poslata preko ${delivery}.`); } catch (error) { let message = 'Korisnik nije dodat.'; try { const details = JSON.parse(error.message); if (details.error === 'User already exists') message = 'Ovaj e-mail već postoji.'; if (details.error?.includes('password')) message = 'Lozinka mora imati najmanje 10 karaktera.'; if (details.error === 'Access denied') message = 'Samo Gérant ili manager mogu dodavati korisnike.'; } catch {} toast(message); } });
	document.querySelector('#upload-form').addEventListener('submit', async (event) => { event.preventDefault(); const file = document.querySelector('#file-input').files[0]; if (!file) { toast('S?lectionnez un fichier avant l?enregistrement.'); return; } const body = new FormData(event.currentTarget); body.set('file', file, file.name); body.set('responseLanguage', language); try { const response = await fetch(`${api}/documents/upload`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || `${response.status}`); event.currentTarget.reset(); await loadDocuments(); if (result.autoAnalysis) { showView('evidence-summary-view'); renderAutoAnalysis(document.querySelector('#ai-answer'), result.autoAnalysis); } toast(result.autoAnalysis ? 'Dokument je sa?uvan i automatski analiziran.' : 'Le document a ?t? enregistr? sur le serveur.'); } catch (error) { toast(`Document non enregistr? : ${error.message || 'erreur inconnue'}`); } });
	document.querySelector('#budget-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const file = document.querySelector('#budget-file').files[0]; const form = event.currentTarget; const sendBudget = async (replaceExisting = false) => { const body = new FormData(form); if (file) body.set('file', file, file.name); if (replaceExisting) body.set('replaceExisting', 'true'); const projectId = body.get('projectId'); return fetch(`${api}/projects/${projectId}/budget`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); }; try { let response = await sendBudget(false); if (response.status === 409 && window.confirm('Un Devis existe deja pour ce chantier. Remplacer par le nouveau PDF ?')) response = await sendBudget(true); if (!response.ok) { const details = await response.text(); throw new Error(`${response.status}: ${details}`); } form.reset(); await loadBudget(); toast('Devis et budget enregistres.'); } catch (error) { toast(`Devis non enregistre : ${error.message || 'erreur inconnue'}`); } });
	document.querySelector('#budget-file')?.addEventListener('change', async (event) => { const file = event.currentTarget.files[0]; if (!file) return; const body = new FormData(); body.append('file', file); const status = document.querySelector('#devis-extraction-status'); status.textContent = 'Čitanje PDF-a...'; try { const response = await fetch(`${api}/budget/inspect`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); if (!response.ok) throw new Error(); const result = await response.json(); const form = document.querySelector('#budget-form'); form.querySelector('[name="devisNumber"]').value = result.extracted.number; form.querySelector('[name="client"]').value = result.extracted.client; form.querySelector('[name="chantierName"]').value = result.extracted.chantier; form.querySelector('[name="total"]').value = result.extracted.total || ''; const projectSelect = form.querySelector('[name="projectId"]'); const chantierText = result.extracted.chantier.toLowerCase(); const matchingOption = [...projectSelect.options].find((option) => chantierText && option.textContent.toLowerCase().includes(chantierText)); if (matchingOption) projectSelect.value = matchingOption.value; status.textContent = result.needsConfirmation ? 'PDF je pročitan delimično. Proveri označena polja pre čuvanja.' : `Automatski pročitano iz: ${result.source}`; } catch { status.textContent = 'PDF nije moguće automatski pročitati. Unesi vrednosti ručno.'; } });
		document.querySelector('#purchase-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const file = document.querySelector('#invoice-file').files[0]; const body = new FormData(event.currentTarget); if (!file) { toast('Dodaj PDF račun ili opravdanje.'); return; } body.append('invoice', file); try { const response = await fetch(`${api}/purchases`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); if (!response.ok) throw new Error(); event.currentTarget.reset(); await Promise.all([loadPurchases(), loadBudget(), loadFinancialSummary()]); toast('Trošak i PDF faktura su sačuvani; Devis je automatski ažuriran.'); } catch { toast('Trošak nije sačuvan.'); } });
	document.querySelector('#invoice-file')?.addEventListener('change', async (event) => { const file = event.currentTarget.files[0]; if (!file) return; const body = new FormData(); body.append('file', file); const status = document.querySelector('#purchase-extraction-status'); status.textContent = 'Čitanje PDF fakture...'; try { const response = await fetch(`${api}/pdf/inspect`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); if (!response.ok) throw new Error(); const result = await response.json(); const form = document.querySelector('#purchase-form'); form.querySelector('[name="supplier"]').value = result.extracted.supplier; form.querySelector('[name="amount"]').value = result.extracted.amount || ''; form.querySelector('[name="purchaseDate"]').value = result.extracted.date || ''; status.textContent = result.needsOcr ? 'PDF je skeniran. Potrebna je ručna provera/OCR.' : `Automatski pročitano iz: ${result.source}`; } catch { status.textContent = 'PDF nije moguće automatski pročitati. Unesi vrednosti ručno.'; } });
	restoreSession();
});
