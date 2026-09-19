document.addEventListener('DOMContentLoaded', () => {
	const api = window.location.protocol === 'file:' ? 'http://localhost:3000/api' : `${window.location.origin}/api`;
	const loginModal = document.querySelector('#login-modal');
	const token = () => localStorage.getItem('ibra-auth-token');
	const ownerRoles = ['admin', 'gerant', 'manager'];
	const isOwner = (role = currentUser?.role) => ownerRoles.includes(role);
	const toast = (message) => { const french = { 'Korisnik je dodat.': 'Utilisateur enregistré.', 'Poruka je sačuvana.': 'Message enregistré.', 'Radno vreme je sačuvano.': 'Temps de travail enregistré.', 'Radno vreme nije sačuvano.': 'Temps de travail non enregistré.', 'Korisnik nije dodat.': 'Utilisateur non enregistré.', 'Trošak nije sačuvan.': 'Dépense non enregistrée.', 'Devis nije sačuvan.': 'Devis non enregistré.', 'Devis i budžet su sačuvani.': 'Devis et budget enregistrés.' }; const translated = french[message] || String(message).replace('Dokument je obrisan.', 'Document supprimé.').replace('Dokument je preimenovan.', 'Document renommé.').replace('Kopija dokumenta je dodata.', 'Copie du document ajoutée.'); const el = document.querySelector('#toast'); el.textContent = translated; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); };
	const formatEUR = (value) => new Intl.NumberFormat('sr-Latn-RS', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
	const translations = { 'Dashboard':'Tableau de bord','Devis':'Devis','Nabavke':'Achats','Chantier kontrole':'Contrôles chantier','RGE / QUALIBAT':'RGE / QUALIBAT','Dokumenti i slike':'Documents et photos','Zadaci i komunikacija':'Tâches et communication','Korisnici':'Utilisateurs','Dokazni paket':'Dossier de preuves','Odjava':'Déconnexion','Kontrola pravilnog izvođenja radova':'Contrôle de la bonne exécution des travaux','Plan, fiche technique, fotografije i potvrda Gerant-a u jednom toku.':'Plan, fiche technique, photos et validation du Gerant dans un seul parcours.','Otvorene kontrole':'Contrôles ouverts','Radno vreme':'Temps de travail','Trošak rada ovog meseca':'Coût du travail ce mois-ci','Preostali budžet':'Budget restant','Materijal, alat i mašine':'Matériaux, outils et machines','Radnici':'Travailleurs','Sous-traitance':'Sous-traitance','Nema Devis-a':'Aucun devis','Bez kašnjenja':'Aucun retard','Début de travaux i rok':'Début des travaux et délai','Début de travaux: nije unet':'Début des travaux : non renseigné','Planirani rok: nije unet · Prilagođeni rok: nije izračunat':'Échéance prévue : non renseignée · Échéance ajustée : non calculée','Chantier kontrole':'Contrôles chantier','Dokumenti i slike':'Documents et photos','AIDE RGE / QUALIBAT':'AIDE RGE / QUALIBAT','ITE - znanje, kontrole i odgovori':'ITE - connaissances, contrôles et réponses','Za učenje i chantier provjeru':'Pour apprendre et contrôler le chantier','Pretraga pitanja i odgovora':'Recherche questions/réponses',"Traži po riječi, npr. RGE, pare-vapeur, BAR-EN-102, lame d'air, MaPrimeRenov":"Rechercher par mot-clé, ex. RGE, pare-vapeur, BAR-EN-102, lame d'air, MaPrimeRenov",'Upiši pojam...':'Saisir un terme...','RGE kontrolna lista':'Liste de contrôle RGE','Kompletno znanje po temama':'Connaissance complète par thèmes','Francuski tehnički termini su ostavljeni da odgovaraju RGE/QUALIBAT dokumentaciji.':'Les termes techniques français sont conservés pour correspondre à la documentation RGE/QUALIBAT.' };
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
	if (userForm?.elements.email) userForm.elements.email.required = true;
	if (userForm?.elements.phone) userForm.elements.phone.required = false;
	translateRuntimeText();
	const userRateFields = document.querySelectorAll('.rate-field');
	const userRateObserver = new MutationObserver(() => {
		if (document.querySelector('#user-role')?.value === 'user') userRateFields.forEach((field) => { field.hidden = false; });
	});
	userRateFields.forEach((field) => userRateObserver.observe(field, { attributes: true, attributeFilter: ['hidden'] }));
	new MutationObserver(translateRuntimeText).observe(document.body, { childList: true, subtree: true });
	const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
	const request = async (path, options = {}) => { const response = await fetch(`${api}${path}`, { cache: 'no-store', ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token()}` } }); if (!response.ok) throw new Error(await response.text()); return response.json(); };

	const wireSiretLookup = (input, preview, companyInput) => {
		if (!input || !preview) return;
		let lastValue = '';
		const lookup = async () => {
			const digits = String(input.value || '').replace(/\D/g, '');
			if (digits === lastValue || ![9, 14].includes(digits.length)) return;
			lastValue = digits;
			preview.textContent = 'Tra?im firmu po SIRET/SIREN...';
			try {
				const company = await request(`/siret/${digits}`);
				if (companyInput && !companyInput.value.trim()) companyInput.value = company.name || '';
				preview.textContent = `${company.name} ? SIRET ${company.siret}${company.address ? ` ? ${company.address}` : ''}`;
			} catch {
				preview.textContent = 'Firma nije prona?ena automatski; unesite ime firme ru?no.';
			}
		};
		input.addEventListener('blur', lookup);
		input.addEventListener('change', lookup);
	};
	const ensureSystemStatus = () => {
		if (document.querySelector('#system-status-bar')) return;
		const header = document.querySelector('main > header');
		if (!header) return;
		const bar = document.createElement('div');
		bar.id = 'system-status-bar';
		bar.className = 'system-status-bar';
		bar.innerHTML = '<span id="online-state"></span><span>Memorija: Supabase cloud</span><span>AI gratis: Gemini</span><span>Server: produkcija</span>';
		header.after(bar);
		const sync = () => {
			const online = navigator.onLine;
			const target = bar.querySelector('#online-state');
			target.textContent = online ? 'Status: online' : 'Status: offline';
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
			worker: ['tasks-view'],
			user: ['tasks-view']
		};
		const allowed = access[role] || ['dashboard-view','tasks-view'];
		document.querySelectorAll('.nav').forEach((item) => { item.hidden = !allowed.includes(item.dataset.view); });
		const canSeeFinancials = isOwner(role);
		document.querySelector('#budget-card')?.toggleAttribute('hidden', !canSeeFinancials);
		document.querySelector('#payroll-card')?.toggleAttribute('hidden', !canSeeFinancials);
		document.querySelector('#quick-worker-form')?.toggleAttribute('hidden', !canSeeFinancials);
		if (!allowed.includes(document.querySelector('.view.active')?.id)) showView(allowed[0]);
	};
	document.querySelectorAll('.nav').forEach((button) => button.addEventListener('click', async () => { showView(button.dataset.view); if (button.dataset.view === 'devis-view' && currentUser) await loadBudget(); if (button.dataset.view === 'rge-help-view') await loadRgeQualibat(); }));

	let projectsCache = [];
	let activeProjectId = localStorage.getItem('ibra-active-project') || '';
	const visibleProjects = () => projectsCache.filter((project) => project.id !== 'lot-a').sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'fr', { sensitivity: 'base' }));
	const currentProjectId = () => {
		const projects = visibleProjects();
		if (!projects.some((project) => project.id === activeProjectId)) activeProjectId = projects[0]?.id || '';
		if (activeProjectId) localStorage.setItem('ibra-active-project', activeProjectId);
		return activeProjectId;
	};
	const currentProject = () => visibleProjects().find((project) => project.id === currentProjectId());
	function ensureProjectSwitchers() {
		[
			{ container: document.querySelector('#dashboard-view .hero'), label: 'Chantier actif' },
			{ container: document.querySelector('#chantier-view .section-head'), label: 'Chantier controle' }
		].forEach(({ container, label }) => {
			if (!container || container.querySelector('.project-switcher')) return;
			const wrapper = document.createElement('label');
			wrapper.className = 'project-switcher';
			wrapper.innerHTML = `${label}<select data-active-project></select>`;
			container.append(wrapper);
		});
	}
	function syncProjectSwitchers() {
		ensureProjectSwitchers();
		const projects = visibleProjects();
		const options = projects.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('');
		document.querySelectorAll('[data-active-project]').forEach((select) => {
			select.innerHTML = options || '<option value="">Creer un chantier dans Devis</option>';
			select.value = currentProjectId();
			select.disabled = !projects.length;
			select.onchange = async () => {
				activeProjectId = select.value;
				localStorage.setItem('ibra-active-project', activeProjectId);
				await Promise.allSettled([loadDashboard(), loadControlHistory(), loadEvidenceSummary(), loadFinancialSummary(), loadSchedule()]);
			};
		});
	}
	async function loadProjectOptions() {
		projectsCache = await request('/projects');
		syncProjectSwitchers();
		const projects = visibleProjects();
		document.querySelectorAll('select[name="projectId"]').forEach((select) => {
			const current = select.value;
			const isBudgetSelect = select.closest('#budget-form');
			const projectOptions = projects.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('');
			select.innerHTML = isBudgetSelect ? `<option value="__new">+ Nouveau chantier depuis ce Devis</option>${projectOptions}` : (projectOptions || '<option value="">Creer un chantier dans Devis</option>');
			select.value = projects.some((project) => project.id === current) ? current : (isBudgetSelect ? '__new' : (currentProjectId() || ''));
			select.disabled = !isBudgetSelect && !projects.length;
		});
	}
	async function loadDashboard() {
		await loadProjectOptions();
		const projectId = currentProjectId();
		const project = currentProject();
		if (!projectId) {
			document.querySelector('#open-controls').textContent = '0';
			document.querySelector('#controls').innerHTML = '<small>Prvo registruj chantier u Devis sekciji.</small>';
			document.querySelector('#project-risk').textContent = 'NEMA CHANTIER';
			return;
		}
		const controls = await request(`/projects/${projectId}/chantier-controls`);
		const completedControls = controls.filter((item) => item.status === 'complete').length;
		const progress = controls.length ? Math.round((completedControls / controls.length) * 100) : Number(project?.progress || 0);
		document.querySelector('#open-controls').textContent = controls.filter((item) => item.status !== 'complete').length;
		document.querySelector('#dashboard-view .hero small').textContent = `${project?.name || 'CHANTIER'} · ${progress}% AVANCEMENT`;
		const schedule = await request(`/projects/${projectId}/schedule`); const financial = await request(`/projects/${projectId}/financial-summary`); const missingEvidence = (await request(`/projects/${projectId}/evidence-summary`)).missing.length; const openControls = controls.filter((item) => item.status !== 'complete').length; const red = openControls >= 3 || missingEvidence >= 4 || (financial.budgetStatus === 'available' && financial.remaining < 0); const orange = !red && (openControls > 0 || missingEvidence > 0 || schedule.delayDays > 0); const risk = document.querySelector('#project-risk-card'); risk.classList.remove('risk-red','risk-orange','risk-green'); risk.classList.add(red ? 'risk-red' : orange ? 'risk-orange' : 'risk-green'); document.querySelector('#project-risk').textContent = `${red ? 'KRITIČAN' : orange ? 'PAŽNJA' : 'STABILAN'} · ${progress}%`;
		const canUpdate = isOwner();
		document.querySelector('#controls').innerHTML = `<div class="list-item chantier-progress"><strong>${escapeHtml(project?.name || 'Chantier')} · ${progress}% zavrseno</strong><small>${completedControls}/${controls.length} kontrola zavrseno</small></div>${controls.map((item) => `<div class="list-item ${item.status === 'complete' ? 'ok' : item.status === 'incomplete' ? 'bad' : 'warn'}"><strong>${item.name}</strong><small>${item.owner} · ${item.status}</small>${canUpdate ? `<div class="control-actions"><button class="secondary control-action" data-control="${item.id}" data-status="complete">Završi</button><button class="secondary control-action" data-control="${item.id}" data-status="incomplete">Vrati na ispravku</button></div>` : ''}</div>`).join('')}`;
		document.querySelectorAll('.control-action').forEach((button) => button.addEventListener('click', async () => { try { await request(`/chantier-controls/${button.dataset.control}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status: button.dataset.status }) }); await Promise.allSettled([loadDashboard(), loadEvidenceSummary(), loadControlHistory()]); toast('Kontrola je ažurirana.'); } catch (error) { try { const details = JSON.parse(error.message); toast(details.missing ? `Nedostaje dokaz: ${details.missing.join(', ')}` : 'Kontrola nije ažurirana.'); } catch { toast('Kontrola nije ažurirana.'); } } }));
	}
		async function loadEvidenceSummary() { 
			await loadProjectOptions();
			const projectId = currentProjectId();
			if (!projectId) return;
			const result = await request(`/projects/${projectId}/evidence-summary`); 
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
	async function loadControlHistory() { await loadProjectOptions(); const projectId = currentProjectId(); const history = projectId ? await request(`/projects/${projectId}/control-history`) : []; const target = document.querySelector('#control-history'); target.innerHTML = history.length ? history.slice().reverse().map((item) => `<div class="list-item"><strong>${item.from} → ${item.to}</strong><small>${item.controlId} · ${item.changedBy} · ${new Date(item.changedAt).toLocaleString()}</small></div>`).join('') : '<small>Nema promena za izabrani chantier.</small>'; }
	async function loadUsers() { const users = await request('/contacts'); const managerView = isOwner(); const currentUserId = currentUser?.id || currentUser?.sub; const canRemoveUsers = Boolean(managerView && currentUserId); const removeUserLabel = language === 'fr' ? "Supprimer l'utilisateur" : 'Ukloni korisnika'; document.querySelector('#users').innerHTML = users.map((user) => `<div class="list-item"><strong>${user.name}</strong><small>${user.role} · ${user.email || 'bez e-maila'} · ${user.phone || 'bez telefona'}${user.siret ? ` · SIRET: ${user.siret}` : ''}${user.company ? ` · Firma: ${user.company}` : ''}${user.employerSiret ? ` · Radi za: ${user.employerCompany || user.company} · SIRET: ${user.employerSiret}` : ''}${managerView && (user.dailyRate || user.hourlyRate) ? ` · Dnevno: ${formatEUR(user.dailyRate)} · Satnica: ${formatEUR(user.hourlyRate)}` : ''}</small>${canRemoveUsers && user.id !== currentUserId ? `<button class="secondary remove-user" data-user="${user.id}" data-name="${escapeHtml(user.name)}" type="button">${removeUserLabel}</button>` : ''}</div>`).join(''); document.querySelectorAll('.remove-user').forEach((button) => button.addEventListener('click', async () => { const removeUserPrompt = language === 'fr' ? `Supprimer l'utilisateur ${button.dataset.name} ?` : `Ukloniti korisnika ${button.dataset.name}?`; if (!window.confirm(removeUserPrompt)) return; try { await request(`/users/${button.dataset.user}`, { method: 'DELETE' }); await refreshActiveView(); toast('Korisnik je uklonjen.'); } catch (error) { let message = 'Korisnik nije uklonjen.'; try { message = JSON.parse(error.message).error || message; } catch {} toast(message); } })); const recipient = document.querySelector('#recipient'); recipient.innerHTML = users.filter((user) => user.id !== currentUserId).map((user) => `<option value="${user.id}">${user.name} · ${user.role}</option>`).join(''); }
	function ensureRendezvousForm() { if (document.querySelector('#rendezvous-form')) return; const panel = document.querySelector('#tasks-view .panel'); if (!panel) return; const form = document.createElement('form'); form.id = 'rendezvous-form'; form.innerHTML = `<h3>RDV / odsustvo sa posla</h3><small>Radnik ovdje javlja da nece doci na posao. Mora poslati najmanje 3 dana ranije; 5 dana je takodje prihvatljivo. Gazda vidi u aplikaciji i dobija email.</small><label>Datum odsustva<input name="absenceDate" type="date" required /></label><label>Sat RDV / odsustva<input name="time" type="time" required /></label><label>Motif / razlog<textarea name="reason" required></textarea></label><button class="secondary" type="submit">Posalji gazdi</button>`; panel.append(form); form.addEventListener('submit', async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(form).entries()); values.date = values.absenceDate; values.projectId = 'lot-a'; try { await request('/rendezvous', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); form.reset(); await refreshActiveView(); toast('Odsustvo/RDV je poslato gazdi.'); } catch (error) { toast(`RDV nije poslat: ${error.message || 'greska'}`); } }); }
	async function loadRendezvous() { const items = await request('/rendezvous'); const panel = document.querySelector('#tasks-view .panel'); if (!panel) return; const target = document.querySelector('#rendezvous-list') || (() => { const element = document.createElement('div'); element.id = 'rendezvous-list'; element.className = 'list'; panel.append(element); return element; })(); target.innerHTML = items.length ? `<h3>RDV / odsustva</h3>${items.slice().sort((first, second) => `${first.absenceDate} ${first.time}`.localeCompare(`${second.absenceDate} ${second.time}`)).map((item) => `<div class="list-item"><strong>${item.absenceDate} · ${item.time}</strong><small>${item.workerName} · chantier ${item.projectId}</small><div>${item.reason}</div></div>`).join('')}` : '<small>Nema RDV/odsustva.</small>'; }
	async function loadMessages() { ensureRendezvousForm(); const messages = await request('/messages'); document.querySelector('#messages').innerHTML = messages.length ? messages.map((item) => `<div class="list-item"><strong>${item.senderName} → ${item.recipientName}</strong><div>${item.text}</div><small>${item.projectId} · ${new Date(item.createdAt).toLocaleString()}</small></div>`).join('') : '<small>Nema poruka.</small>'; await loadRendezvous(); }
	function ensurePayoutPanel() { if (!isOwner()) return; if (document.querySelector('#payout-form')) return; const panel = document.querySelector('#tasks-view .panel'); if (!panel) return; const section = document.createElement('section'); section.className = 'panel payout-panel'; section.innerHTML = `<div class="section-head"><div><h2>Demandes de paiement</h2><small>Les jours sont envoyés le 1er du mois. Le paiement est prévu le 15.</small></div></div><form id="payout-form"><label>Mois à payer<input name="month" type="month" required /></label><label>Nombre de jours à payer<input name="days" type="number" min="0" step="1" required /></label><button class="primary" type="submit">Envoyer la demande au Gérant</button></form><div id="payout-list" class="list"></div></section>`; section.querySelector('#payout-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await request('/payout-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) }); event.currentTarget.reset(); await loadPayouts(); toast('La demande du 1er a été envoyée au Gérant. Paiement prévu le 15.'); } catch (error) { toast(`Demande non enregistrée : ${error.message || 'erreur inconnue'}`); } }); panel.after(section); }
	async function loadPayouts() { if (!isOwner()) { document.querySelector('.payout-panel')?.remove(); return; } ensurePayoutPanel(); const items = await request('/payout-requests'); const target = document.querySelector('#payout-list'); if (!target) return; const managerView = isOwner(); target.innerHTML = items.length ? `<h3>${managerView ? 'Demandes reçues' : 'Mes demandes'}</h3>${items.slice().reverse().map((item) => `<div class="list-item"><strong>${item.month} · ${item.userName} · ${item.days} jours</strong><small>${managerView ? `${formatEUR(item.amount)} · ` : ''}Demande le ${item.submissionDate} · Paiement le ${item.paymentDate} · ${item.status}</small>${managerView && item.status === 'pending' ? `<button class="secondary payout-status" data-payout="${item.id}" data-status="approved">Approuver</button><button class="secondary payout-status" data-payout="${item.id}" data-status="rejected">Refuser</button>` : ''}</div>`).join('')}` : '<small>Aucune demande de paiement.</small>'; document.querySelectorAll('.payout-status').forEach((button) => button.addEventListener('click', async () => { await request(`/payout-requests/${button.dataset.payout}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: button.dataset.status }) }); await loadPayouts(); })); }
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
		section.innerHTML = `<div class="section-head production-head"><div><small>PRODUCTION CHANTIER</small><h2>Production et situations</h2><p>Photo preuve, mesure m2/ml, GPS et validation avant situation.</p></div><span class="status">Validation requise</span></div><form id="production-form" class="production-form"><div class="production-grid"><fieldset><legend>1. Preuve photo</legend><label>Photo du travail realise<input name="photo" type="file" accept="image/*" required /></label><label>Date<input name="date" type="date" required /></label></fieldset><fieldset><legend>2. Mesure</legend><label>Unite a calculer<select name="quantityUnit"><option value="m2">m2 - surface</option><option value="ml">ml - metre lineaire</option></select></label><div class="measure-actions"><button class="secondary" id="estimate-area" type="button">Estimer avec l'IA</button><button class="secondary" id="ar-meter" type="button">Mesurer avec camera AR</button><button class="secondary" id="photo-meter" type="button">Mesurer une photo uploadée</button></div><small id="area-estimate-status">IA utilise les plans/fiches. AR mesure en direct. Photo uploadée se mesure avec une calibration connue.</small></fieldset><fieldset><legend>3. Travaux</legend><label>Description des travaux<input name="description" required /></label><label><span data-quantity-label>Quantite IA ou AR</span><input name="quantity" type="number" min="0" step="0.01" value="" required readonly /></label><input name="quantityM2" type="hidden" value="" /></fieldset><fieldset><legend>4. Prix</legend><label><span data-rate-label>Prix par unite EUR</span><input name="unitRate" type="number" min="0" step="0.01" required /></label><small>La validation humaine du Gerant ou du Gerant reste obligatoire avant la Situation.</small></fieldset></div><button class="primary production-submit" type="submit">Enregistrer la production</button></form><div class="production-results"><div id="production-summary" class="list"></div><div id="production-reports" class="list"></div></div>`;
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
				await refreshActiveView();
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
		if (!isOwner()) { document.querySelector('.production-panel')?.remove(); return; }
		ensureProductionPanel();
		ensureCaptureMetadata();
		const reports = await request('/work-reports');
		const today = new Date().toISOString().slice(0, 10);
		const summary = await request(`/projects/lot-a/situation-summary?date=${today}`);
		const summaryTarget = document.querySelector('#production-summary');
		const reportTarget = document.querySelector('#production-reports');
		if (!summaryTarget || !reportTarget) return;
		const managerView = isOwner();
		const quantityLabel = (item) => `${Number(item.quantity ?? item.quantityM2 ?? 0).toFixed(2)} ${item.quantityUnit || 'm2'}`;
		const workerTotals = summary.byWorker?.map((item) => `${item.workerName}: ${Number(item.quantityM2 || 0).toFixed(2)} m2 ? ${Number(item.quantityMl || 0).toFixed(2)} ml${managerView ? ` ? ${formatEUR(item.amount)}` : ''}`).join(' | ') || 'Aucun detail par utilisateur';
		summaryTarget.innerHTML = `<div class="list-item"><strong>Situation du ${today}</strong><small>${summary.reportCount} rapport(s) approuve(s) ? ${Number(summary.quantityM2 || 0).toFixed(2)} m2 ? ${Number(summary.quantityMl || 0).toFixed(2)} ml${managerView ? ` ? ${formatEUR(summary.amount)}` : ''}</small><small>${workerTotals}</small><small>Calcul base uniquement sur les rapports approuves. Validation humaine requise.</small></div>`;
		const canReview = isOwner();
		reportTarget.innerHTML = reports.length ? `<h3>Rapports de production</h3>${reports.slice().reverse().map((item) => `<div class="list-item"><strong>${item.date} ? ${item.workerName} ? ${quantityLabel(item)}</strong><small>${item.description} ? ${managerView ? `${formatEUR(item.calculatedAmount)} ? ` : ''}${item.status} ? ${item.aiStatus} ? ${item.capturedAt} ? ${item.locationName}</small>${canReview && item.status === 'pending' ? `<button class="secondary production-status" data-report="${item.id}" data-status="approved">Approuver</button><button class="secondary production-status" data-report="${item.id}" data-status="rejected">Refuser</button>` : ''}</div>`).join('')}` : '<small>Aucun rapport de production.</small>';
		document.querySelectorAll('.production-status').forEach((button) => button.addEventListener('click', async () => { await request(`/work-reports/${button.dataset.report}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: button.dataset.status }) }); await loadProduction(); }));
	}
	async function loadWorkSequence() { const panel = document.querySelector('.ai-panel'); if (!panel || document.querySelector('#work-sequence')) return; const section = document.createElement('div'); section.id = 'work-sequence'; section.className = 'list'; section.innerHTML = '<h3>Ordre des travaux selon les plans</h3><small>Analyse de la documentation...</small>'; panel.append(section); try { const result = await request('/projects/lot-a/work-sequence'); section.innerHTML = `<h3>Ordre des travaux selon les plans</h3><small>${result.answer}</small>${result.steps?.length ? result.steps.map((step) => `<div class="list-item"><strong>${step.order}. ${step.title}</strong><small>${step.instruction} · Preuve requise : ${step.requiredEvidence || 'à confirmer'} · Source : ${step.sourcePage || 'à confirmer'}</small></div>`).join('') : '<small>La séquence ne peut pas être affichée sans documentation source et configuration AI.</small>'}`; } catch { section.innerHTML = '<h3>Ordre des travaux selon les plans</h3><small>Analyse indisponible. Ajoutez un plan ou une fiche technique PDF.</small>'; } }
	function renderAutoAnalysis(target, analysis) {
		if (!target || !analysis) return false;
		const french = language === 'fr';
		const section = (title, items) => items?.length ? `<div class="auto-analysis-section"><strong>${escapeHtml(title)}</strong><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : '';
		const specificAnswer = analysis.answer ? `<div class="auto-analysis-answer"><strong>${french ? 'Réponse selon ce plan' : 'Odgovor prema ovom planu'}</strong><p>${escapeHtml(analysis.answer)}</p></div>` : '';
		target.innerHTML = `<div class="list-item auto-analysis"><strong>${french ? 'Analyse automatique' : 'Automatska analiza'} · ${escapeHtml(analysis.workType)}</strong><small>${french ? 'Confiance' : 'Sigurnost'}: ${Math.round(Number(analysis.confidence || 0) * 100)}% · ${escapeHtml(analysis.fileName || '')}</small>${specificAnswer}${section(french ? 'Système' : 'Sistem', analysis.systems)}${section(french ? 'Matériaux détectés' : 'Prepoznati materijali', analysis.materials)}${section(french ? 'Comment exécuter' : 'Kako se radi', analysis.howTo)}${section(french ? 'Contrôles' : 'Šta kontrolisati', analysis.controls)}${section(french ? 'Preuves photos' : 'Šta slikati kao dokaz', analysis.evidence)}${section(french ? 'Risques / à confirmer' : 'Rizici / šta potvrditi', analysis.risks)}</div>`;
		return true;
	}
	let latestOwnTimeEntries = [];
	let latestTimeWorkers = [];
	const monthKeyFromDate = (dateValue) => String(dateValue || new Date().toISOString().slice(0, 10)).slice(0, 7);
	const timePrefsKey = () => `ibra-time-prefs-${currentUser?.id || 'default'}`;
	const loadTimePrefs = () => {
		try { return JSON.parse(localStorage.getItem(timePrefsKey()) || '{}'); } catch { return {}; }
	};
	const saveTimePrefs = (form) => {
		if (!form) return;
		localStorage.setItem(timePrefsKey(), JSON.stringify({ workerId: form.elements.workerId?.value || '', start: form.elements.start?.value || '08:00', end: form.elements.end?.value || '17:00', breakMinutes: form.elements.breakMinutes?.value || '60', rateType: form.elements.rateType?.value || 'daily', rate: form.elements.rate?.value || '' }));
	};
	const saveTimeEntryFromForm = async (form) => {
		await request('/time-entries', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
		saveTimePrefs(form);
	};
	const calculateTimeDraft = () => {
		const form = document.querySelector('#time-form');
		if (!form) return { hours: 0, amount: 0, valid: false };
		const [startH, startM] = String(form.elements.start?.value || '').split(':').map(Number);
		const [endH, endM] = String(form.elements.end?.value || '').split(':').map(Number);
		const rate = Number(form.elements.rate?.value || 0);
		const breakMinutes = Number(form.elements.breakMinutes?.value || 0);
		const rateType = form.elements.rateType?.value || 'daily';
		if (![startH, startM, endH, endM].every(Number.isFinite) || !Number.isFinite(rate) || rate <= 0) return { hours: 0, amount: 0, valid: false };
		const startMinutes = startH * 60 + startM;
		const endMinutes = endH * 60 + endM;
		const hours = startMinutes >= endMinutes ? 0 : (endMinutes - startMinutes - breakMinutes) / 60;
		if (!Number.isFinite(hours) || hours <= 0) return { hours: 0, amount: 0, valid: false };
		return { hours, amount: rateType === 'hourly' ? hours * rate : rate, valid: true };
	};
	const updateTimeLiveCalculation = () => {
		const target = document.querySelector('#time-live-calculation');
		if (!target) return;
		const draft = calculateTimeDraft();
		target.classList.toggle('ready', draft.valid);
		target.innerHTML = draft.valid ? `<strong>Obracun ovog unosa: ${draft.hours.toFixed(2)} h ? ${formatEUR(draft.amount)}</strong><small>Ovo je automatski obracun prije cuvanja. Poslije spremanja ide u kalendar i listu.</small>` : '<strong>Obracun ovog unosa: 0.00 h ? 0,00 EUR</strong><small>Unesite datum, pocetak, kraj, pauzu i cijenu rada.</small>';
	};
	function ensureTimeAutoCalculation(own) {
		const form = document.querySelector('#time-form');
		if (!form) return;
		if (!form.elements.date.value) form.elements.date.value = new Date().toISOString().slice(0, 10);
		const prefs = loadTimePrefs();
		if (form.elements.workerId && prefs.workerId && [...form.elements.workerId.options].some((option) => option.value === prefs.workerId)) form.elements.workerId.value = prefs.workerId;
		if (!form.elements.start.value) form.elements.start.value = prefs.start || '08:00';
		if (!form.elements.end.value) form.elements.end.value = prefs.end || '17:00';
		if (!form.elements.breakMinutes.value) form.elements.breakMinutes.value = prefs.breakMinutes || '60';
		if (prefs.rateType) form.elements.rateType.value = prefs.rateType;
		if (prefs.rate && !form.elements.rate.value) form.elements.rate.value = prefs.rate;
		const selectedWorker = () => latestTimeWorkers.find((worker) => worker.id === form.elements.workerId?.value) || own;
		const fillDefaultRate = () => {
			if (Number(form.elements.rate.value || 0) > 0) return;
			const worker = selectedWorker();
			form.elements.rate.value = form.elements.rateType.value === 'hourly' ? Number(worker?.hourlyRate || 0) : Number(worker?.dailyRate || 0);
		};
		if (form.dataset.autoCalculation !== 'ready') {
			form.dataset.autoCalculation = 'ready';
			['date', 'start', 'end', 'breakMinutes', 'rate', 'rateType', 'workerId'].forEach((name) => form.elements[name]?.addEventListener('input', () => { updateTimeLiveCalculation(); saveTimePrefs(form); }));
			form.elements.date?.addEventListener('input', () => renderWorkCalendar(latestOwnTimeEntries, form.elements.date.value));
			form.elements.workerId?.addEventListener('change', () => { form.elements.rate.value = ''; fillDefaultRate(); renderWorkCalendar(latestOwnTimeEntries, form.elements.date.value); updateTimeLiveCalculation(); saveTimePrefs(form); });
			form.elements.rateType?.addEventListener('change', () => { form.elements.rate.value = ''; fillDefaultRate(); updateTimeLiveCalculation(); });
		}
		fillDefaultRate(); updateTimeLiveCalculation();
	}
	function renderQuickWorkers() {
		const target = document.querySelector('#quick-workers');
		if (!target) return;
		const canManage = isOwner();
		target.innerHTML = canManage && latestTimeWorkers.length ? `<h3>Radnici</h3>${latestTimeWorkers.map((worker) => `<div class="list-item"><strong>${escapeHtml(worker.name)}</strong><small>${escapeHtml(worker.email || worker.phone || 'bez kontakta')} · Dnevnica ${formatEUR(worker.dailyRate || 0)} · Satnica ${formatEUR(worker.hourlyRate || 0)}</small><div class="worker-actions"><button class="secondary rename-worker" data-worker="${worker.id}" type="button">Preimenuj</button><button class="secondary delete-worker" data-worker="${worker.id}" type="button">Obriši</button></div></div>`).join('')}` : '';
		target.querySelectorAll('.rename-worker').forEach((button) => button.addEventListener('click', async () => {
			const worker = latestTimeWorkers.find((item) => item.id === button.dataset.worker);
			if (!worker) return;
			const name = window.prompt('Ime i prezime:', worker.name);
			if (!name?.trim()) return;
			const contact = window.prompt('Telefon ili email:', worker.email || worker.phone || '');
			if (!contact?.trim()) return;
			const dailyRate = window.prompt('Dnevnica EUR:', worker.dailyRate || 0);
			const hourlyRate = window.prompt('Satnica EUR:', worker.hourlyRate || 0);
			try { await request(`/users/${worker.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name: name.trim(), contact: contact.trim(), dailyRate, hourlyRate }) }); await Promise.allSettled([loadTime(), loadUsers(), loadPayroll()]); toast('Radnik je preimenovan.'); }
			catch { toast('Radnik nije izmijenjen.'); }
		}));
		target.querySelectorAll('.delete-worker').forEach((button) => button.addEventListener('click', async () => {
			const worker = latestTimeWorkers.find((item) => item.id === button.dataset.worker);
			if (!worker || !window.confirm(`Obrisati radnika ${worker.name}?`)) return;
			try { await request(`/users/${worker.id}`, { method:'DELETE' }); await Promise.allSettled([loadTime(), loadUsers(), loadPayroll()]); toast('Radnik je obrisan.'); }
			catch { toast('Radnik nije obrisan.'); }
		}));
	}
	function renderWorkCalendar(entries, selectedDate) {
		const target = document.querySelector('#work-calendar');
		if (!target) return;
		const selectedWorkerId = document.querySelector('#time-form')?.elements.workerId?.value || currentUser?.id;
		const visibleEntries = (entries || []).filter((entry) => !selectedWorkerId || entry.workerId === selectedWorkerId || (!entry.workerId && selectedWorkerId === currentUser?.id));
		const month = monthKeyFromDate(selectedDate);
		const [year, monthNumber] = month.split('-').map(Number);
		const first = new Date(year, monthNumber - 1, 1);
		const last = new Date(year, monthNumber, 0);
		const entryByDate = new Map(visibleEntries.filter((entry) => String(entry.date || '').startsWith(month)).map((entry) => [entry.date, entry]));
		let workingDays = 0;
		let cells = '';
		for (let pad = 0; pad < (first.getDay() || 7) - 1; pad += 1) cells += '<span class="calendar-cell empty"></span>';
		for (let day = 1; day <= last.getDate(); day += 1) {
			const date = `${month}-${String(day).padStart(2, '0')}`;
			const weekday = new Date(year, monthNumber - 1, day).getDay();
			const weekend = weekday === 0 || weekday === 6;
			if (!weekend) workingDays += 1;
			const entry = entryByDate.get(date);
			cells += `<button type="button" class="calendar-cell${weekend ? ' weekend' : ''}${entry ? ' worked' : ''}" data-work-date="${date}" title="${entry ? `${Number(entry.hours || 0).toFixed(2)} h ? ${formatEUR(entry.workAmount || 0)}` : `Oznaci sate za ${date}`}"><strong>${day}</strong>${entry ? `<small>${Number(entry.hours || 0).toFixed(1)}h</small>` : '<small>+</small>'}</button>`;
		}
		const workedDays = entryByDate.size;
		const monthHours = [...entryByDate.values()].reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
		const monthAmount = [...entryByDate.values()].reduce((sum, entry) => sum + Number(entry.workAmount || 0), 0);
		target.innerHTML = `<div class="work-calendar-head"><strong>Kalendar radnih dana ? ${month}</strong><small>Radnih dana: ${workingDays} ? Uneseno: ${workedDays} ? ${monthHours.toFixed(2)} h ? ${formatEUR(monthAmount)}</small></div><div class="calendar-hint">Klikni dan da oznacis sate direktno iz kalendara.</div><div class="calendar-weekdays"><span>Pon</span><span>Uto</span><span>Sri</span><span>Cet</span><span>Pet</span><span>Sub</span><span>Ned</span></div><div class="calendar-grid">${cells}</div>`;
		target.querySelectorAll('[data-work-date]').forEach((button) => button.addEventListener('click', async () => {
			const form = document.querySelector('#time-form');
			if (!form) return;
			form.elements.date.value = button.dataset.workDate;
			updateTimeLiveCalculation();
			const draft = calculateTimeDraft();
			if (!draft.valid) { form.elements.start?.focus(); toast('Unesi pocetak, kraj, pauzu i cijenu pa opet klikni dan.'); return; }
			if (!window.confirm(`Sacuvati ${button.dataset.workDate}: ${draft.hours.toFixed(2)} h ? ${formatEUR(draft.amount)}?`)) return;
			try { await saveTimeEntryFromForm(form); await refreshActiveView(); toast('Radni dan je oznacen u kalendaru.'); } catch { toast('Radni dan nije sacuvan.'); }
		}));
	}
	async function loadTime() {
		const entries = await request('/time-entries');
		const own = await request('/my-payroll-summary');
		const managerView = isOwner();
		latestTimeWorkers = managerView ? (await request('/contacts')).filter((user) => ['worker','user'].includes(user.role)) : [{ ...currentUser, dailyRate: own.dailyRate, hourlyRate: own.hourlyRate }];
		const form = document.querySelector('#time-form');
		const workerSelect = form?.elements.workerId;
		if (workerSelect) {
			const previous = workerSelect.value || loadTimePrefs().workerId || currentUser?.id || '';
			workerSelect.innerHTML = latestTimeWorkers.map((worker) => `<option value="${worker.id}">${escapeHtml(worker.name)}${worker.dailyRate || worker.hourlyRate ? ` ? ${formatEUR(worker.dailyRate || 0)}/j ? ${formatEUR(worker.hourlyRate || 0)}/h` : ''}</option>`).join('');
			workerSelect.value = latestTimeWorkers.some((worker) => worker.id === previous) ? previous : (latestTimeWorkers[0]?.id || '');
			document.querySelector('#time-worker-field')?.toggleAttribute('hidden', !managerView);
		}
		renderQuickWorkers();
		const selectedWorkerId = workerSelect?.value || currentUser?.id;
		const selectedWorker = latestTimeWorkers.find((worker) => worker.id === selectedWorkerId) || { ...currentUser, dailyRate: own.dailyRate, hourlyRate: own.hourlyRate };
		const selectedEntries = entries.filter((entry) => entry.workerId === selectedWorkerId || (!entry.workerId && selectedWorkerId === currentUser?.id));
		const selectedMonth = monthKeyFromDate(form?.elements.date?.value);
		const monthEntries = selectedEntries.filter((entry) => String(entry.date || '').startsWith(selectedMonth));
		const monthHours = monthEntries.reduce((sum, item) => sum + Number(item.hours || 0), 0);
		const monthDays = new Set(monthEntries.map((item) => item.date)).size;
		const monthAmount = monthEntries.reduce((sum, item) => sum + Number(item.workAmount || 0), 0);
		document.querySelector('#total-hours').textContent = `${entries.reduce((sum, item) => sum + Number(item.hours || 0), 0).toFixed(2)} h`;
		const rates = document.querySelector('#time-rates') || (() => { const element = document.createElement('div'); element.id = 'time-rates'; document.querySelector('#time-summary').before(element); return element; })();
		rates.textContent = `${selectedWorker?.name || currentUser?.name} ? Taux journalier : ${formatEUR(selectedWorker?.dailyRate || 0)} ? Taux horaire : ${formatEUR(selectedWorker?.hourlyRate || 0)}`;
		document.querySelector('#time-summary').textContent = `${monthHours.toFixed(2)} h`;
		document.querySelector('#time-days').textContent = `Jours : ${monthDays}`;
		document.querySelector('#time-money').textContent = `Calcul : ${formatEUR(monthAmount)}`;
		latestOwnTimeEntries = entries;
		ensureTimeAutoCalculation(selectedWorker);
		renderWorkCalendar(latestOwnTimeEntries, form?.elements.date?.value);
		const canApprove = isOwner();
		document.querySelector('#time-entries').innerHTML = selectedEntries.length ? selectedEntries.map((item) => `<div class="list-item"><strong>${item.workerName} ? ${Number(item.hours || 0).toFixed(2)} h ? ${formatEUR(item.workAmount || 0)}</strong><small>${item.date} ? ${item.start}-${item.end} ? ${item.status}</small>${canApprove && item.status === 'pending' ? `<button class="secondary approve-time" data-time="${item.id}" data-status="approved">Odobri</button><button class="secondary approve-time" data-time="${item.id}" data-status="rejected">Odbij</button>` : ''}</div>`).join('') : '<small>Aucune saisie de temps de travail pour ce travailleur.</small>';
		document.querySelectorAll('.approve-time').forEach((button) => button.addEventListener('click', async () => { await request(`/time-entries/${button.dataset.time}/status`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status:button.dataset.status }) }); await refreshActiveView(); toast(button.dataset.status === 'approved' ? 'Radno vreme je odobreno.' : 'Radno vreme je odbijeno.'); }));
	}
	async function loadPayroll() { try { const result = await request('/payroll/summary'); document.querySelector('#payroll-total').textContent = `${Number(result.total || 0).toFixed(2)} EUR`; } catch { document.querySelector('#payroll-total').textContent = 'Nedostupno'; } }
	async function loadFinancialSummary() {
		try {
			await loadProjectOptions();
			const projectId = currentProjectId();
			if (!projectId) { document.querySelector('#budget-remaining').textContent = 'Nema chantier-a'; return; }
			const result = await request(`/projects/${projectId}/financial-summary`);
			document.querySelector('#budget-remaining').textContent = result.budgetStatus === 'available' ? `${Number(result.remaining).toFixed(2)} EUR` : 'Nema Devis-a';
		} catch { document.querySelector('#budget-remaining').textContent = 'Nedostupno'; }
	}
	function ensureScheduleEditor(schedule) {
		if (!isOwner()) return;
		document.querySelector('#schedule-form')?.remove();
		document.querySelector('#delay-form')?.remove();
		const panel = document.querySelector('.schedule-panel');
		const projectId = currentProjectId();
		if (!panel || !projectId) return;
		const form = document.createElement('form'); form.id = 'schedule-form'; form.className = 'schedule-editor'; form.innerHTML = `<h3>Modifier le calendrier</h3><label>D?but des travaux<input name="startDate" type="date" value="${schedule.startDate || ''}" required /></label><label>?ch?ance pr?vue<input name="plannedEndDate" type="date" value="${schedule.plannedEndDate || ''}" required /></label><button class="primary" type="submit">Enregistrer le calendrier</button>`; panel.append(form);
		form.addEventListener('submit', async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(form).entries()); try { await request(`/projects/${currentProjectId()}/schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); await loadSchedule(); toast('Le calendrier a ?t? enregistr?.'); } catch (error) { toast(`Calendrier non enregistr? : ${error.message || 'erreur inconnue'}`); } });
		const delayForm = document.createElement('form'); delayForm.id = 'delay-form'; delayForm.className = 'schedule-editor'; delayForm.innerHTML = `<h3>D?clarer un retard</h3><label>Cat?gorie<select name="category"><option value="weather">M?t?o</option><option value="materials">Retard des mat?riaux</option><option value="client">Client</option><option value="technical">Technique</option><option value="other">Autre</option></select></label><label>Nombre de jours<input name="days" type="number" min="1" step="1" required /></label><label>Motif du retard<textarea name="reason" required></textarea></label><button class="secondary" type="submit">Enregistrer le retard</button>`; panel.append(delayForm);
		delayForm.addEventListener('submit', async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(delayForm).entries()); try { await request(`/projects/${currentProjectId()}/delays`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); delayForm.reset(); await loadSchedule(); toast('Le retard a ?t? enregistr?.'); } catch (error) { toast(`Retard non enregistr? : ${error.message || 'erreur inconnue'}`); } });
	}
	async function loadSchedule() {
		await loadProjectOptions();
		const projectId = currentProjectId();
		const target = document.querySelector('#schedule-summary'); const status = document.querySelector('#schedule-status');
		if (!projectId) { status.textContent = 'Aucun chantier'; target.innerHTML = '<small>Prvo registruj chantier u Devis sekciji.</small>'; return; }
		const schedule = await request(`/projects/${projectId}/schedule`);
		status.textContent = schedule.delayDays ? `${schedule.delayDays} jours de retard` : 'Aucun retard';
		target.innerHTML = `<div class="list-item"><strong>D?but des travaux : ${schedule.startDate || 'non renseign?'}</strong><small>?ch?ance pr?vue : ${schedule.plannedEndDate || 'non renseign?e'} ? ?ch?ance ajust?e : ${schedule.adjustedEndDate || 'non calcul?e'}</small></div>${schedule.delays.map((item) => `<div class="list-item"><strong>${item.category} ? ${item.days} jours</strong><small>${item.reason}</small></div>`).join('')}`;
		ensureScheduleEditor(schedule);
	}
	async function loadDocuments() { const documents = await request('/documents'); const canManage = isOwner(); document.querySelector('#documents').innerHTML = documents.length ? documents.map((item) => `<div class="list-item"><strong>${item.originalName}</strong><small>${item.evidenceType || 'other'} · ${item.phase || 'general'} · ${Math.max(1, Math.round(item.size / 1024))} KB · ${item.projectId}</small>${canManage ? `<div class="document-actions"><button class="secondary rename-document" data-document="${item.id}">Preimenuj</button><button class="secondary copy-document" data-document="${item.id}">Kopiraj</button><button class="secondary delete-document" data-document="${item.id}">Obriši</button></div>` : ''}</div>`).join('') : '<small>Nema sačuvanih dokumenata.</small>'; document.querySelectorAll('.rename-document').forEach((button) => button.addEventListener('click', async () => { const item = documents.find((document) => document.id === button.dataset.document); const name = window.prompt('Novo ime dokumenta:', item?.originalName || ''); if (!name?.trim()) return; await request(`/documents/${button.dataset.document}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) }); await refreshActiveView(); toast('Dokument je preimenovan.'); })); document.querySelectorAll('.copy-document').forEach((button) => button.addEventListener('click', async () => { await request(`/documents/${button.dataset.document}/copy`, { method: 'POST' }); await refreshActiveView(); toast('Kopija dokumenta je dodata.'); })); document.querySelectorAll('.delete-document').forEach((button) => button.addEventListener('click', async () => { const item = documents.find((document) => document.id === button.dataset.document); if (!item || !window.confirm(`Obrisati dokument „${item.originalName}“?`)) return; await request(`/documents/${button.dataset.document}`, { method: 'DELETE' }); await refreshActiveView(); toast('Dokument je obrisan.'); })); }
	async function loadBudget() {
		await loadProjectOptions();
		const target = document.querySelector('#budget-summary');
		const form = document.querySelector('#budget-form');
		const projects = visibleProjects();
		const selectedProjectId = form?.querySelector('[name="projectId"]')?.value || '__new';
		const rows = [];
		for (const project of projects) {
			const budget = await request(`/projects/${project.id}/budget`);
			const financial = await request(`/projects/${project.id}/financial-summary`);
			rows.push({ project, budget, financial });
		}
		const selected = rows.find((row) => row.project.id === selectedProjectId);
		if (form && selected?.budget?.status !== 'missing') {
			form.querySelector('[name="devisNumber"]').value = selected.budget.devisNumber || '';
			form.querySelector('[name="client"]').value = selected.budget.client || '';
			form.querySelector('[name="chantierName"]').value = selected.budget.chantierName || selected.project.name || '';
			form.querySelector('[name="total"]').value = selected.budget.total || '';
		} else if (form && selectedProjectId !== '__new') {
			form.querySelector('[name="devisNumber"]').value = '';
			form.querySelector('[name="client"]').value = '';
			form.querySelector('[name="chantierName"]').value = selected?.project?.name || '';
			form.querySelector('[name="total"]').value = '';
		}
		target.innerHTML = rows.length ? rows.map(({ project, budget, financial }) => `<div class="list-item"><strong>${escapeHtml(project.name)}</strong><small>${budget.status === 'missing' ? 'Aucun Devis enregistr?' : `${escapeHtml(budget.devisNumber || 'Devis')} ? ${escapeHtml(budget.client || 'Client')} ? ${formatEUR(financial.budget)}`}</small><div>Nabavke: ${formatEUR(financial.purchases)} ? Rad: ${Number(financial.approvedWorkHours || 0).toFixed(2)} h ? Ukupno potro?eno: ${formatEUR(financial.spent)} ? Preostalo: ${financial.remaining === null ? 'N/A' : formatEUR(financial.remaining)}</div>${project.id !== 'lot-a' && isOwner() ? `<button class="secondary remove-project" data-project="${project.id}" data-name="${escapeHtml(project.name)}" type="button">Obri?i chantier</button>` : ''}</div>`).join('') : '<small>Nema registrovanih chantiers.</small>';
		document.querySelectorAll('.remove-project').forEach((button) => button.addEventListener('click', async () => {
			if (!window.confirm(`Obrisati chantier ${button.dataset.name} i povezane podatke?`)) return;
			try { await request(`/projects/${button.dataset.project}`, { method: 'DELETE' }); await refreshActiveView(); toast('Chantier je obrisan.'); }
			catch (error) { let message = 'Chantier nije obrisan.'; try { message = JSON.parse(error.message).error || message; } catch {} toast(message); }
		}));
	}
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
			try { const items = await request('/payout-requests'); const item = items.filter((entry) => entry.month === month && (isOwner() || entry.userId === currentUser?.id)).at(-1); if (!item) throw new Error('Za izabrani mesec prvo pošaljite zahtev za platu.'); const response = await fetch(`${api}/payout-requests/${item.id}/pdf`, { headers: { Authorization: `Bearer ${token()}` } }); if (!response.ok) throw new Error('PDF nije moguće napraviti.'); const blob = await response.blob(); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `ibra-payout-${month}.pdf`; link.click(); URL.revokeObjectURL(link.href); message.textContent = 'PDF je preuzet.'; } catch (error) { message.textContent = error.message || 'PDF nije moguće preuzeti.'; }
		});
	}
	function ensureHoursPdfButton() {
		if (document.querySelector('#send-hours-pdf')) return;
		const form = document.querySelector('#time-form'); if (!form) return;
		const previous = new Date(); previous.setMonth(previous.getMonth() - 1);
		const defaultMonth = previous.toISOString().slice(0, 7);
		const panel = document.createElement('div');
		panel.className = 'hours-pdf-panel';
		panel.innerHTML = `<label>PDF lista dana za gazdu (šalje se 1. u mjesecu)<input id="hours-pdf-month" type="month" value="${defaultMonth}" /></label><button class="secondary" id="send-hours-pdf" type="button">Pošalji PDF listu dana gazdi</button><small>Sadrži odobrene dane, sate i iznos za izabrani mjesec.</small>`;
		form.append(panel);
		panel.querySelector('#send-hours-pdf').addEventListener('click', async () => { try { const month = panel.querySelector('#hours-pdf-month').value || defaultMonth; const result = await request('/time-entries/pdf/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month }) }); toast(`PDF lista dana je poslata gazdi: ${Number(result.amount || 0).toFixed(2)} EUR.`); } catch { toast('PDF lista dana nije poslata. Proverite odobrene dane i email podešavanja.'); } });
	}
	let currentUser;
	const registrationForm = document.querySelector('#registration-form');
	const registrationSuccess = document.querySelector('#registration-success');
	const loginForm = document.querySelector('#login-form');
	const registrationRole = document.querySelector('#registration-role');
	const loginRole = loginForm?.elements.role;
	const updateLoginFields = () => { const role = loginRole?.value; const siret = document.querySelector('#login-siret-field'); if (siret) { siret.hidden = role !== 'gerant'; siret.querySelector('input').required = role === 'gerant'; } };
	loginRole?.addEventListener('change', updateLoginFields);
	updateLoginFields();
	const updateRegistrationFields = () => {
		const siret = document.querySelector('#registration-siret');
		const company = document.querySelector('#registration-company');
		if (siret) { siret.hidden = false; siret.querySelector('input').required = true; }
		if (company) company.querySelector('input').required = true;
	};
	registrationRole?.addEventListener('change', updateRegistrationFields);
	updateRegistrationFields();
	wireSiretLookup(registrationForm?.elements.siret, document.querySelector('#registration-company-preview'), registrationForm?.elements.company);
	const authChoice = document.querySelector('#auth-choice');
	const resetForm = document.querySelector('#reset-form');
	const showLogin = () => { if (authChoice) authChoice.hidden = true; registrationForm.hidden = true; registrationSuccess.hidden = true; resetForm.hidden = true; loginForm.hidden = false; loginForm.elements.phone.focus(); };
	const showRegistration = () => { authChoice.hidden = true; loginForm.hidden = true; registrationSuccess.hidden = true; registrationForm.hidden = false; };
	const loadInitialData = async () => {
		const loads = [loadDashboard(), loadEvidenceSummary(), loadRgeQualibat(), loadControlHistory(), loadBudget(), loadFinancialSummary(), loadSchedule(), loadUsers(), loadMessages(), loadTime(), loadPayroll(), loadDocuments(), loadPurchases(), loadProduction(), loadWorkSequence(), loadPayouts()];
		const results = await Promise.allSettled(loads);
		results.filter((result) => result.status === 'rejected').forEach((result) => console.warn('Initial load failed', result.reason));
		ensurePayoutPdfPanel();
	};
	const refreshActiveView = async () => {
		const active = document.querySelector('.view.active')?.id;
		const refreshers = {
			'dashboard-view': () => Promise.allSettled([loadDashboard(), loadFinancialSummary()]),
			'devis-view': () => Promise.allSettled([loadBudget(), loadFinancialSummary()]),
			'purchases-view': () => Promise.allSettled([loadPurchases(), loadBudget(), loadFinancialSummary()]),
			'chantier-view': () => Promise.allSettled([loadDashboard(), loadControlHistory()]),
			'evidence-summary-view': () => Promise.allSettled([loadEvidenceSummary(), loadDocuments(), loadWorkSequence()]),
			'documents-view': () => Promise.allSettled([loadDocuments(), loadEvidenceSummary(), loadWorkSequence()]),
			'tasks-view': () => Promise.allSettled([loadMessages(), loadTime(), loadPayroll(), loadProduction(), loadPayouts()]),
			'settings-view': () => Promise.allSettled([loadUsers(), loadMessages()])
		};
		await (refreshers[active]?.() || loadInitialData());
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
	document.querySelector('#logout-button').addEventListener('click', () => { localStorage.removeItem('ibra-auth-token'); currentUser = undefined; document.querySelector('#login-form').reset(); document.querySelector('#registration-form')?.reset(); document.querySelector('#registration-form')?.setAttribute('hidden', ''); document.querySelector('#registration-success')?.setAttribute('hidden', ''); document.querySelector('#login-form').setAttribute('hidden', ''); authChoice?.removeAttribute('hidden'); loginModal.classList.remove('hidden'); });
	document.querySelector('#message-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await request('/messages', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ...Object.fromEntries(new FormData(event.currentTarget).entries()), projectId:'lot-a' }) }); event.currentTarget.reset(); await refreshActiveView(); toast('Poruka je sačuvana.'); } catch { toast('Poruka nije poslata.'); } });
	document.querySelector('#time-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await saveTimeEntryFromForm(event.currentTarget); const prefs = loadTimePrefs(); event.currentTarget.reset(); event.currentTarget.elements.start.value = prefs.start || '08:00'; event.currentTarget.elements.end.value = prefs.end || '17:00'; event.currentTarget.elements.breakMinutes.value = prefs.breakMinutes || '60'; event.currentTarget.elements.rateType.value = prefs.rateType || 'daily'; event.currentTarget.elements.rate.value = prefs.rate || ''; await refreshActiveView(); toast('Radno vreme je sa?uvano.'); } catch { toast('Radno vreme nije sa?uvano.'); } });
	document.querySelector('#quick-worker-form')?.addEventListener('submit', async (event) => { event.preventDefault(); try { const values = Object.fromEntries(new FormData(event.currentTarget).entries()); values.email = values.contact; await request('/workers', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(values) }); event.currentTarget.reset(); await Promise.allSettled([loadUsers(), loadMessages(), loadPayroll(), loadTime()]); toast('Email poziv je poslat radniku da sam izabere password.'); } catch (error) { let message = 'Ouvrier nije dodat.'; try { const details = JSON.parse(error.message); if (details.error === 'Worker already exists') message = 'Ovaj radnik vec postoji.'; if (details.error?.includes('Email delivery')) message = 'Email nije poslat: podesite SMTP/Brevo na Renderu.'; } catch {} toast(message); } });
	const userRoleField = document.querySelector('#user-role'); const updateUserRoleFields = () => { const role = userRoleField?.value; const siretField = document.querySelector('#siret-field'); const companyField = document.querySelector('#company-field'); const rateFields = document.querySelectorAll('.rate-field'); if (siretField) { siretField.hidden = role !== 'gerant'; siretField.querySelector('input').required = role === 'gerant'; } if (companyField) { companyField.hidden = role !== 'gerant'; companyField.querySelector('input').required = role === 'gerant'; } rateFields.forEach((field) => { field.hidden = role !== 'user'; }); }; userRoleField?.addEventListener('change', updateUserRoleFields); updateUserRoleFields(); wireSiretLookup(document.querySelector('#user-form')?.elements.siret, document.querySelector('#user-company-preview'), document.querySelector('#user-form')?.elements.company);
		document.querySelector('#user-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const created = await request('/users', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) }); event.currentTarget.reset(); updateUserRoleFields(); await refreshActiveView(); const delivery = created.delivery === 'email' ? 'e-mail' : `lokalni link: ${created.setupUrl}`; toast(`Korisnik je dodat. Link za izbor passworda poslat preko ${delivery}.`); } catch (error) { let message = 'Korisnik nije dodat.'; try { const details = JSON.parse(error.message); if (details.error === 'User already exists') message = 'Ovaj e-mail već postoji.'; if (details.error?.includes('Email delivery') || details.error?.includes('email')) message = 'Email nije poslat: podesite SMTP/Brevo na Renderu.'; if (details.error === 'Access denied') message = 'Samo gazda može dodavati korisnike.'; } catch {} toast(message); } });
	document.querySelector('#upload-form').addEventListener('submit', async (event) => { event.preventDefault(); const file = document.querySelector('#file-input').files[0]; if (!file) { toast('S?lectionnez un fichier avant l?enregistrement.'); return; } const body = new FormData(event.currentTarget); body.set('file', file, file.name); body.set('responseLanguage', language); try { const response = await fetch(`${api}/documents/upload`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || `${response.status}`); event.currentTarget.reset(); await refreshActiveView(); if (result.autoAnalysis) { showView('evidence-summary-view'); renderAutoAnalysis(document.querySelector('#ai-answer'), result.autoAnalysis); } toast(result.autoAnalysis ? 'Dokument je sa?uvan i automatski analiziran.' : 'Le document a ?t? enregistr? sur le serveur.'); } catch (error) { toast(`Document non enregistr? : ${error.message || 'erreur inconnue'}`); } });
	document.querySelector('#budget-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const file = document.querySelector('#budget-file').files[0]; const form = event.currentTarget; const ensureProjectId = async () => { const select = form.querySelector('[name="projectId"]'); if (select.value !== '__new') return select.value; const chantierName = form.querySelector('[name="chantierName"]').value.trim() || form.querySelector('[name="client"]').value.trim() || 'Nouveau chantier'; const project = await request('/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name: chantierName, chantierName }) }); await loadProjectOptions(); select.value = project.id; return project.id; }; const sendBudget = async (replaceExisting = false) => { const projectId = await ensureProjectId(); const body = new FormData(form); body.set('projectId', projectId); if (file) body.set('file', file, file.name); if (replaceExisting) body.set('replaceExisting', 'true'); return fetch(`${api}/projects/${projectId}/budget`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); }; try { let response = await sendBudget(false); if (response.status === 409 && window.confirm('Un Devis existe deja pour ce chantier. Remplacer par le nouveau PDF ?')) response = await sendBudget(true); if (!response.ok) { const details = await response.text(); throw new Error(`${response.status}: ${details}`); } form.reset(); await refreshActiveView(); toast('Devis et chantier enregistres.'); } catch (error) { toast(`Devis non enregistre : ${error.message || 'erreur inconnue'}`); } });
	document.querySelector('#budget-file')?.addEventListener('change', async (event) => { const file = event.currentTarget.files[0]; if (!file) return; const body = new FormData(); body.append('file', file); const status = document.querySelector('#devis-extraction-status'); status.textContent = 'Čitanje PDF-a...'; try { const response = await fetch(`${api}/budget/inspect`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); if (!response.ok) throw new Error(); const result = await response.json(); const form = document.querySelector('#budget-form'); form.querySelector('[name="devisNumber"]').value = result.extracted.number; form.querySelector('[name="client"]').value = result.extracted.client; form.querySelector('[name="chantierName"]').value = result.extracted.chantier; form.querySelector('[name="total"]').value = result.extracted.total || ''; const projectSelect = form.querySelector('[name="projectId"]'); const chantierText = result.extracted.chantier.toLowerCase(); const matchingOption = [...projectSelect.options].find((option) => option.value !== '__new' && chantierText && option.textContent.toLowerCase().includes(chantierText)); projectSelect.value = matchingOption ? matchingOption.value : '__new'; status.textContent = result.needsConfirmation ? 'PDF je pročitan delimično. Proveri označena polja pre čuvanja.' : `Automatski pročitano iz: ${result.source}`; } catch { status.textContent = 'PDF nije moguće automatski pročitati. Unesi vrednosti ručno.'; } });
	document.querySelector('#budget-form [name="projectId"]')?.addEventListener('change', loadBudget);
		document.querySelector('#purchase-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const file = document.querySelector('#invoice-file').files[0]; const body = new FormData(event.currentTarget); if (!file) { toast('Dodaj PDF račun ili opravdanje.'); return; } body.append('invoice', file); try { const response = await fetch(`${api}/purchases`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); if (!response.ok) throw new Error(); event.currentTarget.reset(); await refreshActiveView(); toast('Trošak i PDF faktura su sačuvani; Devis je automatski ažuriran.'); } catch { toast('Trošak nije sačuvan.'); } });
	document.querySelector('#invoice-file')?.addEventListener('change', async (event) => { const file = event.currentTarget.files[0]; if (!file) return; const body = new FormData(); body.append('file', file); const status = document.querySelector('#purchase-extraction-status'); status.textContent = 'Čitanje PDF fakture...'; try { const response = await fetch(`${api}/pdf/inspect`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); if (!response.ok) throw new Error(); const result = await response.json(); const form = document.querySelector('#purchase-form'); form.querySelector('[name="supplier"]').value = result.extracted.supplier; form.querySelector('[name="amount"]').value = result.extracted.amount || ''; form.querySelector('[name="purchaseDate"]').value = result.extracted.date || ''; status.textContent = result.needsOcr ? 'PDF je skeniran. Potrebna je ručna provera/OCR.' : `Automatski pročitano iz: ${result.source}`; } catch { status.textContent = 'PDF nije moguće automatski pročitati. Unesi vrednosti ručno.'; } });
	restoreSession();
});
