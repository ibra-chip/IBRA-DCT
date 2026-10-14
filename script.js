document.addEventListener('DOMContentLoaded', () => {
	// Always the real backend, regardless of what origin served this HTML (ibra-ba.net today, a
	// Cloudflare Pages test domain tomorrow) -- except on localhost, where it stays same-origin so
	// local dev (npm run dev) keeps talking to the local server, not production.
	const api = (() => {
		if (window.location.protocol === 'file:') return 'http://localhost:3000/api';
		if (['localhost', '127.0.0.1'].includes(window.location.hostname)) return `${window.location.origin}/api`;
		return 'https://ibra-ba.net/api';
	})();
	const updateOfflineBadge = () => document.querySelector('#offline-badge')?.toggleAttribute('hidden', navigator.onLine);
	window.addEventListener('online', updateOfflineBadge);
	window.addEventListener('offline', updateOfflineBadge);
	updateOfflineBadge();
	const loginModal = document.querySelector('#login-modal');
	const appShell = document.querySelector('.app-shell');
	const mobileNavToggle = document.querySelector('#mobile-nav-toggle');
	const mobileNavBackdrop = document.querySelector('#mobile-nav-backdrop');
	const token = () => localStorage.getItem('ibra-auth-token');
	const setMobileNav = (open) => {
		appShell?.classList.toggle('mobile-nav-open', open);
		mobileNavToggle?.setAttribute('aria-expanded', String(open));
		if (mobileNavBackdrop) mobileNavBackdrop.hidden = !open;
	};
	mobileNavToggle?.addEventListener('click', () => setMobileNav(!appShell?.classList.contains('mobile-nav-open')));
	mobileNavBackdrop?.addEventListener('click', () => setMobileNav(false));
	document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setMobileNav(false); });
	const installBtn = document.querySelector('#install-app-btn');
	let deferredInstallPrompt = null;
	const isStandaloneApp = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
	if (installBtn) {
		if (isStandaloneApp()) installBtn.hidden = true;
		window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstallPrompt = event; });
		window.addEventListener('appinstalled', () => { installBtn.hidden = true; deferredInstallPrompt = null; });
		installBtn.addEventListener('click', async () => {
			if (deferredInstallPrompt) {
				deferredInstallPrompt.prompt();
				const choice = await deferredInstallPrompt.userChoice;
				deferredInstallPrompt = null;
				if (choice.outcome === 'accepted') installBtn.hidden = true;
				return;
			}
			const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
			toast(isIOS ? 'Pour installer : ouvrez le menu Partager puis « Sur l’écran d’accueil ».' : 'Ouvrez le menu de votre navigateur et choisissez « Installer l’application ».');
		});
	}
	const syncAuthModalState = () => { const hidden = loginModal.classList.contains('hidden'); loginModal.setAttribute('aria-hidden', String(hidden)); appShell?.setAttribute('aria-hidden', String(!hidden)); };
	new MutationObserver(syncAuthModalState).observe(loginModal, { attributes: true, attributeFilter: ['class'] });
	syncAuthModalState();
	const ownerRoles = ['admin', 'gerant', 'manager'];
	const workerRoles = ['user', 'worker'];
	const isOwner = (role = currentUser?.role) => ownerRoles.includes(role);
	const isWorkerRole = (role) => workerRoles.includes(role);
	const toast = (message) => { const french = { 'Korisnik je dodat.': 'Utilisateur enregistré.', 'Message enregistré.': 'Message enregistré.', 'Temps de travail enregistré.': 'Temps de travail enregistré.', 'Temps de travail non enregistré.': 'Temps de travail non enregistré.', 'Korisnik nije dodat.': 'Utilisateur non enregistré.', 'Dépense non enregistrée.': 'Dépense non enregistrée.', 'Devis non enregistré.': 'Devis non enregistré.', 'Le devis et le budget ont été enregistrés.': 'Devis et budget enregistrés.' }; const translated = french[message] || String(message).replace('Dokument je obrisan.', 'Document supprimé.').replace('Dokument je preimenovan.', 'Document renommé.').replace('Kopija dokumenta je dodata.', 'Copie du document ajoutée.'); const el = document.querySelector('#toast'); el.textContent = translated; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); };
	// Without this, an unhandled error in a click handler fails completely silently from the user's
	// point of view: the button does nothing, no toast, no visible sign anything went wrong - exactly the
	// "silent killer" pattern this app has been hardened against everywhere else. This can't fix the bug
	// itself, but it makes the failure visible instead of invisible, and rate-limits itself so one error
	// doesn't spam a wall of toasts.
	let lastErrorToastAt = 0;
	const reportUnexpectedError = (error) => {
		console.error('Unhandled client error:', error);
		const now = Date.now();
		if (now - lastErrorToastAt < 4000) return;
		lastErrorToastAt = now;
		toast('Une erreur inattendue est survenue. Réessayez.');
	};
	window.addEventListener('error', (event) => reportUnexpectedError(event.error || event.message));
	window.addEventListener('unhandledrejection', (event) => reportUnexpectedError(event.reason));
	let closeQuickEditOutsideHandler = null;
	let closeQuickEditEscHandler = null;
	function closeQuickEditPopover() {
		document.querySelector('.quick-edit-popover')?.remove();
		if (closeQuickEditOutsideHandler) { document.removeEventListener('click', closeQuickEditOutsideHandler, true); closeQuickEditOutsideHandler = null; }
		if (closeQuickEditEscHandler) { document.removeEventListener('keydown', closeQuickEditEscHandler); closeQuickEditEscHandler = null; }
	}
	function openQuickEditPopover(anchor, html, wire) {
		closeQuickEditPopover();
		const popover = document.createElement('div');
		popover.className = 'quick-edit-popover';
		popover.innerHTML = html;
		document.body.append(popover);
		const rect = anchor.getBoundingClientRect();
		const spaceBelow = window.innerHeight - rect.bottom;
		const openAbove = spaceBelow < popover.offsetHeight + 16 && rect.top > popover.offsetHeight + 16;
		const top = openAbove ? window.scrollY + rect.top - popover.offsetHeight - 6 : window.scrollY + rect.bottom + 6;
		const clampedTop = Math.max(window.scrollY + 8, Math.min(top, window.scrollY + window.innerHeight - popover.offsetHeight - 8));
		const left = Math.max(8, Math.min(window.scrollX + rect.left, window.scrollX + document.documentElement.clientWidth - popover.offsetWidth - 8));
		popover.style.top = `${clampedTop}px`;
		popover.style.left = `${left}px`;
		wire(popover);
		closeQuickEditOutsideHandler = (event) => { if (!event.target.closest('.quick-edit-popover') && !event.target.closest('[data-edit-hours],[data-edit-rdv]')) closeQuickEditPopover(); };
		closeQuickEditEscHandler = (event) => { if (event.key === 'Escape') closeQuickEditPopover(); };
		setTimeout(() => { document.addEventListener('click', closeQuickEditOutsideHandler, true); document.addEventListener('keydown', closeQuickEditEscHandler); }, 0);
		popover.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		popover.querySelector('input')?.focus();
	}
	function openHoursQuickEdit(anchor, entryId, currentHours, onSaved) {
		openQuickEditPopover(anchor, `<strong>Heures</strong><label>Nombre d’heures<input type="number" min="0.25" step="0.25" value="${currentHours}" name="hours" /></label><div class="quick-edit-actions"><button type="button" class="primary" data-qe-save>Enregistrer</button><button type="button" class="danger" data-qe-delete>Supprimer</button><button type="button" class="secondary" data-qe-cancel>Annuler</button></div>`, (popover) => {
			popover.querySelector('[data-qe-save]').addEventListener('click', async () => {
				const hours = Number(popover.querySelector('input[name="hours"]').value);
				if (!Number.isFinite(hours) || hours <= 0) { toast('Unesi ispravan broj sati.'); return; }
				try { await request(`/time-entries/${encodeURIComponent(entryId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hours }) }); closeQuickEditPopover(); await onSaved(); toast('Sati su izmenjeni.'); } catch { toast('Sati nisu izmenjeni.'); }
			});
			popover.querySelector('[data-qe-delete]').addEventListener('click', async () => {
				if (!window.confirm('Obrisati ovaj unos radnog vremena?')) return;
				try { await request(`/time-entries/${encodeURIComponent(entryId)}`, { method: 'DELETE' }); closeQuickEditPopover(); await onSaved(); toast('Unos je obrisan.'); } catch { toast('Unos nije obrisan.'); }
			});
			popover.querySelector('[data-qe-cancel]').addEventListener('click', closeQuickEditPopover);
		});
	}
	function openRdvQuickEdit(anchor, rdvId, currentTime, onSaved) {
		openQuickEditPopover(anchor, `<strong>RDV / odsustvo</strong><label>Vreme<input type="time" value="${escapeHtml(currentTime || '')}" name="time" /></label><div class="quick-edit-actions"><button type="button" class="primary" data-qe-save>Enregistrer</button><button type="button" class="danger" data-qe-delete>Supprimer</button><button type="button" class="secondary" data-qe-cancel>Annuler</button></div>`, (popover) => {
			popover.querySelector('[data-qe-save]').addEventListener('click', async () => {
				const time = popover.querySelector('input[name="time"]').value;
				if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) { toast('Unesi ispravno vreme.'); return; }
				try { await request(`/rendezvous/${encodeURIComponent(rdvId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ time }) }); closeQuickEditPopover(); await onSaved(); toast('RDV je izmenjen.'); } catch { toast('RDV nije izmenjen.'); }
			});
			popover.querySelector('[data-qe-delete]').addEventListener('click', async () => {
				if (!window.confirm('Obrisati ovaj RDV/odsustvo?')) return;
				try { await request(`/rendezvous/${encodeURIComponent(rdvId)}`, { method: 'DELETE' }); closeQuickEditPopover(); await onSaved(); toast('RDV je obrisan.'); } catch { toast('RDV nije obrisan.'); }
			});
			popover.querySelector('[data-qe-cancel]').addEventListener('click', closeQuickEditPopover);
		});
	}
	function openRdvCreateQuickEdit(anchor, { date, projectId, workerId }, onSaved) {
		openQuickEditPopover(anchor, `<strong>Novi RDV / odsustvo</strong><small>${escapeHtml(date)}</small><label>Vreme<input type="time" name="time" required /></label><label>Razlog (opciono)<textarea name="reason"></textarea></label><div class="quick-edit-actions"><button type="button" class="primary" data-qe-save>Enregistrer</button><button type="button" class="secondary" data-qe-cancel>Annuler</button></div>`, (popover) => {
			popover.querySelector('[data-qe-save]').addEventListener('click', async () => {
				const time = popover.querySelector('input[name="time"]').value;
				const reason = popover.querySelector('textarea[name="reason"]').value.trim();
				if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) { toast('Unesi ispravno vreme.'); return; }
				try {
					await request('/rendezvous', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(projectId ? { projectId } : {}), absenceDate: date, date, time, reason, type: 'rdv', ...(workerId ? { workerId } : {}) }) });
					closeQuickEditPopover(); await onSaved(); toast('RDV enregistré.');
				} catch (error) { toast(`RDV non enregistré : ${error.message || 'erreur'}`); }
			});
			popover.querySelector('[data-qe-cancel]').addEventListener('click', closeQuickEditPopover);
		});
	}
	async function createAbsenceDirect({ date, projectId, workerId }, onSaved) {
		try {
			await request('/rendezvous', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(projectId ? { projectId } : {}), absenceDate: date, date, time: '08:00', reason: '', type: 'absence', ...(workerId ? { workerId } : {}) }) });
			await onSaved(); toast('Absence enregistrée.');
		} catch (error) { toast(`Absence non enregistrée : ${error.message || 'erreur'}`); }
	}
	async function deleteHoursEntryDirect(entryId, onSaved) {
		if (!window.confirm('Obrisati ovaj unos radnog vremena?')) return;
		try { await request(`/time-entries/${encodeURIComponent(entryId)}`, { method: 'DELETE' }); await onSaved(); toast('Unos je obrisan.'); } catch { toast('Unos nije obrisan.'); }
	}
	async function deleteRdvEntryDirect(rdvId, onSaved) {
		if (!window.confirm('Obrisati ovaj RDV/odsustvo?')) return;
		try { await request(`/rendezvous/${encodeURIComponent(rdvId)}`, { method: 'DELETE' }); await onSaved(); toast('RDV je obrisan.'); } catch { toast('RDV nije obrisan.'); }
	}
	const formatEUR =(value) => new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'sr-Latn-RS', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(value || 0));
	const weekdayAbbrFr = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
	const translations = { 'Dashboard':'Tableau de bord','Devis':'Devis','Nabavke':'Achats','Chantier kontrole':'Contrôles chantier','RGE / QUALIBAT':'RGE / QUALIBAT','Dokumenti i slike':'Documents et photos','Zadaci i komunikacija':'Tâches et communication','Korisnici':'Utilisateurs','Dokazni paket':'Dossier de preuves','Odjava':'Déconnexion','Contrôle de la bonne exécution des travaux':'Contrôle de la bonne exécution des travaux','Plan, fiche technique, fotografije i potvrda Gerant-a u jednom toku.':'Plan, fiche technique, photos et validation du Gerant dans un seul parcours.','Otvorene kontrole':'Contrôles ouverts','Radno vreme':'Temps de travail','Coût du travail ce mois-ci':'Coût du travail ce mois-ci','Budget restant':'Budget restant','Matériaux, outils et machines':'Matériaux, outils et machines','Radnici':'Ouvriers','Sous-traitance':'Sous-traitance','Nema Devis-a':'Aucun devis','Aucun retard':'Aucun retard','Début de travaux i rok':'Début des travaux et délai','Début de travaux: nije unet':'Début des travaux : non renseigné','Échéance prévue : non renseignée · Échéance ajustée : non calculée':'Échéance prévue : non renseignée · Échéance ajustée : non calculée','Chantier kontrole':'Contrôles chantier','Dokumenti i slike':'Documents et photos','AIDE RGE / QUALIBAT':'AIDE RGE / QUALIBAT','ITE - znanje, kontrole i odgovori':'ITE - connaissances, contrôles et réponses','Pour apprendre et contrôler le chantier':'Pour apprendre et contrôler le chantier','Pretraga pitanja i odgovora':'Recherche questions/réponses',"Traži po riječi, npr. RGE, pare-vapeur, BAR-EN-102, lame d'air, MaPrimeRenov":"Rechercher par mot-clé, ex. RGE, pare-vapeur, BAR-EN-102, lame d'air, MaPrimeRenov",'Saisir un terme...':'Saisir un terme...','RGE kontrolna lista':'Liste de contrôle RGE','Kompletno znanje po temama':'Connaissance complète par thèmes','Les termes techniques français sont conservés pour correspondre à la documentation RGE/QUALIBAT.':'Les termes techniques français sont conservés pour correspondre à la documentation RGE/QUALIBAT.' };
	const runtimeFrench = {
		'Nabavke': 'Achats', 'Dokumenti i slike': 'Documents et photos', 'Zadaci i komunikacija': 'Tâches et communication', 'Korisnici': 'Utilisateurs',
		'Rizik chantier-a': 'Risque du chantier', 'CRITIQUE': 'CRITIQUE', 'ATTENTION': 'ATTENTION', 'STABILAN': 'STABLE',
		'Aucun retard': 'Aucun retard', 'jours de retard': 'jours de retard', 'nije unet': 'non renseigné', 'nije izračunat': 'non calculé', 'Planirani rok:': 'Échéance prévue :', 'Échéance ajustée :': 'Échéance ajustée :', 'Début de travaux:': 'Début des travaux :',
		'Nema promena.': 'Aucune modification.', 'Nema poruka.': 'Aucun message.', 'Aucune dépense.': 'Aucune dépense.', 'Aucun document enregistré.': 'Aucun document enregistré.',
		'Le contrôle n’a pas été mis à jour.': 'Le contrôle n’a pas été mis à jour.', 'Le contrôle a été mis à jour.': 'Le contrôle a été mis à jour.', 'Terminer': 'Terminer', 'Vrati na ispravku': 'Renvoyer pour correction', 'review': 'En revue', 'incomplete': 'Incomplet', 'complete': 'Terminé', 'Dokazni paket': 'Dossier de preuves', 'Nedostaje:': 'Manquants :', 'fiche-technique': 'fiche technique', 'photo-before': 'photo avant travaux', 'photo-during': 'photo pendant les travaux', 'photo-after': 'photo après travaux',
		'Radovi izvedeni prema projektu i pravilima struke': 'Travaux exécutés conformément au projet et aux règles de l’art', 'Sécurité du chantier et équipements de protection': 'Sécurité sur le chantier et équipements de protection', 'Materijali, ugradnja i sledljivost': 'Matériaux, mise en œuvre et traçabilité', 'Fotografije i dokazi po fazama rada': 'Photographies et preuves par phase de travaux',
		'Radno vreme je odobreno.': 'Le temps de travail a été approuvé.', 'Radno vreme je odbijeno.': 'Le temps de travail a été refusé.',
		'Temps de travail non enregistré.': 'Le temps de travail n’a pas été enregistré.', 'Temps de travail enregistré.': 'Le temps de travail a été enregistré.',
		'Poruka nije poslata.': 'Le message n’a pas été envoyé.', 'Message enregistré.': 'Le message a été enregistré.',
		'Korisnik nije dodat.': 'L’utilisateur n’a pas été ajouté.', 'Korisnik je dodat.': 'L’utilisateur a été ajouté.',
		'Devis non enregistré': 'Le devis n’a pas été enregistré', 'Le devis et le budget ont été enregistrés.': 'Le devis et le budget ont été enregistrés.',
		'Impossible de lire le PDF automatiquement. Saisissez les valeurs manuellement.': 'Lecture automatique du PDF impossible. Saisissez les valeurs manuellement.',
		'Le PDF a été lu partiellement. Vérifiez les champs signalés avant d’enregistrer.': 'Le PDF a été lu partiellement. Vérifiez les champs avant l’enregistrement.',
		'Lu automatiquement depuis :': 'Lu automatiquement depuis :', 'Nedostupno': 'Indisponible', 'Nema Devis-a': 'Aucun devis', 'Budget :': 'Budget :', 'Nabavke:': 'Achats :', 'Rad:': 'Travail :', 'Total dépensé :': 'Total dépensé :', 'Preostalo:': 'Solde restant :',
		'Chargement...': 'Chargement...', 'Chargement': 'Chargement', 'Calcul :': 'Calcul :', 'Dani:': 'Jours :', 'Dnevica:': 'Taux journalier :', 'Satnica:': 'Taux horaire :',
		'Lecture du PDF...': 'Lecture du PDF...', 'Enregistrer': 'Enregistrer', 'Dodaj': 'Ajouter', 'Envoyer': 'Envoyer', 'Prijava nije uspela.': 'Échec de la connexion.', 'Prijavljen korisnik': 'Utilisateur connecté', 'Dnevnica:': 'Taux journalier :', 'Nema unosa radnog vremena.': 'Aucune saisie de temps de travail.', 'user': 'Utilisateur', 'worker': 'Ouvrier / artisan', 'manager': 'Manager'
	};
	const translateRuntimeText = () => { if (language !== 'fr') return; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode); nodes.forEach((node) => { let text = node.nodeValue; Object.entries(runtimeFrench).forEach(([source, target]) => { text = text.split(source).join(target); }); if (text !== node.nodeValue) node.nodeValue = text; }); };
	const encodingRepairs = [['Cat?gorie','Catégorie'],['cat?gorie','catégorie'],['ext?rieur','extérieur'],['?nerg?tique','énergétique'],['continuit?','continuité'],['r?duction','réduction'],['qualit?','qualité'],['contr?le','contrôle'],['contr?les','contrôles'],['?uvre','œuvre'],['r?ception','réception'],['conductivit?','conductivité'],['r?sistance','résistance'],['?lev?','élevé'],['cr?er','créer'],['ventil?','ventilé'],['diff?rents','différents'],['?tre','être'],['r?solique','résolique'],['min?rale','minérale'],['li?ge','liège'],['d?pend','dépend'],['humidit?','humidité'],['r?fl?chissants','réfléchissants'],['?pais','épais'],['compl?ment','complément'],['ferm?','fermé'],['?tanch?it?','étanchéité'],['entr?es','entrées'],['pi?ces','pièces'],['concern?es','concernées'],['s?jour','séjour'],['?l?ments','éléments'],['chauff?s','chauffés'],['D?but','Début'],['d?but','début'],['?ch?ance','Échéance'],['renseign?e','renseignée'],['renseign?','renseigné'],['ajust?e','ajustée'],['ajust?','ajusté'],['calcul?e','calculée'],['calcul?','calculé'],['D?clarer','Déclarer'],['Cat?gorie','Catégorie'],['M?t?o','Météo'],['enregistr?','enregistré'],['sa?uvan','sačuvan'],['s?uvan','sačuvan'],['potro?eno','potrošeno'],['Obri?i','Supprimer'],['S?lectionnez','Sélectionnez'],['l?enregistrement','l’enregistrement'],['Tra?im','Tražim'],['prona?ena','pronađena'],['ru?no','ručno'],['? l\'','à l\''],['m?t?','mété'],['m?tallique','métallique'],['m?tal','métal'],['n?cessaire','nécessaire'],['r?glementation','réglementation'],['r?gles','règles'],['s?curit?','sécurité'],['v?rifier','vérifier'],['v?rifi?','vérifié'],['d?grad?','dégradé'],['d?tails','détails'],['? cause','à cause'],['? partir','À partir'],['?ligible','éligible'],['R?novation','Rénovation'],['R?ception','Réception'],['probl?me','problème'],['obligatoire','obligatoire']];
	const repairEncoding = () => { const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode); nodes.forEach((node) => { let text = node.nodeValue; encodingRepairs.forEach(([source, target]) => { text = text.split(source).join(target); }); if (text !== node.nodeValue) node.nodeValue = text; }); };
	Object.assign(runtimeFrench, { 'Obracun ovog unosa:': 'Calcul de cette saisie :', 'Unesite datum, satnicu/dnevnicu, pocetak, kraj i pauzu.': 'Saisissez la date, le tarif, le début, la fin et la pause.', 'Kalendar radnih dana se ucitava...': 'Chargement du calendrier des jours travaillés…', 'Radnik / ouvrier': 'Ouvrier', 'Creer un chantier u Devis sekciji': 'Créez un chantier depuis Devis', 'Creer un chantier dans Devis': 'Créer un chantier dans Devis', 'Tip cene': 'Type de tarif', 'Cena rada EUR': 'Tarif de travail EUR', 'Dodaj radnika': 'Ajouter un ouvrier', 'Nom et prenom': 'Nom et prénom', 'Email radnika': 'E-mail de l’ouvrier', 'Dnevnica EUR': 'Tarif journalier EUR', 'Satnica / radni sat EUR': 'Tarif horaire EUR', 'Chantier-i na kojima radnik radi': 'Chantiers attribués', 'Envoyer l’invitation e-mail': 'Envoyer l’invitation e-mail', 'Radnik dobija email poziv i pristup samo za svoje dane, dodeljene chantier-e i RDV/odsustvo.': 'L’ouvrier reçoit une invitation e-mail et accède uniquement à ses jours, chantiers et rendez-vous.', 'Prvo registruj chantier u Devis sekciji.': 'Créez d’abord un chantier dans Devis.', 'Nema promena za izabrani chantier.': 'Aucune modification pour ce chantier.', 'Aucune saisie de temps de travail pour cet ouvrier.': 'Aucune saisie de temps pour cet ouvrier.' });
	encodingRepairs.push(['pr?vue', 'prévue'], ['pr?vu', 'prévu'], ['ajust?e', 'ajustée'], ['enregistr?', 'enregistré'], ['non renseign?', 'non renseigné'], ['?t?', 'été'], ['D?but', 'Début'], ['?ch?ance', 'Échéance'], ['Cat?gorie', 'Catégorie'], ['M?t?o', 'Météo']);
	Object.assign(runtimeFrench, {
		'Creer un chantier dans Devis': 'Créer un chantier dans Devis', 'Creer un chantier u Devis sekciji': 'Créez d’abord un chantier dans Devis',
		'Plans et fiches techniques en PDF, photos du chantier · 25 Mo maximum': 'Plans et fiches techniques PDF, photos de chantier · 25 Mo maximum',
		'ITE - znanje, kontrole i odgovori': 'ITE · connaissances, contrôles et réponses', 'Pour apprendre et contrôler le chantier': 'Pour apprendre et contrôler le chantier',
		'Pretraga pitanja i odgovora': 'Recherche de questions et réponses', 'Traži po riječi, npr. RGE, pare-vapeur, BAR-EN-102, lame d’air, MaPrimeRenov': 'Rechercher par mot-clé, ex. RGE, pare-vapeur, BAR-EN-102, lame d’air, MaPrimeRénov',
		'Saisir un terme...': 'Saisir un terme…', 'RGE kontrolna lista': 'Liste de contrôle RGE', 'Kompletno znanje po temama': 'Connaissances par thème', 'Chargement de la base RGE...': 'Chargement de la base RGE…', 'Chargement des contrôles...': 'Chargement des contrôles…', 'Chargement des thèmes...': 'Chargement des thèmes…',
		'Obracun ovog unosa: 0.00 h ? 0,00 EUR': 'Calcul de cette saisie : 0,00 h · 0,00 €', 'Unesite datum, satnicu/dnevnicu, pocetak, kraj i pauzu.': 'Saisissez la date, le tarif, le début, la fin et la pause.', 'Kalendar radnih dana se ucitava...': 'Chargement du calendrier des jours travaillés…',
		'Radnik / ouvrier': 'Ouvrier', 'Tip cene': 'Type de tarif', 'Cena rada EUR': 'Tarif de travail EUR', 'Dnevnica': 'Tarif journalier', 'Satnica': 'Tarif horaire', 'Dodaj radnika': 'Ajouter un ouvrier', 'Nom et prenom': 'Nom et prénom', 'Email radnika': 'E-mail de l’ouvrier', 'Dnevnica EUR': 'Tarif journalier EUR', 'Satnica / radni sat EUR': 'Tarif horaire EUR',
		'Chantier-i na kojima radnik radi': 'Chantiers attribués', 'Sélectionnez un ou plusieurs chantiers pour cet ouvrier.': 'Sélectionnez un ou plusieurs chantiers.', 'Envoyer l’invitation e-mail': 'Envoyer l’invitation e-mail', 'Radnik dobija email poziv i pristup samo za svoje dane, dodeljene chantier-e i RDV/odsustvo.': 'L’ouvrier reçoit une invitation e-mail et accède uniquement à ses jours, chantiers et rendez-vous.',
		'Role': 'Rôle', 'Utilisateur / radnik': 'Ouvrier', 'Gerant / gazda': 'Gérant', 'Ime firme': 'Nom de l’entreprise', 'Za dodatnog gazdu unesite ime firme i SIRET. Radnik nasljedjuje firmu gazde koji ga poziva.': 'Pour un gérant supplémentaire, renseignez le nom de l’entreprise et le SIRET. L’ouvrier reprend l’entreprise du gérant qui l’invite.',
		'Sélectionnez un ou plusieurs chantiers pour cet ouvrier.': 'Sélectionnez un ou plusieurs chantiers.', 'Nema registrovanih chantier-a': 'Aucun chantier enregistré', 'Nema promena za izabrani chantier.': 'Aucune modification pour ce chantier.', 'Aucun document enregistré.': 'Aucun document enregistré.', 'Aucune dépense.': 'Aucune dépense.', 'Nema unosa radnog vremena.': 'Aucune saisie de temps de travail.', 'Nema RDV/odsustva.': 'Aucun rendez-vous ni absence.',
		'OUVRIER · VUE MENSUELLE': 'OUVRIER · VUE MENSUELLE', 'Detalji radnika': 'Détails de l’ouvrier', 'Mjesec pregleda': 'Mois affiché', 'Chargement': 'Chargement', 'KALENDAR': 'CALENDRIER', 'Radni dani i RDV': 'Jours travaillés et rendez-vous', 'ISPLATA': 'PAIEMENT', 'Plata i status': 'Paiement et statut', 'RDV / ODSUSTVO': 'RENDEZ-VOUS / ABSENCES', 'Termini': 'Rendez-vous', 'EVIDENCIJA': 'SUIVI', 'Unosi rada': 'Saisies de temps',
		'Preimenuj': 'Renommer', 'Supprimer': 'Supprimer', 'Otvori': 'Ouvrir', 'Ouvrir le suivi': 'Ouvrir le suivi', 'Izmeni profil': 'Modifier le profil', 'Envoyer le lien de mot de passe': 'Envoyer le lien de mot de passe', 'Supprimer l’ouvrier': 'Supprimer l’ouvrier', 'Nema dodeljenog chantier-a': 'Aucun chantier attribué', 'Nema zakazanog RDV': 'Aucun rendez-vous prévu',
		'Chantier controle': 'Contrôles chantier', 'Izaberite aktivni chantier da biste videli rizik.': 'Sélectionnez un chantier pour afficher les priorités.', 'Prvo registruj chantier u Devis sekciji.': 'Créez d’abord un chantier dans Devis.', 'Nema chantier-a': 'Aucun chantier', 'Nema Devis-a': 'Aucun devis', 'Nedostupno': 'Indisponible',
		'Radno vreme je odobreno.': 'Le temps de travail a été approuvé.', 'Radno vreme je odbijeno.': 'Le temps de travail a été refusé.', 'Temps de travail enregistré.': 'Le temps de travail a été enregistré.', 'Temps de travail non enregistré.': 'Le temps de travail n’a pas été enregistré.', 'Message enregistré.': 'Le message a été enregistré.', 'Poruka nije poslata.': 'Le message n’a pas été envoyé.', 'Le contrôle a été mis à jour.': 'Le contrôle a été mis à jour.', 'Le contrôle n’a pas été mis à jour.': 'Le contrôle n’a pas été mis à jour.'
	});
	Object.assign(runtimeFrench, {
		"Salarié · Gerant · Gérant": "Ouvrier · Gérant", "Chaque jour: chantier, durée et prix": "Chaque jour : chantier, durée et tarif", "Temps de travail": "Temps de travail", "Jours :": "Jours :", "Calcul :": "Calcul :", "Pause en minutes": "Pause en minutes",
		"Npr. kojim redom se izvodi ovaj sistem?": "Ex. dans quel ordre exécuter ce système ?", "Tip izvora": "Type de preuve", "Fotografija pre radova": "Photo avant travaux", "Fotografija tokom radova": "Photo pendant les travaux", "Fotografija posle radova": "Photo après travaux", "Enregistrer et analyser automatiquement": "Enregistrer et analyser",
		"Ajoutez un plan, une fiche technique PDF ou une photo. L’analyse propose le type de travaux, le système, les contrôles et les preuves à conserver.": "Ajoutez un plan, une fiche technique PDF ou une photo. L’analyse propose le type de travaux, le système, les contrôles et les preuves à conserver.",
		"Nabavke": "Achats et dépenses", "Korisnici": "Utilisateurs", "Zadaci i komunikacija": "Tâches et communication", "Dokumenti i slike": "Documents et photos", "Devis i chantiers": "Devis et chantiers", "Chantier kontrole": "Contrôles chantier", "Odjava": "Se déconnecter",
		"Prijavljen korisnik": "Utilisateur connecté", "Izaberite aktivni chantier da biste videli rizik.": "Sélectionnez un chantier pour afficher les priorités.", "NEMA CHANTIER": "AUCUN CHANTIER", "Aucun chantier": "Aucun chantier", "Nema chantier-a": "Aucun chantier",
		"zavrseno": "terminé", "kontrola zavrseno": "contrôles terminés", "Kontrola": "Contrôle", "Nedostaje dokaz:": "Preuve manquante :", "Le contrôle a été mis à jour.": "Le contrôle a été mis à jour.", "Le contrôle n’a pas été mis à jour.": "Le contrôle n’a pas été mis à jour.", "Terminer": "Terminer", "Vrati na ispravku": "Renvoyer pour correction",
		"Budget :": "Budget :", "Nabavke:": "Achats :", "Rad:": "Travail :", "Total dépensé :": "Total dépensé :", "Preostalo:": "Solde restant :", "Devis non enregistré": "Le devis n’a pas été enregistré", "Le devis et le budget ont été enregistrés.": "Le devis et le budget ont été enregistrés.", "Le devis et le chantier ont été enregistrés.": "Le devis et le chantier ont été enregistrés.", "Devis et chantier enregistrés.": "Devis et chantier enregistrés.",
		"Nema promena za izabrani chantier.": "Aucune modification pour ce chantier.", "Nema poruka.": "Aucun message.", "Aucune dépense.": "Aucune dépense.", "Aucun document enregistré.": "Aucun document enregistré.", "Nema registrovanih chantiers.": "Aucun chantier enregistré.", "Nema unosa rada u ovom mesecu": "Aucune saisie de temps ce mois-ci", "Nema RDV/odsustva u izabranom mesecu.": "Aucun rendez-vous ni absence ce mois-ci.",
		"Radno vreme": "Temps de travail", "Radni dani": "Jours travaillés", "Sati": "Heures", "Dnevnica:": "Tarif journalier :", "Satnica:": "Tarif horaire :", "Calcul :": "Calcul :", "Obracun ovog unosa:": "Calcul de cette saisie :", "Radni dan je oznacen u kalendaru.": "La journée a été ajoutée au calendrier.",
		"Radnik dobija email poziv": "L’ouvrier reçoit une invitation e-mail", "Dodaj radnika": "Ajouter un ouvrier", "Radnik je obrisan.": "L’ouvrier a été supprimé.", "Radnik nije obrisan.": "L’ouvrier n’a pas été supprimé.", "Radnik je preimenovan.": "L’ouvrier a été renommé.", "Radnik nije izmijenjen.": "L’ouvrier n’a pas été modifié.",
		"Mesec pregleda": "Mois affiché", "Mjesec pregleda": "Mois affiché", "Radni dani i RDV": "Jours travaillés et rendez-vous", "Plata i status": "Paiement et statut", "Nema zahteva": "Aucune demande", "Échéance non définie": "Aucune échéance", "Demande envoyée · en attente de vérification": "Demande envoyée · en attente de vérification", "Nema zahteva za isplatu": "Aucune demande de paiement",
		"Sélectionnez le chantier actif avant d’enregistrer la production.": "Sélectionnez un chantier avant d’enregistrer la production.", "Izaberite aktivni chantier pre slanja poruke.": "Sélectionnez un chantier avant d’envoyer le message.", "Izaberite aktivni chantier pre slanja RDV-a.": "Sélectionnez un chantier avant d’envoyer le rendez-vous.", "Prvo izaberite ili uploadujte sliku koju hocete mjeriti.": "Sélectionnez d’abord une photo à mesurer.", "Selektujte fajl pre snimanja.": "Sélectionnez un fichier avant l’enregistrement.",
		"S?lectionnez un fichier avant l?enregistrement.": "Sélectionnez un fichier avant l’enregistrement.", "Dokument je sa?uvan i automatski analiziran.": "Le document a été enregistré et analysé.", "Dokument non enregistr?": "Document non enregistré", "Devis non enregistr?": "Devis non enregistré", "Dépense non enregistrée.": "La dépense n’a pas été enregistrée.", "La dépense et la facture PDF ont été enregistrées ; le devis est à jour.": "La dépense et la facture PDF ont été enregistrées ; le devis est à jour.",
		"Recherche de l’entreprise par SIRET/SIREN...": "Recherche de l’entreprise par SIRET/SIREN…", "Entreprise non trouvée automatiquement ; saisissez le nom manuellement.": "Entreprise introuvable automatiquement ; saisissez le nom manuellement.", "L’e-mail/téléphone ou le mot de passe est incorrect.": "E-mail/téléphone ou mot de passe incorrect.", "Izabrani profil ne odgovara ovom nalogu.": "Le profil sélectionné ne correspond pas à ce compte.", "Password i potvrda se razlikuju.": "Les mots de passe ne correspondent pas.", "Nalog je kreiran za": "Compte créé pour", "Lozinka je poslata na": "Le lien a été envoyé à", "Cliquez sur suivant quand vous voulez définir votre mot de passe.": "Continuez pour définir le mot de passe.", "Pristup je spreman.": "L’accès est prêt.", "Kreiraj pristup": "Créer l’accès",
		"Plans et fiches techniques en PDF, photos du chantier · 25 Mo maximum": "Plans et fiches techniques PDF, photos de chantier · 25 Mo maximum", "Telephone (optionnel)": "Téléphone (facultatif)", "Nema registrovanih chantier-a": "Aucun chantier enregistré", "Chargement": "Chargement", "Chargement...": "Chargement…", "Dodaj radnika": "Ajouter un ouvrier", "Envoyer l’invitation e-mail": "Envoyer l’invitation e-mail", "Pitaj na osnovu dokumentacije": "Poser la question", "Enregistrer et analyser automatiquement": "Enregistrer et analyser", "Kalendar radnih dana se ucitava...": "Chargement du calendrier des jours travaillés…", "Kalendar radnih dana se ucitava": "Chargement du calendrier des jours travaillés…"
	});
	let language = localStorage.getItem('ibra-language') || 'fr';
	let rgeQualibatKnowledge;
	document.querySelectorAll('body *').forEach((element) => { if (element.children.length === 0 && translations[element.textContent]) element.textContent = translations[element.textContent]; });
	repairEncoding();
	const userForm = document.querySelector('#user-form');
	if (userForm?.elements.email) userForm.elements.email.required = true;
	if (userForm?.elements.phone) userForm.elements.phone.required = false;
	translateRuntimeText();
	const userRateFields = document.querySelectorAll('.rate-field');
	const userRateObserver = new MutationObserver(() => {
		if (document.querySelector('#user-role')?.value === 'user') userRateFields.forEach((field) => { field.hidden = false; });
	});
	userRateFields.forEach((field) => userRateObserver.observe(field, { attributes: true, attributeFilter: ['hidden'] }));
	new MutationObserver(() => { translateRuntimeText(); repairEncoding(); }).observe(document.body, { childList: true, subtree: true });
	const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
	const workerInitials = (name) => String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?';
	window.handleAvatarImgError = (img) => { const holder = img.closest('span') || img.parentElement; if (holder) holder.textContent = img.dataset.initials || '?'; };
	const paintIdentityToken = (el, url, label) => { if (!el) return; const initials = escapeHtml(workerInitials(label)); el.innerHTML = url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" data-initials="${initials}" onerror="window.handleAvatarImgError(this)" />` : initials; };
	const identityTokenHtml = (url, name, classNames) => { const initials = escapeHtml(workerInitials(name)); return `<span class="${classNames} ${classNames.split(' ')[0]}--initials">${url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" data-initials="${initials}" onerror="window.handleAvatarImgError(this)" />` : initials}</span>`; };
	const formValues = (form) => {
		const values = Object.fromEntries(new FormData(form).entries());
		if (form.elements.projectIds) values.projectIds = [...form.elements.projectIds.selectedOptions].map((option) => option.value).filter(Boolean);
		return values;
	};
	// A 409 means someone else saved different data in between this request's read and write -- the
	// handler re-reads fresh data on every call, so retrying the exact same request once is safe and
	// usually invisible to the user. A second 409 is real, ongoing contention, so it's surfaced as an error.
	const request = async (path, options = {}) => {
		const attempt = () => fetch(`${api}${path}`, { cache: 'no-store', ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token()}` } });
		let response = await attempt();
		if (response.status === 409) { await new Promise((resolve) => setTimeout(resolve, 400)); response = await attempt(); }
		if (!response.ok) throw new Error(await response.text());
		return response.json();
	};

	const wireSiretLookup = (input, preview, companyInput) => {
		if (!input || !preview) return;
		let lastValue = '';
		const lookup = async () => {
			const digits = String(input.value || '').replace(/\D/g, '');
			if (digits === lastValue || ![9, 14].includes(digits.length)) return;
			lastValue = digits;
			preview.textContent = 'Recherche de l’entreprise par SIRET/SIREN...';
			try {
				const company = await request(`/siret/${digits}`);
				if (companyInput && !companyInput.value.trim()) companyInput.value = company.name || '';
				preview.textContent = `${company.name} · SIRET ${company.siret}${company.address ? ` · ${company.address}` : ''}`;
			} catch {
				preview.textContent = 'Entreprise non trouvée automatiquement ; saisissez le nom manuellement.';
			}
		};
		input.addEventListener('blur', lookup);
		input.addEventListener('change', lookup);
	};

	let companyProfileState = null;
	async function loadCompanyProfile() {
		try { companyProfileState = await request('/company/profile'); }
		catch { companyProfileState = null; }
		renderCompanyIdentity();
	}
	async function loadAccountSettings() {
		if (!currentUser) return;
		const form = document.querySelector('#account-info-form');
		if (!form) return;
		if (document.activeElement && form.contains(document.activeElement)) return;
		form.elements.name.value = currentUser.name || '';
		form.elements.contact.value = currentUser.email || currentUser.phone || '';
		form.elements.language.value = language;
	}
	const workerProfilePanel = document.querySelector('#worker-profile-panel');
	const workerProfileAvatar = document.querySelector('#worker-profile-avatar');
	const workerProfileCamera = document.querySelector('#worker-profile-camera');
	const workerProfileFile = document.querySelector('#worker-profile-file');
	const workerProfileRemove = document.querySelector('#worker-profile-remove');
	const workerProfileStatus = document.querySelector('#worker-profile-status');
	let workerProfilePreviewUrl = '';
	function renderWorkerSelfProfile() {
		if (!workerProfilePanel) return;
		const visible = Boolean(currentUser && isWorkerRole(currentUser.role));
		workerProfilePanel.hidden = !visible;
		if (!visible) return;
		paintIdentityToken(workerProfileAvatar, currentUser.avatarUrl || '', currentUser.name || '');
		if (workerProfileRemove) workerProfileRemove.hidden = !currentUser.avatarUrl;
	}
	function setWorkerProfileStatus(message, state = '') {
		if (!workerProfileStatus) return;
		workerProfileStatus.textContent = message;
		workerProfileStatus.dataset.state = state;
	}
	async function saveWorkerSelfAvatar(file) {
		if (!file || !isWorkerRole(currentUser?.role)) return;
		if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
			setWorkerProfileStatus('Choisissez une photo JPG ou PNG de 5 Mo maximum.', 'error');
			return;
		}
		if (workerProfilePreviewUrl) URL.revokeObjectURL(workerProfilePreviewUrl);
		workerProfilePreviewUrl = URL.createObjectURL(file);
		if (workerProfileAvatar) workerProfileAvatar.innerHTML = `<img src="${escapeHtml(workerProfilePreviewUrl)}" alt="" />`;
		setWorkerProfileStatus('Enregistrement de votre photo…', 'loading');
		const body = new FormData(); body.set('avatar', file, file.name);
		try {
			const response = await fetch(`${api}/me/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body });
			const result = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(result.error || 'Photo non enregistrée.');
			currentUser.avatarUrl = result.avatarUrl || '';
			renderWorkerSelfProfile();
			setWorkerProfileStatus('Photo enregistrée. Elle est visible par votre équipe.', 'success');
		} catch (error) {
			renderWorkerSelfProfile();
			setWorkerProfileStatus(error.message || 'La photo n’a pas pu être enregistrée.', 'error');
		} finally {
			if (workerProfileCamera) workerProfileCamera.value = '';
			if (workerProfileFile) workerProfileFile.value = '';
		}
	}
	function setupWorkerSelfProfile() {
		if (!workerProfilePanel || workerProfilePanel.dataset.wired === 'true') { renderWorkerSelfProfile(); return; }
		workerProfilePanel.dataset.wired = 'true';
		workerProfileCamera?.addEventListener('change', () => saveWorkerSelfAvatar(workerProfileCamera.files[0]));
		workerProfileFile?.addEventListener('change', () => saveWorkerSelfAvatar(workerProfileFile.files[0]));
		workerProfileRemove?.addEventListener('click', async () => {
			if (!isWorkerRole(currentUser?.role)) return;
			setWorkerProfileStatus('Suppression de la photo…', 'loading');
			try {
				const response = await fetch(`${api}/me/avatar`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
				const result = await response.json().catch(() => ({}));
				if (!response.ok) throw new Error(result.error || 'Photo non supprimée.');
				currentUser.avatarUrl = result.avatarUrl || '';
				renderWorkerSelfProfile();
				setWorkerProfileStatus('Photo supprimée.', 'success');
			} catch (error) { setWorkerProfileStatus(error.message || 'La photo n’a pas pu être supprimée.', 'error'); }
		});
		renderWorkerSelfProfile();
	}
	function renderCompanyIdentity() {
		const strip = document.querySelector('#company-identity-strip');
		if (!strip || !currentUser) return;
		const canEdit = isOwner();
		const name = companyProfileState?.name || currentUser?.companyName || currentUser?.company || currentUser?.employerCompany || '';
		const logoUrl = companyProfileState?.logoUrl || currentUser?.companyLogoUrl || '';
		strip.hidden = false;
		paintIdentityToken(document.querySelector('#company-identity-logo'), logoUrl, name);
		const nameTarget = document.querySelector('#company-identity-name');
		if (nameTarget) nameTarget.textContent = name || (canEdit ? 'Nom de l’entreprise à renseigner' : 'Entreprise non renseignée');
		const editButton = document.querySelector('#company-identity-edit');
		if (editButton) editButton.hidden = !canEdit;
	}
	const companyIdentityModal = document.querySelector('#company-identity-modal');
	const companyIdentityForm = document.querySelector('#company-identity-form');
	let lastCompanyIdentityTrigger;
	let companyIdentityRemoveLogoQueued = false;
	let companyIdentityLocalPreviewUrl = '';
	function closeCompanyIdentityEditor() {
		if (!companyIdentityModal) return;
		companyIdentityModal.hidden = true; companyIdentityModal.setAttribute('aria-hidden', 'true');
		if (companyIdentityLocalPreviewUrl) URL.revokeObjectURL(companyIdentityLocalPreviewUrl);
		companyIdentityLocalPreviewUrl = '';
		const trigger = lastCompanyIdentityTrigger; lastCompanyIdentityTrigger = null; trigger?.focus();
	}
	function openCompanyIdentityEditor(trigger) {
		if (!companyIdentityModal || !companyIdentityForm) return;
		lastCompanyIdentityTrigger = trigger;
		companyIdentityRemoveLogoQueued = false;
		const name = companyProfileState?.name || currentUser?.company || currentUser?.employerCompany || '';
		companyIdentityForm.elements.name.value = name;
		companyIdentityForm.elements.accountantEmail.value = companyProfileState?.accountantEmail || '';
		companyIdentityForm.elements.logo.value = '';
		paintIdentityToken(document.querySelector('#company-identity-preview'), companyProfileState?.logoUrl || '', name);
		const removeButton = document.querySelector('#company-identity-remove-logo');
		if (removeButton) removeButton.hidden = !companyProfileState?.logoUrl;
		document.querySelector('#company-identity-message').textContent = '';
		companyIdentityModal.hidden = false; companyIdentityModal.setAttribute('aria-hidden', 'false');
		companyIdentityForm.elements.name.focus();
	}
	document.querySelector('#company-identity-edit')?.addEventListener('click', (event) => openCompanyIdentityEditor(event.currentTarget));
	companyIdentityModal?.addEventListener('click', (event) => { if (event.target === companyIdentityModal) closeCompanyIdentityEditor(); });
	document.querySelector('#company-identity-close')?.addEventListener('click', closeCompanyIdentityEditor);
	document.querySelector('#company-identity-cancel')?.addEventListener('click', closeCompanyIdentityEditor);
	document.querySelector('#company-identity-logo-input')?.addEventListener('change', (event) => {
		const file = event.currentTarget.files[0];
		if (!file) return;
		companyIdentityRemoveLogoQueued = false;
		if (companyIdentityLocalPreviewUrl) URL.revokeObjectURL(companyIdentityLocalPreviewUrl);
		companyIdentityLocalPreviewUrl = URL.createObjectURL(file);
		const preview = document.querySelector('#company-identity-preview');
		if (preview) preview.innerHTML = `<img src="${companyIdentityLocalPreviewUrl}" alt="" />`;
		const removeButton = document.querySelector('#company-identity-remove-logo');
		if (removeButton) removeButton.hidden = false;
	});
	document.querySelector('#company-identity-remove-logo')?.addEventListener('click', (event) => {
		companyIdentityRemoveLogoQueued = true;
		companyIdentityForm.elements.logo.value = '';
		if (companyIdentityLocalPreviewUrl) URL.revokeObjectURL(companyIdentityLocalPreviewUrl);
		companyIdentityLocalPreviewUrl = '';
		paintIdentityToken(document.querySelector('#company-identity-preview'), '', companyIdentityForm.elements.name.value);
		event.currentTarget.hidden = true;
	});
	companyIdentityForm?.addEventListener('submit', async (event) => {
		event.preventDefault();
		const message = document.querySelector('#company-identity-message');
		const submit = companyIdentityForm.querySelector('button[type="submit"]');
		message.textContent = '';
		submit.disabled = true; submit.setAttribute('aria-busy', 'true');
		const body = new FormData();
		body.set('name', companyIdentityForm.elements.name.value.trim());
		body.set('accountantEmail', companyIdentityForm.elements.accountantEmail.value.trim());
		if (companyIdentityForm.elements.logo.files[0]) body.set('logo', companyIdentityForm.elements.logo.files[0]);
		if (companyIdentityRemoveLogoQueued) body.set('removeLogo', 'true');
		try {
			const response = await fetch(`${api}/company/profile`, { method: 'PATCH', headers: { Authorization: `Bearer ${token()}` }, body });
			if (!response.ok) throw new Error('save-failed');
			companyProfileState = await response.json();
			if (currentUser) { currentUser.companyName = companyProfileState.name; currentUser.companyLogoUrl = companyProfileState.logoUrl; }
			renderCompanyIdentity();
			closeCompanyIdentityEditor();
			toast('Identité de l’entreprise enregistrée.');
		} catch { message.textContent = 'Les modifications n’ont pas été enregistrées. Réessayez.'; }
		finally { submit.disabled = false; submit.removeAttribute('aria-busy'); }
	});
	document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && companyIdentityModal && !companyIdentityModal.hidden) closeCompanyIdentityEditor(); });
	const navGroupStorageKey = (groupId) => `ibra-nav-group-${groupId}`;
	const setNavGroupExpanded = (toggle, expanded) => {
		if (!toggle) return;
		const groupId = toggle.dataset.groupToggle;
		const submenu = document.querySelector(`[data-group-items="${groupId}"]`);
		toggle.setAttribute('aria-expanded', String(expanded));
		if (submenu) submenu.hidden = !expanded;
		try { localStorage.setItem(navGroupStorageKey(groupId), expanded ? '1' : '0'); } catch { /* storage unavailable */ }
	};
	const showView = (id) => {
		document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === id));
		document.querySelectorAll('.nav:not(.nav-group-toggle), .nav-sub').forEach((item) => item.classList.toggle('active', item.dataset.view === id));
		document.querySelector('#page-title').textContent = document.querySelector(`[data-view="${id}"]`)?.dataset.title || 'IBRA-BA';
		if (id === 'tasks-view') { unreadMessageCount = 0; setChatBadge(0); }
		// Keep the category open once a page inside it is current, so coming back to it isn't a second click.
		document.querySelectorAll('.nav-item-group').forEach((group) => {
			const toggle = group.querySelector('.nav-group-toggle');
			const hasActive = !!group.querySelector('.nav-sub.active');
			toggle?.classList.toggle('has-active', hasActive);
			if (hasActive) setNavGroupExpanded(toggle, true);
		});
	};
	const applyRole = (role) => {
		const access = {
			admin: ['dashboard-view','devis-view','purchases-view','line-items-view','factures-view','chantier-view','rge-help-view','evidence-summary-view','documents-view','tasks-view','settings-view','account-settings-view'],
			gerant: ['dashboard-view','devis-view','purchases-view','line-items-view','factures-view','chantier-view','rge-help-view','evidence-summary-view','documents-view','tasks-view','settings-view','account-settings-view'],
			manager: ['dashboard-view','devis-view','purchases-view','line-items-view','factures-view','chantier-view','rge-help-view','evidence-summary-view','documents-view','tasks-view','settings-view','account-settings-view'],
			worker: ['tasks-view','evidence-summary-view','account-settings-view'],
			user: ['tasks-view','evidence-summary-view','account-settings-view']
		};
		const allowed = access[role] || ['dashboard-view','tasks-view'];
		document.querySelectorAll('.nav:not(.nav-group-toggle), .nav-sub').forEach((item) => { item.hidden = !allowed.includes(item.dataset.view); });
		document.querySelectorAll('.nav-item-group').forEach((group) => { group.hidden = ![...group.querySelectorAll('.nav-sub')].some((item) => !item.hidden); });
		const canSeeFinancials = isOwner(role);
		document.querySelector('#budget-card')?.toggleAttribute('hidden', !canSeeFinancials);
		document.querySelector('#payroll-card')?.toggleAttribute('hidden', !canSeeFinancials);
		document.querySelector('#quick-worker-form')?.toggleAttribute('hidden', !canSeeFinancials);
		document.querySelector('#evidence-upload-panel')?.toggleAttribute('hidden', !canSeeFinancials);
		document.querySelector('#goto-documents-button')?.toggleAttribute('hidden', !canSeeFinancials);
		document.querySelector('#my-tasks-tab-button')?.toggleAttribute('hidden', canSeeFinancials);
		document.querySelector('#my-tasks-panel')?.toggleAttribute('hidden', canSeeFinancials);
		if (!allowed.includes(document.querySelector('.view.active')?.id)) showView(allowed[0]);
	};
	const selectSubTab = (viewId, tabTarget) => {
		if (!tabTarget) return;
		const view = document.getElementById(viewId);
		view?.querySelectorAll(':scope > .panel[id]:not(#devis-line-items-pending-panel), :scope > .grid-two > .panel[id]').forEach((panel) => panel.toggleAttribute('data-tab-hidden', panel.id !== tabTarget));
		view?.querySelectorAll('.mobile-tab').forEach((tabButton) => tabButton.classList.toggle('active', tabButton.dataset.tabTarget === tabTarget));
	};
	document.querySelectorAll('.nav-group-toggle').forEach((toggle) => {
		const groupId = toggle.dataset.groupToggle;
		let saved = null;
		try { saved = localStorage.getItem(navGroupStorageKey(groupId)); } catch { /* storage unavailable */ }
		setNavGroupExpanded(toggle, saved === null ? true : saved === '1');
		toggle.addEventListener('click', () => setNavGroupExpanded(toggle, toggle.getAttribute('aria-expanded') !== 'true'));
	});
	document.querySelectorAll('.nav:not(.nav-group-toggle)').forEach((button) => button.addEventListener('click', async () => {
		if (button.dataset.navParent) document.getElementById(button.dataset.navParent)?.removeAttribute('hidden');
		setMobileNav(false);
		showView(button.dataset.view);
		selectSubTab(button.dataset.view, button.dataset.subTab);
		if (button.dataset.subTab) {
			document.querySelectorAll('.nav:not(.nav-group-toggle), .nav-sub').forEach((item) => item.classList.toggle('active', item === button));
			document.querySelector('#page-title').textContent = button.dataset.title || 'IBRA-BA';
		}
		if (!currentUser) return; if (button.dataset.view === 'rge-help-view') await loadRgeQualibat(); else await refreshActiveView();
	}));
	document.querySelectorAll('.nav-sub').forEach((button) => button.addEventListener('click', async () => {
		setMobileNav(false);
		showView(button.dataset.view);
		selectSubTab(button.dataset.view, button.dataset.subTab);
		if (!currentUser) return;
		if (button.dataset.view === 'rge-help-view') await loadRgeQualibat(); else await refreshActiveView();
	}));
	document.querySelectorAll('.mobile-tab').forEach((tabButton) => tabButton.addEventListener('click', () => {
		const tabs = tabButton.closest('.mobile-tabs');
		tabs?.querySelectorAll('.mobile-tab').forEach((item) => item.classList.toggle('active', item === tabButton));
		const targetId = tabButton.dataset.tabTarget;
		tabs?.parentElement?.querySelectorAll(':scope > .panel[id]:not(#devis-line-items-pending-panel), :scope > .grid-two > .panel[id]').forEach((panel) => panel.toggleAttribute('data-tab-hidden', panel.id !== targetId));
	}));

	let projectsCache = [];
	let activeProjectId = localStorage.getItem('ibra-active-project') || '';
	const assignedProjectNames = (worker) => (worker?.projectIds || []).map((projectId) => projectsCache.find((project) => project.id === projectId)?.name || projectId).filter(Boolean).join(', ');
	const visibleProjects = () => {
		const assigned = isOwner() ? projectsCache : projectsCache.filter((project) => (currentUser?.projectIds || []).includes(project.id));
		return assigned.filter((project) => project.status !== 'archived').sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'fr', { sensitivity: 'base' }));
	};
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
				document.querySelector('#work-sequence')?.remove();
				await Promise.allSettled([loadDashboard(), loadControlHistory(), loadEvidenceSummary(), loadFinancialSummary(), loadSchedule(), loadTime(), loadMessages(), loadDocuments(), loadProduction(), loadWorkSequence()]);
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
		const uploadDeleteButton = document.querySelector('#upload-form-delete-chantier');
		if (uploadDeleteButton) {
			const selectedProjectId = document.querySelector('#upload-form select[name="projectId"]')?.value || '';
			uploadDeleteButton.hidden = !selectedProjectId;
			uploadDeleteButton.dataset.project = selectedProjectId;
		}
		const assignmentOptions = projectsCache.slice().sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'fr', { sensitivity: 'base' })).map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('');
		document.querySelectorAll('select[data-project-assignment]').forEach((select) => {
			const selected = new Set([...select.selectedOptions].map((option) => option.value));
			select.innerHTML = assignmentOptions || '<option value="">Nema registrovanih chantier-a</option>';
			[...select.options].forEach((option) => { option.selected = selected.has(option.value); });
			select.disabled = !projectsCache.length;
		});
	}
	async function loadAttentionItems() {
		const panel = document.querySelector('#attention-panel');
		const list = document.querySelector('#attention-list');
		if (!panel || !list || !isOwner()) { if (panel) panel.hidden = true; return; }
		try {
			const data = await request('/attention-items');
			const sections = [];
			if (data.overdueFactures.length) {
				sections.push({
					title: `Factures impayées depuis plus de 30 jours (${data.overdueFactures.length})`,
					items: data.overdueFactures.map((item) => `${escapeHtml(item.projectName)} · ${escapeHtml(item.clientName || 'Client')} ${item.invoiceNumber ? `(${escapeHtml(item.invoiceNumber)})` : ''} · ${formatEUR(item.amount)} · ${item.daysOverdue} j`),
					action: () => { showView('factures-view'); const select = document.querySelector('#facture-project-select'); if (select) select.value = data.overdueFactures[0].projectId; loadFactures(); },
					actionLabel: 'Voir les factures',
				});
			}
			if (data.unpricedLineItems.length) {
				sections.push({
					title: `Stavke devisa bez cijene (${data.unpricedLineItems.length})`,
					items: data.unpricedLineItems.map((item) => `${escapeHtml(item.projectName)} · ${escapeHtml(item.description)} — ${item.quantity} ${escapeHtml(item.unit || '')}`),
					action: () => { showView('line-items-view'); const select = document.querySelector('#line-items-project-select'); if (select) select.value = data.unpricedLineItems[0].projectId; loadLineItems(); },
					actionLabel: 'Voir les lignes de devis',
				});
			}
			if (data.unverifiedAiLineItems.length) {
				sections.push({
					title: `Lignes lues par IA jamais vérifiées (${data.unverifiedAiLineItems.length})`,
					items: data.unverifiedAiLineItems.map((item) => `${escapeHtml(item.projectName)} · ${escapeHtml(item.description)} — ${item.quantity} ${escapeHtml(item.unit || '')} · ${formatEUR(item.unitPrice)}`),
					action: () => { showView('line-items-view'); const select = document.querySelector('#line-items-project-select'); if (select) select.value = data.unverifiedAiLineItems[0].projectId; loadLineItems(); },
					actionLabel: 'Vérifier ces lignes',
				});
			}
			panel.hidden = !sections.length;
			if (!sections.length) return;
			list.innerHTML = sections.map((section, index) => `<div class="list-item attention-item"><strong>${section.title}</strong><small>${section.items.slice(0, 3).map((line) => `<div>${line}</div>`).join('')}${section.items.length > 3 ? `<div>… et ${section.items.length - 3} autre(s)</div>` : ''}</small><button type="button" class="secondary" data-attention-action="${index}">${section.actionLabel}</button></div>`).join('');
			list.querySelectorAll('[data-attention-action]').forEach((button) => button.addEventListener('click', () => sections[Number(button.dataset.attentionAction)].action()));
		} catch { panel.hidden = true; }
	}
	async function loadDashboard() {
		// loadAttentionItems() is cross-chantier (its own /attention-items call, no dependency on which
		// project loadProjectOptions() ends up selecting) - was waiting for projectOptions to finish for no
		// reason, adding a full extra round trip to every dashboard open.
		await Promise.all([loadProjectOptions(), loadAttentionItems()]);
		const projectId = currentProjectId();
		const project = currentProject();
		if (!projectId) {
			document.querySelector('#progress-value').textContent = '0%';
			document.querySelector('#open-controls').textContent = '0';
			const heroProgressBarEmpty = document.querySelector('#hero-progress-bar'); if (heroProgressBarEmpty) heroProgressBarEmpty.style.width = '0%';
			const chantierProgressBarEmpty = document.querySelector('#chantier-progress-bar'); if (chantierProgressBarEmpty) chantierProgressBarEmpty.style.width = '0%';
			const chantierProgressLabelEmpty = document.querySelector('#chantier-progress-label'); if (chantierProgressLabelEmpty) chantierProgressLabelEmpty.textContent = '0%';
			document.querySelector('#controls').innerHTML = '<small>Créez d’abord un chantier dans Devis.</small>';
			document.querySelector('#project-risk').textContent = 'AUCUN CHANTIER';
			document.querySelector('#project-risk-state').textContent = 'À configurer';
			document.querySelector('#project-risk-detail').textContent = 'Sélectionnez un chantier pour afficher les priorités.';
			document.querySelector('#project-risk-action').textContent = 'Action : créer ou sélectionner un chantier.';
			document.querySelector('#weather-card')?.setAttribute('hidden', '');
			return;
		}
		loadWeather(projectId);
		// Fire all four requests together instead of one after another - they don't depend on each
		// other, so waiting for them sequentially was adding up to three extra network round trips
		// to every dashboard open for no reason.
		const controlsPromise = request(`/projects/${projectId}/chantier-controls`);
		const schedulePromise = request(`/projects/${projectId}/schedule`);
		const financialPromise = request(`/projects/${projectId}/financial-summary`);
		const evidenceSummaryPromise = request(`/projects/${projectId}/evidence-summary`);
		const controls = await controlsPromise;
		const completedControls = controls.filter((item) => item.status === 'complete').length;
		const progress = controls.length ? Math.round((completedControls / controls.length) * 100) : 0;
		const siteProgress = Number(project?.progress || 0);
		document.querySelector('#progress-value').textContent = `${progress}%`;
		const siteProgressValue = document.querySelector('#site-progress-value'); if (siteProgressValue) siteProgressValue.textContent = `${siteProgress}%`;
		const siteProgressInput = document.querySelector('#site-progress-input'); if (siteProgressInput && document.activeElement !== siteProgressInput) siteProgressInput.value = siteProgress;
		document.querySelector('.site-progress-panel')?.toggleAttribute('hidden', !isOwner());
		const chantierProgressLabel = document.querySelector('#chantier-progress-label'); if (chantierProgressLabel) chantierProgressLabel.textContent = `${siteProgress}%`;
		const chantierProgressBar = document.querySelector('#chantier-progress-bar'); if (chantierProgressBar) chantierProgressBar.style.width = `${Math.max(0, Math.min(100, siteProgress))}%`;
		document.querySelector('#open-controls').textContent = controls.filter((item) => item.status !== 'complete').length;
		document.querySelector('#dashboard-view .hero small').textContent = `${project?.name || 'CHANTIER'} · ${siteProgress}% d’avancement`;
		const heroProgressBar = document.querySelector('#hero-progress-bar'); if (heroProgressBar) heroProgressBar.style.width = `${Math.max(0, Math.min(100, siteProgress))}%`;
		const schedule = await schedulePromise;
		const financial = await financialPromise;
		const missingEvidence = (await evidenceSummaryPromise).missing.length;
		const openControls = controls.filter((item) => item.status !== 'complete').length;
		const red = openControls >= 3 || missingEvidence >= 4 || (financial.budgetStatus === 'available' && financial.remaining < 0);
		const orange = !red && (openControls > 0 || missingEvidence > 0 || schedule.delayDays > 0);
		const risk = document.querySelector('#project-risk-card');
		const riskLabel = red ? 'CRITIQUE' : orange ? 'ATTENTION' : 'STABLE';
		risk.classList.remove('risk-red','risk-orange','risk-green');
		risk.classList.add(red ? 'risk-red' : orange ? 'risk-orange' : 'risk-green');
		document.querySelector('#project-risk').textContent = `${riskLabel} · ${progress}%`;
		document.querySelector('#project-risk-state').textContent = red ? 'Action requise' : orange ? 'À vérifier' : 'Sous contrôle';
		document.querySelector('#project-risk-detail').textContent = `${openControls} contrôle${openControls === 1 ? '' : 's'} ouvert${openControls === 1 ? '' : 's'} · ${missingEvidence} preuve${missingEvidence === 1 ? '' : 's'} manquante${missingEvidence === 1 ? '' : 's'}${schedule.delayDays ? ` · ${schedule.delayDays} jour${schedule.delayDays === 1 ? '' : 's'} de retard` : ''}`;
		document.querySelector('#project-risk-action').textContent = red ? 'Action : traiter les contrôles et preuves manquants.' : orange ? 'Action : vérifier les points ouverts avant de continuer.' : 'Action : aucune intervention urgente.';
		const canUpdate = isOwner();
		document.querySelector('#controls').innerHTML = `<div class="list-item chantier-progress"><strong>${escapeHtml(project?.name || 'Chantier')} · ${progress}% zavrseno</strong><small>${completedControls}/${controls.length} kontrola zavrseno</small></div><details class="chantier-controls-details"><summary>Voir le détail des contrôles RGE</summary>${controls.map((item) => `<div class="list-item ${item.status === 'complete' ? 'ok' : item.status === 'incomplete' ? 'bad' : 'warn'}"><strong>${item.name}</strong><small>${item.owner} · ${item.status}</small>${canUpdate ? `<div class="control-actions"><button class="secondary control-action" data-control="${item.id}" data-status="complete">Terminer</button><button class="secondary control-action" data-control="${item.id}" data-status="incomplete">Vrati na ispravku</button></div>` : ''}</div>`).join('')}</details>`;
		document.querySelectorAll('.control-action').forEach((button) => button.addEventListener('click', async () => { try { await request(`/chantier-controls/${button.dataset.control}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status: button.dataset.status }) }); await Promise.allSettled([loadDashboard(), loadEvidenceSummary(), loadControlHistory()]); toast('Le contrôle a été mis à jour.'); } catch (error) { try { const details = JSON.parse(error.message); toast(details.missing ? `Nedostaje dokaz: ${details.missing.join(', ')}` : 'Le contrôle n’a pas été mis à jour.'); } catch { toast('Le contrôle n’a pas été mis à jour.'); } } }));
	}
	async function loadWeather(projectId) {
		const cards = document.querySelectorAll('.weather-card');
		if (!cards.length) return;
		try {
			const forecast = projectId ? await request(`/projects/${projectId}/weather`) : { available: false };
			if (!forecast.available || !forecast.days?.length) { cards.forEach((card) => card.setAttribute('hidden', '')); return; }
			const daysHtml = forecast.days.map((day) => {
				const date = new Date(`${day.date}T00:00:00`);
				const dayName = new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'sr-Latn-RS', { weekday: 'short' }).format(date);
				return `<div class="weather-day"><span class="weather-day-name">${escapeHtml(dayName)}</span><span class="weather-day-icon" title="${escapeHtml(day.label || '')}">${day.icon || '🌡️'}</span><span class="weather-day-temps">${day.tempMax != null ? Math.round(day.tempMax) : '-'}°<small>/${day.tempMin != null ? Math.round(day.tempMin) : '-'}°</small></span>${day.precipProbability != null ? `<span class="weather-day-rain">💧 ${day.precipProbability}%</span>` : ''}</div>`;
			}).join('');
			cards.forEach((card) => {
				card.querySelector('.weather-label').textContent = `Prévisions · ${forecast.label || ''}`;
				card.querySelector('.weather-days').innerHTML = daysHtml;
				card.removeAttribute('hidden');
			});
		} catch { cards.forEach((card) => card.setAttribute('hidden', '')); }
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
	function renderRgeSiteChecklist(result) {
		const target = document.querySelector('#rge-site-checklist');
		if (!target) return;
		if (result.status === 'not_configured' || result.status === 'unavailable') { target.innerHTML = '<small>Lecture IA indisponible pour ce chantier.</small>'; return; }
		if (result.status === 'no_documents') { target.innerHTML = '<small>Aucun plan ni fiche technique pour ce chantier.</small>'; return; }
		if (result.status === 'no_text') { target.innerHTML = '<small>Les documents de ce chantier n’ont pas de texte lisible (scans/photos uniquement).</small>'; return; }
		if (result.status === 'not_generated') { target.innerHTML = '<small>Cliquez sur « Actualiser » pour lire les documents de ce chantier.</small>'; return; }
		const skippedNote = result.documentsSkipped?.length ? `<small>Non lus (pas de texte) : ${result.documentsSkipped.map((name) => escapeHtml(name)).join(', ')}</small>` : '';
		const generatedNote = result.generatedAt ? `<small>Lu le ${new Date(result.generatedAt).toLocaleString()} · ${result.documentsRead?.length || 0} document(s)</small>` : '';
		if (!result.points?.length) { target.innerHTML = `<small>Aucun point de conformité RGE explicite trouvé dans les documents lus.</small>${generatedNote}${skippedNote}`; return; }
		target.innerHTML = `<div class="ai-badge">⚠ Lu par IA depuis le texte des documents — à vérifier</div>${generatedNote}${result.points.map((point) => `<div class="list-item"><strong>${escapeHtml(point.rule)}</strong><small>Source : ${escapeHtml(point.sourceDocument)}</small></div>`).join('')}${skippedNote}`;
	}
	async function loadRgeSiteChecklist() {
		const projectId = currentProjectId();
		const target = document.querySelector('#rge-site-checklist');
		if (!target) return;
		if (!projectId) { target.innerHTML = '<small>Sélectionnez un chantier.</small>'; return; }
		try { renderRgeSiteChecklist(await request(`/projects/${projectId}/rge-checklist`)); }
		catch { target.innerHTML = '<small>Impossible de charger la conformité RGE.</small>'; }
	}
	document.querySelector('#rge-site-checklist-refresh')?.addEventListener('click', async (event) => {
		const projectId = currentProjectId();
		if (!projectId) { toast('Sélectionnez un chantier.'); return; }
		const button = event.currentTarget;
		button.disabled = true; button.setAttribute('aria-busy', 'true');
		try { renderRgeSiteChecklist(await request(`/projects/${projectId}/rge-checklist`, { method: 'POST' })); }
		catch { toast('Lecture impossible.'); }
		finally { button.disabled = false; button.removeAttribute('aria-busy'); }
	});
	const userRoleLabels = { admin: 'Administrateur', manager: 'Manager', gerant: 'Gérant', user: 'Ouvrier', worker: 'Ouvrier' };
	let lastUserEditorTrigger;
	const userEditModal = document.querySelector('#user-edit-modal');
	const userEditForm = document.querySelector('#user-edit-form');
	const userEditAvatarInput = document.querySelector('#user-edit-avatar-input');
	const userEditAvatarPreview = document.querySelector('#user-edit-avatar-preview');
	const userEditAvatarRemove = document.querySelector('#user-edit-avatar-remove');
	const closeUserEditor = () => { if (!userEditModal) return; userEditModal.hidden = true; userEditModal.setAttribute('hidden', ''); userEditModal.setAttribute('aria-hidden', 'true'); const trigger = lastUserEditorTrigger; lastUserEditorTrigger = null; trigger?.focus(); };
	const openUserEditor = (user, trigger) => {
		if (!userEditModal || !userEditForm || !user) return;
		lastUserEditorTrigger = trigger;
		userEditForm.elements.userId.value = user.id;
		userEditForm.elements.name.value = user.name || '';
		userEditForm.elements.contact.value = user.email || user.phone || '';
		userEditForm.elements.dailyRate.value = user.dailyRate ?? 0;
		userEditForm.elements.hourlyRate.value = user.hourlyRate ?? 0;
		document.querySelector('#user-edit-name-preview').textContent = user.name || 'Utilisateur';
		document.querySelector('#user-edit-role-preview').textContent = userRoleLabels[user.role] || user.role || 'Ouvrier';
		document.querySelector('#user-edit-company').textContent = user.company || user.employerCompany || '—';
		document.querySelector('#user-edit-role').textContent = userRoleLabels[user.role] || user.role || '—';
		const projectSelect = userEditForm.elements.projectIds;
		projectSelect.innerHTML = projectsCache.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join('');
		const selectedProjects = new Set(user.projectIds || []);
		[...projectSelect.options].forEach((option) => { option.selected = selectedProjects.has(option.value); });
		userEditForm.querySelector('.user-edit-rates').hidden = !isWorkerRole(user.role);
		const avatarField = userEditForm.querySelector('.image-field');
		if (avatarField) avatarField.hidden = !isWorkerRole(user.role);
		if (userEditAvatarPreview) paintIdentityToken(userEditAvatarPreview, user.avatarUrl || '', user.name);
		if (userEditAvatarRemove) userEditAvatarRemove.hidden = !user.avatarUrl;
		if (userEditAvatarInput) userEditAvatarInput.value = '';
		projectSelect.disabled = !isWorkerRole(user.role);
		userEditForm.querySelector('#user-edit-project-help').textContent = isWorkerRole(user.role) ? 'Sélectionnez les chantiers accessibles à cet utilisateur.' : 'Les chantiers d’un gérant suivent l’accès société.';
		userEditForm.querySelector('#user-edit-message').textContent = '';
		userEditModal.hidden = false;
		userEditModal.removeAttribute('hidden');
		userEditModal.setAttribute('aria-hidden', 'false');
		userEditForm.elements.name.focus();
	};
	userEditModal?.addEventListener('click', (event) => { if (event.target === userEditModal) closeUserEditor(); });
	userEditModal?.querySelector('#user-edit-close')?.addEventListener('click', closeUserEditor);
	userEditModal?.querySelector('#user-edit-cancel')?.addEventListener('click', closeUserEditor);
	document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && userEditModal && !userEditModal.hidden) closeUserEditor(); });
	userEditForm?.addEventListener('submit', async (event) => {
		event.preventDefault();
		const message = userEditForm.querySelector('#user-edit-message');
		const submit = userEditForm.querySelector('button[type="submit"]');
		const values = Object.fromEntries(new FormData(userEditForm).entries());
		values.projectIds = [...userEditForm.elements.projectIds.selectedOptions].map((option) => option.value);
		message.textContent = '';
		submit.disabled = true; submit.setAttribute('aria-busy', 'true');
		try { await request(`/users/${encodeURIComponent(values.userId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); closeUserEditor(); await Promise.allSettled([loadUsers(), loadTime(), loadMessages()]); toast('Utilisateur mis à jour.'); }
		catch (error) { try { message.textContent = JSON.parse(error.message).error || 'Utilisateur non mis à jour.'; } catch { message.textContent = 'Utilisateur non mis à jour.'; } }
		finally { submit.disabled = false; submit.removeAttribute('aria-busy'); }
	});
	userEditAvatarInput?.addEventListener('change', async () => {
		const file = userEditAvatarInput.files[0];
		const userId = userEditForm.elements.userId.value;
		if (!file || !userId) return;
		const message = userEditForm.querySelector('#user-edit-message');
		const body = new FormData(); body.set('avatar', file);
		try {
			const response = await fetch(`${api}/users/${encodeURIComponent(userId)}/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body });
			if (!response.ok) throw new Error();
			const result = await response.json();
			paintIdentityToken(userEditAvatarPreview, result.avatarUrl, userEditForm.elements.name.value);
			if (userEditAvatarRemove) userEditAvatarRemove.hidden = !result.avatarUrl;
			await loadUsers();
			toast('Photo de l’ouvrier enregistrée.');
		} catch { message.textContent = 'La photo n’a pas pu être enregistrée.'; }
		finally { userEditAvatarInput.value = ''; }
	});
	userEditAvatarRemove?.addEventListener('click', async () => {
		const userId = userEditForm.elements.userId.value;
		if (!userId) return;
		try {
			await request(`/users/${encodeURIComponent(userId)}/avatar`, { method: 'DELETE' });
			paintIdentityToken(userEditAvatarPreview, '', userEditForm.elements.name.value);
			userEditAvatarRemove.hidden = true;
			await loadUsers();
			toast('Photo de l’ouvrier supprimée.');
		} catch { toast('La photo n’a pas pu être supprimée.'); }
	});
	async function resetUserPassword(user, trigger) {
		if (!user?.email || !window.confirm(`Envoyer un nouveau lien de mot de passe à ${user.email} ?`)) return;
		trigger.disabled = true; trigger.setAttribute('aria-busy', 'true');
		try { const result = await request(`/users/${encodeURIComponent(user.id)}/password-reset`, { method: 'POST' }); toast(result.setupUrl ? `Lien de configuration : ${result.setupUrl}` : 'Lien de mot de passe envoyé.'); }
		catch (error) { try { toast(JSON.parse(error.message).error || 'Lien de mot de passe non envoyé.'); } catch { toast('Lien de mot de passe non envoyé.'); } }
		finally { trigger.disabled = false; trigger.removeAttribute('aria-busy'); }
	}
	const workerRosterState = { month: new Date().toISOString().slice(0, 7), query: '', statusFilter: 'all', users: [], entries: [], rendezvous: [], payouts: [], loading: false, error: null, menuWorkerId: '', detailWorkerId: '', detailMonth: '', detailSelectedDate: '', detailSnapshot: null, editingEntryId: '', sortBy: 'payment', sortDir: 'asc' };
	const workerTimesheetState = { workerId: '', month: new Date().toISOString().slice(0, 7), referenceHours: Number(localStorage.getItem('ibra-worker-timesheet-reference-hours')) || 8 };
	function closeWorkerTimesheet() { const modal = document.querySelector('#worker-timesheet-modal'); if (!modal) return; modal.hidden = true; modal.setAttribute('aria-hidden', 'true'); workerTimesheetState.workerId = ''; }
	function openWorkerTimesheet(workerId) { const modal = document.querySelector('#worker-timesheet-modal'); const user = workerRosterState.users.find((item) => item.id === workerId); if (!user || !modal) return; workerTimesheetState.workerId = workerId; workerTimesheetState.month = workerRosterState.detailMonth || workerRosterState.month; modal.hidden = false; modal.setAttribute('aria-hidden', 'false'); renderWorkerTimesheet(); document.querySelector('#worker-timesheet-close')?.focus(); }
	function renderWorkerTimesheet() {
		const user = workerRosterState.users.find((item) => item.id === workerTimesheetState.workerId);
		if (!user) return;
		const month = workerTimesheetState.month;
		const snapshot = deriveWorkerSnapshot(user, month);
		const referenceHours = workerTimesheetState.referenceHours;
		paintIdentityToken(document.querySelector('#worker-timesheet-avatar'), user.avatarUrl || '', user.name);
		const title = document.querySelector('#worker-timesheet-title'); if (title) title.textContent = user.name || 'Ouvrier';
		const subtitle = document.querySelector('#worker-timesheet-subtitle'); if (subtitle) subtitle.textContent = [user.email || user.phone || '', snapshot.assignedProjects.join(', ')].filter(Boolean).join(' · ');
		const monthLabel = document.querySelector('#worker-timesheet-month-label'); if (monthLabel) monthLabel.textContent = formatMonthLabel(month);
		const refInput = document.querySelector('#worker-timesheet-reference-hours'); if (refInput && document.activeElement !== refInput) refInput.value = referenceHours;
		const [year, monthNumber] = month.split('-').map(Number);
		const lastDay = new Date(year, monthNumber, 0).getDate();
		const entryByDate = new Map(snapshot.entries.map((entry) => [entry.date, entry]));
		const rendezvousByDate = new Map();
		snapshot.rendezvous.forEach((item) => { const date = item.absenceDate || item.date; const list = rendezvousByDate.get(date) || []; list.push(item); rendezvousByDate.set(date, list); });
		const todayKey = new Date().toISOString().slice(0, 10);
		let workingDays = 0; let totalOvertime = 0; const rows = [];
		for (let day = 1; day <= lastDay; day += 1) {
			const date = `${month}-${String(day).padStart(2, '0')}`;
			const weekday = new Date(year, monthNumber - 1, day).getDay();
			const weekend = weekday === 0 || weekday === 6;
			if (!weekend) workingDays += 1;
			const entry = entryByDate.get(date);
			const rdv = rendezvousByDate.get(date) || [];
			const hours = entry ? Number(entry.hours || 0) : 0;
			const overtime = entry ? hours - referenceHours : 0;
			if (entry) totalOvertime += overtime;
			const overtimeClass = overtime < 0 ? ' negative' : overtime > 0 ? ' positive' : '';
			const overtimeLabel = entry ? `${overtime >= 0 ? '+' : ''}${overtime.toFixed(2)} h` : '';
			const rdvLabel = rdv.map((item) => item.type === 'absence' ? 'Absence' : `RDV ${item.time || ''}`).join(' · ');
			rows.push(`<div class="worker-timesheet-row${weekend ? ' weekend' : ''}${date === todayKey ? ' today' : ''}${entry ? ' worked' : ''}"><span class="wt-day"><strong>${day}</strong><small>${weekdayAbbrFr[weekday]}</small></span><span class="wt-start">${entry ? escapeHtml(entry.start || '-') : '-'}</span><span class="wt-end">${entry ? escapeHtml(entry.end || '-') : '-'}</span><span class="wt-hours">${entry ? hours.toFixed(2) + ' h' : rdvLabel ? escapeHtml(rdvLabel) : '-'}</span><span class="wt-overtime${overtimeClass}">${overtimeLabel}</span></div>`);
		}
		const list = document.querySelector('#worker-timesheet-list'); if (list) list.innerHTML = rows.join('');
		const stats = document.querySelector('#worker-timesheet-stats'); if (stats) stats.innerHTML = `<span><strong>${workingDays}</strong><small>Jours ouvrés</small></span><span><strong>${snapshot.hours.toFixed(2)} h</strong><small>Heures saisies</small></span><span><strong>${snapshot.workedDays}</strong><small>Jours saisis</small></span>`;
		const overtimeFooterClass = totalOvertime < 0 ? 'negative' : totalOvertime > 0 ? 'positive' : '';
		const footer = document.querySelector('#worker-timesheet-footer'); if (footer) footer.innerHTML = `<span><strong>${formatEUR(snapshot.amount)}</strong><small>Total calculé</small></span><span><strong>${snapshot.hours.toFixed(2)} h</strong><small>Heures travaillées</small></span><span class="${overtimeFooterClass}"><strong>${totalOvertime >= 0 ? '+' : ''}${totalOvertime.toFixed(2)} h</strong><small>Écart vs ${referenceHours} h/jour</small></span>`;
	}
	const workerStatusMeta = {
		critical: { label: 'Critique', className: 'status-critical' },
		attention: { label: 'Attention', className: 'status-attention' },
		pending: { label: 'En attente', className: 'status-pending' },
		good: { label: 'Payé', className: 'status-good' },
		empty: { label: 'Bez unosa', className: 'status-empty' }
	};
	const workerStatusRank = { critical: 0, attention: 1, pending: 2, good: 3, empty: 4 };
	const payoutStatusLabels = { pending: 'En attente d’approbation', approved: 'Approuvé · non payé', rejected: 'Odbijeno', paid: 'Payé' };
	const formatRosterDate = (value) => { if (!value) return ''; const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`); return Number.isNaN(parsed.getTime()) ? String(value) : new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'sr-Latn-RS', { day: '2-digit', month: 'short' }).format(parsed); };
	const workerEntryAmount = (entry, worker) => { const stored = Number(entry.workAmount); if (Number.isFinite(stored) && stored > 0) return stored; const rate = Number(entry.rate || (entry.rateType === 'hourly' ? worker?.hourlyRate : worker?.dailyRate) || 0); return entry.rateType === 'hourly' ? Number(entry.hours || 0) * rate : rate; };
	const assignedWorkerProjects = (worker) => (worker?.projectIds || []).map((projectId) => projectsCache.find((project) => project.id === projectId)?.name || projectId).filter(Boolean);
	const nextWorkerRendezvous = (items) => { const today = new Date().toISOString().slice(0, 10); return items.slice().sort((first, second) => `${first.absenceDate || first.date || ''} ${first.time || ''}`.localeCompare(`${second.absenceDate || second.date || ''} ${second.time || ''}`)).find((item) => (item.absenceDate || item.date || '') >= today) || null; };
	function deriveWorkerSnapshot(user, month, source = workerRosterState) {
		const entries = (source.entries || []).filter((entry) => entry.workerId === user.id && String(entry.date || '').startsWith(month));
		const rendezvous = (source.rendezvous || []).filter((item) => item.workerId === user.id && String(item.absenceDate || item.date || '').startsWith(month));
		const allRendezvous = (source.rendezvous || []).filter((item) => item.workerId === user.id);
		const payout = (source.payouts || []).filter((item) => item.userId === user.id && item.month === month).sort((first, second) => String(second.createdAt || '').localeCompare(String(first.createdAt || '')))[0];
		const workedDays = new Set(entries.map((entry) => entry.date)).size;
		const hours = entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
		const amount = entries.reduce((sum, entry) => sum + workerEntryAmount(entry, user), 0);
		const missingRate = entries.some((entry) => workerEntryAmount(entry, user) <= 0);
		const isPaid = payout?.status === 'paid';
		const [monthYear, monthNum] = month.split('-').map(Number);
		const overdueThreshold = monthYear && monthNum ? Date.UTC(monthYear, monthNum + 1, 1) : NaN;
		const overdue = Boolean(entries.length && !isPaid && Number.isFinite(overdueThreshold) && Date.now() >= overdueThreshold);
		let paymentState = 'empty';
		if (entries.length) {
			if (payout?.manualOverride && payout.status !== 'paid') paymentState = payout.status === 'critical' ? 'critical' : 'pending';
			else if (isPaid) paymentState = 'good';
			else if (missingRate || overdue) paymentState = 'critical';
			else paymentState = 'pending';
		}
		const paymentDetail = paymentState === 'empty' ? 'Nema unosa rada u ovom mesecu' : paymentState === 'critical' ? (missingRate ? 'Tarif manquant pour une ou plusieurs saisies' : 'En retard de plus d’un mois · non payé') : paymentState === 'good' ? `Isplaćeno${payout?.paymentDate ? ` · ${formatRosterDate(payout.paymentDate)}` : ''}` : 'En attente de paiement';
		return { user, month, entries, rendezvous, payout, workedDays, hours, amount, nextRendezvous: nextWorkerRendezvous(allRendezvous), paymentState, paymentDetail, assignedProjects: assignedWorkerProjects(user), rateMissing: missingRate };
	}
	const cyclePaymentState = (state) => state === 'good' ? 'pending' : state === 'critical' ? 'paid' : 'critical';
	const renderRosterStatus = (snapshot) => { const meta = workerStatusMeta[snapshot.paymentState] || workerStatusMeta.empty; const clickable = isOwner() && snapshot.entries.length; return `<button type="button" class="worker-status ${meta.className}"${clickable ? ` data-cycle-status data-cycle-status-worker="${escapeHtml(snapshot.user.id)}" data-cycle-status-month="${escapeHtml(snapshot.month)}" data-cycle-status-state="${snapshot.paymentState}"` : ' disabled'}><span class="worker-status-dot" aria-hidden="true"></span>${meta.label}</button><small class="worker-status-detail">${escapeHtml(snapshot.paymentDetail)}</small>`; };
	function renderWorkerRosterSummary(snapshots) {
		const summary = document.querySelector('#worker-roster-summary');
		if (!summary) return;
		const totalAmount = snapshots.reduce((sum, snapshot) => sum + snapshot.amount, 0);
		const counts = Object.fromEntries(Object.keys(workerStatusMeta).map((status) => [status, snapshots.filter((snapshot) => snapshot.paymentState === status).length]));
		summary.innerHTML = `<div><dt>Ouvriers</dt><dd>${snapshots.length}</dd><small>${counts.empty ? `${counts.empty} sans saisie` : 'registre actif'}</small></div><div class="summary-critical"><dt>Critique</dt><dd>${counts.critical}</dd><small>échéance, tarif ou demande refusée</small></div><div class="summary-attention"><dt>À vérifier</dt><dd>${counts.attention + counts.pending}</dd><small>${counts.attention} en attente de paiement · ${counts.pending} en attente de vérification</small></div><div class="summary-total"><dt>Total ce mois-ci</dt><dd>${formatEUR(totalAmount)}</dd><small>${escapeHtml(formatMonthLabel(workerRosterState.month))}</small></div>`;
	}
	const closeWorkerActionMenus = () => { document.querySelectorAll('.worker-action-menu').forEach((menu) => { menu.hidden = true; }); document.querySelectorAll('.worker-action-menu-trigger').forEach((button) => button.setAttribute('aria-expanded', 'false')); workerRosterState.menuWorkerId = ''; };
	const toggleWorkerActionMenu = (workerId, trigger) => { const menu = trigger?.closest('.worker-action-menu-wrap')?.querySelector('.worker-action-menu'); const alreadyOpen = menu && !menu.hidden; closeWorkerActionMenus(); if (menu && !alreadyOpen) { menu.hidden = false; trigger.setAttribute('aria-expanded', 'true'); workerRosterState.menuWorkerId = workerId; menu.querySelector('[role="menuitem"]')?.focus(); } };
	function renderWorkerRoster() {
		const table = document.querySelector('#worker-roster-table');
		const body = document.querySelector('#worker-roster-body');
		const stateTarget = document.querySelector('#worker-roster-state');
		if (!table || !body || !stateTarget) return;
		const workerUsers = workerRosterState.users.filter((user) => isWorkerRole(user.role));
		const snapshots = workerUsers.map((user) => deriveWorkerSnapshot(user, workerRosterState.month));
		const query = workerRosterState.query.trim().toLowerCase();
		const sortComparators = {
			payment: (first, second) => workerStatusRank[first.paymentState] - workerStatusRank[second.paymentState],
			name: (first, second) => String(first.user.name || '').localeCompare(String(second.user.name || ''), 'fr', { sensitivity: 'base' }),
			days: (first, second) => first.workedDays - second.workedDays,
			hours: (first, second) => first.hours - second.hours,
			amount: (first, second) => first.amount - second.amount
		};
		const sortDirMultiplier = workerRosterState.sortDir === 'desc' ? -1 : 1;
		const primaryComparator = sortComparators[workerRosterState.sortBy] || sortComparators.payment;
		const filtered = snapshots.filter((snapshot) => { const haystack = [snapshot.user.name, snapshot.user.email, snapshot.user.phone, snapshot.user.company, snapshot.user.employerCompany, ...snapshot.assignedProjects].filter(Boolean).join(' ').toLowerCase(); return (!query || haystack.includes(query)) && (workerRosterState.statusFilter === 'all' || snapshot.paymentState === workerRosterState.statusFilter); }).sort((first, second) => (primaryComparator(first, second) * sortDirMultiplier) || String(first.user.name || '').localeCompare(String(second.user.name || ''), 'fr', { sensitivity: 'base' }));
		renderWorkerRosterSummary(snapshots);
		table.querySelectorAll('.sort-header').forEach((button) => { const active = button.dataset.sort === workerRosterState.sortBy; button.classList.toggle('active', active); button.setAttribute('aria-sort', active ? (workerRosterState.sortDir === 'desc' ? 'descending' : 'ascending') : 'none'); });
		document.querySelector('#worker-roster-period-label').textContent = `${formatMonthLabel(workerRosterState.month)} · ${filtered.length} sur ${snapshots.length} ouvriers`;
		if (workerRosterState.error) { stateTarget.hidden = false; stateTarget.innerHTML = `<strong>Podaci ekipe nisu dostupni.</strong><small>Réessayez sans effacer l’affichage précédent.</small><button class="secondary" id="worker-roster-retry" type="button">Réessayer</button>`; table.hidden = !workerUsers.length; } else if (workerRosterState.loading && !workerUsers.length) { stateTarget.hidden = false; stateTarget.innerHTML = '<strong>Données en cours de chargement…</strong>'; table.hidden = true; } else if (!workerUsers.length) { stateTarget.hidden = false; stateTarget.innerHTML = '<strong>Nema dodatih radnika</strong><small>Dodajte prvog radnika da biste pratili dane, sate i isplate.</small>'; table.hidden = true; } else if (!filtered.length) { stateTarget.hidden = false; stateTarget.innerHTML = '<strong>Nema radnika za ovaj filter</strong><small>Promenite pretragu ili status.</small>'; table.hidden = false; } else { stateTarget.hidden = true; stateTarget.innerHTML = ''; table.hidden = false; }
		body.innerHTML = filtered.map((snapshot) => { const user = snapshot.user; const contact = user.email || user.phone || 'Contact non renseigné'; const canManage = isOwner() && user.id !== (currentUser?.id || currentUser?.sub); const projectLabel = snapshot.assignedProjects.length ? snapshot.assignedProjects.join(', ') : 'Aucun chantier attribué'; const nextRdv = snapshot.nextRendezvous ? `${formatRosterDate(snapshot.nextRendezvous.absenceDate || snapshot.nextRendezvous.date)} · ${snapshot.nextRendezvous.time || ''}` : 'Aucun rendez-vous prévu'; return `<tr class="worker-roster-row ${workerStatusMeta[snapshot.paymentState]?.className || ''}" data-worker-row="${escapeHtml(user.id)}"><th scope="row"><div class="worker-name-cell">${identityTokenHtml(user.avatarUrl, user.name, 'worker-avatar worker-avatar--roster')}<button class="worker-detail-primary" data-worker-detail="${escapeHtml(user.id)}" type="button"><strong>${escapeHtml(user.name || 'Ouvrier')}</strong><span>Ouvrir le suivi</span></button></div><small class="worker-contact">${escapeHtml(contact)}</small><small class="worker-projects" title="${escapeHtml(projectLabel)}">${escapeHtml(projectLabel)}</small></th><td data-label="Jours"><strong>${snapshot.workedDays}</strong><small> ce mois</small></td><td data-label="Heures"><strong>${snapshot.hours.toFixed(2)}</strong><small> h</small></td><td data-label="Tarif"><span>${formatEUR(user.dailyRate || 0)}/j</span><small>${formatEUR(user.hourlyRate || 0)}/h</small></td><td data-label="Montant du mois" class="worker-amount"><strong>${formatEUR(snapshot.amount)}</strong><small>${snapshot.entries.length ? `${snapshot.entries.length} saisies` : 'aucune saisie'}</small></td><td data-label="Paiement" class="worker-payment-cell">${renderRosterStatus(snapshot)}</td><td data-label="Prochain RDV"><span class="worker-next-rdv">${escapeHtml(nextRdv)}</span>${snapshot.nextRendezvous?.reason ? `<small>${escapeHtml(snapshot.nextRendezvous.reason)}</small>` : ''}</td><td data-label="Actions" class="worker-actions-cell"><div class="worker-row-actions"><button class="secondary worker-detail-primary worker-detail-action" data-worker-detail="${escapeHtml(user.id)}" type="button">Ouvrir</button><button class="secondary worker-detail-action" data-worker-timesheet="${escapeHtml(user.id)}" type="button" title="Calendrier mensuel plein écran">Calendrier</button>${isOwner() && snapshot.entries.length && snapshot.paymentState !== 'good' ? `<button class="primary worker-detail-action worker-paid-quick" data-mark-paid="${escapeHtml(user.id)}" data-mark-paid-month="${escapeHtml(snapshot.month)}" type="button" title="Marquer comme payé" aria-label="Marquer ${escapeHtml(user.name || 'cet ouvrier')} comme payé">✓</button>` : ''}${canManage ? `<div class="worker-action-menu-wrap"><button class="secondary worker-action-menu-trigger" data-worker-menu="${escapeHtml(user.id)}" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Actions pour ${escapeHtml(user.name || 'cet ouvrier')}">⋯</button><div class="worker-action-menu" role="menu" hidden><button type="button" role="menuitem" data-worker-action="edit" data-worker="${escapeHtml(user.id)}">Modifier le profil</button><button type="button" role="menuitem" data-worker-action="reset" data-worker="${escapeHtml(user.id)}"${user.email ? '' : ' disabled'}>Envoyer le lien de mot de passe</button><button type="button" role="menuitem" class="danger" data-worker-action="delete" data-worker="${escapeHtml(user.id)}">Supprimer l’ouvrier</button></div></div>` : ''}</div></td></tr>`; }).join('');
		document.querySelector('#worker-roster-retry')?.addEventListener('click', () => loadUsers());
	}
	function setupWorkerRosterControls() {
		const monthInput = document.querySelector('#worker-roster-month');
		const searchInput = document.querySelector('#worker-roster-search');
		const filterInput = document.querySelector('#worker-roster-status-filter');
		if (monthInput && monthInput.dataset.wired !== 'true') { monthInput.dataset.wired = 'true'; monthInput.addEventListener('change', () => { workerRosterState.month = monthInput.value || new Date().toISOString().slice(0, 7); workerRosterState.detailSelectedDate = ''; renderWorkerRoster(); if (workerRosterState.detailWorkerId) { workerRosterState.detailMonth = workerRosterState.month; renderWorkerDetail(); } }); }
		if (searchInput && searchInput.dataset.wired !== 'true') { searchInput.dataset.wired = 'true'; searchInput.addEventListener('input', () => { workerRosterState.query = searchInput.value; renderWorkerRoster(); }); }
		if (filterInput && filterInput.dataset.wired !== 'true') { filterInput.dataset.wired = 'true'; filterInput.addEventListener('change', () => { workerRosterState.statusFilter = filterInput.value; renderWorkerRoster(); }); }
		const rosterHead = document.querySelector('#worker-roster-table thead');
		if (rosterHead && rosterHead.dataset.wired !== 'true') { rosterHead.dataset.wired = 'true'; rosterHead.addEventListener('click', (event) => { const button = event.target.closest('[data-sort]'); if (!button) return; const sortBy = button.dataset.sort; workerRosterState.sortDir = workerRosterState.sortBy === sortBy && workerRosterState.sortDir === 'asc' ? 'desc' : 'asc'; workerRosterState.sortBy = sortBy; renderWorkerRoster(); }); }
		if (monthInput && !monthInput.value) monthInput.value = workerRosterState.month;
		const addPanel = document.querySelector('#worker-add-panel');
		const toggleAdd = (open) => { if (!addPanel) return; addPanel.hidden = !open; document.querySelector('#toggle-add-worker')?.setAttribute('aria-expanded', String(open)); if (open) { addPanel.scrollIntoView({ behavior: 'smooth', block: 'start' }); addPanel.querySelector('input')?.focus(); } else document.querySelector('#toggle-add-worker')?.focus(); };
		[['#toggle-add-worker', true], ['#close-add-worker', false], ['#cancel-add-worker', false]].forEach(([selector, open]) => { const button = document.querySelector(selector); if (button && button.dataset.wired !== 'true') { button.dataset.wired = 'true'; button.addEventListener('click', () => toggleAdd(open)); } });
	}
	const workerDetailModal = document.querySelector('#worker-detail-modal');
	let lastWorkerDetailTrigger;
	function closeWorkerDetail() { if (!workerDetailModal) return; workerDetailModal.hidden = true; workerDetailModal.setAttribute('aria-hidden', 'true'); workerRosterState.detailWorkerId = ''; workerRosterState.detailSnapshot = null; lastWorkerDetailTrigger?.focus(); lastWorkerDetailTrigger = null; }
	function openWorkerDetail(workerId, trigger) { const user = workerRosterState.users.find((item) => item.id === workerId); if (!user || !workerDetailModal) return; closeWorkerActionMenus(); lastWorkerDetailTrigger = trigger; workerRosterState.detailWorkerId = workerId; workerRosterState.detailMonth = workerRosterState.detailMonth || workerRosterState.month; workerRosterState.detailSelectedDate = ''; workerDetailModal.hidden = false; workerDetailModal.setAttribute('aria-hidden', 'false'); renderWorkerDetail(); document.querySelector('#worker-detail-close')?.focus(); }
	function renderWorkerDetailCalendar(snapshot, month) {
		const target = document.querySelector('#worker-detail-calendar'); if (!target) return;
		const [year, monthNumber] = month.split('-').map(Number); const first = new Date(year, monthNumber - 1, 1); const last = new Date(year, monthNumber, 0); const entryByDate = new Map(snapshot.entries.map((entry) => [entry.date, entry])); const rendezvousByDate = new Map(); snapshot.rendezvous.forEach((item) => { const date = item.absenceDate || item.date; const list = rendezvousByDate.get(date) || []; list.push(item); rendezvousByDate.set(date, list); }); let cells = ''; for (let pad = 0; pad < (first.getDay() || 7) - 1; pad += 1) cells += '<span class="calendar-cell empty" aria-hidden="true"></span>'; for (let day = 1; day <= last.getDate(); day += 1) { const date = `${month}-${String(day).padStart(2, '0')}`; const weekday = new Date(year, monthNumber - 1, day).getDay(); const weekend = weekday === 0 || weekday === 6; const entry = entryByDate.get(date); const rdv = rendezvousByDate.get(date) || []; const title = [entry ? `${Number(entry.hours || 0).toFixed(2)} h · ${formatEUR(workerEntryAmount(entry, snapshot.user))}` : '', rdv.map((item) => `RDV ${item.time || ''} · ${item.reason || ''}`).join(' | ')].filter(Boolean).join(' · ') || 'Bez unosa'; const hoursButton = entry ? `<span class="calendar-quick-edit" data-edit-hours="${entry.id}" data-edit-hours-value="${Number(entry.hours || 0)}">${Number(entry.hours || 0).toFixed(1)}h<button type="button" class="calendar-icon-btn edit-only" data-edit-hours="${entry.id}" data-edit-hours-value="${Number(entry.hours || 0)}" title="Modifier les heures" aria-label="Modifier les heures">✎</button></span>` : ''; const rdvButtons = rdv.map((item) => `<span class="calendar-quick-edit calendar-rendezvous${item.type === 'absence' ? ' calendar-absence' : ''}" data-edit-rdv="${item.id}" data-edit-rdv-time="${escapeHtml(item.time || '')}">${item.type === 'absence' ? 'Absence' : `RDV ${escapeHtml(item.time || '')}`}<button type="button" class="calendar-icon-btn edit-only" data-edit-rdv="${item.id}" data-edit-rdv-time="${escapeHtml(item.time || '')}" title="Modifier" aria-label="Modifier">✎</button></span>`).join(''); const addRdvButton = `<button type="button" class="calendar-quick-edit calendar-add-rdv" data-add-rdv="${date}" title="Ajouter un RDV pour ${date}">+RDV</button>`; const addAbsenceButton = `<button type="button" class="calendar-quick-edit calendar-add-rdv" data-add-absence="${date}" title="Ajouter une absence pour ${date}">+Absence</button>`; const marker = hoursButton + rdvButtons + addRdvButton + addAbsenceButton; cells += `<div class="calendar-cell${weekend ? ' weekend' : ''}${entry ? ' worked' : ''}${rdv.length ? ' has-rendezvous' : ''}${rdv.some((item) => item.type === 'absence') ? ' has-absence' : ''}" data-detail-date="${date}" tabindex="0" role="button" title="${escapeHtml(title)}" aria-label="${escapeHtml(`${date}: ${title}`)}"><strong>${day}<span class="calendar-cell-weekday">${weekdayAbbrFr[weekday]}</span></strong>${marker}</div>`; }
		const workedDays = new Set(snapshot.entries.map((entry) => entry.date)).size; const hours = snapshot.entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0); const rdvDays = rendezvousByDate.size; target.className = `work-calendar worker-detail-calendar payment-${snapshot.paymentState}`; const clickableCalendarBadge = isOwner() && snapshot.entries.length; const calendarBadge = `<button type="button" class="worker-status ${workerStatusMeta[snapshot.paymentState].className}"${clickableCalendarBadge ? ` data-cycle-status data-cycle-status-worker="${escapeHtml(snapshot.user.id)}" data-cycle-status-month="${escapeHtml(snapshot.month)}" data-cycle-status-state="${snapshot.paymentState}"` : ' disabled'}><span class="worker-status-dot" aria-hidden="true"></span>${workerStatusMeta[snapshot.paymentState].label}</button>`; target.innerHTML = `<div class="work-calendar-head"><strong>${escapeHtml(formatMonthLabel(month))}</strong>${calendarBadge}<small>${workedDays} jours travaillés · ${hours.toFixed(2)} h · ${rdvDays} RDV</small></div><p class="calendar-hint">Cliquez sur une date pour voir le suivi de ce jour.</p><div class="calendar-weekdays"><span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span></div><div class="calendar-grid">${cells}</div>`;
	}
	function renderWorkerDetail() {
		const user = workerRosterState.users.find((item) => item.id === workerRosterState.detailWorkerId); if (!user) return; const month = workerRosterState.detailMonth || workerRosterState.month; const snapshot = deriveWorkerSnapshot(user, month); workerRosterState.detailSnapshot = snapshot; const title = document.querySelector('#worker-detail-title'); const subtitle = document.querySelector('#worker-detail-subtitle'); const monthInput = document.querySelector('#worker-detail-month'); const badge = document.querySelector('#worker-detail-payment-badge'); paintIdentityToken(document.querySelector('#worker-detail-avatar'), user.avatarUrl || '', user.name); if (title) title.textContent = user.name || 'Radnik'; if (subtitle) subtitle.textContent = [user.email || user.phone || 'Kontakt nije unet', user.company || user.employerCompany || '', snapshot.assignedProjects.join(', ')].filter(Boolean).join(' · '); if (monthInput) monthInput.value = month; if (badge) { badge.className = `worker-status ${workerStatusMeta[snapshot.paymentState].className}`; badge.innerHTML = `<span class="worker-status-dot" aria-hidden="true"></span>${workerStatusMeta[snapshot.paymentState].label}`; const clickable = isOwner() && snapshot.entries.length; badge.disabled = !clickable; if (clickable) { badge.dataset.cycleStatusWorker = user.id; badge.dataset.cycleStatusMonth = month; badge.dataset.cycleStatusState = snapshot.paymentState; } else { delete badge.dataset.cycleStatusWorker; delete badge.dataset.cycleStatusMonth; delete badge.dataset.cycleStatusState; } }
		document.querySelector('#worker-detail-summary').innerHTML = `<div><small>Jours travaillés</small><strong>${snapshot.workedDays}</strong><span>${escapeHtml(formatMonthLabel(month))}</span></div><div><small>Heures</small><strong>${snapshot.hours.toFixed(2)}</strong><span>total</span></div><div><small>Tarif journalier</small><strong>${formatEUR(user.dailyRate || 0)}</strong><span>par jour</span></div><div><small>Tarif horaire</small><strong>${formatEUR(user.hourlyRate || 0)}</strong><span>par heure</span></div><div class="detail-summary-amount"><small>Calculé</small><strong>${formatEUR(snapshot.amount)}</strong><span>${snapshot.entries.length} saisies</span></div>`;
		renderWorkerDetailCalendar(snapshot, month); renderWorkerDetailPayment(snapshot); renderWorkerDetailRendezvous(snapshot); renderWorkerDetailEntries(snapshot); loadWorkerDetailDocuments(user.id);
	}
	function daysUntilExpiry(expiresAt) { return expiresAt ? Math.ceil((new Date(expiresAt) - new Date()) / 86400000) : null; }
	function renderPersonalDocumentList(target, items) {
		if (!target) return;
		if (!items.length) { target.innerHTML = '<small>Aucun document.</small>'; return; }
		target.innerHTML = items.map((item) => {
			const days = daysUntilExpiry(item.expiresAt);
			const expiryLabel = days == null ? '' : days < 0 ? 'Expiré' : days <= 30 ? `Expire dans ${days} j` : `Valide jusqu’au ${item.expiresAt.slice(0, 10)}`;
			const stateClass = days == null ? '' : days < 0 ? 'bad' : days <= 30 ? 'warn' : 'ok';
			return `<div class="list-item ${stateClass}"><strong>${escapeHtml(item.docType)}</strong><small>${escapeHtml(item.originalName)} · ${item.direction === 'gerant-to-worker' ? 'Envoyé par le gérant' : 'Envoyé par l’ouvrier'}${expiryLabel ? ' · ' + expiryLabel : ''}</small><div class="document-actions"><button class="secondary view-personal-document" data-document="${item.id}" type="button">Voir</button><button class="secondary send-personal-document-email" data-document="${item.id}" data-name="${escapeHtml(item.originalName)}" type="button">Envoyer par email</button><button class="secondary delete-personal-document" data-document="${item.id}" type="button">Supprimer</button></div></div>`;
		}).join('');
		target.querySelectorAll('.delete-personal-document').forEach((button) => button.addEventListener('click', async () => {
			if (!window.confirm('Supprimer ce document ?')) return;
			try { await request(`/personal-documents/${button.dataset.document}`, { method: 'DELETE' }); await Promise.allSettled([loadWorkerDetailDocuments(workerRosterState.detailWorkerId), loadMyDocuments()]); toast('Document supprimé.'); } catch { toast('Document non supprimé.'); }
		}));
		target.querySelectorAll('.view-personal-document').forEach((button) => button.addEventListener('click', () => viewDocument(`/personal-documents/${button.dataset.document}/download`, button)));
		target.querySelectorAll('.send-personal-document-email').forEach((button) => button.addEventListener('click', () => sendDocumentByEmail(`/personal-documents/${button.dataset.document}/download`, button.dataset.name, button)));
	}
	async function loadWorkerDetailDocuments(workerId) {
		if (!workerId) return;
		try { const all = await request('/personal-documents'); renderPersonalDocumentList(document.querySelector('#worker-detail-documents'), all.filter((item) => item.workerId === workerId)); } catch { renderPersonalDocumentList(document.querySelector('#worker-detail-documents'), []); }
	}
	async function loadMyDocuments() {
		const panel = document.querySelector('#my-documents-panel');
		if (!panel) return;
		const visible = isWorkerRole(currentUser?.role);
		panel.toggleAttribute('hidden', !visible);
		document.querySelector('.mobile-tab[data-tab-target="my-documents-panel"]')?.toggleAttribute('hidden', !visible);
		if (!visible) return;
		try { const items = await request('/personal-documents'); renderPersonalDocumentList(document.querySelector('#my-documents'), items); } catch { renderPersonalDocumentList(document.querySelector('#my-documents'), []); }
	}
	function renderWorkerDetailPayment(snapshot) {
		const target = document.querySelector('#worker-detail-payment'); if (!target) return;
		const payout = snapshot.payout;
		const due = payout?.paymentDate && snapshot.paymentState === 'good' ? `Payé : ${formatRosterDate(payout.paymentDate)}` : 'Pas encore payé';
		const swatch = (value, stateName, label) => `<button type="button" class="status-swatch status-swatch-${value}${snapshot.paymentState === stateName ? ' active' : ''}" data-set-status="${value}" data-set-status-worker="${escapeHtml(snapshot.user.id)}" data-set-status-month="${escapeHtml(snapshot.month)}" title="${label}" aria-label="${label}"></button>`;
		const actions = isOwner() && snapshot.entries.length ? `<div class="detail-payment-actions status-swatches">${swatch('pending', 'pending', 'En attente (jaune)')}${swatch('critical', 'critical', 'Critique (rouge)')}${swatch('paid', 'good', 'Payé (vert)')}</div>` : '';
		const clickable = isOwner() && snapshot.entries.length;
		const badge = `<button type="button" class="worker-status ${workerStatusMeta[snapshot.paymentState].className}"${clickable ? ` data-cycle-status data-cycle-status-worker="${escapeHtml(snapshot.user.id)}" data-cycle-status-month="${escapeHtml(snapshot.month)}" data-cycle-status-state="${snapshot.paymentState}"` : ' disabled'}><span class="worker-status-dot" aria-hidden="true"></span>${workerStatusMeta[snapshot.paymentState].label}</button>`;
		const downloadButton = `<button type="button" class="secondary" data-download-pdf data-download-pdf-worker="${escapeHtml(snapshot.user.id)}" data-download-pdf-month="${escapeHtml(snapshot.month)}" data-download-pdf-name="${escapeHtml(snapshot.user.name || '')}">Télécharger PDF (${escapeHtml(formatMonthLabel(snapshot.month))})</button>`;
		target.innerHTML = `<div class="detail-payment-status ${workerStatusMeta[snapshot.paymentState].className}"><div>${badge}<strong>${formatEUR(snapshot.amount)}</strong></div><p>${escapeHtml(snapshot.paymentDetail)}</p><small>${escapeHtml(due)}</small>${actions}<div class="detail-payment-actions">${downloadButton}</div></div>`;
	}
	function renderWorkerDetailRendezvous(snapshot) { const target = document.querySelector('#worker-detail-rendezvous'); if (!target) return; target.innerHTML = snapshot.rendezvous.length ? snapshot.rendezvous.slice().sort((first, second) => `${first.absenceDate || first.date} ${first.time}`.localeCompare(`${second.absenceDate || second.date} ${second.time}`)).map((item) => `<div class="detail-list-item"><strong>${escapeHtml(formatRosterDate(item.absenceDate || item.date))} · ${escapeHtml(item.time || '')}</strong><small>${escapeHtml(item.reason || 'Bez razloga')} · ${escapeHtml(assignedWorkerProjects({ projectIds: [item.projectId] })[0] || item.projectId || '')}</small></div>`).join('') : '<small>Nema RDV/odsustva u izabranom mesecu.</small>'; }
	function renderWorkerDetailEntries(snapshot) {
		const target = document.querySelector('#worker-detail-entries'); if (!target) return;
		const selectedDate = workerRosterState.detailSelectedDate;
		if (!selectedDate) { target.innerHTML = '<small>Cliquez sur un jour du calendrier pour voir et modifier cette saisie.</small>'; return; }
		const entries = snapshot.entries.filter((entry) => entry.date === selectedDate);
		const heading = `<div class="detail-list-filter"><small>${escapeHtml(formatRosterDate(selectedDate))}</small><button class="secondary" type="button" data-detail-clear>Zatvori</button></div>`;
		const canEdit = (item) => isOwner() || item.status !== 'approved';
		const editForm = (item) => `<form class="detail-list-item detail-entry-edit" data-edit-entry="${item.id}"><div class="form-row"><label>Début<input type="time" name="start" value="${escapeHtml(item.start || '')}" required /></label><label>Fin<input type="time" name="end" value="${escapeHtml(item.end || '')}" required /></label></div><div class="form-row"><label>Pause (min)<input type="number" name="breakMinutes" min="0" value="${Number(item.breakMinutes || 0)}" /></label><label>Tarif<select name="rateType"><option value="daily"${item.rateType === 'daily' ? ' selected' : ''}>Dnevnica</option><option value="hourly"${item.rateType === 'hourly' ? ' selected' : ''}>Satnica</option></select></label></div><div class="form-row"><label>Montant EUR<input type="number" name="rate" min="0.01" step="0.01" value="${Number(item.rate || 0)}" required /></label></div><div class="detail-list-filter"><button class="primary" type="submit">Enregistrer</button><button class="secondary" type="button" data-cancel-edit>Annuler</button></div></form>`;
		const viewRow = (item) => `<div class="detail-list-item"><strong>${escapeHtml(formatRosterDate(item.date))} · ${Number(item.hours || 0).toFixed(2)} h · ${formatEUR(workerEntryAmount(item, snapshot.user))}</strong><small>${escapeHtml(item.start || '')}${item.end ? `–${escapeHtml(item.end)}` : ''} · ${item.rateType === 'hourly' ? 'Satnica' : 'Dnevnica'} · ${item.status === 'approved' ? 'Odobreno' : item.status === 'rejected' ? 'Odbijeno' : 'En attente de vérification'}</small>${canEdit(item) ? `<div class="detail-list-filter"><button class="secondary" type="button" data-edit-entry-start="${item.id}">Modifier</button><button class="secondary" type="button" data-delete-entry="${item.id}">Supprimer</button></div>` : ''}</div>`;
		target.innerHTML = `${heading}${entries.length ? entries.map((item) => workerRosterState.editingEntryId === item.id ? editForm(item) : viewRow(item)).join('') : '<small>Aucune saisie pour ce jour.</small>'}`;
	}
	async function downloadHoursPdf(workerId, month, workerName, trigger) {
		if (trigger) { trigger.disabled = true; trigger.setAttribute('aria-busy', 'true'); }
		try {
			const response = await fetch(`${api}/time-entries/pdf/download?workerId=${encodeURIComponent(workerId)}&month=${encodeURIComponent(month)}`, { headers: { Authorization: `Bearer ${token()}` } });
			if (!response.ok) throw new Error();
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `ibra-lista-plate-${month}-${(workerName || 'radnik').replace(/\s+/g, '-')}.pdf`;
			document.body.append(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(url);
		} catch { toast('PDF nije preuzet.'); }
		finally { if (trigger) { trigger.disabled = false; trigger.removeAttribute('aria-busy'); } }
	}
	async function resolveDownloadUrl(downloadPath) {
		try { const result = await request(`${downloadPath}?resolve=url`); return result?.url || null; } catch { return null; }
	}
	async function viewDocument(downloadPath, trigger) {
		if (trigger) { trigger.disabled = true; trigger.setAttribute('aria-busy', 'true'); }
		try {
			const resolvedUrl = await resolveDownloadUrl(downloadPath);
			if (resolvedUrl) { window.open(resolvedUrl, '_blank'); return; }
			const response = await fetch(`${api}${downloadPath}`, { headers: { Authorization: `Bearer ${token()}` } });
			if (!response.ok) throw new Error();
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			window.open(url, '_blank');
			setTimeout(() => URL.revokeObjectURL(url), 60000);
		} catch { toast('Le document n’a pas pu être ouvert.'); }
		finally { if (trigger) { trigger.disabled = false; trigger.removeAttribute('aria-busy'); } }
	}
	async function sendDocumentByEmail(downloadPath, filename, trigger) {
		if (trigger) { trigger.disabled = true; trigger.setAttribute('aria-busy', 'true'); }
		try {
			const resolvedUrl = await resolveDownloadUrl(downloadPath);
			if (resolvedUrl) {
				window.open(resolvedUrl, '_blank');
			} else {
				const response = await fetch(`${api}${downloadPath}`, { headers: { Authorization: `Bearer ${token()}` } });
				if (!response.ok) throw new Error();
				const blob = await response.blob();
				const blobUrl = URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.href = blobUrl;
				link.download = filename || 'document';
				document.body.append(link);
				link.click();
				link.remove();
				setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
			}
			const to = companyProfileState?.accountantEmail || '';
			const subject = encodeURIComponent(`Document IBRA-BA : ${filename || ''}`);
			const body = encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-joint le document « ${filename || ''} » (téléchargé automatiquement — joignez-le manuellement à cet e-mail).\n\nCordialement.`);
			window.open(`mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`, '_blank');
			toast('Document téléchargé. Joignez-le à l’e-mail qui vient de s’ouvrir.');
		} catch { toast('Le document n’a pas pu être téléchargé.'); }
		finally { if (trigger) { trigger.disabled = false; trigger.removeAttribute('aria-busy'); } }
	}
	async function markWorkerPaid(userId, month, trigger) {
		if (!window.confirm('Marquer ce mois comme payé ?')) return;
		if (trigger) trigger.disabled = true;
		try { await request('/payout-requests/mark-paid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, month }) }); await loadUsers(); renderWorkerDetail(); toast('Le paiement a été marqué.'); }
		catch { toast('Le paiement n’a pas été marqué.'); }
		finally { if (trigger) trigger.disabled = false; }
	}
	async function setWorkerPaymentStatus(userId, month, status, trigger) {
		if (trigger) trigger.disabled = true;
		try { await request('/payout-requests/set-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, month, status }) }); await loadUsers(); renderWorkerDetail(); toast('Statut du paiement modifié.'); }
		catch { toast('Status nije promenjen.'); }
		finally { if (trigger) trigger.disabled = false; }
	}
	async function cycleWorkerPaymentStatus(userId, month, currentState, trigger) {
		await setWorkerPaymentStatus(userId, month, cyclePaymentState(currentState), trigger);
	}
	workerDetailModal?.addEventListener('keydown', (event) => { if (event.key !== 'Enter' && event.key !== ' ') return; const cell = event.target.closest('[data-detail-date]'); if (!cell || event.target !== cell) return; event.preventDefault(); cell.click(); });
	workerDetailModal?.addEventListener('click', async (event) => {
		if (event.target === workerDetailModal) { closeWorkerDetail(); return; }
		const cycleButton = event.target.closest('[data-cycle-status]'); if (cycleButton && !cycleButton.disabled) { await cycleWorkerPaymentStatus(cycleButton.dataset.cycleStatusWorker, cycleButton.dataset.cycleStatusMonth, cycleButton.dataset.cycleStatusState, cycleButton); return; }
		const swatchButton = event.target.closest('[data-set-status]'); if (swatchButton) { await setWorkerPaymentStatus(swatchButton.dataset.setStatusWorker, swatchButton.dataset.setStatusMonth, swatchButton.dataset.setStatus, swatchButton); return; }
		const downloadPdfButton = event.target.closest('[data-download-pdf]'); if (downloadPdfButton) { await downloadHoursPdf(downloadPdfButton.dataset.downloadPdfWorker, downloadPdfButton.dataset.downloadPdfMonth, downloadPdfButton.dataset.downloadPdfName, downloadPdfButton); return; }
		const deleteHoursButton = event.target.closest('[data-delete-hours]'); if (deleteHoursButton) { await deleteHoursEntryDirect(deleteHoursButton.dataset.deleteHours, async () => { await loadUsers(); renderWorkerDetail(); }); return; }
		const editHoursButton = event.target.closest('[data-edit-hours]'); if (editHoursButton) { openHoursQuickEdit(editHoursButton, editHoursButton.dataset.editHours, editHoursButton.dataset.editHoursValue, async () => { await loadUsers(); renderWorkerDetail(); }); return; }
		const deleteRdvButton = event.target.closest('[data-delete-rdv]'); if (deleteRdvButton) { await deleteRdvEntryDirect(deleteRdvButton.dataset.deleteRdv, async () => { await loadUsers(); renderWorkerDetail(); }); return; }
		const editRdvButton = event.target.closest('[data-edit-rdv]'); if (editRdvButton) { openRdvQuickEdit(editRdvButton, editRdvButton.dataset.editRdv, editRdvButton.dataset.editRdvTime, async () => { await loadUsers(); renderWorkerDetail(); }); return; }
		const addRdvButton = event.target.closest('[data-add-rdv]'); if (addRdvButton) { const snapshot = workerRosterState.detailSnapshot; openRdvCreateQuickEdit(addRdvButton, { date: addRdvButton.dataset.addRdv, projectId: snapshot?.user?.projectIds?.[0], workerId: snapshot?.user?.id }, async () => { await loadUsers(); renderWorkerDetail(); }); return; }
		const addAbsenceButton = event.target.closest('[data-add-absence]'); if (addAbsenceButton) { const snapshot = workerRosterState.detailSnapshot; await createAbsenceDirect({ date: addAbsenceButton.dataset.addAbsence, projectId: snapshot?.user?.projectIds?.[0], workerId: snapshot?.user?.id }, async () => { await loadUsers(); renderWorkerDetail(); }); return; }
		const dateButton = event.target.closest('[data-detail-date]'); if (dateButton) { workerRosterState.detailSelectedDate = dateButton.dataset.detailDate; workerRosterState.editingEntryId = ''; renderWorkerDetail(); return; }
		if (event.target.closest('[data-detail-clear]')) { workerRosterState.detailSelectedDate = ''; workerRosterState.editingEntryId = ''; renderWorkerDetail(); return; }
		const editStartButton = event.target.closest('[data-edit-entry-start]'); if (editStartButton) { workerRosterState.editingEntryId = editStartButton.dataset.editEntryStart; renderWorkerDetail(); return; }
		if (event.target.closest('[data-cancel-edit]')) { workerRosterState.editingEntryId = ''; renderWorkerDetail(); return; }
		const deleteButton = event.target.closest('[data-delete-entry]'); if (deleteButton) { if (!window.confirm('Obrisati ovaj unos radnog vremena?')) return; deleteButton.disabled = true; try { await request(`/time-entries/${encodeURIComponent(deleteButton.dataset.deleteEntry)}`, { method: 'DELETE' }); await loadUsers(); renderWorkerDetail(); toast('Unos je obrisan.'); } catch { toast('Unos nije obrisan.'); } finally { deleteButton.disabled = false; } return; }
		const markPaidButton = event.target.closest('[data-mark-paid]'); if (markPaidButton) { await markWorkerPaid(markPaidButton.dataset.markPaid, markPaidButton.dataset.markPaidMonth, markPaidButton); return; }
		const payoutButton = event.target.closest('[data-payout-status]'); if (payoutButton) { payoutButton.disabled = true; try { await request(`/payout-requests/${encodeURIComponent(payoutButton.dataset.payout)}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: payoutButton.dataset.payoutStatus }) }); await loadUsers(); renderWorkerDetail(); toast(payoutButton.dataset.payoutStatus === 'paid' ? 'Le paiement a été marqué comme terminé.' : 'Status zahteva je promenjen.'); } catch { toast('Statut du paiement non modifié.'); } finally { payoutButton.disabled = false; } }
	});
	workerDetailModal?.addEventListener('submit', async (event) => {
		const form = event.target.closest('[data-edit-entry]'); if (!form) return;
		event.preventDefault();
		const submitButton = form.querySelector('button[type="submit"]'); if (submitButton) submitButton.disabled = true;
		try {
			await request(`/time-entries/${encodeURIComponent(form.dataset.editEntry)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
			workerRosterState.editingEntryId = '';
			await loadUsers(); renderWorkerDetail(); toast('Unos je izmenjen.');
		} catch { toast('Unos nije izmenjen.'); }
		finally { if (submitButton) submitButton.disabled = false; }
	});
	workerDetailModal?.querySelector('#worker-detail-close')?.addEventListener('click', closeWorkerDetail);
	const workerTimesheetModal = document.querySelector('#worker-timesheet-modal');
	workerTimesheetModal?.addEventListener('click', (event) => { if (event.target === workerTimesheetModal) closeWorkerTimesheet(); });
	workerTimesheetModal?.querySelector('#worker-timesheet-close')?.addEventListener('click', closeWorkerTimesheet);
	workerTimesheetModal?.querySelector('#worker-timesheet-prev')?.addEventListener('click', () => { workerTimesheetState.month = shiftMonthKey(workerTimesheetState.month, -1); renderWorkerTimesheet(); });
	workerTimesheetModal?.querySelector('#worker-timesheet-next')?.addEventListener('click', () => { workerTimesheetState.month = shiftMonthKey(workerTimesheetState.month, 1); renderWorkerTimesheet(); });
	workerTimesheetModal?.querySelector('#worker-timesheet-reference-hours')?.addEventListener('change', (event) => { const value = Math.max(1, Math.min(24, Number(event.target.value) || 8)); workerTimesheetState.referenceHours = value; try { localStorage.setItem('ibra-worker-timesheet-reference-hours', String(value)); } catch { /* storage unavailable */ } renderWorkerTimesheet(); });
	document.querySelector('#worker-detail-open-timesheet')?.addEventListener('click', () => { if (workerRosterState.detailWorkerId) openWorkerTimesheet(workerRosterState.detailWorkerId); });
	document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && workerTimesheetModal && !workerTimesheetModal.hidden) closeWorkerTimesheet(); });
	workerDetailModal?.addEventListener('change', (event) => { if (event.target.id !== 'worker-detail-month') return; workerRosterState.detailMonth = event.target.value || workerRosterState.month; workerRosterState.detailSelectedDate = ''; renderWorkerDetail(); });
	document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeWorkerActionMenus(); if (workerDetailModal && !workerDetailModal.hidden) closeWorkerDetail(); } if (event.key === 'Tab' && workerDetailModal && !workerDetailModal.hidden) { const focusable = [...workerDetailModal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')].filter((element) => !element.hidden && element.offsetParent !== null); if (!focusable.length) return; const first = focusable[0]; const last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } });
	document.addEventListener('click', (event) => { if (!event.target.closest('.worker-action-menu-wrap')) closeWorkerActionMenus(); });
	document.querySelector('#worker-roster-body')?.addEventListener('click', async (event) => { const cycleButton = event.target.closest('[data-cycle-status]'); if (cycleButton && !cycleButton.disabled) { await cycleWorkerPaymentStatus(cycleButton.dataset.cycleStatusWorker, cycleButton.dataset.cycleStatusMonth, cycleButton.dataset.cycleStatusState, cycleButton); return; } const detailButton = event.target.closest('[data-worker-detail]'); if (detailButton) { openWorkerDetail(detailButton.dataset.workerDetail, detailButton); return; } const timesheetButton = event.target.closest('[data-worker-timesheet]'); if (timesheetButton) { openWorkerTimesheet(timesheetButton.dataset.workerTimesheet); return; } const menuTrigger = event.target.closest('[data-worker-menu]'); if (menuTrigger) { event.stopPropagation(); toggleWorkerActionMenu(menuTrigger.dataset.workerMenu, menuTrigger); return; } const action = event.target.closest('[data-worker-action]'); if (!action) return; const user = workerRosterState.users.find((item) => item.id === action.dataset.worker); closeWorkerActionMenus(); if (!user) return; if (action.dataset.workerAction === 'edit') { openUserEditor(user, action); return; } if (action.dataset.workerAction === 'reset') { await resetUserPassword(user, action); return; } if (action.dataset.workerAction === 'delete' && window.confirm(`Supprimer l’ouvrier ${user.name} ?`)) { try { await request(`/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' }); await refreshActiveView(); toast('Radnik je uklonjen.'); } catch (error) { let message = 'Radnik nije uklonjen.'; try { message = JSON.parse(error.message).error || message; } catch {} toast(message); } } });
	async function loadUsers() {
		setupWorkerRosterControls();
		workerRosterState.loading = true; workerRosterState.error = null; renderWorkerRoster();
		try {
			await loadProjectOptions();
			const [users, entries, rendezvous, payouts] = await Promise.all([request('/contacts'), request('/time-entries'), request('/rendezvous'), request('/payout-requests')]);
			workerRosterState.users = users; workerRosterState.entries = entries; workerRosterState.rendezvous = rendezvous; workerRosterState.payouts = payouts; workerRosterState.loading = false; workerRosterState.error = null; renderWorkerRoster();
			const currentUserId = currentUser?.id || currentUser?.sub; const recipient = document.querySelector('#recipient'); if (recipient) { const previousValue = recipient.value; recipient.innerHTML = users.filter((user) => user.id !== currentUserId).map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)} · ${escapeHtml(userRoleLabels[user.role] || user.role)}</option>`).join(''); if (previousValue && [...recipient.options].some((option) => option.value === previousValue)) recipient.value = previousValue; renderChatThread(); }
			if (workerRosterState.detailWorkerId) renderWorkerDetail();
		} catch (error) { workerRosterState.loading = false; workerRosterState.error = error; renderWorkerRoster(); }
	}
	const workerAssignmentModal = document.querySelector('#worker-assignment-modal');
	const workerAssignmentState = { query: '', workers: [], projects: [], original: {}, draft: {} };
	let lastWorkerAssignmentTrigger;
	function assignmentChangedCount() {
		return workerAssignmentState.workers.reduce((count, worker) => {
			const original = new Set(workerAssignmentState.original[worker.id] || []);
			const draft = new Set(workerAssignmentState.draft[worker.id] || []);
			const same = original.size === draft.size && [...original].every((id) => draft.has(id));
			return same ? count : count + 1;
		}, 0);
	}
	function renderWorkerAssignmentMatrix() {
		const headRow = document.querySelector('#worker-assignment-head-row');
		const body = document.querySelector('#worker-assignment-body');
		const stateTarget = document.querySelector('#worker-assignment-state');
		const table = document.querySelector('#worker-assignment-table');
		if (!headRow || !body || !stateTarget || !table) return;
		const projects = workerAssignmentState.projects;
		headRow.innerHTML = `<th scope="col">Ouvrier</th>${projects.map((project) => `<th scope="col">${escapeHtml(project.name)}</th>`).join('')}`;
		const query = workerAssignmentState.query.trim().toLowerCase();
		const workers = workerAssignmentState.workers.filter((worker) => !query || [worker.name, worker.email, worker.phone].filter(Boolean).join(' ').toLowerCase().includes(query));
		if (!workerAssignmentState.workers.length) { stateTarget.hidden = false; stateTarget.innerHTML = '<strong>Aucun ouvrier à attribuer</strong><small>Invitez un ouvrier par e-mail, puis attribuez-lui un chantier.</small>'; table.hidden = true; }
		else if (!projects.length) { stateTarget.hidden = false; stateTarget.innerHTML = '<strong>Aucun chantier disponible</strong><small>Créez un chantier depuis un devis avant de gérer les attributions.</small>'; table.hidden = true; }
		else if (!workers.length) { stateTarget.hidden = false; stateTarget.innerHTML = '<strong>Aucun ouvrier ne correspond à cette recherche.</strong>'; table.hidden = true; }
		else { stateTarget.hidden = true; stateTarget.innerHTML = ''; table.hidden = false; }
		body.innerHTML = workers.map((worker) => { const draftIds = new Set(workerAssignmentState.draft[worker.id] || []); return `<tr><th scope="row">${identityTokenHtml(worker.avatarUrl, worker.name, 'worker-avatar worker-avatar--roster')}<span>${escapeHtml(worker.name)}</span></th>${projects.map((project) => { const assigned = draftIds.has(project.id); return `<td><button type="button" class="assignment-cell${assigned ? ' assignment-cell--assigned' : ''}" data-assignment-worker="${escapeHtml(worker.id)}" data-assignment-project="${escapeHtml(project.id)}" aria-pressed="${assigned}" aria-label="${escapeHtml(worker.name)} ${assigned ? 'est attribué(e) à' : 'n’est pas attribué(e) à'} ${escapeHtml(project.name)}"><span aria-hidden="true"></span></button></td>`; }).join('')}</tr>`; }).join('');
		const savebar = document.querySelector('#worker-assignment-savebar');
		const changed = assignmentChangedCount();
		if (savebar) { savebar.hidden = changed === 0; document.querySelector('#worker-assignment-change-count').textContent = `${changed} attribution${changed === 1 ? '' : 's'} modifiée${changed === 1 ? '' : 's'}`; }
	}
	async function loadWorkerAssignments() {
		const stateTarget = document.querySelector('#worker-assignment-state');
		try {
			const result = await request('/worker-assignments');
			workerAssignmentState.workers = result.workers;
			workerAssignmentState.projects = result.projects;
			workerAssignmentState.original = Object.fromEntries(result.assignments.map((item) => [item.userId, item.projectIds]));
			workerAssignmentState.draft = Object.fromEntries(result.assignments.map((item) => [item.userId, [...item.projectIds]]));
			renderWorkerAssignmentMatrix();
		} catch { if (stateTarget) { stateTarget.hidden = false; stateTarget.innerHTML = '<strong>Impossible de charger les attributions.</strong>'; } }
	}
	function openWorkerAssignmentDrawer(trigger) {
		if (!workerAssignmentModal) return;
		lastWorkerAssignmentTrigger = trigger;
		workerAssignmentState.query = '';
		const searchInput = document.querySelector('#worker-assignment-search');
		if (searchInput) searchInput.value = '';
		document.querySelector('#worker-assignment-message').textContent = '';
		workerAssignmentModal.hidden = false; workerAssignmentModal.setAttribute('aria-hidden', 'false');
		loadWorkerAssignments();
		searchInput?.focus();
	}
	function closeWorkerAssignmentDrawer({ force = false } = {}) {
		if (!workerAssignmentModal) return;
		if (!force && assignmentChangedCount() > 0 && !window.confirm('Ignorer les modifications non enregistrées ?')) return;
		workerAssignmentModal.hidden = true; workerAssignmentModal.setAttribute('aria-hidden', 'true');
		const trigger = lastWorkerAssignmentTrigger; lastWorkerAssignmentTrigger = null; trigger?.focus();
	}
	document.querySelector('#open-worker-assignments')?.addEventListener('click', (event) => openWorkerAssignmentDrawer(event.currentTarget));
	document.querySelector('#worker-assignment-close')?.addEventListener('click', () => closeWorkerAssignmentDrawer());
	workerAssignmentModal?.addEventListener('click', (event) => { if (event.target === workerAssignmentModal) closeWorkerAssignmentDrawer(); });
	document.querySelector('#worker-assignment-search')?.addEventListener('input', (event) => { workerAssignmentState.query = event.currentTarget.value; renderWorkerAssignmentMatrix(); });
	document.querySelector('#worker-assignment-body')?.addEventListener('click', (event) => {
		const cell = event.target.closest('[data-assignment-worker]');
		if (!cell) return;
		const workerId = cell.dataset.assignmentWorker;
		const projectId = cell.dataset.assignmentProject;
		const current = new Set(workerAssignmentState.draft[workerId] || []);
		if (current.has(projectId)) current.delete(projectId); else current.add(projectId);
		workerAssignmentState.draft[workerId] = [...current];
		renderWorkerAssignmentMatrix();
	});
	document.querySelector('#worker-assignment-cancel')?.addEventListener('click', () => { workerAssignmentState.draft = Object.fromEntries(Object.entries(workerAssignmentState.original).map(([id, ids]) => [id, [...ids]])); renderWorkerAssignmentMatrix(); });
	document.querySelector('#worker-assignment-save')?.addEventListener('click', async () => {
		const button = document.querySelector('#worker-assignment-save');
		const message = document.querySelector('#worker-assignment-message');
		message.textContent = '';
		button.disabled = true; button.setAttribute('aria-busy', 'true');
		const assignments = Object.entries(workerAssignmentState.draft).map(([userId, projectIds]) => ({ userId, projectIds }));
		try {
			await request('/worker-assignments', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignments }) });
			workerAssignmentState.original = Object.fromEntries(assignments.map((item) => [item.userId, [...item.projectIds]]));
			renderWorkerAssignmentMatrix();
			await loadUsers();
			toast('Attributions chantier enregistrées.');
		} catch { message.textContent = 'Les attributions n’ont pas été enregistrées. Réessayez.'; }
		finally { button.disabled = false; button.removeAttribute('aria-busy'); }
	});
	document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && workerAssignmentModal && !workerAssignmentModal.hidden) closeWorkerAssignmentDrawer(); });
	async function loadRendezvous(items) {
		const activeProject = currentProjectId();
		latestRendezvous = (items || await request('/rendezvous')).filter((item) => !activeProject || !item.projectId || item.projectId === activeProject);
	}
	function renderChatThread() {
		const target = document.querySelector('#messages'); if (!target) return;
		const recipientSelect = document.querySelector('#recipient');
		const currentUserId = currentUser?.id || currentUser?.sub;
		const chatMessages = latestChatMessages.filter((item) => item.type !== 'rendezvous-notification');
		let selectedId = recipientSelect?.value || '';
		if (!selectedId) {
			const lastPartner = chatMessages.slice().sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))[0];
			selectedId = lastPartner ? (lastPartner.senderId === currentUserId ? lastPartner.recipientId : lastPartner.senderId) : (recipientSelect?.options[0]?.value || '');
			if (recipientSelect && selectedId) recipientSelect.value = selectedId;
		}
		const thread = chatMessages.filter((item) => (item.senderId === currentUserId && item.recipientId === selectedId) || (item.senderId === selectedId && item.recipientId === currentUserId)).sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt));
		const canDelete = (item) => !item.optimistic && (item.senderId === currentUserId || isOwner());
		const avatarFor = (item, mine) => { const user = mine ? currentUser : workerRosterState.users.find((candidate) => candidate.id === item.senderId); return identityTokenHtml(user?.avatarUrl || user?.companyLogoUrl || '', item.senderName || user?.name || '', 'worker-avatar chat-avatar'); };
		target.innerHTML = thread.length ? thread.map((item) => {
			const mine = item.senderId === currentUserId;
			const time = new Date(item.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
			const ticks = mine && !item.optimistic ? `<span class="chat-ticks${item.read ? ' read' : ''}" title="${item.read ? 'Vu' : 'Envoyé'}">${item.read ? '✓✓' : '✓'}</span>` : '';
			return `<div class="chat-bubble-row ${mine ? 'sent' : 'received'}">${avatarFor(item, mine)}<div class="chat-bubble ${mine ? 'sent' : 'received'}"><div class="chat-bubble-text">${escapeHtml(item.text)}</div><div class="chat-bubble-meta"><small>${time}</small>${ticks}${canDelete(item) ? `<button type="button" class="chat-delete" data-delete-message="${item.id}" title="Supprimer le message" aria-label="Supprimer le message">✕</button>` : ''}</div></div></div>`;
		}).join('') : '<small class="chat-empty">Aucun message dans cette conversation.</small>';
		target.scrollTop = target.scrollHeight;
		const unreadFromPartner = thread.filter((item) => item.senderId === selectedId && item.recipientId === currentUserId && !item.read);
		if (unreadFromPartner.length && selectedId) {
			request('/messages/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partnerId: selectedId }) })
				.then(() => { unreadFromPartner.forEach((item) => { item.read = true; }); }).catch(() => {});
		}
	}
	async function loadMessages() { await loadProjectOptions(); latestChatMessages = await request('/messages'); renderChatThread(); await loadRendezvous(); }
	let unreadMessageCount = 0;
	let messagePollTimer = null;
	function setChatBadge(count) {
		const navButton = document.querySelector('[data-view="tasks-view"]');
		if (!navButton) return;
		let badge = navButton.querySelector('.nav-badge');
		if (!badge) { badge = document.createElement('span'); badge.className = 'nav-badge'; navButton.append(badge); }
		badge.textContent = count > 9 ? '9+' : String(count);
		badge.hidden = count <= 0;
	}
	async function pollForNewMessages() {
		if (!token()) return;
		try {
			const activeProject = currentProjectId();
			const messages = (await request('/messages')).filter((item) => !activeProject || item.projectId === activeProject);
			const currentUserId = currentUser?.id || currentUser?.sub;
			const previousIds = new Set(latestChatMessages.map((item) => item.id));
			const newIncoming = messages.filter((item) => !previousIds.has(item.id) && item.type !== 'rendezvous-notification' && item.senderId !== currentUserId);
			latestChatMessages = messages;
			const tasksActive = document.querySelector('#tasks-view')?.classList.contains('active');
			if (tasksActive) renderChatThread();
			if (newIncoming.length) {
				newIncoming.forEach((item) => toast(`💬 ${item.senderName} : ${item.text.length > 60 ? `${item.text.slice(0, 60)}…` : item.text}`));
				if (!tasksActive) { unreadMessageCount += newIncoming.length; setChatBadge(unreadMessageCount); }
			}
		} catch { /* silent retry on next tick */ }
	}
	function startMessagePolling() {
		if (messagePollTimer) return;
		messagePollTimer = setInterval(() => { if (document.visibilityState === 'visible') pollForNewMessages(); }, 20000);
		pollForNewMessages();
	}
	function stopMessagePolling() {
		if (messagePollTimer) { clearInterval(messagePollTimer); messagePollTimer = null; }
		unreadMessageCount = 0;
		setChatBadge(0);
	}
	document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && messagePollTimer) pollForNewMessages(); });
	function urlBase64ToUint8Array(base64String) {
		const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
		const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
		const rawData = window.atob(base64);
		return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
	}
	async function setupPushNotifications() {
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
		try {
			const { publicKey, enabled } = await request('/push/public-key');
			if (!enabled || !publicKey) return;
			const registration = await navigator.serviceWorker.register('/sw.js');
			let permission = Notification.permission;
			if (permission === 'default') permission = await Notification.requestPermission();
			if (permission !== 'granted') return;
			let subscription = await registration.pushManager.getSubscription();
			if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
			await request('/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: subscription.toJSON() }) });
		} catch { /* push notifications unavailable, ignore silently */ }
	}
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
		if (!navigator.xr) { status.textContent = 'AR metar nije dostupan u ovom browseru. Probajte Android Chrome sa ARCore; na iPhone web AR mjerenje je ograniceno.'; return; }
		const supported = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
		if (!supported) { status.textContent = 'Telefon/browser ne podrzava WebXR AR mjerenje. Probajte Android Chrome sa Google Play Services for AR.'; return; }
		const overlay = document.createElement('div');
		overlay.className = 'ar-meter-overlay';
		overlay.innerHTML = `<canvas></canvas><div class="ar-meter-panel"><strong>AR metar</strong><small>Touchez les points dans l’ordre : pour ml, minimum 2 points sur la ligne ; pour m², minimum 3 coins de la surface. Choisissez ensuite ci-dessous ce que vous voulez calculer.</small><span id="ar-meter-count">0 tacki</span><div class="photo-meter-finish-row"><button class="primary" id="ar-meter-finish-m2" type="button">Calculer m²</button><button class="primary" id="ar-meter-finish-ml" type="button">Calculer ml</button></div><button class="secondary" id="ar-meter-cancel" type="button">Zatvori</button></div>`;
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
			const finish = async (unit) => {
				const value = unit === 'ml' ? points.slice(1).reduce((sum, point, index) => sum + pointDistance(points[index], point), 0) : polygonArea3d(points);
				if (!Number.isFinite(value) || value <= 0 || (unit === 'ml' && points.length < 2) || (unit === 'm2' && points.length < 3)) { count.textContent = unit === 'ml' ? 'Treba najmanje 2 tacke.' : 'Treba najmanje 3 tacke.'; return; }
				form.elements.quantityUnit.value = unit;
				form.elements.quantityUnit.dispatchEvent(new Event('change'));
				form.elements.quantity.value = value.toFixed(2);
				form.elements.quantityM2.value = unit === 'm2' ? value.toFixed(2) : '';
				form.elements.m2Source.value = `ar-${unit}`;
				form.elements.quantity.dispatchEvent(new Event('input'));
				status.textContent = `AR mjera: ${value.toFixed(2)} ${unit}. Prenez maintenant une photo comme preuve et enregistrez le rapport.`;
				await close();
				if (!form.elements.photo.files.length) form.elements.photo.click();
			};
			overlay.querySelector('#ar-meter-finish-m2').addEventListener('click', () => finish('m2'));
			overlay.querySelector('#ar-meter-finish-ml').addEventListener('click', () => finish('ml'));
		} catch (error) {
			overlay.remove();
			status.textContent = `Le mètre AR n’a pas démarré : ${error.message || 'le navigateur n’a pas autorisé l’AR'}.`;
		}
	}
	function startPhotoMeter(form, status) {
		const file = form.elements.photo.files[0];
		if (!file) { status.textContent = 'Prvo izaberite ili uploadujte sliku koju hocete mjeriti.'; form.elements.photo.click(); return; }
		const image = new Image();
		const url = URL.createObjectURL(file);
		const overlay = document.createElement('div');
		overlay.className = 'photo-meter-overlay';
		overlay.innerHTML = `<canvas></canvas><div class="ar-meter-panel"><strong>Mjerenje iz uploadovane slike</strong><small>1) Upisite poznatu mjeru u metrima. 2) Cliquez les deux points de cette mesure (jaune). 3) Cliquez les points de la ligne/les coins de la surface à mesurer (vert). 4) Choisissez ci-dessous m² ou ml.</small><small class="photo-meter-accuracy-warning">⚠ Za tačnost: slika mora biti snimljena pravo sprijeda/odozgo (ne ukoso), a poznata mjera (referenca) mora biti na istoj površini i istoj udaljenosti od kamere kao ono što mjerite. Ukošena slika ili referenca na drugoj ravni daje pogrešan rezultat — za nagnute/udaljene površine koristite AR metar kamerom umjesto ove opcije.</small><label>Poznata mjera (m)</label><input id="photo-meter-reference" type="number" min="0.01" step="0.01" placeholder="Saisissez votre mesure en mètres" /><span id="photo-meter-status">Referenca: 0/2 tacke</span><button class="secondary" id="photo-meter-reset" type="button">Ponovi tacke</button><div class="photo-meter-finish-row"><button class="primary" id="photo-meter-finish-m2" type="button">Calculer m²</button><button class="primary" id="photo-meter-finish-ml" type="button">Calculer ml</button></div><button class="secondary" id="photo-meter-cancel" type="button">Zatvori</button></div>`;
		document.body.append(overlay);
		const canvas = overlay.querySelector('canvas');
		const context = canvas.getContext('2d');
		const referencePoints = [];
		const measurePoints = [];
		const meterStatus = overlay.querySelector('#photo-meter-status');
		const close = () => { URL.revokeObjectURL(url); overlay.remove(); };
		const fit = () => {
			const displayWidth = canvas.clientWidth;
			const displayHeight = canvas.clientHeight;
			if (canvas.width !== displayWidth) canvas.width = displayWidth;
			if (canvas.height !== displayHeight) canvas.height = displayHeight;
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
			drawLine(measurePoints, '#31d3a4');
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
		const finish = (unit) => {
			const referenceLength = Number(overlay.querySelector('#photo-meter-reference').value);
			if (!Number.isFinite(referenceLength) || referenceLength <= 0) { meterStatus.textContent = 'Upisite poznatu mjeru u metrima.'; return; }
			if (referencePoints.length < 2) { meterStatus.textContent = 'Kliknite dvije tacke poznate mjere.'; return; }
			if ((unit === 'ml' && measurePoints.length < 2) || (unit === 'm2' && measurePoints.length < 3)) { meterStatus.textContent = unit === 'ml' ? 'Za ml kliknite najmanje 2 tacke.' : 'Za m2 kliknite najmanje 3 ugla.'; return; }
			const scale = referenceLength / distance2d(referencePoints[0], referencePoints[1]);
			const value = unit === 'ml' ? measurePoints.slice(1).reduce((sum, point, index) => sum + distance2d(measurePoints[index], point), 0) * scale : polygonArea2d(measurePoints) * scale * scale;
			form.elements.quantityUnit.value = unit;
			form.elements.quantityUnit.dispatchEvent(new Event('change'));
			form.elements.quantity.value = value.toFixed(2);
			form.elements.quantityM2.value = unit === 'm2' ? value.toFixed(2) : '';
			form.elements.m2Source.value = `photo-calibrated-${unit}`;
			form.elements.quantity.dispatchEvent(new Event('input'));
			status.textContent = `Mjera iz slike: ${value.toFixed(2)} ${unit}. Kalibracija: ${referenceLength} m. Provjerite da je slika bila prava (ne ukosa) prije nego sačuvate izvještaj.`;
			close();
		};
		overlay.querySelector('#photo-meter-finish-m2').addEventListener('click', () => finish('m2'));
		overlay.querySelector('#photo-meter-finish-ml').addEventListener('click', () => finish('ml'));
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
		section.id = 'production-panel';
		section.setAttribute('data-tab-hidden', '');
		section.innerHTML = `<div class="section-head production-head"><div><small>PRODUCTION CHANTIER</small><h2>Production et situations</h2><p>Photo preuve, mesure m2/ml, GPS et validation avant situation.</p></div><span class="status">Validation requise</span></div><form id="production-form" class="production-form"><div class="production-grid"><fieldset><legend>1. Preuve photo</legend><label>Photo du travail réalisé (optionnel)<input name="photo" type="file" accept="image/*" /></label><label>Date (optionnel)<input name="date" type="date" /></label></fieldset><fieldset><legend>2. Mesure</legend><label>Unité à calculer<select name="quantityUnit"><option value="m2">m2 - surface</option><option value="ml">ml - mètre linéaire</option></select></label><div class="measure-actions"><button class="secondary" id="estimate-area" type="button">Estimer avec l'IA</button><button class="secondary" id="ar-meter" type="button">Mesurer avec caméra AR</button><button class="secondary" id="photo-meter" type="button">Mesurer une photo uploadée</button></div><small id="area-estimate-status">IA utilise les plans/fiches. AR mesure en direct. Photo uploadée se mesure avec une calibration connue.</small></fieldset><fieldset><legend>3. Travaux</legend><label>Description des travaux<input name="description" required /></label><label><span data-quantity-label>Quantité</span><input name="quantity" type="number" min="0" step="0.01" value="" required /></label><input name="quantityM2" type="hidden" value="" /></fieldset><fieldset><legend>4. Prix</legend><label><span data-rate-label>Prix par unité EUR</span><input name="unitRate" type="number" min="0" step="0.01" required /></label><div id="production-live-calc" class="production-live-calc">0.00 × 0,00 € = 0,00 €</div><small>La validation humaine du Gérant reste obligatoire avant la Situation.</small></fieldset></div><button class="primary production-submit" type="submit">Enregistrer la production</button></form><div class="production-results"><div id="production-summary" class="list"></div><div id="production-reports" class="list"></div></div>`;
		panel.after(section);
		const form = section.querySelector('#production-form');
		const quantityInput = form.elements.quantity;
		const updateUnitLabels = () => {
			const unit = form.elements.quantityUnit.value;
			section.querySelector('[data-quantity-label]').textContent = unit === 'ml' ? 'Longueur (ml)' : 'Surface (m2)';
			section.querySelector('[data-rate-label]').textContent = unit === 'ml' ? 'Prix par ml EUR' : 'Prix par m2 EUR';
			section.querySelector('#estimate-area').textContent = unit === 'ml' ? 'Estimer les ml avec l’IA' : 'Estimer les m2 avec l’IA';
		};
		const liveCalcTarget = section.querySelector('#production-live-calc');
		const updateLiveCalc = () => {
			const unit = form.elements.quantityUnit.value;
			const quantity = Number(quantityInput.value) || 0;
			const rate = Number(form.elements.unitRate.value) || 0;
			liveCalcTarget.textContent = `${quantity.toFixed(2)} ${unit} × ${formatEUR(rate)} = ${formatEUR(quantity * rate)}`;
		};
		form.elements.quantityUnit.addEventListener('change', () => { quantityInput.value = ''; form.elements.quantityM2.value = ''; form.elements.m2Source.value = ''; updateUnitLabels(); updateLiveCalc(); });
		form.elements.unitRate.addEventListener('input', updateLiveCalc);
		quantityInput.addEventListener('input', updateLiveCalc);
		updateUnitLabels();
		updateLiveCalc();
		section.querySelector('#ar-meter').addEventListener('click', () => startArMeter(form, section.querySelector('#area-estimate-status')));
		section.querySelector('#photo-meter').addEventListener('click', () => startPhotoMeter(form, section.querySelector('#area-estimate-status')));
		section.querySelector('#estimate-area').addEventListener('click', async () => {
			const file = form.elements.photo.files[0];
			const unit = form.elements.quantityUnit.value;
			const status = section.querySelector('#area-estimate-status');
			if (!file) { status.textContent = "Selectionnez d'abord une photo."; return; }
			const projectId = currentProjectId();
			if (!projectId) { status.textContent = 'Izaberite aktivni chantier pre procene.'; return; }
			const body = new FormData();
			body.append('photo', file, file.name);
			body.append('quantityUnit', unit);
			body.append('projectId', projectId);
			status.textContent = unit === 'ml' ? 'Analyse de la longueur visible avec plans du chantier...' : 'Analyse de la surface visible avec plans du chantier...';
			try {
				const result = await fetch(`${api}/ai/estimate-area`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body }).then(async (response) => { if (!response.ok) throw new Error(await response.text()); return response.json(); });
				if (result.estimatedQuantity === null || result.estimatedQuantity === undefined) { status.textContent = result.answer; return; }
				quantityInput.value = result.estimatedQuantity;
				form.elements.quantityM2.value = unit === 'm2' ? result.estimatedQuantity : '';
				form.elements.m2Source.value = `ai-${unit}`;
				updateLiveCalc();
				status.textContent = `Proposition IA : ${result.estimatedQuantity} ${unit}. Confiance ${Math.round(Number(result.confidence || 0) * 100)}%. Verifiez et confirmez avant l'enregistrement. ${result.answer || ''}`;
			} catch (error) {
				status.textContent = `Estimation indisponible : ${error.message || 'erreur inconnue'}`;
			}
		});
		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			const projectId = currentProjectId();
			if (!projectId) { toast('Sélectionnez le chantier actif avant d’enregistrer la production.'); return; }
			const body = new FormData(form);
			body.append('projectId', projectId);
			try {
				const response = await fetch(`${api}/work-reports`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
				if (!response.ok) throw new Error(await response.text());
				form.reset();
				updateUnitLabels();
				await refreshActiveView();
				toast('La production a été enregistrée pour validation.');
			} catch (error) {
				toast(`Production non enregistrée : ${error.message || 'erreur inconnue'}`);
			}
		});
	}
	function ensureCaptureMetadata() {
		const form = document.querySelector('#production-form');
		if (!form || document.querySelector('#capture-metadata')) return;
		const block = document.createElement('div');
		block.id = 'capture-metadata';
		block.innerHTML = `<input name="capturedAt" type="hidden" /><input name="latitude" type="hidden" /><input name="longitude" type="hidden" /><input name="locationName" type="hidden" /><input name="m2Source" type="hidden" value="" /><label>Heure de la photo (opciono)<input name="captureTime" type="time" /></label>`;
		form.querySelector('fieldset')?.append(block);
		const quantityInput = form.elements.quantity;
		form.elements.photo.addEventListener('change', () => {
			const now = new Date();
			form.elements.capturedAt.value = now.toISOString();
			form.elements.captureTime.value = now.toTimeString().slice(0, 5);
			form.elements.m2Source.value = '';
			form.elements.quantityM2.value = '';
			quantityInput.value = '';
		});
	}
	async function loadProduction() {
		ensureProductionPanel();
		ensureCaptureMetadata();
		await loadProjectOptions();
		const projectId = currentProjectId();
		const reports = projectId ? (await request('/work-reports')).filter((item) => item.projectId === projectId) : [];
		const today = new Date().toISOString().slice(0, 10);
		if (!projectId) {
			document.querySelector('#production-summary').innerHTML = '<small>Prvo registrujte ili izaberite chantier.</small>';
			document.querySelector('#production-reports').innerHTML = '';
			return;
		}
		const summary = await request(`/projects/${projectId}/situation-summary?date=${today}`);
		const summaryTarget = document.querySelector('#production-summary');
		const reportTarget = document.querySelector('#production-reports');
		if (!summaryTarget || !reportTarget) return;
		const managerView = isOwner();
		const quantityLabel = (item) => `${Number(item.quantity ?? item.quantityM2 ?? 0).toFixed(2)} ${item.quantityUnit || 'm2'}`;
		const methodInfo = (item) => { const source = String(item.quantitySource || item.m2Source || ''); if (source.startsWith('ai-')) return { label: '⚠ IA - à vérifier', cls: 'ai' }; if (source.startsWith('ar-')) return { label: 'AR', cls: 'ar' }; if (source.startsWith('photo-calibrated')) return { label: 'Photo', cls: 'photo' }; return { label: 'Manuel', cls: 'manual' }; };
		const statusLabel = (status) => status === 'approved' ? 'Approuvé' : status === 'rejected' ? 'Refusé' : 'En attente';
		const workerTotals = summary.byWorker?.map((item) => `${item.workerName} : ${Number(item.quantityM2 || 0).toFixed(2)} m² · ${Number(item.quantityMl || 0).toFixed(2)} ml${managerView ? ` · ${formatEUR(item.amount)}` : ''}`).join(' | ') || 'Aucun détail par ouvrier';
		summaryTarget.innerHTML = `<div class="production-summary-card"><strong>Situation du ${today}</strong><span>${summary.reportCount} rapport(s) approuvé(s) · ${Number(summary.quantityM2 || 0).toFixed(2)} m² · ${Number(summary.quantityMl || 0).toFixed(2)} ml${managerView ? ` · ${formatEUR(summary.amount)}` : ''}</span><small>${workerTotals}</small><small>Calcul basé uniquement sur les rapports approuvés. Validation humaine requise.</small></div>`;
		const canReview = isOwner();
		reportTarget.innerHTML = reports.length ? `<h3>Rapports de production</h3><div class="production-report-list">${reports.slice().reverse().map((item) => { const method = methodInfo(item); return `<div class="production-report-row"><div class="production-report-main"><strong>${escapeHtml(item.date)} · ${escapeHtml(item.workerName)}</strong><span class="entry-status-pill entry-status-${item.status}">${statusLabel(item.status)}</span></div><small>${escapeHtml(item.description)}</small><div class="production-report-meta"><span>${quantityLabel(item)}</span><span class="production-method-tag production-method-${method.cls}">${method.label}</span>${managerView ? `<span>${formatEUR(item.calculatedAmount)}</span>` : ''}</div>${canReview && item.status === 'pending' ? `<div class="production-report-actions"><button class="secondary production-status" data-report="${item.id}" data-status="approved">Approuver</button><button class="secondary production-status" data-report="${item.id}" data-status="rejected">Refuser</button></div>` : ''}</div>`; }).join('')}</div>` : '<small>Aucun rapport de production.</small>';
		document.querySelectorAll('.production-status').forEach((button) => button.addEventListener('click', async () => { button.disabled = true; button.setAttribute('aria-busy', 'true'); try { await request(`/work-reports/${button.dataset.report}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: button.dataset.status }) }); await loadProduction(); } catch { toast('Statut non modifié.'); button.disabled = false; button.removeAttribute('aria-busy'); } }));
	}
	async function loadWorkSequence() {
		const panel = document.querySelector('#ai-form')?.closest('.ai-panel');
		if (!panel) return;
		let section = document.querySelector('#work-sequence');
		if (!section) { section = document.createElement('div'); section.id = 'work-sequence'; section.className = 'list'; panel.append(section); }
		section.innerHTML = '<h3>Ordre des travaux selon les plans</h3><small>Analyse de la documentation...</small>';
		const projectId = currentProjectId();
		if (!projectId) { section.innerHTML = '<h3>Ordre des travaux selon les plans</h3><small>Sélectionnez d’abord un chantier actif.</small>'; return; }
		try {
			const result = await request(`/projects/${projectId}/work-sequence`);
			section.innerHTML = `<h3>Ordre des travaux selon les plans</h3><small>${result.answer}</small>${result.steps?.length ? result.steps.map((step) => `<div class="list-item"><strong>${step.order}. ${step.title}</strong><small>${step.instruction} · Preuve requise : ${step.requiredEvidence || 'à confirmer'} · Source : ${step.sourcePage || 'à confirmer'}</small></div>`).join('') : '<small>La séquence ne peut pas être affichée sans documentation source et configuration AI.</small>'}`;
		} catch (error) {
			let details = ''; try { details = JSON.parse(error.message)?.error || ''; } catch { details = error.message || ''; }
			section.innerHTML = `<h3>Ordre des travaux selon les plans</h3><small>Analyse indisponible${details ? ` : ${escapeHtml(details)}` : ''}. Ajoutez un plan ou une fiche technique PDF.</small>`;
		}
	}
	function renderAutoAnalysis(target, analysis) {
		if (!target || !analysis) return false;
		const french = language === 'fr';
		const section = (title, items) => items?.length ? `<div class="auto-analysis-section"><strong>${escapeHtml(title)}</strong><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : '';
		const specificAnswer = analysis.answer ? `<div class="auto-analysis-answer"><strong>${french ? 'Réponse selon ce plan' : 'Odgovor prema ovom planu'}</strong><p>${escapeHtml(analysis.answer)}</p></div>` : '';
		const imagesSection = analysis.referenceImages?.length ? `<div class="auto-analysis-section auto-analysis-images"><strong>${french ? 'Schémas extraits du document' : 'Schémas extraits du document'}</strong><div class="auto-analysis-image-grid">${analysis.referenceImages.map((img) => `<a href="${escapeHtml(img.dataUrl)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(img.dataUrl)}" alt="${french ? 'Schéma page' : 'Schéma page'} ${escapeHtml(String(img.page))}" loading="lazy" /></a>`).join('')}</div></div>` : '';
		const rulesSection = section(french ? 'Règles et valeurs (extraites du document)' : 'Règles et valeurs (extraites du document)', analysis.extractedRules);
		const referencesSection = analysis.references?.length ? `<div class="auto-analysis-section"><strong>${french ? 'Vidéos et guides de référence' : 'Vidéos et guides de référence'}</strong><ul>${analysis.references.map((ref) => `<li><a href="${escapeHtml(ref.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ref.title)}</a></li>`).join('')}</ul></div>` : '';
		// The AI's own self-reported confidence is never a guarantee - it can misread an unclear page like
		// anyone would. Showing it bare next to the percentage used to look like a certified accuracy score;
		// this line makes explicit, every single time analysis.requiresHumanConfirmation is set (which is
		// virtually always for AI-generated analysis), that a person must still check it before relying on it.
		const confirmNotice = analysis.requiresHumanConfirmation ? `<div class="auto-analysis-confirm-notice">${french ? '⚠ Estimation automatique : à vérifier par une personne avant de l’utiliser pour le chantier.' : '⚠ Automatska procjena: mora je provjeriti osoba prije upotrebe na gradilištu.'}</div>` : '';
		// analysis.status distinguishes a genuine per-document AI read (document_ai_analyzed / vision) from
		// the keyword-matching fallback (keyword_match / needs_ocr), which only ever used when the real AI
		// read failed or wasn't configured for this particular upload. The fallback returns the SAME canned
		// checklist for any two documents matching the same keywords - it is NOT derived from reading this
		// specific plan's actual content, so it must never look like a genuine per-plan read in the UI.
		const isGenuineRead = analysis.status === 'document_ai_analyzed' || analysis.status === 'photo_ai_analyzed';
		const fallbackNotice = !isGenuineRead ? `<div class="auto-analysis-confirm-notice">${french ? '⚠ Lecture IA indisponible pour CE document précis : ceci est une suggestion générique par mots-clés, pas une lecture spécifique de ce plan. Ouvrez le document et vérifiez-le vous-même.' : '⚠ AI čitanje nije uspjelo za BAŠ ovaj dokument: ovo je generički prijedlog po ključnim riječima, ne specifično čitanje ovog plana. Otvorite dokument i provjerite ga sami.'}</div>` : '';
		target.innerHTML = `<div class="list-item auto-analysis"><strong>${french ? 'Analyse automatique' : 'Automatska analiza'} · ${escapeHtml(analysis.workType)}</strong><small>${french ? 'Confiance (estimation IA, pas une garantie)' : 'Sigurnost (AI procjena, ne garancija)'}: ${Math.round(Number(analysis.confidence || 0) * 100)}% · ${escapeHtml(analysis.fileName || '')}</small>${confirmNotice}${fallbackNotice}${specificAnswer}${rulesSection}${imagesSection}${section(french ? 'Système' : 'Sistem', analysis.systems)}${section(french ? 'Matériaux détectés' : 'Prepoznati materijali', analysis.materials)}${section(french ? 'Comment exécuter' : 'Kako se radi', analysis.howTo)}${section(french ? 'Contrôles' : 'Quoi contrôler', analysis.controls)}${section(french ? 'Preuves photos' : 'Quoi photographier comme preuve', analysis.evidence)}${section(french ? 'Risques / à confirmer' : 'Risques / à confirmer', analysis.risks)}${referencesSection}</div>`;
		return true;
	}
	function renderTechnicalAnswer(target, result) {
		if (!target || !result) return false;
		const french = language === 'fr';
		const sourcesList = result.sources?.length ? `<div class="auto-analysis-section"><strong>${french ? 'Sources' : 'Izvori'}</strong><ul>${result.sources.map((source) => `<li>${escapeHtml(source.title || source.file || '')}${source.page ? ` (p.${escapeHtml(String(source.page))})` : ''}</li>`).join('')}</ul></div>` : '';
		target.innerHTML = `<div class="list-item auto-analysis"><strong>${french ? 'Réponse' : 'Odgovor'}</strong><p>${escapeHtml(result.answer)}</p>${sourcesList}</div>`;
		return true;
	}
	let latestOwnTimeEntries = [];
	let latestRendezvous = [];
	let latestTimeWorkers = [];
	let latestChatMessages = [];
	const monthKeyFromDate = (dateValue) => String(dateValue || new Date().toISOString().slice(0, 10)).slice(0, 7);
	const formatMonthLabel = (month) => {
		const [year, monthNumber] = String(month || '').split('-').map(Number);
		if (!year || !monthNumber) return month;
		return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'sr-Latn-RS', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
	};
	const shiftMonthKey = (month, delta) => {
		const [year, monthNumber] = String(month || '').split('-').map(Number);
		const shifted = new Date(year, (monthNumber - 1) + delta, 1);
		return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
	};
	let workCalendarViewMonth = '';
	const timePrefsKey = () => `ibra-time-prefs-${currentUser?.id || 'default'}`;
	const loadTimePrefs = () => {
		try { return JSON.parse(localStorage.getItem(timePrefsKey()) || '{}'); } catch { return {}; }
	};
	const saveTimePrefs = (form) => {
		if (!form) return;
		localStorage.setItem(timePrefsKey(), JSON.stringify({ workerId: form.elements.workerId?.value || '', start: form.elements.start?.value || '08:00', end: form.elements.end?.value || '17:00', breakMinutes: form.elements.breakMinutes?.value || '60', rateType: form.elements.rateType?.value || 'daily', rate: form.elements.rate?.value || '' }));
	};
	const saveTimeEntryFromForm = async (form) => {
		const values = Object.fromEntries(new FormData(form).entries());
		try {
			await request('/time-entries', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(values) });
		} catch (error) {
			let details; try { details = JSON.parse(error.message); } catch { details = null; }
			if (details?.duplicate && window.confirm('Une saisie identique (même ouvrier, chantier, date et heures) existe déjà. Enregistrer quand même ?')) {
				await request('/time-entries', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ...values, confirmDuplicate: 'true' }) });
			} else {
				throw error;
			}
		}
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
		target.innerHTML = draft.valid ? `<strong>Calcul de cette saisie : ${draft.hours.toFixed(2)} h · ${formatEUR(draft.amount)}</strong><small>Ceci est un calcul automatique avant l’enregistrement. Une fois enregistré, il part dans le calendrier et la liste.</small>` : '<strong>Calcul de cette saisie : 0.00 h · 0,00 EUR</strong><small>Saisissez la date, le début, la fin, la pause et le tarif.</small>';
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
			form.elements.date?.addEventListener('input', () => { workCalendarViewMonth = ''; const month = monthKeyFromDate(form.elements.date.value); renderWorkCalendar(latestOwnTimeEntries, form.elements.date.value, latestRendezvous); renderWorkerMonthSummary(month); });
			form.elements.workerId?.addEventListener('change', () => { form.elements.rate.value = ''; fillDefaultRate(); const month = monthKeyFromDate(form.elements.date.value); renderWorkCalendar(latestOwnTimeEntries, form.elements.date.value, latestRendezvous); renderWorkerMonthSummary(month); updateTimeLiveCalculation(); saveTimePrefs(form); });
			form.elements.rateType?.addEventListener('change', () => { form.elements.rate.value = ''; fillDefaultRate(); updateTimeLiveCalculation(); });
		}
		fillDefaultRate(); updateTimeLiveCalculation();
	}
	function renderQuickWorkers() {
		const target = document.querySelector('#quick-workers');
		if (!target) return;
		const canManage = isOwner();
		if (!canManage || !latestTimeWorkers.length) { target.innerHTML = ''; return; }
		const workerRow = (worker) => `<div class="list-item" data-worker-search="${escapeHtml((worker.name || '').toLowerCase())}"><strong>${escapeHtml(worker.name)}</strong><small>${escapeHtml(worker.email || worker.phone || 'sans contact')} · Chantier : ${escapeHtml(assignedProjectNames(worker) || 'non sélectionné')} · Tarif journalier ${formatEUR(worker.dailyRate || 0)} · Tarif horaire ${formatEUR(worker.hourlyRate || 0)}</small><div class="worker-actions"><button class="secondary rename-worker" data-worker="${worker.id}" type="button">Renommer</button><button class="secondary delete-worker" data-worker="${worker.id}" type="button">Supprimer</button></div></div>`;
		target.innerHTML = `<details class="quick-workers-group"><summary>Ouvriers (${latestTimeWorkers.length})</summary><input type="search" class="quick-workers-search" placeholder="Rechercher un ouvrier..." /><div class="quick-workers-list">${latestTimeWorkers.map(workerRow).join('')}</div></details>`;
		target.querySelector('.quick-workers-search')?.addEventListener('input', (event) => {
			const query = event.target.value.trim().toLowerCase();
			target.querySelectorAll('[data-worker-search]').forEach((row) => { row.hidden = Boolean(query) && !row.dataset.workerSearch.includes(query); });
		});
		target.querySelectorAll('.rename-worker').forEach((button) => button.addEventListener('click', async () => {
			const worker = latestTimeWorkers.find((item) => item.id === button.dataset.worker);
			if (!worker) return;
			const name = window.prompt('Ime i prezime:', worker.name);
			if (!name?.trim()) return;
			const contact = window.prompt('Telefon ili email:', worker.email || worker.phone || '');
			if (!contact?.trim()) return;
			const dailyRate = window.prompt('Tarif journalier EUR :', worker.dailyRate || 0);
			const hourlyRate = window.prompt('Tarif horaire EUR :', worker.hourlyRate || 0);
			button.disabled = true; button.setAttribute('aria-busy', 'true');
			try { await request(`/users/${worker.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name: name.trim(), contact: contact.trim(), dailyRate, hourlyRate }) }); await Promise.allSettled([loadTime(), loadUsers(), loadPayroll()]); toast('Radnik je preimenovan.'); }
			catch { toast('Radnik nije izmijenjen.'); button.disabled = false; button.removeAttribute('aria-busy'); }
		}));
		target.querySelectorAll('.delete-worker').forEach((button) => button.addEventListener('click', async () => {
			const worker = latestTimeWorkers.find((item) => item.id === button.dataset.worker);
			if (!worker || !window.confirm(`Supprimer l’ouvrier ${worker.name} ?`)) return;
			button.disabled = true; button.setAttribute('aria-busy', 'true');
			try { await request(`/users/${worker.id}`, { method:'DELETE' }); await Promise.allSettled([loadTime(), loadUsers(), loadPayroll()]); toast('Radnik je obrisan.'); }
			catch { toast('Radnik nije obrisan.'); button.disabled = false; button.removeAttribute('aria-busy'); }
		}));
	}
	function renderWorkCalendar(entries, selectedDate, rendezvous = latestRendezvous) {
		const target = document.querySelector('#work-calendar');
		if (!target) return;
		const selectedWorkerId = document.querySelector('#time-form')?.elements.workerId?.value || currentUser?.id;
		const activeProject = currentProjectId();
		const visibleEntries = (entries || []).filter((entry) => !selectedWorkerId || entry.workerId === selectedWorkerId || (!entry.workerId && selectedWorkerId === currentUser?.id));
		const visibleRendezvous = (rendezvous || []).filter((item) => (!selectedWorkerId || item.workerId === selectedWorkerId) && (!activeProject || !item.projectId || item.projectId === activeProject));
		const todayKey = new Date().toISOString().slice(0, 10);
		const month = workCalendarViewMonth || monthKeyFromDate(selectedDate);
		const [year, monthNumber] = month.split('-').map(Number);
		const first = new Date(year, monthNumber - 1, 1);
		const last = new Date(year, monthNumber, 0);
		const monthEntries = visibleEntries.filter((entry) => String(entry.date || '').startsWith(month));
		const entryByDate = new Map(monthEntries.map((entry) => [entry.date, entry]));
		const rendezvousByDate = new Map();
		visibleRendezvous.filter((item) => String(item.absenceDate || item.date || '').startsWith(month)).forEach((item) => {
			const date = item.absenceDate || item.date;
			const items = rendezvousByDate.get(date) || [];
			items.push(item);
			rendezvousByDate.set(date, items);
		});
		let workingDays = 0;
		let cells = '';
		for (let pad = 0; pad < (first.getDay() || 7) - 1; pad += 1) cells += '<span class="calendar-cell empty" aria-hidden="true"></span>';
		for (let day = 1; day <= last.getDate(); day += 1) {
			const date = `${month}-${String(day).padStart(2, '0')}`;
			const weekday = new Date(year, monthNumber - 1, day).getDay();
			const weekend = weekday === 0 || weekday === 6;
			if (!weekend) workingDays += 1;
			const entry = entryByDate.get(date);
			const dayRendezvous = rendezvousByDate.get(date) || [];
			const rendezvousLabel = dayRendezvous.map((item) => `${item.type === 'absence' ? 'Absence' : `RDV ${item.time || ''}`}${item.reason ? ` · ${item.reason}` : ''}`).join(' | ');
			const title = [entry ? `${Number(entry.hours || 0).toFixed(2)} h · ${formatEUR(entry.workAmount || 0)}` : '', rendezvousLabel, entry || dayRendezvous.length ? '' : `Indiquer les heures pour ${date}`].filter(Boolean).join(' · ');
			const hoursButton = entry ? `<span class="calendar-quick-edit" data-edit-hours="${entry.id}" data-edit-hours-value="${Number(entry.hours || 0)}">${Number(entry.hours || 0).toFixed(1)}h<button type="button" class="calendar-icon-btn edit-only" data-edit-hours="${entry.id}" data-edit-hours-value="${Number(entry.hours || 0)}" title="Modifier les heures" aria-label="Modifier les heures">✎</button></span>` : '';
			const rdvButtons = dayRendezvous.map((item) => `<span class="calendar-quick-edit calendar-rendezvous${item.type === 'absence' ? ' calendar-absence' : ''}" data-edit-rdv="${item.id}" data-edit-rdv-time="${escapeHtml(item.time || '')}">${item.type === 'absence' ? 'Absence' : `RDV ${escapeHtml(item.time || '')}`}<button type="button" class="calendar-icon-btn edit-only" data-edit-rdv="${item.id}" data-edit-rdv-time="${escapeHtml(item.time || '')}" title="Modifier" aria-label="Modifier">✎</button></span>`).join('');
			const addRdvButton = `<button type="button" class="calendar-quick-edit calendar-add-rdv" data-add-rdv="${date}" title="Ajouter un RDV pour ${date}">+RDV</button>`;
			const addAbsenceButton = `<button type="button" class="calendar-quick-edit calendar-add-rdv" data-add-absence="${date}" title="Ajouter une absence pour ${date}">+Absence</button>`;
			const marker = hoursButton + rdvButtons + addRdvButton + addAbsenceButton;
			const todayClass = date === todayKey ? ' today' : '';
			cells += `<div class="calendar-cell${weekend ? ' weekend' : ''}${entry ? ' worked' : ''}${dayRendezvous.length ? ' has-rendezvous' : ''}${dayRendezvous.some((item) => item.type === 'absence') ? ' has-absence' : ''}${todayClass}" data-work-date="${date}" tabindex="0" role="button" title="${escapeHtml(title)}" aria-label="${escapeHtml(`${date}: ${title}`)}"><strong>${day}<span class="calendar-cell-weekday">${weekdayAbbrFr[weekday]}</span></strong>${marker}</div>`;
		}
		const workedDays = new Set(monthEntries.map((entry) => entry.date)).size;
		const monthHours = monthEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
		const monthAmount = monthEntries.reduce((sum, entry) => sum + Number(entry.workAmount || 0), 0);
		const rendezvousDays = rendezvousByDate.size;
		const monthLabel = formatMonthLabel(month);
		const isCurrentMonth = month === monthKeyFromDate(todayKey);
		target.innerHTML = `<div class="work-calendar-head"><div class="calendar-title"><small>Calendrier des jours travaillés</small><div class="calendar-nav"><button type="button" class="calendar-nav-btn" data-calendar-nav="prev" aria-label="Mois précédent">‹</button><strong class="calendar-month-label">${escapeHtml(monthLabel)}</strong><button type="button" class="calendar-nav-btn" data-calendar-nav="next" aria-label="Mois suivant">›</button></div></div><button type="button" class="calendar-nav-today"${isCurrentMonth ? ' disabled' : ''} data-calendar-nav="today">Aujourd’hui</button></div><div class="calendar-stats"><span class="calendar-stat"><strong>${workingDays}</strong><small>Jours ouvrés</small></span><span class="calendar-stat"><strong>${workedDays}</strong><small>Saisis</small></span><span class="calendar-stat"><strong>${monthHours.toFixed(2)} h</strong><small>Heures</small></span><span class="calendar-stat"><strong>${formatEUR(monthAmount)}</strong><small>Montant</small></span><span class="calendar-stat"><strong>${rendezvousDays}</strong><small>RDV</small></span></div><div class="calendar-hint">Cliquez sur un jour pour saisir les heures directement depuis le calendrier. <span class="calendar-legend"><span class="legend-work">Travail</span> · <span class="legend-rendezvous">RDV / absence</span></span></div><div class="calendar-weekdays"><span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span></div><div class="calendar-grid">${cells}</div>`;
		target.querySelectorAll('[data-calendar-nav]').forEach((button) => button.addEventListener('click', () => {
			const action = button.dataset.calendarNav;
			workCalendarViewMonth = action === 'today' ? monthKeyFromDate(todayKey) : shiftMonthKey(month, action === 'prev' ? -1 : 1);
			renderWorkCalendar(entries, selectedDate, rendezvous);
		}));
		target.querySelectorAll('[data-work-date]').forEach((cell) => {
			const selectDay = async () => {
				const form = document.querySelector('#time-form');
				if (!form) return;
				form.elements.date.value = cell.dataset.workDate;
				updateTimeLiveCalculation();
				const draft = calculateTimeDraft();
				if (!draft.valid) { form.elements.start?.focus(); toast('Unesi pocetak, kraj, pauzu i cijenu pa opet klikni dan.'); return; }
				if (!window.confirm(`Sacuvati ${cell.dataset.workDate}: ${draft.hours.toFixed(2)} h ? ${formatEUR(draft.amount)}?`)) return;
				try { await saveTimeEntryFromForm(form); await refreshActiveView(); toast('Radni dan je oznacen u kalendaru.'); } catch { toast('Radni dan nije sacuvan.'); }
			};
			cell.addEventListener('click', selectDay);
			cell.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectDay(); } });
		});
		target.querySelectorAll('[data-edit-hours]').forEach((button) => button.addEventListener('click', (event) => {
			event.stopPropagation();
			openHoursQuickEdit(button, button.dataset.editHours, button.dataset.editHoursValue, refreshActiveView);
		}));
		target.querySelectorAll('[data-delete-hours]').forEach((button) => button.addEventListener('click', async (event) => {
			event.stopPropagation();
			await deleteHoursEntryDirect(button.dataset.deleteHours, refreshActiveView);
		}));
		target.querySelectorAll('[data-edit-rdv]').forEach((button) => button.addEventListener('click', (event) => {
			event.stopPropagation();
			openRdvQuickEdit(button, button.dataset.editRdv, button.dataset.editRdvTime, refreshActiveView);
		}));
		target.querySelectorAll('[data-delete-rdv]').forEach((button) => button.addEventListener('click', async (event) => {
			event.stopPropagation();
			await deleteRdvEntryDirect(button.dataset.deleteRdv, refreshActiveView);
		}));
		const fallbackProjectId = activeProject || currentUser?.projectIds?.[0];
		target.querySelectorAll('[data-add-rdv]').forEach((button) => button.addEventListener('click', (event) => {
			event.stopPropagation();
			openRdvCreateQuickEdit(button, { date: button.dataset.addRdv, projectId: fallbackProjectId, workerId: selectedWorkerId !== currentUser?.id ? selectedWorkerId : undefined }, refreshActiveView);
		}));
		target.querySelectorAll('[data-add-absence]').forEach((button) => button.addEventListener('click', async (event) => {
			event.stopPropagation();
			await createAbsenceDirect({ date: button.dataset.addAbsence, projectId: fallbackProjectId, workerId: selectedWorkerId !== currentUser?.id ? selectedWorkerId : undefined }, refreshActiveView);
		}));
	}
	function ensureWorkerMonthSummaryPanel() {
		if (!isOwner()) { document.querySelector('#worker-month-summary')?.remove(); return null; }
		const existing = document.querySelector('#worker-month-summary');
		if (existing) return existing;
		const panel = document.querySelector('#time-form')?.closest('.panel') || document.querySelector('#tasks-view .panel');
		if (!panel) return null;
		const section = document.createElement('section');
		section.id = 'worker-month-summary';
		section.className = 'worker-month-summary';
		section.innerHTML = '<div class="section-head"><div><h3>Résumé des ouvriers</h3><small id="worker-month-summary-label"></small></div></div><div id="worker-month-summary-content" aria-live="polite"></div>';
		panel.insertBefore(section, panel.querySelector('#time-form') || null);
		return section;
	}
	function summarizeWorkerMonth(workerId, month) {
		const workerEntries = latestOwnTimeEntries.filter((entry) => entry.workerId === workerId && String(entry.date || '').startsWith(month));
		const workerRendezvous = latestRendezvous.filter((item) => item.workerId === workerId && String(item.absenceDate || item.date || '').startsWith(month));
		return {
			workDays: new Set(workerEntries.map((entry) => entry.date)).size,
			hours: workerEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0),
			rendezvousDays: new Set(workerRendezvous.map((item) => item.absenceDate || item.date)).size,
			rendezvousCount: workerRendezvous.length
		};
	}
	function renderWorkerMonthSummary(month) {
		const section = ensureWorkerMonthSummaryPanel();
		if (!section) return;
		const target = section.querySelector('#worker-month-summary-content');
		const label = section.querySelector('#worker-month-summary-label');
		const french = language === 'fr';
		label.textContent = `${french ? 'Mois sélectionné' : 'Izabrani mjesec'}: ${formatMonthLabel(month)}`;
		const workers = latestTimeWorkers.filter((worker) => ['user', 'worker'].includes(worker.role));
		if (!workers.length) {
			target.innerHTML = `<small>${french ? 'Aucun ouvrier.' : 'Nema dodatih korisnika.'}</small>`;
			return;
		}
		const labels = french ? { worker: 'Ouvrier', workDays: 'Jours travaillés', hours: 'Heures', rendezvous: 'RDV / absences' } : { worker: 'Radnik', workDays: 'Radni dani', hours: 'Sati', rendezvous: 'RDV / odsustva' };
		target.innerHTML = `<div class="worker-month-summary-table-wrap"><table class="worker-month-summary-table"><caption class="visually-hidden">${escapeHtml(`${french ? 'Résumé des utilisateurs pour' : 'Résumé des ouvriers pour'} ${formatMonthLabel(month)}`)}</caption><thead><tr><th scope="col">${labels.worker}</th><th scope="col">${labels.workDays}</th><th scope="col">${labels.hours}</th><th scope="col">${labels.rendezvous}</th></tr></thead><tbody>${workers.map((worker) => { const summary = summarizeWorkerMonth(worker.id, month); return `<tr><th scope="row">${escapeHtml(worker.name)}</th><td>${summary.workDays}</td><td>${summary.hours.toFixed(2)}</td><td>${summary.rendezvousDays}${summary.rendezvousCount > summary.rendezvousDays ? ` <small>(${summary.rendezvousCount} ${french ? 'termin.' : 'termina'})</small>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
	}
	async function loadTime() {
		await loadProjectOptions();
		const activeProject = currentProjectId();
		const managerView = isOwner();
		const [entriesRaw, own, rendezvousRaw, contacts] = await Promise.all([
			request('/time-entries'),
			request('/my-payroll-summary'),
			request('/rendezvous'),
			managerView ? request('/contacts') : Promise.resolve(null),
		]);
		const entries = entriesRaw.filter((entry) => !activeProject || !entry.projectId || entry.projectId === activeProject);
		const rendezvous = rendezvousRaw.filter((item) => !activeProject || !item.projectId || item.projectId === activeProject);
		latestRendezvous = rendezvous;
		latestTimeWorkers = managerView ? contacts.filter((user) => ['worker','user'].includes(user.role)) : [{ ...currentUser, dailyRate: own.dailyRate, hourlyRate: own.hourlyRate }];
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
		const selectedDate = form?.elements.date?.value || new Date().toISOString().slice(0, 10);
		if (form?.elements.date && !form.elements.date.value) form.elements.date.value = selectedDate;
		const selectedEntries = entries.filter((entry) => entry.workerId === selectedWorkerId || (!entry.workerId && selectedWorkerId === currentUser?.id));
		const selectedMonth = monthKeyFromDate(selectedDate);
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
		const selectedYear = selectedDate.slice(0, 4);
		const yearEntries = selectedEntries.filter((entry) => String(entry.date || '').startsWith(selectedYear));
		const yearHours = yearEntries.reduce((sum, item) => sum + Number(item.hours || 0), 0);
		const yearDays = new Set(yearEntries.map((item) => item.date)).size;
		const yearAmount = yearEntries.reduce((sum, item) => sum + Number(item.workAmount || 0), 0);
		const yearTarget = document.querySelector('#time-year-summary');
		if (yearTarget) { yearTarget.hidden = isOwner(); if (!isOwner()) yearTarget.innerHTML = `<strong>${escapeHtml(selectedYear)} · ${yearDays} jours · ${yearHours.toFixed(2)} h</strong><small>Total annuel : ${formatEUR(yearAmount)}</small>`; }
		latestOwnTimeEntries = entries;
		ensureTimeAutoCalculation(selectedWorker);
		renderWorkCalendar(latestOwnTimeEntries, selectedDate, latestRendezvous);
		renderWorkerMonthSummary(selectedMonth);
		const canApprove = isOwner();
		const canDeleteEntry = (item) => canApprove || item.status !== 'approved';
		const statusLabel = (status) => status === 'approved' ? 'Odobreno' : status === 'rejected' ? 'Odbijeno' : 'En attente';
		const entryRow = (item) => `<tr><td data-label="Date">${escapeHtml(item.date || '')}</td><td data-label="Ouvrier">${escapeHtml(item.workerName || '')}</td><td data-label="Heure">${escapeHtml(item.start || '')}–${escapeHtml(item.end || '')}</td><td data-label="Heures">${Number(item.hours || 0).toFixed(2)} h</td><td data-label="Montant">${formatEUR(item.workAmount || 0)}</td><td data-label="Statut"><span class="entry-status-pill entry-status-${item.status}">${statusLabel(item.status)}</span></td><td data-label="Actions"><div class="time-entry-actions">${canApprove && item.status === 'pending' ? `<button class="secondary approve-time" data-time="${item.id}" data-status="approved">Odobri</button><button class="secondary approve-time" data-time="${item.id}" data-status="rejected">Odbij</button>` : ''}${canDeleteEntry(item) ? `<button class="secondary delete-time" data-time="${item.id}">Supprimer</button>` : ''}</div></td></tr>`;
		const entriesByMonth = new Map();
		selectedEntries.slice().sort((first, second) => String(second.date || '').localeCompare(String(first.date || ''))).forEach((item) => {
			const month = monthKeyFromDate(item.date);
			if (!entriesByMonth.has(month)) entriesByMonth.set(month, []);
			entriesByMonth.get(month).push(item);
		});
		const months = [...entriesByMonth.keys()].sort((first, second) => second.localeCompare(first));
		const currentMonthKey = monthKeyFromDate(new Date().toISOString().slice(0, 10));
		const timeEntriesTarget = document.querySelector('#time-entries');
		timeEntriesTarget.hidden = canApprove;
		if (!canApprove) timeEntriesTarget.innerHTML = months.length ? months.map((month) => {
			const monthItems = entriesByMonth.get(month);
			const totalHours = monthItems.reduce((sum, item) => sum + Number(item.hours || 0), 0);
			const totalAmount = monthItems.reduce((sum, item) => sum + Number(item.workAmount || 0), 0);
			return `<details class="time-month-group"${month === currentMonthKey ? ' open' : ''}><summary>${formatMonthLabel(month)} · ${monthItems.length} j · ${totalHours.toFixed(2)} h · ${formatEUR(totalAmount)}</summary><div class="time-entries-scroll"><table class="time-entries-table"><thead><tr><th>Date</th><th>Ouvrier</th><th>Heure</th><th>Heures</th><th>Montant</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${monthItems.map(entryRow).join('')}</tbody></table></div></details>`;
		}).join('') : '<small>Aucune saisie de temps de travail pour cet ouvrier.</small>';
		document.querySelectorAll('.approve-time').forEach((button) => button.addEventListener('click', async () => { button.disabled = true; button.setAttribute('aria-busy', 'true'); try { await request(`/time-entries/${button.dataset.time}/status`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status:button.dataset.status }) }); await refreshActiveView(); toast(button.dataset.status === 'approved' ? 'Radno vreme je odobreno.' : 'Radno vreme je odbijeno.'); } catch { toast('Status nije promenjen.'); button.disabled = false; button.removeAttribute('aria-busy'); } }));
		document.querySelectorAll('.delete-time').forEach((button) => button.addEventListener('click', async () => { if (!window.confirm('Obrisati ovaj unos radnog vremena?')) return; button.disabled = true; button.setAttribute('aria-busy', 'true'); try { await request(`/time-entries/${button.dataset.time}`, { method:'DELETE' }); await refreshActiveView(); toast('Unos je obrisan.'); } catch { toast('Unos nije obrisan.'); button.disabled = false; button.removeAttribute('aria-busy'); } }));
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
		const form = document.createElement('form'); form.id = 'schedule-form'; form.className = 'schedule-editor'; form.innerHTML = `<h3>Modifier le calendrier</h3><label>Début des travaux<input name="startDate" type="date" value="${schedule.startDate || ''}" required /></label><label>Échéance prévue<input name="plannedEndDate" type="date" value="${schedule.plannedEndDate || ''}" required /></label><button class="primary" type="submit">Enregistrer le calendrier</button>`; panel.append(form);
		form.addEventListener('submit', async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(form).entries()); try { await request(`/projects/${currentProjectId()}/schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); await loadSchedule(); toast('Le calendrier a été enregistré.'); } catch (error) { toast(`Calendrier non enregistré : ${error.message || 'erreur inconnue'}`); } });
		const delayForm = document.createElement('form'); delayForm.id = 'delay-form'; delayForm.className = 'schedule-editor'; delayForm.innerHTML = `<h3>Déclarer un retard</h3><label>Catégorie<select name="category"><option value="weather">Météo</option><option value="materials">Retard des matériaux</option><option value="client">Client</option><option value="technical">Technique</option><option value="other">Autre</option></select></label><label>Nombre de jours<input name="days" type="number" min="1" step="1" required /></label><label>Motif du retard<textarea name="reason" required></textarea></label><button class="secondary" type="submit">Enregistrer le retard</button>`; panel.append(delayForm);
		delayForm.addEventListener('submit', async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(delayForm).entries()); try { await request(`/projects/${currentProjectId()}/delays`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); delayForm.reset(); await loadSchedule(); toast('Le retard a été enregistré.'); } catch (error) { toast(`Retard non enregistré : ${error.message || 'erreur inconnue'}`); } });
	}
	async function loadSchedule() {
		await loadProjectOptions();
		const projectId = currentProjectId();
		const target = document.querySelector('#schedule-summary'); const status = document.querySelector('#schedule-status');
		if (!projectId) { status.textContent = 'Aucun chantier'; target.innerHTML = '<small>Créez d’abord un chantier dans Devis.</small>'; return; }
		const schedule = await request(`/projects/${projectId}/schedule`);
		status.textContent = schedule.delayDays ? `${schedule.delayDays} jours de retard` : 'Aucun retard';
		target.innerHTML = `<div class="list-item"><strong>Début des travaux : ${schedule.startDate || 'non renseigné'}</strong><small>Échéance prévue : ${schedule.plannedEndDate || 'non renseignée'} · Échéance ajustée : ${schedule.adjustedEndDate || 'non calculée'}</small></div>${schedule.delays.map((item) => `<div class="list-item"><strong>${item.category} · ${item.days} jours</strong><small>${item.reason}</small></div>`).join('')}`;
		ensureScheduleEditor(schedule);
	}
	const documentGroupOrder = ['plan', 'fiche-technique', 'photo-before', 'photo-during', 'photo-after', 'other'];
	const documentGroupLabels = { plan: 'Plans', 'fiche-technique': 'Fiches techniques', 'photo-before': 'Photos avant travaux', 'photo-during': 'Photos pendant les travaux', 'photo-after': 'Photos après travaux', other: 'Autres' };
	async function loadDocuments() { await loadProjectOptions(); const activeProject = currentProjectId(); const documents = (await request('/documents')).filter((item) => !activeProject || item.projectId === activeProject); const canManage = isOwner();
		const explainable = (item) => ['plan', 'fiche-technique'].includes(item.evidenceType);
		const isPhoto = (item) => (item.evidenceType || '').startsWith('photo-');
		const planTypeTag = (item) => item.planType === 'existant' ? `<span class="production-method-tag plan-type-existant-tag">Plan existant</span>` : item.planType === 'nouveau' ? `<span class="production-method-tag plan-type-nouveau-tag">Plan nouveau</span>` : '';
		const renderItem = (item) => `<div class="list-item">${isPhoto(item) ? `<img class="document-thumb" data-thumb-doc="${item.id}" alt="" />` : ''}<strong>${item.originalName}</strong>${planTypeTag(item)}${item.duplicateOfId ? `<span class="production-method-tag duplicate-tag" title="Un fichier identique a déjà été ajouté : ${escapeHtml(item.duplicateOfName || '')}">⚠ Doublon possible</span>` : ''}<small>${item.phase || 'general'} · ${Math.max(1, Math.round(item.size / 1024))} KB · ${item.projectId}</small><div class="document-actions"><button class="secondary view-document" data-document="${item.id}">Voir</button>${canManage && item.evidenceType === 'plan' ? `<button class="secondary measure-plan" data-document="${item.id}">Mesurer</button>` : ''}${explainable(item) ? `<button class="secondary explain-document" data-document="${item.id}">Objasni jednostavnim jezikom</button>` : ''}${canManage ? `<button class="secondary rename-document" data-document="${item.id}">Renommer</button><button class="secondary copy-document" data-document="${item.id}">Copier</button><button class="secondary send-document-email" data-document="${item.id}" data-name="${escapeHtml(item.originalName)}">Envoyer par email</button><button class="secondary delete-document" data-document="${item.id}">Supprimer</button>` : ''}</div>${explainable(item) ? `<div class="document-explanation" data-document-explanation="${item.id}" hidden></div>` : ''}</div>`;
		const groups = documentGroupOrder.map((type) => ({ type, items: documents.filter((item) => (item.evidenceType || 'other') === type) })).filter((group) => group.items.length);
		document.querySelector('#documents').innerHTML = groups.length ? groups.map((group) => `<div class="document-group"><h4>${documentGroupLabels[group.type]} · ${group.items.length}</h4>${group.items.map(renderItem).join('')}</div>`).join('') : '<small>Aucun document enregistré.</small>';
		document.querySelectorAll('.rename-document').forEach((button) => button.addEventListener('click', async () => { const item = documents.find((document) => document.id === button.dataset.document); const name = window.prompt('Novo ime dokumenta:', item?.originalName || ''); if (!name?.trim()) return; button.disabled = true; button.setAttribute('aria-busy', 'true'); try { await request(`/documents/${button.dataset.document}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) }); await refreshActiveView(); toast('Document renommé.'); } catch { toast('Document non renommé.'); button.disabled = false; button.removeAttribute('aria-busy'); } })); document.querySelectorAll('.copy-document').forEach((button) => button.addEventListener('click', async () => { button.disabled = true; button.setAttribute('aria-busy', 'true'); try { await request(`/documents/${button.dataset.document}/copy`, { method: 'POST' }); await refreshActiveView(); toast('Copie du document ajoutée.'); } catch { toast('Copie non ajoutée.'); button.disabled = false; button.removeAttribute('aria-busy'); } })); document.querySelectorAll('.delete-document').forEach((button) => button.addEventListener('click', async () => { const item = documents.find((document) => document.id === button.dataset.document); if (!item || !window.confirm(`Obrisati dokument „${item.originalName}“?`)) return; const originalLabel = button.textContent; button.disabled = true; button.textContent = 'Brisanje...'; try { await request(`/documents/${button.dataset.document}`, { method: 'DELETE' }); await refreshActiveView(); toast('Dokument je obrisan.'); } catch { toast('Dokument nije obrisan.'); button.disabled = false; button.textContent = originalLabel; } })); document.querySelectorAll('.send-document-email').forEach((button) => button.addEventListener('click', () => sendDocumentByEmail(`/documents/${button.dataset.document}/download`, button.dataset.name, button))); document.querySelectorAll('.view-document').forEach((button) => button.addEventListener('click', () => viewDocument(`/documents/${button.dataset.document}/download`, button))); document.querySelectorAll('.measure-plan').forEach((button) => button.addEventListener('click', () => openPlanMeasure(button.dataset.document)));
			document.querySelectorAll('.document-thumb').forEach((img) => {
				const documentId = img.dataset.thumbDoc;
				const downloadPath = `/documents/${documentId}/download`;
				img.addEventListener('click', () => viewDocument(downloadPath, null));
				resolveDownloadUrl(downloadPath).then((url) => {
					if (url) { img.src = url; return; }
					return fetch(`${api}${downloadPath}`, { headers: { Authorization: `Bearer ${token()}` } })
						.then((response) => (response.ok ? response.blob() : Promise.reject()))
						.then((blob) => { img.src = URL.createObjectURL(blob); });
				}).catch(() => { img.remove(); });
			});
			document.querySelectorAll('.explain-document').forEach((button) => button.addEventListener('click', async () => {
				const panel = document.querySelector(`[data-document-explanation="${button.dataset.document}"]`);
				if (panel && !panel.hidden) { panel.hidden = true; return; }
				button.disabled = true; button.setAttribute('aria-busy', 'true');
				try {
					const result = await request(`/documents/${button.dataset.document}/explain`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ responseLanguage: language }) });
					if (result.status === 'not_configured') { toast('Objašnjenje trenutno nije dostupno.'); }
					else if (panel) { panel.innerHTML = `<strong>⚠ Objašnjenje (IA) — kote provjeriti na dokumentu</strong><p>${escapeHtml(result.explanation || '').replace(/\n/g, '<br>')}</p>`; panel.hidden = false; }
				} catch { toast('Objašnjenje nije učitano.'); }
				finally { button.disabled = false; button.removeAttribute('aria-busy'); }
			}));
		}
	// Plan measurement tool: calibrated on-screen takeoff (click two points of a known real-world
	// distance to set a scale, then trace lines/polygons) - pure geometry, no AI, matching how tools
	// like On-Screen Takeoff / PlanSwift work. planMeasureState.*Points are stored in the plan's natural
	// image pixel space (not the possibly-scaled canvas display size) so measurements stay correct
	// regardless of zoom/window size; planMeasureState.scale converts natural space -> canvas display space.
	let planMeasureState = null;
	// Canvas pixel size for the CURRENT scale + rotation - width/height swap at 90/270 since the plan is
	// turned on its side. Exact integer math (Math.round only here, never trig) so rotating never shifts
	// an already-placed point by even a fraction of a pixel.
	function planMeasureCanvasSize() {
		const scaledW = Math.round(planMeasureState.image.naturalWidth * planMeasureState.scale);
		const scaledH = Math.round(planMeasureState.image.naturalHeight * planMeasureState.scale);
		const swapped = planMeasureState.rotation === 90 || planMeasureState.rotation === 270;
		return swapped ? { width: scaledH, height: scaledW } : { width: scaledW, height: scaledH };
	}
	function planMeasureToNatural(event) {
		const canvas = document.querySelector('#plan-measure-canvas');
		const rect = canvas.getBoundingClientRect();
		const dx = (event.clientX - rect.left) * (canvas.width / rect.width);
		const dy = (event.clientY - rect.top) * (canvas.height / rect.height);
		// Exact inverse of the rotation transform planMeasureRedraw applies below, so a click always maps
		// back to the same natural-image point regardless of which way the plan is currently turned.
		let lx; let ly;
		switch (planMeasureState.rotation) {
			case 90: lx = dy; ly = canvas.width - dx; break;
			case 180: lx = canvas.width - dx; ly = canvas.height - dy; break;
			case 270: lx = canvas.height - dy; ly = dx; break;
			default: lx = dx; ly = dy;
		}
		return { x: lx / planMeasureState.scale, y: ly / planMeasureState.scale };
	}
	// Resolves which calibration zone a natural-space point falls inside (by its saved region rectangle).
	// If no delimited region claims the point, it falls back to whichever zone has NO region at all - that
	// zone is the implicit "rest of the plan" catch-all (e.g. the main façade scale, with only the pignon
	// sub-section separately delimited). This must NOT fall back to "whatever zone is currently active",
	// because the active zone changes as the gérant works and using it would make the resolved scale depend
	// on click order instead of on the plan's own geometry - a silent, undetectable source of wrong numbers.
	// Only when there is more than one regionless zone (genuinely ambiguous) do we fall back to the active
	// zone, same as a plain single-scale plan where no zone has ever had a region defined at all.
	function planMeasureZoneForPoint(point) {
		// A plan can be many PDF pages (a cover sheet, then each facade on its own page) - a zone calibrated
		// on page 2 must never resolve for a point being clicked on page 5, even if page 5 happens to have no
		// zone of its own yet. Scoping to the current page FIRST, before the region/fallback logic below,
		// keeps that the same hard rule the region system already enforces for zones on the same page.
		const zones = (planMeasureState?.calibrations || []).filter((zone) => (zone.page || 1) === (planMeasureState?.page || 1));
		const match = zones.find((zone) => zone.region && point.x >= zone.region.x0 && point.x <= zone.region.x1 && point.y >= zone.region.y0 && point.y <= zone.region.y1);
		if (match) return match;
		const undelimited = zones.filter((zone) => !zone.region);
		if (undelimited.length === 1) return undelimited[0];
		return planMeasureState?.calibration || null;
	}
	function planMeasureLengthM(points) {
		if (!planMeasureState?.calibration) return 0;
		let pixelSum = 0;
		for (let i = 1; i < points.length; i += 1) pixelSum += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
		return pixelSum / planMeasureState.calibration.pixelsPerMeter;
	}
	function planMeasureAreaM2(points) {
		if (!planMeasureState?.calibration || points.length < 3) return 0;
		let sum = 0;
		for (let i = 0; i < points.length; i += 1) { const a = points[i]; const b = points[(i + 1) % points.length]; sum += a.x * b.y - b.x * a.y; }
		return Math.abs(sum) / 2 / (planMeasureState.calibration.pixelsPerMeter ** 2);
	}
	function planMeasureRedraw() {
		if (!planMeasureState?.image) return;
		const canvas = document.querySelector('#plan-measure-canvas');
		const ctx = canvas.getContext('2d');
		const scale = planMeasureState.scale;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.save();
		// Every draw call below (image, calibration line, measurements, in-progress points) already uses
		// natural-image coordinates * scale, unrotated. Rotating the context itself here, once, turns all
		// of it together and exactly - no stored point is ever touched, so calibration/measurements made
		// before a rotation stay numerically correct after it.
		switch (planMeasureState.rotation) {
			case 90: ctx.translate(canvas.width, 0); ctx.rotate(Math.PI / 2); break;
			case 180: ctx.translate(canvas.width, canvas.height); ctx.rotate(Math.PI); break;
			case 270: ctx.translate(0, canvas.height); ctx.rotate(-Math.PI / 2); break;
		}
		const naturalDrawWidth = planMeasureState.image.naturalWidth * scale;
		const naturalDrawHeight = planMeasureState.image.naturalHeight * scale;
		ctx.drawImage(planMeasureState.image, 0, 0, naturalDrawWidth, naturalDrawHeight);
		const strokePath = (points, close) => { ctx.beginPath(); points.forEach((p, i) => { const x = p.x * scale; const y = p.y * scale; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); if (close) ctx.closePath(); };
		const currentPage = planMeasureState.page || 1;
		if (planMeasureState.calibration?.pointA && planMeasureState.calibration?.pointB && (planMeasureState.calibration.page || 1) === currentPage) {
			ctx.strokeStyle = '#31d3a4'; ctx.lineWidth = 2; ctx.setLineDash([]);
			strokePath([planMeasureState.calibration.pointA, planMeasureState.calibration.pointB], false); ctx.stroke();
		}
		// Shows exactly where each delimited zone applies, so a mixed-scale plan (façade at one zone, pignon
		// at another) is visually self-explanatory instead of relying on memory - matches what the automatic
		// per-shape zone resolution already uses under the hood. Only zones for the page actually on screen -
		// a page-2 zone's rectangle would otherwise be drawn over completely unrelated page-1 geometry.
		(planMeasureState.calibrations || []).filter((zone) => (zone.page || 1) === currentPage).forEach((zone) => {
			if (!zone.region) return;
			ctx.strokeStyle = zone.id === planMeasureState.calibration?.id ? '#72b9ff' : '#72b9ff80';
			ctx.lineWidth = 2; ctx.setLineDash([10, 6]);
			ctx.strokeRect(zone.region.x0 * scale, zone.region.y0 * scale, (zone.region.x1 - zone.region.x0) * scale, (zone.region.y1 - zone.region.y0) * scale);
			ctx.setLineDash([]);
			ctx.fillStyle = '#72b9ff'; ctx.font = 'bold 13px sans-serif';
			ctx.fillText(zone.label || 'Zone', zone.region.x0 * scale + 4, zone.region.y0 * scale + 16);
		});
		// Only this page's own measurements are drawn over it - a measurement traced on a different page of
		// the same PDF would otherwise appear as stray, meaningless geometry floating over whatever this page
		// actually shows. The full list (every page) still totals correctly in the devis - see planMeasureRenderList.
		planMeasureState.measurements.filter((item) => (item.page || 1) === currentPage).forEach((item) => {
			const isOpening = item.type === 'polygon' && item.role === 'opening';
			ctx.strokeStyle = isOpening ? '#f77d7d' : item.type === 'polygon' ? '#f4c86f' : '#72b9ff';
			ctx.fillStyle = isOpening ? '#f77d7d33' : item.type === 'polygon' ? '#f4c86f2e' : 'transparent';
			ctx.lineWidth = 2;
			strokePath(item.points, item.type === 'polygon');
			if (item.type === 'polygon') ctx.fill();
			ctx.stroke();
			ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif';
			ctx.fillText(item.repeatCount > 1 ? `${item.label} ×${item.repeatCount}` : item.label, item.points[0].x * scale + 5, item.points[0].y * scale - 6);
		});
		if (planMeasureState.mode === 'calibrate' && planMeasureState.calibratePoints.length) {
			ctx.fillStyle = '#31d3a4';
			planMeasureState.calibratePoints.forEach((p) => { ctx.beginPath(); ctx.arc(p.x * scale, p.y * scale, 4, 0, Math.PI * 2); ctx.fill(); });
			if (planMeasureState.calibratePoints.length === 2) { ctx.strokeStyle = '#31d3a4'; ctx.setLineDash([5, 5]); strokePath(planMeasureState.calibratePoints, false); ctx.stroke(); ctx.setLineDash([]); }
		}
		if ((planMeasureState.mode === 'line' || planMeasureState.mode === 'polygon' || planMeasureState.mode === 'chain') && planMeasureState.drawPoints.length) {
			ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
			strokePath(planMeasureState.drawPoints, false); ctx.stroke();
			ctx.fillStyle = '#ffffff';
			planMeasureState.drawPoints.forEach((p) => { ctx.beginPath(); ctx.arc(p.x * scale, p.y * scale, 3, 0, Math.PI * 2); ctx.fill(); });
		}
		if (planMeasureState.candidates?.length) {
			const candidateColor = { opening: '#f39a4a', 'rail-v': '#72b9ff', 'rail-h': '#c879ff', 'custom-v': '#5bd68a', 'custom-h': '#ffd166', 'custom-blob': '#ff6b9d' };
			ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
			ctx.font = 'bold 12px sans-serif';
			planMeasureState.candidates.forEach((box, index) => {
				const color = candidateColor[box.kind] || candidateColor.opening;
				ctx.strokeStyle = color; ctx.fillStyle = color;
				const w = (box.x1 - box.x0) * scale; const h = (box.y1 - box.y0) * scale;
				// A rail candidate is only a couple of pixels thick before scaling - padded out to a minimum
				// visible width/height here (display only, never written back to the stored box) so its outline
				// doesn't vanish on screen while the gérant is reviewing it.
				const padX = w < 6 ? (6 - w) / 2 : 0; const padY = h < 6 ? (6 - h) / 2 : 0;
				ctx.strokeRect(box.x0 * scale - padX, box.y0 * scale - padY, w + padX * 2, h + padY * 2);
				ctx.fillText(`#${index + 1}`, box.x0 * scale + 3, box.y0 * scale - padY + 13);
			});
			ctx.setLineDash([]);
		}
		ctx.restore();
	}
	function planMeasureUpdateStatus() {
		const status = document.querySelector('#plan-measure-status');
		if (!status || !planMeasureState) return;
		if (planMeasureState.mode === 'calibrate') { status.textContent = `Calibration : cliquez 2 points d’une distance connue (${planMeasureState.calibratePoints.length}/2)`; return; }
		if (planMeasureState.mode === 'calibrate-region') { status.textContent = `Délimitation de la zone : cliquez 2 coins opposés (${planMeasureState.calibratePoints.length}/2)`; return; }
		if (planMeasureState.mode === 'pick-color') { status.textContent = 'Cliquez une fois sur un exemple de l’élément à reconnaître (ex. un trait de recoupement) - sa couleur exacte sera cherchée partout sur le plan.'; return; }
		if (planMeasureState.mode === 'line') { status.textContent = `Ligne en cours : ${planMeasureState.drawPoints.length} point(s) · ${planMeasureLengthM(planMeasureState.drawPoints).toFixed(2)} ml`; return; }
		if (planMeasureState.mode === 'chain') {
			const points = planMeasureState.drawPoints;
			const segments = Math.max(0, points.length - 1);
			const lastSegment = segments > 0 ? planMeasureLengthM(points.slice(-2)).toFixed(2) : null;
			status.textContent = `Chaîne en cours : ${points.length} point(s) → ${segments} segment(s)${lastSegment ? ` · dernier segment ${lastSegment} ml` : ''} — cliquez chaque point successif (départ, puis chaque recoupement/bando), « Terminer » crée un segment mesuré entre chaque paire.`;
			return;
		}
		if (planMeasureState.mode === 'polygon') { const kind = planMeasureState.drawRole === 'opening' ? 'Ouverture à déduire' : 'Surface'; status.textContent = `${kind} en cours : ${planMeasureState.drawPoints.length} point(s) · ${planMeasureAreaM2(planMeasureState.drawPoints).toFixed(2)} m²`; return; }
		if (!planMeasureState.calibration) { status.textContent = 'Échelle non calibrée — cliquez « Calibrer l’échelle » avant de mesurer.'; return; }
		const zoneSuffix = planMeasureState.calibration.label ? ` (zone : ${planMeasureState.calibration.label})` : '';
		// Only THIS page's own zones are relevant here - a zone calibrated on another page of the same PDF
		// is never ambiguous with one on this page (planMeasureZoneForPoint already scopes to the current
		// page the same way), so it must never trigger this warning either.
		const zones = (planMeasureState.calibrations || []).filter((zone) => (zone.page || 1) === (planMeasureState.page || 1));
		// With at most one regionless zone, planMeasureZoneForPoint always resolves deterministically (see its
		// own comment) - the tool genuinely applies the right scale on its own, so no manual check is needed.
		// Only 2+ regionless zones are truly ambiguous (the tool can't tell them apart) and need the gérant's eye.
		const undelimitedCount = zones.filter((zone) => !zone.region).length;
		const multiZoneWarning = zones.length > 1
			? (undelimitedCount > 1 ? ' ⚠ Plusieurs zones de calibration sans délimitation claire - vérifiez que la zone active correspond à ce que vous mesurez.' : ' ℹ Plusieurs zones existent ; la bonne échelle est appliquée automatiquement selon l’endroit du plan.')
			: '';
		status.textContent = `Échelle calibrée : ${planMeasureState.calibration.pixelsPerMeter.toFixed(1)} px/m${zoneSuffix}${multiZoneWarning}`;
	}
	// Lets a gérant switch back to a previously calibrated zone (e.g. a plan with a façade at one printed
	// scale and a pignon/gable at another) without re-clicking two reference points every time - purely a
	// convenience over calling the same PATCH endpoint again with the saved points, see the server comment
	// on addCalibrationZone for why this never touches any measurement already created under another zone.
	function planMeasureRenderCalibrationZones() {
		const select = document.querySelector('#plan-measure-calibration-zone');
		if (!select) return;
		// Only the CURRENT page's own zones - switching to a zone calibrated on a different page would point
		// planMeasureState.calibration at a scale (and a pointA/pointB reference line) that belongs to an
		// image the gérant isn't even looking at right now.
		const currentPage = planMeasureState?.page || 1;
		const zones = (planMeasureState?.calibrations || []).filter((zone) => (zone.page || 1) === currentPage);
		select.hidden = zones.length < 2;
		if (zones.length < 2) return;
		select.innerHTML = zones.map((zone, index) => `<option value="${escapeHtml(zone.id)}">${escapeHtml(zone.label || `Zone ${index + 1}`)} (${zone.pixelsPerMeter.toFixed(1)} px/m)</option>`).join('');
		select.value = planMeasureState.calibration?.id || '';
	}
	function planMeasureSyncToolbar() {
		const disabled = !planMeasureState?.calibration;
		document.querySelector('#plan-measure-line')?.toggleAttribute('disabled', disabled);
		document.querySelector('#plan-measure-polygon')?.toggleAttribute('disabled', disabled);
		document.querySelector('#plan-measure-opening')?.toggleAttribute('disabled', disabled);
		document.querySelector('#plan-measure-detect-openings')?.toggleAttribute('disabled', disabled);
		document.querySelector('#plan-measure-detect-rails')?.toggleAttribute('disabled', disabled);
		document.querySelector('#plan-measure-pick-color')?.toggleAttribute('disabled', disabled);
		document.querySelector('#plan-measure-scan-colors')?.toggleAttribute('disabled', disabled);
		const actions = document.querySelector('#plan-measure-candidates-actions');
		const candidates = planMeasureState?.candidates || [];
		if (actions) {
			actions.hidden = candidates.length === 0;
			const openingBoxes = candidates.filter((box) => box.kind === 'opening');
			const railV = candidates.filter((box) => box.kind === 'rail-v');
			const railH = candidates.filter((box) => box.kind === 'rail-h');
			const customV = candidates.filter((box) => box.kind === 'custom-v');
			const customH = candidates.filter((box) => box.kind === 'custom-h');
			const customBlob = candidates.filter((box) => box.kind === 'custom-blob');
			// A rail candidate is only a few pixels thick - too thin to reliably click-to-reject one at a time
			// among what's often hundreds of them across a whole facade (confirmed on a real plan: 500+ rail
			// segments). So unlike openings (confirmed one by one, each a genuinely distinct real-world item),
			// rails are reviewed as a SUM: the overlay on the canvas is the review (does the pattern of lines
			// look right across the facade), and confirming adds one devis line per orientation with the total
			// length - never hundreds of individual line items nobody would scroll through anyway.
			const pxPerM = planMeasureState?.calibration?.pixelsPerMeter || 1;
			const totalV = railV.reduce((sum, box) => sum + (box.y1 - box.y0) / pxPerM, 0);
			const totalH = railH.reduce((sum, box) => sum + (box.x1 - box.x0) / pxPerM, 0);
			const customLabel = planMeasureState?.customColorLabel || 'élément';
			const countLabel = document.querySelector('#plan-measure-candidates-count');
			if (countLabel) {
				const parts = [];
				if (openingBoxes.length) parts.push(`${openingBoxes.length} ouverture(s)`);
				if (railV.length) parts.push(`${railV.length} rail(aux) vertical(aux) = ${totalV.toFixed(1)} ml (${planMeasureDescribeLineBoxes(railV, 'v', pxPerM)})`);
				if (railH.length) parts.push(`${railH.length} rail(aux) horizontal(aux) = ${totalH.toFixed(1)} ml (${planMeasureDescribeLineBoxes(railH, 'h', pxPerM)})`);
				if (customV.length) parts.push(`${customV.length} « ${customLabel} » vertical(aux) (${planMeasureDescribeLineBoxes(customV, 'v', pxPerM)})`);
				if (customH.length) parts.push(`${customH.length} « ${customLabel} » horizontal(aux) (${planMeasureDescribeLineBoxes(customH, 'h', pxPerM)})`);
				if (customBlob.length) parts.push(`${customBlob.length} « ${customLabel} » (élément compact) (${planMeasureDescribeBlobBoxes(customBlob, pxPerM)})`);
				countLabel.textContent = `${parts.join(', ')} détecté(s) (⚠ hors couleur reconnue = jamais détecté), à vérifier :`;
			}
			document.querySelector('#plan-measure-candidates-confirm')?.toggleAttribute('hidden', openingBoxes.length === 0);
			document.querySelector('#plan-measure-candidates-rails-v')?.toggleAttribute('hidden', railV.length === 0);
			document.querySelector('#plan-measure-candidates-rails-h')?.toggleAttribute('hidden', railH.length === 0);
			const chainVButton = document.querySelector('#plan-measure-candidates-custom-chain-v');
			const chainHButton = document.querySelector('#plan-measure-candidates-custom-chain-h');
			const blobButton = document.querySelector('#plan-measure-candidates-custom-blob');
			if (chainVButton) { chainVButton.hidden = customV.length < 2; chainVButton.textContent = `+ Chaîne « ${customLabel} » verticale (${customV.length} points)`; }
			if (chainHButton) { chainHButton.hidden = customH.length < 2; chainHButton.textContent = `+ Chaîne « ${customLabel} » horizontale (${customH.length} points)`; }
			if (blobButton) { blobButton.hidden = customBlob.length === 0; blobButton.textContent = `+ Quantité « ${customLabel} » au devis (${customBlob.length})`; }
		}
	}
	// Deterministic (no AI, no language model) opening detector: finds blue/cyan-colored rectangular
	// regions on the plan image - a very common CAD convention for window/door glazing, confirmed by hand
	// against a real structural plan before shipping this. Same image always gives the exact same result,
	// nothing is "guessed". Results are only ever candidates the user reviews (reject a false positive by
	// clicking it, or "Confirmer tout") - never auto-created as real measurements, because color-matching
	// alone cannot be honestly promised as 100% accurate on every possible plan style; only the geometry
	// the user explicitly confirms is.
	function planMeasureDetectOpenings() {
		if (!planMeasureState?.image || !planMeasureState.calibration) return;
		const image = planMeasureState.image;
		const natW = image.naturalWidth;
		const natH = image.naturalHeight;
		// Downscaled for performance on large A0-format plans (can rasterize to several thousand pixels per
		// side) - a window is still many pixels across at this size, so this doesn't meaningfully hurt
		// detection, but keeps the flood-fill below well under a second on the main thread.
		const detectScale = Math.min(1, 1600 / Math.max(natW, natH));
		const dw = Math.max(1, Math.round(natW * detectScale));
		const dh = Math.max(1, Math.round(natH * detectScale));
		const offscreen = document.createElement('canvas');
		offscreen.width = dw; offscreen.height = dh;
		const octx = offscreen.getContext('2d', { willReadFrequently: true });
		octx.drawImage(image, 0, 0, dw, dh);
		const { data } = octx.getImageData(0, 0, dw, dh);
		const isBlue = new Uint8Array(dw * dh);
		for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
			const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
			if (b > 140 && b > r + 30 && g > r && r < 150) isBlue[p] = 1;
		}
		const labelOf = new Int32Array(dw * dh).fill(-1);
		const stack = [];
		const candidates = [];
		for (let start = 0; start < dw * dh; start += 1) {
			if (!isBlue[start] || labelOf[start] !== -1) continue;
			let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity; let count = 0;
			stack.length = 0;
			stack.push(start);
			labelOf[start] = 1;
			while (stack.length) {
				const p = stack.pop();
				const px = p % dw; const py = (p - px) / dw;
				if (px < x0) x0 = px; if (px > x1) x1 = px;
				if (py < y0) y0 = py; if (py > y1) y1 = py;
				count += 1;
				if (px > 0 && isBlue[p - 1] && labelOf[p - 1] === -1) { labelOf[p - 1] = 1; stack.push(p - 1); }
				if (px < dw - 1 && isBlue[p + 1] && labelOf[p + 1] === -1) { labelOf[p + 1] = 1; stack.push(p + 1); }
				if (p - dw >= 0 && isBlue[p - dw] && labelOf[p - dw] === -1) { labelOf[p - dw] = 1; stack.push(p - dw); }
				if (p + dw < dw * dh && isBlue[p + dw] && labelOf[p + dw] === -1) { labelOf[p + dw] = 1; stack.push(p + dw); }
			}
			const bw = x1 - x0 + 1; const bh = y1 - y0 + 1;
			const extent = count / (bw * bh);
			const aspect = bh ? bw / bh : 0;
			// Rejects thin annotation/dimension lines (very elongated, or a thin stroke that technically
			// fills its own tiny bounding box) and single-pixel antialiasing specks - keeps roughly
			// rectangular, reasonably solid blobs the size of a real window pane at this resolution.
			if (count < 40 || extent < 0.55 || aspect < 0.3 || aspect > 3.5) continue;
			candidates.push({
				kind: 'opening',
				x0: x0 / detectScale, y0: y0 / detectScale,
				x1: (x1 + 1) / detectScale, y1: (y1 + 1) / detectScale,
			});
		}
		// A double or triple window (two/three panes side by side, separated by a thin frame mullion) must
		// count as ONE opening, not one per pane - checked by hand against the real BONDY plan: measuring
		// the gap between every same-row pair showed a clean split, mullions between panes of the same
		// window at roughly 10-40px, the wall/pier between two actually separate windows at 140px+. Using
		// 1.2x the pane's own height as the merge cutoff (scale-invariant, unlike a fixed pixel count) sits
		// comfortably inside that gap and matched the real plan exactly (405 raw panes -> 200 real windows,
		// confirmed box-by-box against both façades and the gable end).
		const merged = planMeasureMergeAdjacentCandidates(candidates);
		planMeasureState.candidates = merged;
		planMeasureSyncToolbar();
		planMeasureRedraw();
		// Confirmed on a real plan: a stairwell's glazing drawn in white instead of the usual blue was
		// completely invisible to this color-based detection - never silently implied as "found everything"
		// here, since the same thing could happen to any element that isn't drawn in that blue convention.
		toast(merged.length ? `${merged.length} ouverture(s) candidate(s) détectée(s) - vérifiez avant de confirmer. ⚠ Les éléments d'une autre couleur (ex. cage d'escalier) ne sont jamais détectés - tracez-les à la main avec « + Ouverture à déduire ».` : 'Aucune ouverture détectée automatiquement sur ce plan (couleurs non reconnues) - tracez-les manuellement.');
	}
	function planMeasureMergeAdjacentCandidates(boxes) {
		let list = boxes.map((box) => ({ ...box, parts: 1 }));
		let changed = true;
		while (changed) {
			changed = false;
			outer: for (let i = 0; i < list.length; i += 1) {
				const a = list[i];
				if (!a) continue;
				const heightA = a.y1 - a.y0;
				const widthA = a.x1 - a.x0;
				for (let j = i + 1; j < list.length; j += 1) {
					const c = list[j];
					if (!c) continue;
					// A real window has at most 3 panes - without this cap, a chain of otherwise-valid small
					// merges could keep absorbing neighbors across a whole row and eventually bridge a real
					// gap between two separate parts of the building. Caught by hand on a second real plan
					// (two different building wings got merged into one absurd candidate) before shipping.
					if (a.parts + c.parts > 3) continue;
					const heightC = c.y1 - c.y0;
					const widthC = c.x1 - c.x0;
					// A double/triple window's panes can be adjacent along either axis of the plan's OWN
					// stored image, regardless of which way it's currently rotated for viewing (rotation is
					// a view-only transform - detection always runs on the real, unrotated image data, so a
					// plan stored sideways has its "side by side" panes stacked vertically in that data).
					// Checked against a real plan that was stored sideways: a horizontal-only check found
					// zero merges where a pre-rotated copy of the same plan found exactly the expected ones.
					const yOverlap = Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0);
					const xGap = Math.max(c.x0 - a.x1, a.x0 - c.x1);
					const horizontalPair = yOverlap >= 0.6 * Math.min(heightA, heightC) && xGap >= 0 && xGap <= 1.2 * Math.min(heightA, heightC);
					const xOverlap = Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0);
					const yGap = Math.max(c.y0 - a.y1, a.y0 - c.y1);
					const verticalPair = xOverlap >= 0.6 * Math.min(widthA, widthC) && yGap >= 0 && yGap <= 1.2 * Math.min(widthA, widthC);
					if (!horizontalPair && !verticalPair) continue;
					const mergedX0 = Math.min(a.x0, c.x0); const mergedY0 = Math.min(a.y0, c.y0);
					const mergedX1 = Math.max(a.x1, c.x1); const mergedY1 = Math.max(a.y1, c.y1);
					// Second, independent guard: even within the 3-part cap, reject a merge that would
					// produce an implausibly elongated shape for a real window (a bridge between two
					// legitimately separate, similarly-colored elements rather than one window's panes).
					const mergedAspect = (mergedX1 - mergedX0) / (mergedY1 - mergedY0 || 1);
					if (mergedAspect > 6 || mergedAspect < 1 / 6) continue;
					a.x0 = mergedX0; a.y0 = mergedY0; a.x1 = mergedX1; a.y1 = mergedY1;
					a.parts += c.parts;
					list[j] = null;
					changed = true;
					break outer;
				}
			}
			list = list.filter(Boolean);
		}
		return list.map(({ parts, ...rest }) => rest);
	}
	// Detects the steel "ossature" rails (horizontal + vertical furring/cladding rails) drawn on a facade
	// elevation plan - a DIFFERENT color convention from window openings, confirmed by hand on two real
	// BONDY "OSSATURES" plans: both rail orientations share the exact same fill color (sky blue, ~173/221/
	// 247) in the plan's own legend ("Ossature L acier galva"), distinguished from each other only by which
	// way they're drawn, never by hue. Unlike a window pane (a filled rectangle, many pixels across even on
	// a big plan), a rail is drawn as a THIN line - only 1px wide at this app's actual 150 DPI raster,
	// confirmed by sampling the real plan pixel by pixel. A 1px feature can vanish entirely under the
	// opening detector's downscale step, so this runs at full resolution (no downscale) even though that
	// costs more time on a huge A0 sheet.
	// Finds thin elongated regions of ONE given color (classified horizontal/vertical by aspect ratio,
	// merged back across each element's own real breaks - see planMeasureMergeCollinearRailSegments) -
	// the shared engine behind both the hardcoded "ossature rails" detector below and the gérant-driven
	// custom-color detector (planMeasureDetectCustomColor): a color convention is specific to whichever
	// architect drew THIS plan (confirmed directly: two real plans from the same project used a thick
	// black line for one detail and a thin colored axis for another), so the one thing that generalizes
	// across every future plan is the ENGINE, not any one hardcoded color. Full resolution (no downscale),
	// because a thin line can be only 1px wide on a big A0 sheet at this app's actual raster DPI, and
	// downscaling can erase it outright (confirmed on a real plan).
	// Shared by the single-click "sample one color" detector and the "Pitaj app" scan-all-colors tool: given
	// a boolean mask (one flag per pixel, already matched to some target color) at natural resolution, finds
	// connected regions and classifies each into a vertical line, a horizontal line, or a compact "blob"
	// (discrete item like a window, bracket or platine) - then bridges each line's own real breaks (label
	// boxes, crossing elements drawn over it in the source plan) back into one candidate per physical run,
	// exactly like the ossature-rail detector this was originally built for.
	function planMeasureClassifyMask(mask, natW, natH) {
		const labelOf = new Int32Array(natW * natH).fill(-1);
		const stack = [];
		const verticals = [];
		const horizontals = [];
		const blobs = [];
		// A dimension label, crossing element, or frame drawn over a line breaks it into pieces in the
		// SOURCE drawing itself, not just at render time - confirmed by tracing a real rail column pixel
		// by pixel: small ~2-3px gaps (antialiasing) alongside repeated ~80px (~1m) gaps lining up exactly
		// where label boxes cross it. Raw fragments are merged back below; the length/aspect checks here
		// only filter the tiny corner specks where a vertical and horizontal element nearly touch.
		const minLengthPx = 0.15 * planMeasureState.calibration.pixelsPerMeter;
		for (let start = 0; start < natW * natH; start += 1) {
			if (!mask[start] || labelOf[start] !== -1) continue;
			let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity; let count = 0;
			stack.length = 0;
			stack.push(start);
			labelOf[start] = 1;
			while (stack.length) {
				const p = stack.pop();
				const px = p % natW; const py = (p - px) / natW;
				if (px < x0) x0 = px; if (px > x1) x1 = px;
				if (py < y0) y0 = py; if (py > y1) y1 = py;
				count += 1;
				if (px > 0 && mask[p - 1] && labelOf[p - 1] === -1) { labelOf[p - 1] = 1; stack.push(p - 1); }
				if (px < natW - 1 && mask[p + 1] && labelOf[p + 1] === -1) { labelOf[p + 1] = 1; stack.push(p + 1); }
				if (p - natW >= 0 && mask[p - natW] && labelOf[p - natW] === -1) { labelOf[p - natW] = 1; stack.push(p - natW); }
				if (p + natW < natW * natH && mask[p + natW] && labelOf[p + natW] === -1) { labelOf[p + natW] = 1; stack.push(p + natW); }
			}
			const bw = x1 - x0 + 1; const bh = y1 - y0 + 1;
			const aspect = bh ? bw / bh : 0;
			if (aspect <= 0.35 && bh >= minLengthPx) { verticals.push({ x0, y0, x1: x1 + 1, y1: y1 + 1 }); continue; }
			if (aspect >= 3 && bw >= minLengthPx) { horizontals.push({ x0, y0, x1: x1 + 1, y1: y1 + 1 }); continue; }
			// Not line-shaped - a COMPACT region of this color instead (a window, an équerre bracket, a
			// platine, any discrete item), same "roughly solid, not a stray speck" check the window-opening
			// detector uses: extent close to 1 means the pixels actually fill their own bounding box, ruling
			// out a diagonal scribble or a thin diagonal hatch line that happens to span a square-ish area.
			const extent = count / (bw * bh);
			if (count >= 12 && extent >= 0.55) blobs.push({ x0, y0, x1: x1 + 1, y1: y1 + 1 });
		}
		return {
			verticals: planMeasureMergeCollinearRailSegments(verticals, 'v'),
			horizontals: planMeasureMergeCollinearRailSegments(horizontals, 'h'),
			blobs,
		};
	}
	function planMeasureDetectRegionsOfColor(image, targetColor, tol = 22) {
		const natW = image.naturalWidth;
		const natH = image.naturalHeight;
		if (natW * natH > 60_000_000) return null;
		const offscreen = document.createElement('canvas');
		offscreen.width = natW; offscreen.height = natH;
		const octx = offscreen.getContext('2d', { willReadFrequently: true });
		octx.drawImage(image, 0, 0, natW, natH);
		const { data } = octx.getImageData(0, 0, natW, natH);
		const mask = new Uint8Array(natW * natH);
		for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
			const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
			if (Math.abs(r - targetColor.r) <= tol && Math.abs(g - targetColor.g) <= tol && Math.abs(b - targetColor.b) <= tol) mask[p] = 1;
		}
		return planMeasureClassifyMask(mask, natW, natH);
	}
	function planMeasureDetectRails() {
		if (!planMeasureState?.image || !planMeasureState.calibration) return;
		// Sky blue (~173/221/247) is this one project's own "Ossature L acier galva" convention, sampled by
		// hand from its real legend - kept as a one-click shortcut since it's this app's single most-tested
		// detector, not because every future plan will use the same color (planMeasureDetectCustomColor
		// below is the general answer to that).
		const result = planMeasureDetectRegionsOfColor(planMeasureState.image, { r: 173, g: 221, b: 247 });
		if (!result) { toast('Plan trop grand pour détecter les rails à pleine résolution - tracez-les à la main.'); return; }
		const mergedV = result.verticals.map((box) => ({ ...box, kind: 'rail-v' }));
		const mergedH = result.horizontals.map((box) => ({ ...box, kind: 'rail-h' }));
		planMeasureState.candidates = [...planMeasureState.candidates, ...mergedV, ...mergedH];
		planMeasureSyncToolbar();
		planMeasureRedraw();
		toast(mergedV.length || mergedH.length
			? `${mergedV.length} rail(aux) vertical(aux) + ${mergedH.length} rail(aux) horizontal(aux) détecté(s) - vérifiez avant de confirmer. ⚠ Seule la couleur bleu ciel « Ossature L acier galva » est reconnue - tout autre profilé (plaque pliée, pattes, équerres) doit être tracé à la main.`
			: 'Aucun rail détecté automatiquement sur ce plan (couleur non reconnue) - tracez-les manuellement avec « + Ligne (ml) ».');
	}
	// The general answer to "every plan's legend uses its own colors": the gérant clicks one real instance
	// of the element on the plan (its color is sampled on the spot, not typed or guessed), names it once,
	// and this runs the SAME detection engine as the rails button above against that exact color - so it
	// works on any future plan regardless of which color a particular architect happened to use, with zero
	// risk of misreading a legend's text (no OCR involved at all, deliberately - confirmed today that this
	// project alone already draws its own reference lines two different ways, which is exactly why a
	// read-the-legend-automatically approach would need to be right about an unbounded variety of drawing
	// conventions to be trustworthy, while "the gérant points, the tool matches that exact color" never
	// has to guess what a label means).
	// Shared tail for both ways of picking a color to search for (manual click-and-sample below, or choosing
	// an entry already found by "Pitaj app" / scan-all-colors): replaces any previous custom-color run rather
	// than accumulating, so the review/chain/count actions stay unambiguous (always "the last color picked"),
	// and never silently mixes candidates from two different elements together.
	function planMeasureApplyCustomColorResult(result, label) {
		planMeasureState.candidates = planMeasureState.candidates.filter((box) => box.kind !== 'custom-h' && box.kind !== 'custom-v' && box.kind !== 'custom-blob');
		planMeasureState.customColorLabel = label;
		const mergedV = result.verticals.map((box) => ({ ...box, kind: 'custom-v' }));
		const mergedH = result.horizontals.map((box) => ({ ...box, kind: 'custom-h' }));
		// A compact blob (window, équerre, platine, any discrete item) is reviewed and counted differently
		// from a line (see planMeasureSyncToolbar) - not forced into the horizontal/vertical chain actions,
		// which only make sense for a sequence of positions along one axis.
		const blobs = result.blobs.map((box) => ({ ...box, kind: 'custom-blob' }));
		planMeasureState.candidates = [...planMeasureState.candidates, ...mergedV, ...mergedH, ...blobs];
		planMeasureSyncToolbar();
		planMeasureRedraw();
		const pxPerM = planMeasureState?.calibration?.pixelsPerMeter;
		const parts = [];
		if (mergedV.length) parts.push(`${mergedV.length} vertical(aux) (${planMeasureDescribeLineBoxes(result.verticals, 'v', pxPerM)})`);
		if (mergedH.length) parts.push(`${mergedH.length} horizontal(aux) (${planMeasureDescribeLineBoxes(result.horizontals, 'h', pxPerM)})`);
		if (blobs.length) parts.push(`${blobs.length} élément(s) compact(s) (${planMeasureDescribeBlobBoxes(result.blobs, pxPerM)})`);
		toast(parts.length
			? `« ${label} » : ${parts.join(' + ')} trouvé(s) de cette couleur - vérifiez avant de confirmer.`
			: `Aucune autre occurrence de cette couleur trouvée sur ce plan - c’est peut-être un élément unique, ou le clic est tombé sur un bord antialiasé : réessayez en cliquant plus au centre du trait.`);
	}
	async function planMeasureDetectCustomColor(point) {
		if (!planMeasureState?.image || !planMeasureState.calibration) return;
		const canvas = document.createElement('canvas');
		canvas.width = planMeasureState.image.naturalWidth;
		canvas.height = planMeasureState.image.naturalHeight;
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		ctx.drawImage(planMeasureState.image, 0, 0, canvas.width, canvas.height);
		// Median of a small neighbourhood around the click, not the single pixel under the cursor - a click
		// landing exactly on an antialiased edge would otherwise sample a blended color that matches nothing
		// else on the plan.
		const half = 2;
		const x0 = Math.max(0, Math.round(point.x) - half); const y0 = Math.max(0, Math.round(point.y) - half);
		const w = Math.min(canvas.width - x0, half * 2 + 1); const h = Math.min(canvas.height - y0, half * 2 + 1);
		const { data } = ctx.getImageData(x0, y0, Math.max(1, w), Math.max(1, h));
		const rs = []; const gs = []; const bs = [];
		for (let i = 0; i < data.length; i += 4) { rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]); }
		const median = (arr) => { const sorted = [...arr].sort((a, b2) => a - b2); return sorted[Math.floor(sorted.length / 2)]; };
		const targetColor = { r: median(rs), g: median(gs), b: median(bs) };
		const label = window.prompt('Nom de cet élément (ex. « Recoupement », « Bando », « Couvertine ») - le ton exact cliqué sera recherché partout sur ce plan :', '');
		if (!label?.trim()) return;
		toast(`Recherche de la couleur rgb(${targetColor.r},${targetColor.g},${targetColor.b}) sur tout le plan…`);
		const result = planMeasureDetectRegionsOfColor(planMeasureState.image, targetColor);
		if (!result) { toast('Plan trop grand pour détecter à pleine résolution - tracez à la main.'); return; }
		planMeasureApplyCustomColorResult(result, label.trim());
	}
	// "Pitaj app" (demander à l'app) - instead of the gérant having to already know which single example to
	// click, this decodes the plan once, buckets every color actually used in a meaningful amount (ignoring
	// the white/near-white background and anything too faint to ever form even one minimal line or blob at
	// this plan's own calibrated scale), and runs the exact same classification used for a manually-sampled
	// color on each bucket. The result is only ever "what geometrically exists on this plan, grouped by
	// color" - nothing is guessed about what any of it MEANS. The gérant still looks at the list, picks
	// whichever entries are real (a "Recoupement", a "Bando", a fixation...), and names them before anything
	// is measured or added to the devis - same review step as the manual single-color flow, just offered as
	// a shortcut for someone who wouldn't know where on the plan to click first.
	async function planMeasureScanAllColors() {
		if (!planMeasureState?.image || !planMeasureState.calibration) return;
		const image = planMeasureState.image;
		const natW = image.naturalWidth;
		const natH = image.naturalHeight;
		if (natW * natH > 60_000_000) { toast('Plan trop grand pour analyser toutes les couleurs à pleine résolution - utilisez « Reconnaître une couleur » sur un exemple précis.'); return; }
		const button = document.querySelector('#plan-measure-scan-colors');
		if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
		toast('Analyse de toutes les couleurs du plan en cours…');
		try {
			const offscreen = document.createElement('canvas');
			offscreen.width = natW; offscreen.height = natH;
			const octx = offscreen.getContext('2d', { willReadFrequently: true });
			octx.drawImage(image, 0, 0, natW, natH);
			const { data } = octx.getImageData(0, 0, natW, natH);
			// Quantize to 32-level buckets per channel (8 bits -> 5 bits) so near-identical antialiased shades
			// of the same drawn color collapse into one bucket, without merging genuinely different colors;
			// the near-white background (the plan's paper, not a drawn element) is excluded outright.
			const buckets = new Map();
			for (let i = 0; i < data.length; i += 4) {
				const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
				if (r > 235 && g > 235 && b > 235) continue;
				const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
				const entry = buckets.get(key);
				if (entry) { entry.count += 1; entry.rSum += r; entry.gSum += g; entry.bSum += b; }
				else buckets.set(key, { count: 1, rSum: r, gSum: g, bSum: b });
			}
			// A color with too few pixels can never form even one minimal line/blob at this plan's own scale -
			// skip it outright instead of running a full classification pass (and cluttering the list) for
			// what's almost certainly text or antialiasing noise.
			const minPixels = Math.max(40, 0.15 * planMeasureState.calibration.pixelsPerMeter * 2);
			const topBuckets = [...buckets.values()].filter((entry) => entry.count >= minPixels).sort((a, b) => b.count - a.count).slice(0, 10);
			const results = [];
			for (const entry of topBuckets) {
				const color = { r: Math.round(entry.rSum / entry.count), g: Math.round(entry.gSum / entry.count), b: Math.round(entry.bSum / entry.count) };
				const mask = new Uint8Array(natW * natH);
				for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
					const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
					if (Math.abs(r - color.r) <= 22 && Math.abs(g - color.g) <= 22 && Math.abs(b - color.b) <= 22) mask[p] = 1;
				}
				const classified = planMeasureClassifyMask(mask, natW, natH);
				if (classified.verticals.length + classified.horizontals.length + classified.blobs.length === 0) continue;
				results.push({ color, ...classified });
			}
			planMeasureState.colorScanResults = results;
			// Alongside the color/shape scan above (pure geometry), also pull whatever the plan's own PDF
			// text already says - never OCR, never a guess: if this document has no real text layer (a scan/
			// photo), the endpoint itself returns nothing rather than inventing anything. Both are shown
			// together as "everything the app can tell you about this plan without you pointing at it".
			try {
				const textResult = await request(`/documents/${planMeasureState.documentId}/plan-text-callouts`);
				planMeasureState.textCallouts = textResult.callouts || [];
				planMeasureState.textOpenItems = textResult.openItems || [];
			} catch { planMeasureState.textCallouts = []; planMeasureState.textOpenItems = []; }
			// A "carnet de détails" style multi-page plan (one construction detail per page) reads as a real
			// index of what each page actually says - see extractPlanDetailIndex server-side for why this
			// never guesses which page a code/title/note belongs to.
			try {
				const detailResult = await request(`/documents/${planMeasureState.documentId}/plan-detail-index`);
				planMeasureState.textDetailIndex = detailResult.entries || [];
			} catch { planMeasureState.textDetailIndex = []; }
			planMeasureRenderColorScan();
			const textNote = planMeasureState.textOpenItems.length ? ` ⚠ ${planMeasureState.textOpenItems.length} élément(s) non finalisé(s) trouvé(s) dans le texte du plan.` : '';
			toast((results.length
				? `${results.length} couleur(s) avec des lignes/éléments reconnaissables trouvée(s) - choisissez laquelle utiliser ci-dessous.`
				: 'Aucune couleur avec des lignes ou éléments nets trouvée sur ce plan - utilisez « Reconnaître une couleur » en cliquant un exemple précis.') + textNote);
		} finally { if (button) { button.disabled = false; button.removeAttribute('aria-busy'); } }
	}
	function planMeasureRenderColorScan() {
		const box = document.querySelector('#plan-measure-color-scan');
		if (!box) return;
		const results = planMeasureState?.colorScanResults || [];
		const pxPerM = planMeasureState?.calibration?.pixelsPerMeter;
		const openItems = planMeasureState?.textOpenItems || [];
		const callouts = planMeasureState?.textCallouts || [];
		const detailIndex = planMeasureState?.textDetailIndex || [];
		const openItemsHtml = openItems.length
			? `<strong>⚠ Éléments non finalisés (texte du plan)</strong><div class="plan-measure-color-scan-list">${openItems.map((line) => `<span class="plan-measure-color-scan-entry">${escapeHtml(line)}</span>`).join('')}</div>`
			: '';
		// One entry per page of a "carnet de détails" style plan, under whatever code/title that SAME page
		// already prints - never guessed, never reordered (see extractPlanDetailIndex server-side).
		const detailIndexHtml = detailIndex.length
			? `<strong>Index des détails de ce plan (texte du plan)</strong><div class="plan-measure-color-scan-list">${detailIndex.map((entry) => {
				const heading = [entry.code, entry.title].filter(Boolean).join(' — ') || `Page ${entry.page}`;
				const notesHtml = entry.notes.length ? `<ul>${entry.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` : '';
				return `<span class="plan-measure-color-scan-entry plan-measure-detail-entry"><strong>${escapeHtml(heading)}</strong> <small>(p.${entry.page})</small>${notesHtml}</span>`;
			}).join('')}</div>`
			: '';
		// Raw text found on the plan, exactly as printed - never paired back to a product name (see
		// extractPlanTextCallouts for why), so labeled as an index to cross-check against the drawing, not
		// a parsed materials list.
		const calloutsHtml = callouts.length
			? `<strong>Texte technique trouvé sur ce plan (à vérifier sur le dessin)</strong><div class="plan-measure-color-scan-list">${callouts.map((entry) => `<span class="plan-measure-color-scan-entry">${escapeHtml(entry.text)}${entry.count > 1 ? ` <small>(×${entry.count})</small>` : ''}</span>`).join('')}</div>`
			: '';
		const colorsHtml = results.length
			? `<strong>Couleurs trouvées sur ce plan</strong><div class="plan-measure-color-scan-list">${results.map((entry, index) => {
				const { color, verticals, horizontals, blobs } = entry;
				const parts = [];
				if (verticals.length) parts.push(`${verticals.length} vertical(aux) (${planMeasureDescribeLineBoxes(verticals, 'v', pxPerM)})`);
				if (horizontals.length) parts.push(`${horizontals.length} horizontal(aux) (${planMeasureDescribeLineBoxes(horizontals, 'h', pxPerM)})`);
				if (blobs.length) parts.push(`${blobs.length} élément(s) compact(s) (${planMeasureDescribeBlobBoxes(blobs, pxPerM)})`);
				return `<span class="plan-measure-color-scan-entry"><span class="plan-measure-color-swatch" style="background:rgb(${color.r},${color.g},${color.b})"></span><span>${parts.join(', ')}</span><button type="button" class="secondary" data-color-scan-choose="${index}">Choisir</button></span>`;
			}).join('')}</div>`
			: '';
		box.hidden = results.length === 0 && openItems.length === 0 && callouts.length === 0 && detailIndex.length === 0;
		box.innerHTML = openItemsHtml + colorsHtml + calloutsHtml + detailIndexHtml;
	}
	function planMeasureChooseColorScanResult(index) {
		const entry = planMeasureState?.colorScanResults?.[index];
		if (!entry) return;
		const label = window.prompt('Nom de cet élément (ex. « Recoupement », « Bando », « Couvertine ») :', '');
		if (!label?.trim()) return;
		planMeasureApplyCustomColorResult(entry, label.trim());
	}
	// Bridges a rail's own real breaks (label boxes, crossing elements drawn over it in the source plan)
	// back into one candidate per physical rail run, without bridging two genuinely different rails
	// together - the gap check only ever compares segments already confirmed collinear (same column for a
	// vertical rail, same row for a horizontal one), so two separate rails in different columns/rows can
	// never merge with each other regardless of this threshold. 1.2m comfortably covers the ~1m recurring
	// gaps measured by hand on the real plan while staying far short of a typical floor height, so it can't
	// bridge two rails that are genuinely separate pieces either side of a floor break.
	function planMeasureMergeCollinearRailSegments(boxes, axis) {
		const pixelsPerMeter = planMeasureState.calibration.pixelsPerMeter;
		const gapPx = 1.2 * pixelsPerMeter;
		const bandTolPx = Math.max(3, 0.03 * pixelsPerMeter);
		let list = boxes.map((box) => ({ ...box, parts: 1 }));
		let changed = true;
		while (changed) {
			changed = false;
			outer: for (let i = 0; i < list.length; i += 1) {
				const a = list[i];
				if (!a) continue;
				for (let j = i + 1; j < list.length; j += 1) {
					const c = list[j];
					if (!c) continue;
					// Caps how many fragments one candidate can absorb - a real rail realistically crosses a
					// handful of labels/crossings per floor, never dozens; stops a pathological run of tiny
					// specks from chaining into one implausibly long candidate.
					if (a.parts + c.parts > 8) continue;
					const sameBand = axis === 'v'
						? Math.abs(a.x0 - c.x0) <= bandTolPx && Math.abs(a.x1 - c.x1) <= bandTolPx
						: Math.abs(a.y0 - c.y0) <= bandTolPx && Math.abs(a.y1 - c.y1) <= bandTolPx;
					if (!sameBand) continue;
					const gap = axis === 'v' ? Math.max(c.y0 - a.y1, a.y0 - c.y1) : Math.max(c.x0 - a.x1, a.x0 - c.x1);
					if (gap > gapPx) continue;
					a.x0 = Math.min(a.x0, c.x0); a.y0 = Math.min(a.y0, c.y0);
					a.x1 = Math.max(a.x1, c.x1); a.y1 = Math.max(a.y1, c.y1);
					a.parts += c.parts;
					list[j] = null;
					changed = true;
					break outer;
				}
			}
			list = list.filter(Boolean);
		}
		// A merged run longer than this is implausible for one physical rail piece on a residential/mid-rise
		// facade (would span many floors uninterrupted) - rather than guess which part of such a chain is
		// real, it's dropped from auto-detection entirely so nothing implausible is ever silently presented
		// as one measurement; trace it by hand in sections with "+ Ligne (ml)" instead.
		const maxSpanPx = 20 * pixelsPerMeter;
		// `parts` is kept on the returned box (not stripped) - a value >1 means this run was reconstructed
		// from more than one raw fragment, i.e. it was genuinely broken/dashed in the source drawing, not
		// drawn as one continuous line. Callers that describe a detection result to the gérant (the scan-all
		// list, a manual color pick's toast) read it to report that honestly instead of staying silent on it.
		return list.filter((box) => (axis === 'v' ? box.y1 - box.y0 : box.x1 - box.x0) <= maxSpanPx);
	}
	// Turns a set of detected line boxes into a short, honest physical description - average thickness in
	// mm (computed straight from the calibrated scale, never a visual guess) and whether the run was
	// continuous or reconstructed from dashes/gaps in the source drawing. Purely descriptive: it never
	// renames or reclassifies anything, just tells the gérant what the geometry itself already shows.
	function planMeasureDescribeLineBoxes(boxes, axis, pixelsPerMeter) {
		if (!boxes.length || !pixelsPerMeter) return '';
		const thicknessesMm = boxes.map((box) => ((axis === 'v' ? box.x1 - box.x0 : box.y1 - box.y0) / pixelsPerMeter) * 1000);
		const avgThicknessMm = thicknessesMm.reduce((sum, v) => sum + v, 0) / thicknessesMm.length;
		const dashedCount = boxes.filter((box) => (box.parts || 1) > 1).length;
		const dashedNote = dashedCount === 0 ? 'trait continu' : dashedCount === boxes.length ? 'en pointillés' : `${dashedCount}/${boxes.length} en pointillés`;
		return `~${avgThicknessMm.toFixed(1)}mm, ${dashedNote}`;
	}
	// Same idea for compact "blob" shapes (not lines) - an average physical size in cm instead of a
	// thickness/dashed note, since those concepts don't apply to a discrete item.
	function planMeasureDescribeBlobBoxes(boxes, pixelsPerMeter) {
		if (!boxes.length || !pixelsPerMeter) return '';
		const sizesCm = boxes.map((box) => ({ w: ((box.x1 - box.x0) / pixelsPerMeter) * 100, h: ((box.y1 - box.y0) / pixelsPerMeter) * 100 }));
		const avgW = sizesCm.reduce((sum, s) => sum + s.w, 0) / sizesCm.length;
		const avgH = sizesCm.reduce((sum, s) => sum + s.h, 0) / sizesCm.length;
		return `~${avgW.toFixed(1)}×${avgH.toFixed(1)}cm`;
	}
	async function planMeasureConfirmCandidates() {
		const openingBoxes = (planMeasureState?.candidates || []).filter((box) => box.kind === 'opening');
		if (!openingBoxes.length) return;
		const button = document.querySelector('#plan-measure-candidates-confirm');
		if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
		try {
			let index = 0;
			for (const box of openingBoxes) {
				index += 1;
				// Each candidate is resolved against its OWN center point, not the currently active zone - a
				// plan with multiple delimited zones (e.g. façade + pignon) can have detected candidates in
				// both at once, and confirming them all in one click must still apply the right scale to each.
				const center = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
				const zone = planMeasureZoneForPoint(center) || planMeasureState.calibration;
				const points = [{ x: box.x0, y: box.y0 }, { x: box.x1, y: box.y0 }, { x: box.x1, y: box.y1 }, { x: box.x0, y: box.y1 }];
				// The real width/height in meters comes straight from the calibrated px/m ratio, exactly like
				// every other measurement in this tool - not a guess, so it's safe to put in the label.
				const widthM = (box.x1 - box.x0) / zone.pixelsPerMeter;
				const heightM = (box.y1 - box.y0) / zone.pixelsPerMeter;
				const zoneNote = zone.label ? ` (${zone.label})` : '';
				const label = `Ouverture détectée #${index} — ${widthM.toFixed(2)}×${heightM.toFixed(2)} m${zoneNote}`;
				try {
					const measurement = await request(`/documents/${planMeasureState.documentId}/measurements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'polygon', role: 'opening', label, points, repeatCount: 1, calibrationId: zone.id }) });
					planMeasureState.measurements.push(measurement);
				} catch { /* one failed candidate must not stop the rest from being confirmed */ }
			}
			planMeasureState.candidates = planMeasureState.candidates.filter((box) => box.kind !== 'opening');
			planMeasureRenderList();
			planMeasureSyncToolbar();
			planMeasureRedraw();
			toast('Ouvertures confirmées et ajoutées au métré.');
		} finally {
			if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
		}
	}
	// Splits a sequence of points into one line measurement PER CONSECUTIVE PAIR, each resolved against its
	// OWN zone (not one shared calibration) so a chain that happens to cross a delimited zone boundary - a
	// façade's recoupement run continuing past a pignon's different scale, say - still gets every segment
	// right. Shared by the manual "+ Chaîne de segments" tool and by confirming an auto-detected custom-color
	// run (planMeasureDetectCustomColor) - same output shape either way, because splitting a click sequence
	// into segments and splitting a sorted detection list into segments are the same operation.
	async function planMeasureCreateChainSegments(points, startLabel, segLabel) {
		let created = 0; let failed = 0;
		for (let i = 0; i < points.length - 1; i += 1) {
			const fromLabel = i === 0 ? startLabel : `${segLabel} ${i}`;
			const toLabel = `${segLabel} ${i + 1}`;
			const segmentPoints = [points[i], points[i + 1]];
			const center = { x: (segmentPoints[0].x + segmentPoints[1].x) / 2, y: (segmentPoints[0].y + segmentPoints[1].y) / 2 };
			const zone = planMeasureZoneForPoint(center) || planMeasureState.calibration;
			// Computed from the RESOLVED zone's own scale, not the generic planMeasureLengthM helper (which
			// always reads the currently active zone) - on a plan with more than one calibrated scale, those
			// two can differ, and showing a label that doesn't match what the server actually stored would be
			// exactly the kind of silent, hard-to-notice wrong number this tool exists to prevent.
			const lengthM = Math.hypot(segmentPoints[1].x - segmentPoints[0].x, segmentPoints[1].y - segmentPoints[0].y) / zone.pixelsPerMeter;
			const label = `${fromLabel} → ${toLabel} (${lengthM.toFixed(2)} ml)`;
			try {
				const measurement = await request(`/documents/${planMeasureState.documentId}/measurements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'line', role: 'surface', label, points: segmentPoints, repeatCount: 1, calibrationId: zone.id }) });
				planMeasureState.measurements.push(measurement);
				created += 1;
			} catch { failed += 1; }
		}
		return { created, failed };
	}
	// A rail candidate is only a couple of pixels thick on screen - too thin to click-to-reject one at a
	// time among what's routinely hundreds of them across a whole facade (538 verticals + 582 horizontals,
	// measured on a real plan). So unlike an opening (confirmed individually, each a genuinely distinct
	// real-world item), rails are reviewed as a SUM: the dashed overlay on the canvas IS the review (does
	// the pattern of lines look right across the facade), and this adds ONE devis line with the total
	// length for the chosen orientation - never hundreds of line items nobody would scroll through anyway.
	async function planMeasureAddRailTotalToDevis(kind) {
		const boxes = (planMeasureState?.candidates || []).filter((box) => box.kind === kind);
		if (!boxes.length) return;
		const button = document.querySelector(kind === 'rail-v' ? '#plan-measure-candidates-rails-v' : '#plan-measure-candidates-rails-h');
		if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
		try {
			// Each box is resolved against its OWN center point (same reasoning as an opening candidate) so a
			// plan with multiple delimited zones still applies the right scale to every segment before summing.
			const totalM = boxes.reduce((sum, box) => {
				const center = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
				const zone = planMeasureZoneForPoint(center) || planMeasureState.calibration;
				return sum + (kind === 'rail-v' ? box.y1 - box.y0 : box.x1 - box.x0) / zone.pixelsPerMeter;
			}, 0);
			const orientationLabel = kind === 'rail-v' ? 'Ossature L acier galva verticale' : 'Ossature L acier galva horizontale';
			const matchDescription = orientationLabel;
			if (!(await planMeasureConfirmAgainstExistingLineItem(matchDescription, Number(totalM.toFixed(2)), 'ml'))) return;
			const unitPrice = await planMeasureResolveLineItemPrice(matchDescription, 'ml');
			const category = planMeasureState.planType === 'existant' ? 'Démolition (plan existant)' : planMeasureState.planType === 'nouveau' ? 'Construction neuve (plan nouveau)' : 'Mesures du plan';
			const description = `${matchDescription} — ${planMeasureState.originalName || 'plan'} : ${boxes.length} segment(s) détecté(s), ${totalM.toFixed(2)} ml au total`;
			await request(`/projects/${planMeasureState.projectId}/budget/line-items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ description, quantity: Number(totalM.toFixed(2)), unit: 'ml', unitPrice, lineTotal: Number((totalM * unitPrice).toFixed(2)), category }], source: 'plan-measure' }) });
			planMeasureState.candidates = planMeasureState.candidates.filter((box) => box.kind !== kind);
			planMeasureSyncToolbar();
			planMeasureRedraw();
			toast(`${orientationLabel} (${totalM.toFixed(2)} ml) ajouté au devis.`);
		} catch { toast('Ligne de devis non ajoutée.'); }
		finally { if (button) { button.disabled = false; button.removeAttribute('aria-busy'); } }
	}
	// A custom-color chain works exactly like the manual "+ Chaîne de segments" tool, except the point
	// sequence comes from auto-detected same-color regions instead of clicks. Sorted along the axis the
	// elements actually run across - left to right for a row of vertical elements (e.g. "bando" boundaries
	// spaced across a facade), top to bottom for a column of horizontal elements (e.g. "recoupement" lines
	// stacked one per floor) - since that is the only reading order the gérant could mean by "the next one
	// along the facade / up the building". Exact geometry of what was detected either way; this only changes
	// how the same detected boxes get split into segments, same as the manual chain tool.
	async function planMeasureConfirmCustomChain(kind) {
		const boxes = (planMeasureState?.candidates || []).filter((box) => box.kind === kind);
		if (boxes.length < 2) return;
		const button = document.querySelector(kind === 'custom-v' ? '#plan-measure-candidates-custom-chain-v' : '#plan-measure-candidates-custom-chain-h');
		if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
		try {
			const centered = boxes.map((box) => ({ x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 }));
			centered.sort((a, b) => (kind === 'custom-v' ? a.x - b.x : a.y - b.y));
			const segLabel = planMeasureState.customColorLabel || 'Point';
			const { created, failed } = await planMeasureCreateChainSegments(centered, `${segLabel} 0`, segLabel);
			planMeasureState.candidates = planMeasureState.candidates.filter((box) => box.kind !== kind);
			planMeasureRenderList();
			planMeasureSyncToolbar();
			planMeasureRedraw();
			toast(failed ? `${created} segment(s) enregistré(s), ${failed} échoué(s).` : `${created} segment(s) « ${segLabel} » enregistrés.`);
		} finally { if (button) { button.disabled = false; button.removeAttribute('aria-busy'); } }
	}
	// A compact "blob" candidate (a discrete item like a bracket, plate or fixing - as opposed to a line) is
	// counted and added to the devis as a quantity, same one-line-item-for-many-instances reasoning as the
	// rail totals above: a real facade can have dozens of these and nobody would want one devis line per
	// instance confirmed by hand.
	async function planMeasureAddCustomBlobToDevis() {
		const boxes = (planMeasureState?.candidates || []).filter((box) => box.kind === 'custom-blob');
		if (!boxes.length) return;
		const button = document.querySelector('#plan-measure-candidates-custom-blob');
		if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
		try {
			const matchDescription = planMeasureState.customColorLabel || 'Élément';
			if (!(await planMeasureConfirmAgainstExistingLineItem(matchDescription, boxes.length, 'unité'))) return;
			const unitPrice = await planMeasureResolveLineItemPrice(matchDescription, 'unité');
			const category = planMeasureState.planType === 'existant' ? 'Démolition (plan existant)' : planMeasureState.planType === 'nouveau' ? 'Construction neuve (plan nouveau)' : 'Mesures du plan';
			const description = `${matchDescription} — ${planMeasureState.originalName || 'plan'} : ${boxes.length} détecté(s)`;
			await request(`/projects/${planMeasureState.projectId}/budget/line-items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ description, quantity: boxes.length, unit: 'unité', unitPrice, lineTotal: Number((boxes.length * unitPrice).toFixed(2)), category }], source: 'plan-measure' }) });
			planMeasureState.candidates = planMeasureState.candidates.filter((box) => box.kind !== 'custom-blob');
			planMeasureSyncToolbar();
			planMeasureRedraw();
			toast(`${matchDescription} (${boxes.length} unité(s)) ajouté au devis.`);
		} catch { toast('Ligne de devis non ajoutée.'); }
		finally { if (button) { button.disabled = false; button.removeAttribute('aria-busy'); } }
	}
	function planMeasureApplyZoom(newScale) {
		if (!planMeasureState?.image) return;
		const canvas = document.querySelector('#plan-measure-canvas');
		if (!canvas) return;
		// Capped at 8x the "fit to screen" size - enough to place a precise point on a phone without
		// letting the canvas balloon to an unusable size on a very small source image.
		const clamped = Math.max(planMeasureState.baseScale, Math.min(planMeasureState.baseScale * 8, newScale));
		planMeasureState.scale = clamped;
		const size = planMeasureCanvasSize();
		canvas.width = size.width;
		canvas.height = size.height;
		const zoomLabel = document.querySelector('#plan-measure-zoom-level');
		if (zoomLabel) zoomLabel.textContent = `${Math.round(clamped * 100)}%`;
		planMeasureRedraw();
	}
	// Rotates the view 90° at a time (cycling 0->90->180->270->0) and re-fits it to the available screen
	// space in the new orientation - a plan exported sideways (common with large-format A0/A1 PDFs) can be
	// turned upright before calibrating/measuring. Nothing about the stored calibration or measurements
	// ever changes here: only the view transform does, so work done before a rotation stays exactly correct.
	function planMeasureRotate() {
		if (!planMeasureState?.image) return;
		planMeasureState.rotation = (planMeasureState.rotation + 90) % 360;
		const canvasWrap = document.querySelector('.plan-measure-canvas-wrap');
		const maxWidth = canvasWrap?.clientWidth || 900;
		const maxHeight = canvasWrap?.clientHeight || 600;
		const swapped = planMeasureState.rotation === 90 || planMeasureState.rotation === 270;
		const effectiveWidth = swapped ? planMeasureState.image.naturalHeight : planMeasureState.image.naturalWidth;
		const effectiveHeight = swapped ? planMeasureState.image.naturalWidth : planMeasureState.image.naturalHeight;
		planMeasureState.baseScale = Math.min(maxWidth / effectiveWidth, maxHeight / effectiveHeight);
		planMeasureApplyZoom(planMeasureState.baseScale);
	}
	function planMeasureUndoLastPoint() {
		if (!planMeasureState || !planMeasureState.drawPoints.length) return;
		planMeasureState.drawPoints.pop();
		planMeasureUpdateStatus();
		planMeasureRedraw();
	}
	// Catches a devis (often a competitor's, uploaded via the Excel/PDF devis import) quoting a lower
	// quantity for the same item than the app's own exact, calibrated plan measurement - the real-world
	// case this check exists for is a larger firm under-quoting m²/ml/unité to look cheaper than a small
	// firm, then cutting corners or billing extras later. Matched by description because there's no
	// reliable automatic link between a free-text devis line and a traced shape; the user names their
	// measurement to match the line they're verifying. Never blocks silently - on any failure to check
	// (e.g. no devis exists yet), it fails OPEN (lets the add through) rather than silently failing closed,
	// since this is a secondary safety net, not the only way to add a measurement to the devis.
	async function planMeasureConfirmAgainstExistingLineItem(description, quantity, unit) {
		const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s*\(×\d+\)\s*$/, '');
		try {
			const items = await request(`/projects/${planMeasureState.projectId}/budget/line-items`);
			const target = normalize(description);
			const match = items.find((item) => normalize(item.description) === target);
			if (!match) return true;
			const existingQty = Number(match.quantity) || 0;
			const diff = quantity - existingQty;
			if (Math.abs(diff) < 0.01) return true;
			// Spelled out explicitly (never "X de moins/de plus" attached to "votre mesure", which reads
			// ambiguously about which number is bigger) - the case this exists for is a subcontracted
			// devis under-quoting the real quantity, so when THAT is what's happening it says so plainly.
			const warning = diff > 0
				? `⚠ La ligne du devis (${existingQty.toFixed(2)} ${match.unit}) est INFÉRIEURE de ${diff.toFixed(2)} ${unit} à la mesure réelle du plan (${quantity.toFixed(2)} ${unit}).`
				: `La ligne du devis (${existingQty.toFixed(2)} ${match.unit}) est supérieure de ${Math.abs(diff).toFixed(2)} ${unit} à la mesure réelle du plan (${quantity.toFixed(2)} ${unit}).`;
			// If that devis line's own number came from AI reading a PDF/photo (not a deterministic Excel
			// cell), say so here too - a wrong AI digit could otherwise look like a real discrepancy (or
			// hide a real one), and this is exactly the moment that number is being relied on to accuse
			// someone of under-quoting, so it must never be presented as equally certain as a plan measurement.
			const sourceNote = match.source === 'ai' ? '\n⚠ Cette ligne du devis a été lue par IA depuis un PDF/photo - vérifiez le chiffre sur le document original avant de conclure.' : '';
			return window.confirm(`Une ligne « ${match.description} » existe déjà dans ce devis.\n${warning}${sourceNote}\nAjouter quand même une nouvelle ligne avec la mesure du plan ?`);
		} catch {
			return true;
		}
	}
	// Suggests a unit price from the company's own past devis - never invented, never from another
	// company, and matched on the exact description only (so "fourniture et pose" never suggests a
	// "pose"-only price or vice versa, a 4x-scale mistake for the same-sounding item). Always a prompt
	// the gérant confirms or edits, never silently applied - a historical price is a reminder, not a
	// guarantee, since real prices move with materials/labor cost over time in a way a measurement never does.
	async function planMeasureResolveLineItemPrice(description, unit) {
		try {
			const suggestion = await request(`/price-catalog/suggest?description=${encodeURIComponent(description)}`);
			if (!suggestion.found) return 0;
			const dateLabel = suggestion.date ? new Date(suggestion.date).toLocaleDateString('fr-FR') : '';
			const entered = window.prompt(`Dernier prix connu pour « ${suggestion.description} » : ${Number(suggestion.unitPrice).toFixed(2)} €/${suggestion.unit} (${suggestion.projectName}${dateLabel ? ' · ' + dateLabel : ''}).\nPrix unitaire à utiliser (€), laissez vide pour ne pas en mettre :`, Number(suggestion.unitPrice).toFixed(2));
			if (entered === null) return 0;
			const parsed = Number(entered);
			return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
		} catch {
			return 0;
		}
	}
	function planMeasureRenderList() {
		const totals = document.querySelector('#plan-measure-totals');
		const list = document.querySelector('#plan-measure-list');
		if (!totals || !list) return;
		// repeatCount lets one traced shape stand in for several identical copies (e.g. 5 identical
		// windows) - every total below uses value*repeatCount ("effective" value), never the raw traced
		// value alone, so a repeated opening is never silently under-counted.
		const effective = (item) => item.value * (item.repeatCount || 1);
		const totalMl = planMeasureState.measurements.filter((item) => item.unit === 'ml').reduce((sum, item) => sum + effective(item), 0);
		const surfaces = planMeasureState.measurements.filter((item) => item.unit === 'm2' && item.role !== 'opening');
		const openings = planMeasureState.measurements.filter((item) => item.unit === 'm2' && item.role === 'opening');
		const totalGrossM2 = surfaces.reduce((sum, item) => sum + effective(item), 0);
		const totalOpeningsM2 = openings.reduce((sum, item) => sum + effective(item), 0);
		const totalNetM2 = Math.max(0, totalGrossM2 - totalOpeningsM2);
		// A window/door isn't only "m² to deduct" - it's also usually its own billable item: supplied and
		// installed per piece (unité), and/or sealed/trimmed around its perimeter (ml). Both are offered
		// as one-click aggregates so the user never has to add each opening to the devis individually.
		const openingsCount = openings.reduce((sum, item) => sum + (item.repeatCount || 1), 0);
		const openingsPerimeterMl = openings.reduce((sum, item) => sum + (item.perimeterM || 0) * (item.repeatCount || 1), 0);
		totals.innerHTML = `<span>Total : ${totalMl.toFixed(2)} ml</span><span>Total brut : ${totalGrossM2.toFixed(2)} m²</span>${openings.length ? `<span>Ouvertures à déduire : −${totalOpeningsM2.toFixed(2)} m²</span><span><strong>Total net : ${totalNetM2.toFixed(2)} m²</strong></span><button type="button" class="secondary add-net-total-to-devis">Ajouter le total net au devis</button><span>Ouvertures : ${openingsCount} unité · pourtour ${openingsPerimeterMl.toFixed(2)} ml</span><button type="button" class="secondary add-openings-unit-to-devis">Ajouter ouvertures (unité)</button><button type="button" class="secondary add-openings-ml-to-devis">Ajouter pourtour ouvertures (ml)</button>` : ''}`;
		list.innerHTML = planMeasureState.measurements.length ? planMeasureState.measurements.map((item) => {
			const isOpening = item.role === 'opening';
			const sign = isOpening ? '− ' : '';
			const repeatTag = item.repeatCount > 1 ? ` <span class="production-method-tag">×${item.repeatCount}</span>` : '';
			const effectiveValue = effective(item);
			const perUnit = item.repeatCount > 1 ? ` (1× = ${item.value.toFixed(2)})` : '';
			const detail = item.unit === 'm2'
				? `${sign}${effectiveValue.toFixed(2)} m²${perUnit}${Number.isFinite(item.perimeterM) ? ` · pourtour ${(item.perimeterM * (item.repeatCount || 1)).toFixed(2)} ml` : ''}`
				: `${effectiveValue.toFixed(2)} ml${perUnit}`;
			return `<div class="list-item"><strong>${escapeHtml(item.label)}${repeatTag}${isOpening ? ' <span class="production-method-tag plan-type-existant-tag">Ouverture (déduite)</span>' : ''}</strong><small>${detail}</small><div>${isOpening ? '' : `<button type="button" class="secondary add-measurement-to-devis" data-measurement="${item.id}">Ajouter au devis</button>`}<button type="button" class="secondary danger delete-measurement" data-measurement="${item.id}">Supprimer</button></div></div>`;
		}).join('') : '<small>Aucune mesure pour ce plan.</small>';
		list.querySelectorAll('.delete-measurement').forEach((button) => button.addEventListener('click', async () => {
			button.disabled = true;
			try { await request(`/measurements/${button.dataset.measurement}`, { method: 'DELETE' }); planMeasureState.measurements = planMeasureState.measurements.filter((item) => item.id !== button.dataset.measurement); planMeasureRenderList(); planMeasureRedraw(); }
			catch { toast('Mesure non supprimée.'); button.disabled = false; }
		}));
		list.querySelectorAll('.add-measurement-to-devis').forEach((button) => button.addEventListener('click', async () => {
			const item = planMeasureState.measurements.find((entry) => entry.id === button.dataset.measurement);
			if (!item) return;
			const description = item.repeatCount > 1 ? `${item.label} (×${item.repeatCount})` : item.label;
			const unit = item.unit === 'm2' ? 'm²' : 'ml';
			const quantity = Number(effective(item).toFixed(2));
			if (!(await planMeasureConfirmAgainstExistingLineItem(description, quantity, unit))) return;
			const unitPrice = await planMeasureResolveLineItemPrice(description, unit);
			button.disabled = true; button.setAttribute('aria-busy', 'true');
			const category = planMeasureState.planType === 'existant' ? 'Démolition (plan existant)' : planMeasureState.planType === 'nouveau' ? 'Construction neuve (plan nouveau)' : 'Mesures du plan';
			try {
				await request(`/projects/${planMeasureState.projectId}/budget/line-items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ description, quantity, unit, unitPrice, lineTotal: Number((quantity * unitPrice).toFixed(2)), category }], source: 'plan-measure' }) });
				toast('Ligne ajoutée au devis.');
			} catch { toast('Ligne de devis non ajoutée.'); }
			finally { button.disabled = false; button.removeAttribute('aria-busy'); }
		}));
		// The description passed to planMeasureConfirmAgainstExistingLineItem must stay the plain, stable
		// phrase below - it's what lets a future addition recognize "this is the same kind of line" as an
		// existing devis entry (including one written by a subcontractor, to catch them under-quoting). The
		// actual created item then gets a MORE DETAILED description (which plan, zone, and the gross/net
		// breakdown) so re-reading the devis later actually explains what the number is, without breaking
		// that matching.
		totals.querySelector('.add-net-total-to-devis')?.addEventListener('click', async (event) => {
			const button = event.currentTarget;
			const matchDescription = 'Surface nette (ouvertures déduites)';
			const quantity = Number(totalNetM2.toFixed(2));
			if (!(await planMeasureConfirmAgainstExistingLineItem(matchDescription, quantity, 'm²'))) return;
			const unitPrice = await planMeasureResolveLineItemPrice(matchDescription, 'm²');
			button.disabled = true; button.setAttribute('aria-busy', 'true');
			const category = planMeasureState.planType === 'existant' ? 'Démolition (plan existant)' : planMeasureState.planType === 'nouveau' ? 'Construction neuve (plan nouveau)' : 'Mesures du plan';
			const zoneNote = planMeasureState.calibration?.label ? `, zone « ${planMeasureState.calibration.label} »` : '';
			const description = `${matchDescription} — ${planMeasureState.originalName || 'plan'}${zoneNote} : ${totalGrossM2.toFixed(2)} m² brut − ${totalOpeningsM2.toFixed(2)} m² ouvertures (${openingsCount}) = ${totalNetM2.toFixed(2)} m² net`;
			try {
				await request(`/projects/${planMeasureState.projectId}/budget/line-items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ description, quantity, unit: 'm²', unitPrice, lineTotal: Number((quantity * unitPrice).toFixed(2)), category }], source: 'plan-measure' }) });
				toast('Total net ajouté au devis.');
			} catch { toast('Ligne de devis non ajoutée.'); }
			finally { button.disabled = false; button.removeAttribute('aria-busy'); }
		});
		totals.querySelector('.add-openings-unit-to-devis')?.addEventListener('click', async (event) => {
			const button = event.currentTarget;
			const matchDescription = 'Ouvertures (fenêtres/portes) - fourniture et pose';
			if (!(await planMeasureConfirmAgainstExistingLineItem(matchDescription, openingsCount, 'unité'))) return;
			const unitPrice = await planMeasureResolveLineItemPrice(matchDescription, 'unité');
			button.disabled = true; button.setAttribute('aria-busy', 'true');
			const category = planMeasureState.planType === 'existant' ? 'Démolition (plan existant)' : planMeasureState.planType === 'nouveau' ? 'Construction neuve (plan nouveau)' : 'Mesures du plan';
			const zoneNote = planMeasureState.calibration?.label ? `, zone « ${planMeasureState.calibration.label} »` : '';
			const description = `${matchDescription} — ${planMeasureState.originalName || 'plan'}${zoneNote} : ${openingsCount} unité(s), pourtour total ${openingsPerimeterMl.toFixed(2)} ml`;
			try {
				await request(`/projects/${planMeasureState.projectId}/budget/line-items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ description, quantity: openingsCount, unit: 'unité', unitPrice, lineTotal: Number((openingsCount * unitPrice).toFixed(2)), category }], source: 'plan-measure' }) });
				toast('Ouvertures (unité) ajoutées au devis.');
			} catch { toast('Ligne de devis non ajoutée.'); }
			finally { button.disabled = false; button.removeAttribute('aria-busy'); }
		});
		totals.querySelector('.add-openings-ml-to-devis')?.addEventListener('click', async (event) => {
			const button = event.currentTarget;
			const matchDescription = 'Pourtour ouvertures (étanchéité/finition)';
			const quantity = Number(openingsPerimeterMl.toFixed(2));
			if (!(await planMeasureConfirmAgainstExistingLineItem(matchDescription, quantity, 'ml'))) return;
			const unitPrice = await planMeasureResolveLineItemPrice(matchDescription, 'ml');
			button.disabled = true; button.setAttribute('aria-busy', 'true');
			const category = planMeasureState.planType === 'existant' ? 'Démolition (plan existant)' : planMeasureState.planType === 'nouveau' ? 'Construction neuve (plan nouveau)' : 'Mesures du plan';
			const zoneNote = planMeasureState.calibration?.label ? `, zone « ${planMeasureState.calibration.label} »` : '';
			const description = `${matchDescription} — ${planMeasureState.originalName || 'plan'}${zoneNote} : ${openingsCount} ouverture(s)`;
			try {
				await request(`/projects/${planMeasureState.projectId}/budget/line-items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ description, quantity, unit: 'ml', unitPrice, lineTotal: Number((quantity * unitPrice).toFixed(2)), category }], source: 'plan-measure' }) });
				toast('Pourtour ouvertures (ml) ajouté au devis.');
			} catch { toast('Ligne de devis non ajoutée.'); }
			finally { button.disabled = false; button.removeAttribute('aria-busy'); }
		});
	}
	function planMeasureSetMode(mode, role = 'surface') {
		// Drawing without a calibration would only ever produce 0.00 (planMeasureLengthM/AreaM2 refuse to
		// guess a px/m ratio that doesn't exist yet) - block entering that mode at all instead of letting
		// someone trace a whole shape only to find out silently at the end that nothing was measured.
		if ((mode === 'line' || mode === 'polygon' || mode === 'chain' || mode === 'pick-color') && !planMeasureState.calibration) {
			toast('Calibrez d’abord l’échelle (bouton « Calibrer l’échelle ») avant de tracer une mesure.');
			return;
		}
		document.querySelector('#plan-measure-magnifier')?.setAttribute('hidden', '');
		planMeasureState.mode = mode;
		planMeasureState.drawRole = role;
		planMeasureState.drawPoints = [];
		planMeasureState.calibratePoints = [];
		document.querySelectorAll('.plan-measure-toolbar button[id^="plan-measure-"]').forEach((button) => button.classList.remove('active'));
		if (mode === 'calibrate') document.querySelector('#plan-measure-calibrate')?.classList.add('active');
		if (mode === 'line') document.querySelector('#plan-measure-line')?.classList.add('active');
		if (mode === 'chain') document.querySelector('#plan-measure-chain')?.classList.add('active');
		if (mode === 'pick-color') document.querySelector('#plan-measure-pick-color')?.classList.add('active');
		if (mode === 'polygon') document.querySelector(role === 'opening' ? '#plan-measure-opening' : '#plan-measure-polygon')?.classList.add('active');
		document.querySelector('#plan-measure-finish').hidden = mode !== 'line' && mode !== 'polygon' && mode !== 'chain';
		// pick-color fires on a single click (see the canvas click handler) rather than accumulating points,
		// so it has nothing to "finish" or "undo" - only cancelling out of the mode applies.
		document.querySelector('#plan-measure-cancel-draw').hidden = !mode;
		document.querySelector('#plan-measure-undo-point').hidden = !mode || mode === 'pick-color';
		planMeasureUpdateStatus();
		planMeasureSyncToolbar();
		planMeasureRedraw();
	}
	// Loads (or switches to) one page's raster image into the already-open modal - shared by the initial
	// open and by the page-navigation arrows, so both go through the exact same "fit to screen" sizing and
	// the exact same page-scoped calibration resolution. Re-fetches the document's measurements/calibrations
	// too (cheap, and keeps a freshly-added zone/measurement from a moment ago always current).
	async function planMeasureLoadPage(pageNumber) {
		if (!planMeasureState) return;
		const canvas = document.querySelector('#plan-measure-canvas');
		if (!canvas) return;
		document.querySelector('#plan-measure-status').textContent = 'Chargement du plan...';
		try {
			const response = await fetch(`${api}/documents/${planMeasureState.documentId}/plan-image?page=${pageNumber}`, { headers: { Authorization: `Bearer ${token()}` } });
			if (!response.ok) throw new Error();
			const blob = await response.blob();
			const image = new Image();
			const objectUrl = URL.createObjectURL(blob);
			await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = objectUrl; });
			const canvasWrap = document.querySelector('.plan-measure-canvas-wrap');
			const maxWidth = canvasWrap?.clientWidth || 900;
			const maxHeight = canvasWrap?.clientHeight || 600;
			// baseScale is the "fit to screen" size - uses the real available space in both directions (not
			// a fixed cap), so a wide full-screen layout actually gets used instead of leaving the plan small
			// in a mostly-empty canvas area. On a narrow phone this can still shrink a large plan enough that
			// a small window's corners are a few blurry pixels apart, too imprecise to tap accurately - zoom
			// in/out (below) lets the user scale up past this before placing a point; the canvas-wrap already
			// scrolls (overflow:auto in CSS), so zooming in just makes it pannable instead of resizing.
			const baseScale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
			canvas.width = Math.round(image.naturalWidth * baseScale);
			canvas.height = Math.round(image.naturalHeight * baseScale);
			const measurementsResult = await request(`/documents/${planMeasureState.documentId}/measurements`);
			if (planMeasureState.objectUrl) URL.revokeObjectURL(planMeasureState.objectUrl);
			const zones = measurementsResult.calibrations || [];
			// The "active" zone must belong to THIS page - a zone that was active on the page just left behind
			// would otherwise keep being used to resolve clicks on an image it was never calibrated against.
			// Prefers the server's own active pointer when it already matches, else the first zone saved for
			// this page, else null (meaning: not calibrated yet on this page, exactly as if it had never been
			// calibrated at all).
			const activeForPage = (measurementsResult.calibration && (measurementsResult.calibration.page || 1) === pageNumber) ? measurementsResult.calibration : zones.find((zone) => (zone.page || 1) === pageNumber) || null;
			planMeasureState = { ...planMeasureState, image, scale: baseScale, baseScale, rotation: 0, page: pageNumber, calibration: activeForPage, calibrations: zones, measurements: measurementsResult.measurements, mode: null, drawRole: 'surface', drawPoints: [], calibratePoints: [], candidates: [], pendingRegionCalibrationId: null, currentShapeCalibrationId: null, customColorLabel: null, objectUrl };
			planMeasureRenderCalibrationZones();
			const zoomLabel = document.querySelector('#plan-measure-zoom-level');
			if (zoomLabel) zoomLabel.textContent = `${Math.round(baseScale * 100)}%`;
			const pageLabel = document.querySelector('#plan-measure-page-label');
			if (pageLabel) pageLabel.textContent = `Page ${pageNumber}/${planMeasureState.pageCount || 1}`;
			const pageNav = document.querySelector('#plan-measure-page-nav');
			if (pageNav) {
				pageNav.hidden = (planMeasureState.pageCount || 1) < 2;
				document.querySelector('#plan-measure-page-prev')?.toggleAttribute('disabled', pageNumber <= 1);
				document.querySelector('#plan-measure-page-next')?.toggleAttribute('disabled', pageNumber >= (planMeasureState.pageCount || 1));
			}
			const colorScanBox = document.querySelector('#plan-measure-color-scan');
			if (colorScanBox) { colorScanBox.hidden = true; colorScanBox.innerHTML = ''; }
			planMeasureState.colorScanResults = []; planMeasureState.textCallouts = []; planMeasureState.textOpenItems = []; planMeasureState.textDetailIndex = [];
			document.querySelector('#plan-measure-info-box').hidden = true;
			planMeasureRenderList();
			planMeasureSetMode(null);
			const suggestionBox = document.querySelector('#plan-measure-scale-suggestion');
			if (!planMeasureState.calibration && suggestionBox) {
				try {
					const suggestion = await request(`/documents/${planMeasureState.documentId}/plan-scale-suggestion`);
					if (suggestion.scaleDenominator) {
						suggestionBox.hidden = false;
						document.querySelector('#plan-measure-scale-suggestion-text').textContent = `Échelle 1:${suggestion.scaleDenominator} lue dans le texte du PDF (pas une estimation visuelle) - vérifiez qu’elle correspond bien à CETTE page avant de l’utiliser.`;
						suggestionBox.dataset.scaleDenominator = String(suggestion.scaleDenominator);
					} else { suggestionBox.hidden = true; }
				} catch { suggestionBox.hidden = true; }
			} else if (suggestionBox) { suggestionBox.hidden = true; }
		} catch {
			document.querySelector('#plan-measure-status').textContent = 'Impossible de charger le plan.';
		}
	}
	async function openPlanMeasure(documentId) {
		const modal = document.querySelector('#plan-measure-modal');
		const canvas = document.querySelector('#plan-measure-canvas');
		if (!modal || !canvas) return;
		const documents = await request('/documents');
		const docItem = documents.find((item) => item.id === documentId);
		if (!docItem) { toast('Document introuvable.'); return; }
		modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
		// Shown prominently so the chantier being measured is never ambiguous - this plan's measurements
		// are only ever compared against THIS chantier's devis lines (server-scoped by projectId), but a
		// wrong visual read here (measuring the right plan while assuming a different chantier) would
		// still send someone looking at the wrong devis entirely.
		const projectName = projectsCache.find((project) => project.id === docItem.projectId)?.name || docItem.projectId;
		const titleEl = document.querySelector('#plan-measure-title');
		if (titleEl) titleEl.textContent = `Mesurer le plan — ${projectName} — ${docItem.originalName}`;
		document.querySelector('#plan-measure-info-box').hidden = true;
		const colorScanBox = document.querySelector('#plan-measure-color-scan');
		if (colorScanBox) { colorScanBox.hidden = true; colorScanBox.innerHTML = ''; }
		// A real architectural PDF set is routinely many pages (a cover sheet, then each facade/floor/detail
		// on its own page) - fetched once up front so the page-nav arrows know their bounds immediately,
		// instead of discovering the count only after trying to go past the last page.
		let pageCount = 1;
		try { pageCount = (await request(`/documents/${documentId}/plan-page-count`)).pageCount || 1; } catch { pageCount = 1; }
		planMeasureState = { documentId, projectId: docItem.projectId, planType: docItem.planType || null, originalName: docItem.originalName, pageCount, page: 1, image: null, scale: 1, baseScale: 1, rotation: 0, calibration: null, calibrations: [], measurements: [], mode: null, drawRole: 'surface', drawPoints: [], calibratePoints: [], candidates: [], pendingRegionCalibrationId: null, currentShapeCalibrationId: null, objectUrl: null };
		await planMeasureLoadPage(1);
	}
	function closePlanMeasure() {
		const modal = document.querySelector('#plan-measure-modal');
		if (modal) { modal.hidden = true; modal.setAttribute('aria-hidden', 'true'); }
		if (planMeasureState?.objectUrl) URL.revokeObjectURL(planMeasureState.objectUrl);
		planMeasureState = null;
		const titleEl = document.querySelector('#plan-measure-title');
		if (titleEl) titleEl.textContent = 'Mesurer le plan';
	}
	document.querySelector('#plan-measure-close')?.addEventListener('click', closePlanMeasure);
	document.querySelector('#plan-measure-modal')?.addEventListener('click', (event) => { if (event.target.id === 'plan-measure-modal') closePlanMeasure(); });
	document.querySelector('#plan-measure-calibrate')?.addEventListener('click', () => planMeasureState && planMeasureSetMode(planMeasureState.mode === 'calibrate' ? null : 'calibrate'));
	document.querySelector('#plan-measure-calibration-zone')?.addEventListener('change', async (event) => {
		if (!planMeasureState) return;
		try {
			const result = await request(`/documents/${planMeasureState.documentId}/calibration/activate`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ calibrationId: event.target.value }) });
			planMeasureState.calibration = result.calibration;
			planMeasureState.calibrations = result.calibrations || [];
			planMeasureUpdateStatus();
			toast(`Zone active : ${result.calibration.label || 'sans nom'}.`);
		} catch { toast('Changement de zone échoué.'); }
	});
	document.querySelector('#plan-measure-line')?.addEventListener('click', () => planMeasureState && planMeasureSetMode(planMeasureState.mode === 'line' ? null : 'line'));
	document.querySelector('#plan-measure-chain')?.addEventListener('click', () => planMeasureState && planMeasureSetMode(planMeasureState.mode === 'chain' ? null : 'chain'));
	document.querySelector('#plan-measure-pick-color')?.addEventListener('click', () => planMeasureState && planMeasureSetMode(planMeasureState.mode === 'pick-color' ? null : 'pick-color'));
	document.querySelector('#plan-measure-scan-colors')?.addEventListener('click', () => planMeasureState?.calibration && planMeasureScanAllColors());
	document.querySelector('#plan-measure-color-scan')?.addEventListener('click', (event) => {
		const button = event.target.closest('[data-color-scan-choose]');
		if (!button) return;
		planMeasureChooseColorScanResult(Number(button.dataset.colorScanChoose));
	});
	document.querySelector('#plan-measure-polygon')?.addEventListener('click', () => planMeasureState && planMeasureSetMode(planMeasureState.mode === 'polygon' && planMeasureState.drawRole !== 'opening' ? null : 'polygon', 'surface'));
	document.querySelector('#plan-measure-opening')?.addEventListener('click', () => planMeasureState && planMeasureSetMode(planMeasureState.mode === 'polygon' && planMeasureState.drawRole === 'opening' ? null : 'polygon', 'opening'));
	document.querySelector('#plan-measure-cancel-draw')?.addEventListener('click', () => planMeasureState && planMeasureSetMode(null));
	document.querySelector('#plan-measure-undo-point')?.addEventListener('click', () => planMeasureState && planMeasureUndoLastPoint());
	document.querySelector('#plan-measure-zoom-in')?.addEventListener('click', () => planMeasureState && planMeasureApplyZoom(planMeasureState.scale * 1.25));
	document.querySelector('#plan-measure-zoom-out')?.addEventListener('click', () => planMeasureState && planMeasureApplyZoom(planMeasureState.scale / 1.25));
	document.querySelector('#plan-measure-zoom-reset')?.addEventListener('click', () => planMeasureState && planMeasureApplyZoom(planMeasureState.baseScale));
	document.querySelector('#plan-measure-page-prev')?.addEventListener('click', () => { if (planMeasureState && planMeasureState.page > 1) planMeasureLoadPage(planMeasureState.page - 1); });
	document.querySelector('#plan-measure-page-next')?.addEventListener('click', () => { if (planMeasureState && planMeasureState.page < (planMeasureState.pageCount || 1)) planMeasureLoadPage(planMeasureState.page + 1); });
	document.querySelector('#plan-measure-rotate')?.addEventListener('click', () => planMeasureState && planMeasureRotate());
	document.querySelector('#plan-measure-detect-openings')?.addEventListener('click', () => planMeasureState?.calibration && planMeasureDetectOpenings());
	document.querySelector('#plan-measure-detect-rails')?.addEventListener('click', () => planMeasureState?.calibration && planMeasureDetectRails());
	document.querySelector('#plan-measure-candidates-confirm')?.addEventListener('click', () => planMeasureConfirmCandidates());
	document.querySelector('#plan-measure-candidates-rails-v')?.addEventListener('click', () => planMeasureAddRailTotalToDevis('rail-v'));
	document.querySelector('#plan-measure-candidates-rails-h')?.addEventListener('click', () => planMeasureAddRailTotalToDevis('rail-h'));
	document.querySelector('#plan-measure-candidates-custom-chain-v')?.addEventListener('click', () => planMeasureConfirmCustomChain('custom-v'));
	document.querySelector('#plan-measure-candidates-custom-chain-h')?.addEventListener('click', () => planMeasureConfirmCustomChain('custom-h'));
	document.querySelector('#plan-measure-candidates-custom-blob')?.addEventListener('click', () => planMeasureAddCustomBlobToDevis());
	document.querySelector('#plan-measure-candidates-clear')?.addEventListener('click', () => { if (!planMeasureState) return; planMeasureState.candidates = []; planMeasureSyncToolbar(); planMeasureRedraw(); });
	// Every tool lives behind one "🛠️ Outils" dropdown so the plan itself gets almost the whole screen at
	// rest (desktop and mobile alike) - picking any tool inside it closes the dropdown right back up, so the
	// gérant is looking at the plan, not the menu, the moment they've made their choice.
	document.querySelector('#plan-measure-tools-menu')?.addEventListener('click', (event) => {
		if (event.target.closest('button')) document.querySelector('#plan-measure-tools-menu').open = false;
	});
	document.querySelector('#plan-measure-finish')?.addEventListener('click', async () => {
		if (!planMeasureState) return;
		const { mode, drawPoints, drawRole } = planMeasureState;
		const minPoints = mode === 'polygon' ? 3 : 2;
		if (drawPoints.length < minPoints) { toast(`Il faut au moins ${minPoints} points.`); return; }
		// A chain is for a sequence of real-world reference points on one axis (rail de départ, then each
		// recoupement/bando up a facade, or any other succession) where what's actually wanted is the
		// distance of EACH segment, not one combined total - so instead of one polyline measurement, each
		// consecutive pair of clicked points becomes its OWN line measurement, labeled with its position in
		// the sequence. Exact geometry either way - this only changes how the same clicks get split into
		// measurements, never guesses a position the gérant didn't click.
		if (mode === 'chain') {
			const startName = window.prompt('Nom du point de départ (ex. « DEP », « Rail de départ ») :', 'Départ');
			if (startName === null) return;
			const segmentName = window.prompt('Nom des points suivants (ex. « Recoupement », « Bando ») :', 'Recoupement');
			if (segmentName === null) return;
			const { created, failed } = await planMeasureCreateChainSegments(drawPoints, startName.trim() || 'Départ', segmentName.trim() || 'Point');
			planMeasureRenderList();
			planMeasureSetMode(null);
			toast(failed ? `${created} segment(s) enregistré(s), ${failed} échoué(s).` : `${created} segment(s) de la chaîne enregistrés.`);
			return;
		}
		const defaultLabel = mode === 'polygon' ? (drawRole === 'opening' ? 'Fenêtre' : 'Surface') : 'Ligne';
		const label = window.prompt('Nom de cette mesure (ex. Façade Nord, Fenêtre salon) :', defaultLabel);
		if (!label?.trim()) return;
		// Only asked for openings, where identical repeats (e.g. 5 windows of the same 1.20x1.20 size) are
		// the common real case - tracing one and typing the count beats re-tracing every one, and is still
		// an exact number the user confirms, never a guess from pattern-matching the plan image.
		let repeatCount = 1;
		if (drawRole === 'opening') {
			const repeatInput = window.prompt('Combien de fois ce type se répète à l’identique sur ce plan ? (ex. 5 fenêtres identiques - laissez 1 pour une seule)', '1');
			repeatCount = Math.max(1, Math.round(Number(repeatInput)) || 1);
		}
		try {
			const measurement = await request(`/documents/${planMeasureState.documentId}/measurements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: mode, role: drawRole, label: label.trim(), points: drawPoints, repeatCount, calibrationId: planMeasureState.currentShapeCalibrationId }) });
			planMeasureState.measurements.push(measurement);
			planMeasureRenderList();
			planMeasureSetMode(null);
			toast('Mesure enregistrée.');
		} catch { toast('Mesure non enregistrée.'); }
	});
	// AutoCAD-style magnifier: while in a point-placing mode (calibrate/line/polygon/opening), a zoomed
	// loupe with a crosshair follows the cursor/finger so the exact pixel about to be placed is visible
	// magnified, instead of guessing under a fingertip. Reads from the already-drawn main canvas (same
	// pixels the click handler below converts via planMeasureToNatural), so the loupe can never disagree
	// with where the point actually lands - it's a crop of the real canvas, not a separate render.
	const PLAN_MEASURE_MAGNIFIER_SIZE = 140;
	const PLAN_MEASURE_MAGNIFIER_ZOOM = 3;
	function planMeasureUpdateMagnifier(clientX, clientY) {
		const magnifier = document.querySelector('#plan-measure-magnifier');
		if (!magnifier) return;
		if (!planMeasureState?.mode) { magnifier.hidden = true; return; }
		const canvas = document.querySelector('#plan-measure-canvas');
		const wrap = document.querySelector('.plan-measure-canvas-wrap');
		if (!canvas || !wrap) { magnifier.hidden = true; return; }
		const canvasRect = canvas.getBoundingClientRect();
		if (clientX < canvasRect.left || clientX > canvasRect.right || clientY < canvasRect.top || clientY > canvasRect.bottom) { magnifier.hidden = true; return; }
		// Position within the canvas's own pixel buffer (canvas.width/height can differ from its displayed
		// CSS size), matching exactly how planMeasureToNatural resolves a click to a point.
		const canvasX = (clientX - canvasRect.left) * (canvas.width / canvasRect.width);
		const canvasY = (clientY - canvasRect.top) * (canvas.height / canvasRect.height);
		magnifier.width = PLAN_MEASURE_MAGNIFIER_SIZE;
		magnifier.height = PLAN_MEASURE_MAGNIFIER_SIZE;
		const ctx = magnifier.getContext('2d');
		const sourceSize = PLAN_MEASURE_MAGNIFIER_SIZE / PLAN_MEASURE_MAGNIFIER_ZOOM;
		ctx.imageSmoothingEnabled = false;
		ctx.clearRect(0, 0, PLAN_MEASURE_MAGNIFIER_SIZE, PLAN_MEASURE_MAGNIFIER_SIZE);
		ctx.save();
		ctx.beginPath();
		ctx.arc(PLAN_MEASURE_MAGNIFIER_SIZE / 2, PLAN_MEASURE_MAGNIFIER_SIZE / 2, PLAN_MEASURE_MAGNIFIER_SIZE / 2, 0, Math.PI * 2);
		ctx.clip();
		ctx.drawImage(canvas, canvasX - sourceSize / 2, canvasY - sourceSize / 2, sourceSize, sourceSize, 0, 0, PLAN_MEASURE_MAGNIFIER_SIZE, PLAN_MEASURE_MAGNIFIER_SIZE);
		ctx.restore();
		ctx.strokeStyle = '#f77d7d';
		ctx.lineWidth = 1.5;
		const center = PLAN_MEASURE_MAGNIFIER_SIZE / 2;
		ctx.beginPath(); ctx.moveTo(center - 14, center); ctx.lineTo(center + 14, center); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(center, center - 14); ctx.lineTo(center, center + 14); ctx.stroke();
		// Positioned above the cursor/finger (so a fingertip never covers it); flips below if too close to
		// the top, and stays clamped horizontally within the scrollable wrap's own content area.
		const wrapRect = wrap.getBoundingClientRect();
		const offsetX = clientX - wrapRect.left + wrap.scrollLeft;
		const offsetY = clientY - wrapRect.top + wrap.scrollTop;
		let left = offsetX - PLAN_MEASURE_MAGNIFIER_SIZE / 2;
		let top = offsetY - PLAN_MEASURE_MAGNIFIER_SIZE - 24;
		if (top < wrap.scrollTop) top = offsetY + 24;
		left = Math.max(wrap.scrollLeft + 4, Math.min(left, wrap.scrollLeft + wrapRect.width - PLAN_MEASURE_MAGNIFIER_SIZE - 4));
		magnifier.style.left = `${left}px`;
		magnifier.style.top = `${top}px`;
		magnifier.hidden = false;
	}
	const planMeasureCanvasForMagnifier = document.querySelector('#plan-measure-canvas');
	planMeasureCanvasForMagnifier?.addEventListener('mousemove', (event) => planMeasureUpdateMagnifier(event.clientX, event.clientY));
	planMeasureCanvasForMagnifier?.addEventListener('mouseleave', () => { const magnifier = document.querySelector('#plan-measure-magnifier'); if (magnifier) magnifier.hidden = true; });
	planMeasureCanvasForMagnifier?.addEventListener('touchstart', (event) => { const touch = event.touches[0]; if (touch) planMeasureUpdateMagnifier(touch.clientX, touch.clientY); }, { passive: true });
	planMeasureCanvasForMagnifier?.addEventListener('touchmove', (event) => { const touch = event.touches[0]; if (touch) planMeasureUpdateMagnifier(touch.clientX, touch.clientY); }, { passive: true });
	planMeasureCanvasForMagnifier?.addEventListener('touchend', () => { const magnifier = document.querySelector('#plan-measure-magnifier'); if (magnifier) magnifier.hidden = true; });
	document.querySelector('#plan-measure-canvas')?.addEventListener('click', async (event) => {
		if (!planMeasureState) return;
		// Rejecting a false-positive detected candidate works even outside any drawing mode - clicking
		// directly on one of the dashed orange boxes removes just that one, before the rest get confirmed.
		if (!planMeasureState.mode && planMeasureState.candidates?.length) {
			const point = planMeasureToNatural(event);
			const index = planMeasureState.candidates.findIndex((box) => point.x >= box.x0 && point.x <= box.x1 && point.y >= box.y0 && point.y <= box.y1);
			if (index !== -1) {
				planMeasureState.candidates.splice(index, 1);
				planMeasureSyncToolbar();
				planMeasureRedraw();
				return;
			}
		}
		if (!planMeasureState?.mode) return;
		const point = planMeasureToNatural(event);
		if (planMeasureState.mode === 'calibrate') {
			planMeasureState.calibratePoints.push(point);
			if (planMeasureState.calibratePoints.length === 2) {
				const realDistanceM = Number(window.prompt('Distance réelle entre ces deux points, en mètres (ex. 5) :', ''));
				if (Number.isFinite(realDistanceM) && realDistanceM > 0) {
					// Many plans print more than one scale on the same sheet (e.g. a façade at 1/75e next to
					// a pignon/gable at 1/50e - confirmed on a real plan from this exact app). Naming the zone
					// lets the gérant switch back to it later from the dropdown instead of re-clicking two
					// points every time they move between parts of the plan - never required, an empty name
					// just becomes "Zone N".
					const label = window.prompt('Nom de cette zone de calibration (ex. « Façade », « Pignon ») - laissez vide si le plan n’a qu’une seule échelle :', '');
					try {
						const result = await request(`/documents/${planMeasureState.documentId}/calibration`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pointA: planMeasureState.calibratePoints[0], pointB: planMeasureState.calibratePoints[1], realDistanceM, label, page: planMeasureState.page || 1 }) });
						planMeasureState.calibration = result.calibration;
						planMeasureState.calibrations = result.calibrations || [];
						planMeasureRenderCalibrationZones();
						toast('Échelle calibrée.');
						// From the second zone onward ON THIS SAME PAGE, offer to mark where it applies - once a
						// zone has a region, the tool resolves the right scale on its own for anything drawn
						// inside it, instead of depending on the gérant remembering to switch zones first. A
						// single-scale plan (or a zone that's the first one calibrated on its own page, even if
						// other pages already have zones of their own) never sees this prompt - there is nothing
						// to disambiguate on THIS page's image yet.
						const zonesOnThisPage = planMeasureState.calibrations.filter((zone) => (zone.page || 1) === (planMeasureState.page || 1));
						if (zonesOnThisPage.length > 1 && window.confirm(`Délimiter la zone « ${label || 'sans nom'} » sur le plan ? Cliquez OK puis cliquez 2 coins opposés de la zone où cette échelle s’applique.`)) {
							planMeasureState.pendingRegionCalibrationId = result.calibration.id;
							planMeasureSetMode('calibrate-region');
							return;
						}
					} catch { toast('Calibration échouée.'); }
				} else { toast('Calibration annulée : distance invalide.'); }
				planMeasureSetMode(null);
			} else { planMeasureUpdateStatus(); planMeasureRedraw(); }
			return;
		}
		if (planMeasureState.mode === 'calibrate-region') {
			planMeasureState.calibratePoints.push(point);
			if (planMeasureState.calibratePoints.length === 2) {
				const [a, b] = planMeasureState.calibratePoints;
				try {
					const result = await request(`/documents/${planMeasureState.documentId}/calibration/${planMeasureState.pendingRegionCalibrationId}/region`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x0: a.x, y0: a.y, x1: b.x, y1: b.y }) });
					planMeasureState.calibrations = result.calibrations || planMeasureState.calibrations;
					if (planMeasureState.calibration?.id === result.calibration.id) planMeasureState.calibration = result.calibration;
					toast('Zone délimitée.');
				} catch { toast('Délimitation échouée.'); }
				planMeasureState.pendingRegionCalibrationId = null;
				planMeasureSetMode(null);
			} else { planMeasureUpdateStatus(); planMeasureRedraw(); }
			return;
		}
		if (planMeasureState.mode === 'pick-color') {
			const pickedPoint = point;
			planMeasureSetMode(null);
			await planMeasureDetectCustomColor(pickedPoint);
			return;
		}
		// Resolve the right calibration zone automatically for the FIRST point of a new shape only - a shape
		// must use one consistent scale throughout, so this is locked in once per shape rather than
		// re-resolved per point (which could otherwise mix scales inside a single line/polygon if it happened
		// to cross a zone boundary). Silently switches the active zone to match when they differ, so the
		// gérant never has to remember to do it themselves for a zone that's already been delimited.
		if (planMeasureState.drawPoints.length === 0) {
			const resolved = planMeasureZoneForPoint(point);
			planMeasureState.currentShapeCalibrationId = resolved?.id || null;
			if (resolved && resolved.id !== planMeasureState.calibration?.id) {
				try {
					const result = await request(`/documents/${planMeasureState.documentId}/calibration/activate`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ calibrationId: resolved.id }) });
					planMeasureState.calibration = result.calibration;
					planMeasureState.calibrations = result.calibrations || planMeasureState.calibrations;
					planMeasureRenderCalibrationZones();
					toast(`Zone détectée automatiquement : ${resolved.label || 'sans nom'}.`);
				} catch { /* keep the previously active zone if the switch itself fails */ }
			}
		}
		planMeasureState.drawPoints.push(point);
		planMeasureUpdateStatus();
		planMeasureRedraw();
	});
	document.querySelector('#plan-measure-info')?.addEventListener('click', async (event) => {
		if (!planMeasureState) return;
		const button = event.currentTarget;
		const box = document.querySelector('#plan-measure-info-box');
		button.disabled = true; button.setAttribute('aria-busy', 'true');
		try {
			const result = await request(`/documents/${planMeasureState.documentId}/plan-info`, { method: 'POST' });
			if (result.status === 'not_configured' || result.status === 'unavailable' || !result.planInfo) {
				box.hidden = false; box.innerHTML = '<small>Lecture IA indisponible pour ce plan.</small>';
			} else {
				const info = result.planInfo;
				box.hidden = false;
				box.innerHTML = `<strong>⚠ Lu par IA depuis le plan — à vérifier</strong><span>Sujet : ${escapeHtml(info.subject || '—')}</span><span>Chantier : ${escapeHtml(info.chantierAddress || '—')}</span><span>Client : ${escapeHtml(info.clientName || '—')}</span><span>Architecte : ${escapeHtml(info.architecte || '—')}</span>`;
			}
		} catch { toast('Lecture du plan impossible.'); }
		finally { button.disabled = false; button.removeAttribute('aria-busy'); }
	});
	document.querySelector('#plan-measure-metre-pdf')?.addEventListener('click', async (event) => {
		if (!planMeasureState) return;
		if (!planMeasureState.measurements.length) { toast('Aucune mesure à exporter.'); return; }
		const button = event.currentTarget;
		button.disabled = true; button.setAttribute('aria-busy', 'true');
		try {
			const response = await fetch(`${api}/documents/${planMeasureState.documentId}/measurements/metre-pdf`, { headers: { Authorization: `Bearer ${token()}` } });
			if (!response.ok) throw new Error();
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = 'metre.pdf';
			document.body.append(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(url);
		} catch { toast('Export du métré impossible.'); }
		finally { button.disabled = false; button.removeAttribute('aria-busy'); }
	});
	document.querySelector('#plan-measure-scale-accept')?.addEventListener('click', async (event) => {
		if (!planMeasureState) return;
		const suggestionBox = document.querySelector('#plan-measure-scale-suggestion');
		const scaleDenominator = Number(suggestionBox?.dataset.scaleDenominator);
		if (!Number.isFinite(scaleDenominator)) return;
		const button = event.currentTarget;
		button.disabled = true; button.setAttribute('aria-busy', 'true');
		try {
			const result = await request(`/documents/${planMeasureState.documentId}/calibration`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scaleDenominator, page: planMeasureState.page || 1 }) });
			planMeasureState.calibration = result.calibration;
			suggestionBox.hidden = true;
			planMeasureUpdateStatus();
			planMeasureSyncToolbar();
			planMeasureRedraw();
			toast(`Échelle 1:${scaleDenominator} appliquée depuis le PDF.`);
		} catch { toast('Calibration échouée.'); }
		finally { button.disabled = false; button.removeAttribute('aria-busy'); }
	});
	document.querySelector('#plan-measure-scale-dismiss')?.addEventListener('click', () => { const box = document.querySelector('#plan-measure-scale-suggestion'); if (box) box.hidden = true; });
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
			const lineItems = await request(`/projects/${project.id}/budget/line-items`).catch(() => []);
			rows.push({ project, budget, financial, lineItems });
		}
		const selected = rows.find((row) => row.project.id === selectedProjectId);
		if (form && selected && selected.budget.status !== 'missing') {
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
		// The devis total alone doesn't say where the number comes from - show the detected/created line
		// items (quantité, prix unitaire, total) grouped by category right under each chantier's summary,
		// so uploading a devis visibly produces its full breakdown here, not just in Lignes & assignation.
		const renderLineItemsDetail = (lineItems) => {
			if (!lineItems.length) return '';
			const categories = new Map();
			lineItems.forEach((item) => { const key = item.category || item.description; if (!categories.has(key)) categories.set(key, []); categories.get(key).push(item); });
			const rowsHtml = [...categories.entries()].map(([category, items]) => `<div class="budget-line-items-category"><strong>${escapeHtml(category)}</strong>${items.map((item) => `<div class="budget-line-item-row"><span>${escapeHtml(item.description)}</span><span>${Number(item.quantity || 0)} ${escapeHtml(item.unit || '')}</span><span>${formatEUR(item.unitPrice)}</span><span>${formatEUR(item.lineTotal)}</span></div>`).join('')}</div>`).join('');
			return `<details class="budget-line-items-detail"><summary>Voir le détail du devis (${lineItems.length} stavke)</summary>${rowsHtml}</details>`;
		};
		target.innerHTML = rows.length ? rows.map(({ project, budget, financial, lineItems }) => `<div class="list-item"><strong>${escapeHtml(project.name)}</strong><small>${budget.status === 'missing' ? 'Aucun Devis enregistré' : `${escapeHtml(budget.devisNumber || 'Devis')} · ${escapeHtml(budget.client || 'Client')} · ${formatEUR(financial.budget)}`}</small><div>Nabavke: ${formatEUR(financial.purchases)} · Rad: ${Number(financial.approvedWorkHours || 0).toFixed(2)} h (${formatEUR(financial.approvedWorkAmount || 0)}) · Ukupno potrošeno: ${formatEUR(financial.spent)} · Preostalo: ${financial.remaining === null ? 'N/A' : formatEUR(financial.remaining)}</div>${renderLineItemsDetail(lineItems)}<div>${lineItems.length ? `<button class="secondary download-devis-pdf" data-project="${project.id}" data-name="${escapeHtml(project.name)}" type="button">Télécharger le devis PDF</button>` : ''}${isOwner() ? `<button class="secondary remove-project" data-project="${project.id}" data-name="${escapeHtml(project.name)}" type="button">Obrisi chantier</button>` : ''}</div></div>`).join('') : '<small>Nema registrovanih chantiers.</small>';
		document.querySelectorAll('.remove-project').forEach((button) => button.addEventListener('click', async () => {
			if (!window.confirm(`Supprimer le chantier ${button.dataset.name} et les données associées ?`)) return;
			button.disabled = true; button.setAttribute('aria-busy', 'true');
			try { await request(`/projects/${button.dataset.project}`, { method: 'DELETE' }); await refreshActiveView(); toast('Chantier je obrisan.'); }
			catch (error) { let message = 'Chantier nije obrisan.'; try { message = JSON.parse(error.message).error || message; } catch {} toast(message); button.disabled = false; button.removeAttribute('aria-busy'); }
		}));
		document.querySelectorAll('.download-devis-pdf').forEach((button) => button.addEventListener('click', async () => {
			button.disabled = true; button.setAttribute('aria-busy', 'true');
			try {
				const response = await fetch(`${api}/projects/${button.dataset.project}/devis-pdf`, { headers: { Authorization: `Bearer ${token()}` } });
				if (!response.ok) throw new Error();
				const blob = await response.blob();
				const url = URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.href = url;
				link.download = `devis-${(button.dataset.name || 'chantier').replace(/\s+/g, '-')}.pdf`;
				document.body.append(link);
				link.click();
				link.remove();
				URL.revokeObjectURL(url);
			} catch { toast('Export du devis impossible.'); }
			finally { button.disabled = false; button.removeAttribute('aria-busy'); }
		}));
	}
	async function loadPurchases() {
		// Grouped by "is subcontracting or not" rather than an allow-list of known categories, so a
		// purchase saved under "Autre" (the category a gérant naturally picks for a fuel/till receipt
		// that doesn't fit material/tools/machines) is never silently invisible after being saved -
		// every purchase shows up in exactly one of the two panels, with no category that falls through.
		const purchases = await request('/purchases');
		const subcontracting = purchases.filter((item) => item.category === 'subcontracting');
		const materialToolsMachines = purchases.filter((item) => item.category !== 'subcontracting');
		const render = (items, target, totalTarget) => { document.querySelector(`#${totalTarget}`).textContent = `${items.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2)} EUR`; document.querySelector(`#${target}`).innerHTML = items.length ? items.map((item) => `<div class="list-item"><strong>${item.category} · ${item.supplier}</strong><small>${item.description} · ${Number(item.amount).toFixed(2)} EUR · ${item.purchaseDate}</small><div class="form-row"><button type="button" class="secondary danger delete-purchase" data-purchase-delete="${item.id}">Supprimer</button></div></div>`).join('') : '<small>Aucune dépense.</small>'; };
		render(materialToolsMachines, 'purchase-material-tools', 'purchase-total-material-tools');
		render(subcontracting, 'purchase-subcontracting', 'purchase-total-subcontracting');
		document.querySelectorAll('.delete-purchase').forEach((button) => button.addEventListener('click', async () => {
			if (!window.confirm('Supprimer définitivement cette dépense ?')) return;
			button.disabled = true; button.setAttribute('aria-busy', 'true');
			try { await request(`/purchases/${button.dataset.purchaseDelete}`, { method: 'DELETE' }); toast('Dépense supprimée.'); await loadPurchases(); }
			catch { toast('Dépense non supprimée.'); button.disabled = false; button.removeAttribute('aria-busy'); }
		}));
	}
	function ensureHoursPdfButton() {
		if (document.querySelector('#download-hours-pdf')) return;
		const form = document.querySelector('#time-form'); if (!form) return;
		const previous = new Date(); previous.setMonth(previous.getMonth() - 1);
		const defaultMonth = previous.toISOString().slice(0, 7);
		const panel = document.createElement('div');
		panel.className = 'hours-pdf-panel';
		panel.innerHTML = `<label>Télécharger la liste PDF des jours<input id="hours-pdf-month" type="month" value="${defaultMonth}" /></label><button class="secondary" id="download-hours-pdf" type="button">Télécharger PDF</button><small>Contient les jours approuvés, les heures et le montant pour le mois sélectionné.</small>`;
		form.append(panel);
		panel.querySelector('#download-hours-pdf').addEventListener('click', async (event) => { const month = panel.querySelector('#hours-pdf-month').value || defaultMonth; await downloadHoursPdf(currentUser?.id, month, currentUser?.name, event.currentTarget); });
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
	const clearLoginCompanyPreview = () => { const preview = document.querySelector('#login-company-preview'); if (preview) preview.hidden = true; };
	let loginIdentityPreviewTimer;
	async function refreshLoginIdentityPreview() {
		const identifier = loginForm?.elements.phone?.value.trim();
		if (!identifier) { clearLoginCompanyPreview(); return; }
		const role = loginRole?.value || 'user';
		const siretInput = document.querySelector('#login-siret-field input');
		if (role === 'gerant' && (!siretInput?.value || siretInput.value.replace(/\D/g, '').length < 9)) { clearLoginCompanyPreview(); return; }
		const params = new URLSearchParams({ identifier, role });
		if (role === 'gerant' && siretInput?.value) params.set('siret', siretInput.value);
		try {
			const response = await fetch(`${api}/auth/identity-preview?${params.toString()}`);
			const result = await response.json();
			const preview = document.querySelector('#login-company-preview');
			if (!result.matched) { clearLoginCompanyPreview(); return; }
			paintIdentityToken(document.querySelector('#login-company-logo'), result.companyLogoUrl, result.companyName);
			const nameTarget = document.querySelector('#login-company-name');
			if (nameTarget) nameTarget.textContent = result.companyName || 'Entreprise';
			if (preview) preview.hidden = false;
		} catch { clearLoginCompanyPreview(); }
	}
	const scheduleLoginIdentityPreview = () => { clearTimeout(loginIdentityPreviewTimer); loginIdentityPreviewTimer = setTimeout(refreshLoginIdentityPreview, 380); };
	loginForm?.elements.phone?.addEventListener('input', scheduleLoginIdentityPreview);
	loginForm?.elements.phone?.addEventListener('blur', refreshLoginIdentityPreview);
	document.querySelector('#login-siret-field input')?.addEventListener('input', scheduleLoginIdentityPreview);
	loginRole?.addEventListener('change', () => { clearLoginCompanyPreview(); refreshLoginIdentityPreview(); });
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
		const loads = [loadDashboard(), loadEvidenceSummary(), loadRgeQualibat(), loadControlHistory(), loadBudget(), loadFinancialSummary(), loadSchedule(), loadUsers(), loadMessages(), loadTime(), loadPayroll(), loadDocuments(), loadPurchases(), loadProduction(), loadWorkSequence(), loadCompanyProfile(), loadWeather(currentProjectId())];
		const results = await Promise.allSettled(loads);
		results.filter((result) => result.status === 'rejected').forEach((result) => console.warn('Initial load failed', result.reason));
		ensureHoursPdfButton();
	};
	const refreshActiveView = async () => {
		const active = document.querySelector('.view.active')?.id;
		const refreshers = {
			'dashboard-view': () => Promise.allSettled([loadDashboard()]),
			'devis-view': () => Promise.allSettled([loadBudget(), loadFinancialSummary()]),
			'purchases-view': () => Promise.allSettled([loadPurchases(), loadBudget(), loadFinancialSummary()]),
			'line-items-view': () => Promise.allSettled([loadProjectOptions(), loadLineItems()]),
			'factures-view': () => Promise.allSettled([loadProjectOptions(), loadFactures()]),
			'chantier-view': () => Promise.allSettled([loadDashboard(), loadControlHistory(), loadSchedule(), loadFinancialSummary(), loadRgeSiteChecklist()]),
			'evidence-summary-view': () => Promise.allSettled([loadEvidenceSummary(), loadDocuments(), loadWorkSequence()]),
			'documents-view': () => Promise.allSettled([loadDocuments(), loadEvidenceSummary(), loadWorkSequence()]),
			'tasks-view': () => Promise.allSettled([loadMessages(), loadTime(), loadPayroll(), loadProduction(), loadWeather(currentProjectId()), loadMyTasks()]),
			'settings-view': () => Promise.allSettled([loadUsers(), loadMessages()]),
			'account-settings-view': () => Promise.allSettled([loadAccountSettings(), loadMyDocuments()])
		};
		await (refreshers[active]?.() || loadInitialData());
	};
	const restoreSession = async () => {
		if (!localStorage.getItem('ibra-auth-token')) return;
		try {
			const result = await request('/me');
			currentUser = result.user; applyRole(currentUser.role); setupWorkerSelfProfile(); showView(document.querySelector('.view.active')?.id || 'dashboard-view'); loginModal.classList.add('hidden'); document.querySelector('#current-role').textContent = `${currentUser.name} - ${currentUser.role}`; const sidebarUserName = document.querySelector('#sidebar-user-name'); if (sidebarUserName) sidebarUserName.textContent = currentUser.name; const sidebarUserRole = document.querySelector('#sidebar-user-role'); if (sidebarUserRole) sidebarUserRole.textContent = currentUser.role;
			await loadInitialData();
			startMessagePolling();
			setupPushNotifications();
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
			document.querySelector('#registration-success-message').textContent = data.delivery === 'password-set' ? `Le compte a été créé pour ${deliveryTarget}. Connectez-vous avec le mot de passe choisi.` : `Un lien a été envoyé à ${deliveryTarget}. Cliquez dessus pour définir votre mot de passe.`;
			loginForm.elements.phone.value = deliveryTarget || '';
			if (loginForm.elements.role && data.role) loginForm.elements.role.value = data.role;
		} catch (error) { message.textContent = error.message || 'Inscription impossible.'; }
	});
		document.querySelector('#login-form').addEventListener('submit', async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const submitButton = event.currentTarget.querySelector('button[type="submit"]'); const errorTarget = document.querySelector('#login-error'); errorTarget.textContent = ''; submitButton.disabled = true; submitButton.setAttribute('aria-busy', 'true'); try { const result = await fetch(`${api}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(form.entries())) }); if (!result.ok) { const details = await result.json().catch(() => ({})); const error = new Error(details.error || 'Login failed'); error.status = result.status; throw error; } const data = await result.json(); localStorage.setItem('ibra-auth-token', data.token); currentUser = data.user; applyRole(currentUser.role); setupWorkerSelfProfile(); showView(document.querySelector('.view.active')?.id || 'dashboard-view'); loginModal.classList.add('hidden'); document.querySelector('#current-role').textContent = `${currentUser.name} - ${currentUser.role}`; const sidebarUserName = document.querySelector('#sidebar-user-name'); if (sidebarUserName) sidebarUserName.textContent = currentUser.name; const sidebarUserRole = document.querySelector('#sidebar-user-role'); if (sidebarUserRole) sidebarUserRole.textContent = currentUser.role; await loadInitialData(); startMessagePolling(); setupPushNotifications(); } catch (error) { errorTarget.textContent = error.status === 403 ? 'Izabrani profil ne odgovara ovom nalogu.' : 'L’e-mail/téléphone ou le mot de passe est incorrect.'; } finally { submitButton.disabled = false; submitButton.removeAttribute('aria-busy'); } });
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
	document.querySelector('#logout-button').addEventListener('click', () => { stopMessagePolling(); localStorage.removeItem('ibra-auth-token'); currentUser = undefined; companyProfileState = null; workerProfilePanel?.setAttribute('hidden', ''); document.querySelector('#company-identity-strip')?.setAttribute('hidden', ''); const sidebarUserName = document.querySelector('#sidebar-user-name'); if (sidebarUserName) sidebarUserName.textContent = 'Non connecté'; const sidebarUserRole = document.querySelector('#sidebar-user-role'); if (sidebarUserRole) sidebarUserRole.textContent = '—'; document.querySelector('#login-form').reset(); document.querySelector('#registration-form')?.reset(); document.querySelector('#registration-form')?.setAttribute('hidden', ''); document.querySelector('#registration-success')?.setAttribute('hidden', ''); document.querySelector('#login-form').setAttribute('hidden', ''); authChoice?.removeAttribute('hidden'); loginModal.classList.remove('hidden'); });
	document.querySelector('#account-info-form')?.addEventListener('submit', async (event) => {
		event.preventDefault();
		const form = event.currentTarget;
		const message = document.querySelector('#account-info-message');
		message.textContent = '';
		const submitButton = form.querySelector('button[type="submit"]');
		submitButton.disabled = true; submitButton.setAttribute('aria-busy', 'true');
		try {
			const values = formValues(form);
			const result = await request('/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: values.name, contact: values.contact }) });
			currentUser = result.user;
			document.querySelector('#current-role').textContent = `${currentUser.name} - ${currentUser.role}`; const sidebarUserName = document.querySelector('#sidebar-user-name'); if (sidebarUserName) sidebarUserName.textContent = currentUser.name; const sidebarUserRole = document.querySelector('#sidebar-user-role'); if (sidebarUserRole) sidebarUserRole.textContent = currentUser.role;
			language = values.language || 'fr';
			localStorage.setItem('ibra-language', language);
			toast('Paramètres enregistrés.');
		} catch (error) {
			let text = 'Les modifications n’ont pas été enregistrées.';
			try { const details = JSON.parse(error.message); if (details.error === 'User already exists') text = 'Cet e-mail ou téléphone est déjà utilisé.'; } catch {}
			message.textContent = text;
		} finally { submitButton.disabled = false; submitButton.removeAttribute('aria-busy'); }
	});
	document.querySelector('#account-password-form')?.addEventListener('submit', async (event) => {
		event.preventDefault();
		const form = event.currentTarget;
		const message = document.querySelector('#account-password-message');
		message.textContent = '';
		const values = formValues(form);
		if (values.newPassword !== values.confirmPassword) { message.textContent = 'Les mots de passe ne correspondent pas.'; return; }
		const submitButton = form.querySelector('button[type="submit"]');
		submitButton.disabled = true; submitButton.setAttribute('aria-busy', 'true');
		try {
			const result = await request('/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }) });
			localStorage.setItem('ibra-auth-token', result.token);
			form.reset();
			toast('Mot de passe changé.');
		} catch (error) {
			let text = 'Le mot de passe n’a pas été changé.';
			try { const details = JSON.parse(error.message); if (details.error === 'Current password is incorrect') text = 'Mot de passe actuel incorrect.'; } catch {}
			message.textContent = text;
		} finally { submitButton.disabled = false; submitButton.removeAttribute('aria-busy'); }
	});
	async function submitPersonalDocument(form, extraFields) {
		const file = form.elements.file.files[0];
		if (!file) return;
		const body = new FormData(form);
		body.set('file', file, file.name);
		Object.entries(extraFields || {}).forEach(([key, value]) => body.set(key, value));
		const submitButton = form.querySelector('button[type="submit"]');
		submitButton.disabled = true; submitButton.setAttribute('aria-busy', 'true');
		try {
			const response = await fetch(`${api}/personal-documents/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body });
			const result = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(result.error || `${response.status}`);
			form.reset();
			await Promise.allSettled([loadWorkerDetailDocuments(workerRosterState.detailWorkerId), loadMyDocuments()]);
			toast('Document ajouté.');
		} catch (error) {
			toast(`Document non ajouté : ${error.message || 'erreur'}`);
		} finally {
			submitButton.disabled = false; submitButton.removeAttribute('aria-busy');
		}
	}
	document.querySelector('#worker-detail-document-form')?.addEventListener('submit', async (event) => { event.preventDefault(); await submitPersonalDocument(event.currentTarget, { workerId: workerRosterState.detailWorkerId }); });
	document.querySelector('#my-document-form')?.addEventListener('submit', async (event) => { event.preventDefault(); await submitPersonalDocument(event.currentTarget, {}); });
	document.querySelector('#message-form').addEventListener('submit', async (event) => {
		event.preventDefault();
		const form = event.currentTarget;
		const projectId = currentProjectId();
		const recipientId = form.elements.recipientId.value;
		if (!recipientId) { toast('Izaberite sagovornika.'); return; }
		const text = form.elements.text.value.trim();
		if (!text) return;
		const submitButton = form.querySelector('button[type="submit"], button.primary');
		const currentUserId = currentUser?.id || currentUser?.sub;
		const optimisticId = `optimistic-${Date.now()}`;
		const optimistic = { id: optimisticId, senderId: currentUserId, senderName: currentUser?.name || '', recipientId, projectId, text, createdAt: new Date().toISOString(), optimistic: true };
		latestChatMessages = [...latestChatMessages, optimistic];
		renderChatThread();
		form.elements.text.value = '';
		if (submitButton) { submitButton.disabled = true; submitButton.setAttribute('aria-busy', 'true'); }
		try {
			const saved = await request('/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientId, text, projectId }) });
			latestChatMessages = latestChatMessages.map((item) => (item.id === optimisticId ? saved : item));
			renderChatThread();
		} catch {
			latestChatMessages = latestChatMessages.filter((item) => item.id !== optimisticId);
			renderChatThread();
			toast('Poruka nije poslata.');
		} finally { if (submitButton) { submitButton.disabled = false; submitButton.removeAttribute('aria-busy'); } }
	});
	document.querySelector('#recipient')?.addEventListener('change', renderChatThread);
	document.querySelector('#messages')?.addEventListener('click', async (event) => {
		const deleteButton = event.target.closest('[data-delete-message]'); if (!deleteButton) return;
		if (!window.confirm('Obrisati ovu poruku?')) return;
		deleteButton.disabled = true;
		try { await request(`/messages/${encodeURIComponent(deleteButton.dataset.deleteMessage)}`, { method: 'DELETE' }); await loadMessages(); }
		catch { toast('Poruka nije obrisana.'); deleteButton.disabled = false; }
	});
	document.querySelector('#time-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await saveTimeEntryFromForm(event.currentTarget); const prefs = loadTimePrefs(); event.currentTarget.reset(); event.currentTarget.elements.start.value = prefs.start || '08:00'; event.currentTarget.elements.end.value = prefs.end || '17:00'; event.currentTarget.elements.breakMinutes.value = prefs.breakMinutes || '60'; event.currentTarget.elements.rateType.value = prefs.rateType || 'daily'; event.currentTarget.elements.rate.value = prefs.rate || ''; await refreshActiveView(); toast('Radno vreme je sa?uvano.'); } catch { toast('Radno vreme nije sa?uvano.'); } });
	document.querySelector('#site-progress-form')?.addEventListener('submit', async (event) => {
		event.preventDefault();
		const projectId = currentProjectId();
		if (!projectId) { toast('Izaberite chantier.'); return; }
		const progress = Number(event.currentTarget.elements.progress.value);
		if (!Number.isFinite(progress) || progress < 0 || progress > 100) { toast('Unesite procenat izmedju 0 i 100.'); return; }
		try {
			await request(`/projects/${projectId}/progress`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progress }) });
			await loadDashboard();
			toast('Avancement je sacuvan.');
		} catch (error) { toast(`Avancement nije sacuvan : ${error.message || 'greska'}`); }
	});
	document.querySelector('#quick-worker-form')?.addEventListener('submit', async (event) => { event.preventDefault(); try { const values = formValues(event.currentTarget); values.email = values.contact; const created = await request('/workers', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(values) }); event.currentTarget.reset(); await Promise.allSettled([loadUsers(), loadMessages(), loadPayroll(), loadTime()]); toast(created.delivery === 'email' ? 'Email poziv je poslat radniku da sam izabere password.' : `Link za radnika (pošalji ručno): ${created.setupUrl}`); } catch (error) { let message = 'Ouvrier nije dodat.'; try { const details = JSON.parse(error.message); if (details.error === 'Worker already exists') message = 'Ovaj radnik vec postoji.'; if (details.error?.includes('chantier')) message = 'Izaberi najmanje jedan chantier za radnika.'; } catch {} toast(message); } });
	const userRoleField = document.querySelector('#user-role'); const updateUserRoleFields = () => { const role = userRoleField?.value; const siretField = document.querySelector('#siret-field'); const companyField = document.querySelector('#company-field'); const rateFields = document.querySelectorAll('.rate-field'); const projectField = document.querySelector('#user-project-field'); const projectSelect = document.querySelector('#user-project-field select'); if (siretField) { siretField.hidden = role !== 'gerant'; siretField.querySelector('input').required = role === 'gerant'; } if (companyField) { companyField.hidden = role !== 'gerant'; companyField.querySelector('input').required = role === 'gerant'; } rateFields.forEach((field) => { field.hidden = role !== 'user'; }); if (projectField) projectField.hidden = role !== 'user'; if (projectSelect) projectSelect.required = role === 'user'; }; userRoleField?.addEventListener('change', updateUserRoleFields); updateUserRoleFields(); wireSiretLookup(document.querySelector('#user-form')?.elements.siret, document.querySelector('#user-company-preview'), document.querySelector('#user-form')?.elements.company);
	const userFormAvatarInput = document.querySelector('#user-form-avatar-input');
	const userFormAvatarPreview = document.querySelector('#user-form-avatar-preview');
	userFormAvatarInput?.addEventListener('change', () => { const file = userFormAvatarInput.files[0]; if (!file || !userFormAvatarPreview) return; userFormAvatarPreview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="" />`; });
		document.querySelector('#user-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const created = await request('/users', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(formValues(event.currentTarget)) }); let avatarWarning = ''; const avatarFile = userFormAvatarInput?.files[0]; if (avatarFile && created.id) { const avatarBody = new FormData(); avatarBody.set('avatar', avatarFile); try { const avatarResponse = await fetch(`${api}/users/${encodeURIComponent(created.id)}/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: avatarBody }); if (!avatarResponse.ok) throw new Error(); } catch { avatarWarning = ' Photo non enregistrée ; réessayez depuis la modification du profil.'; } } event.currentTarget.reset(); if (userFormAvatarPreview) userFormAvatarPreview.innerHTML = '?'; updateUserRoleFields(); await refreshActiveView(); const delivery = created.delivery === 'email' ? 'e-mail' : `lien local : ${created.setupUrl}`; toast(`Utilisateur ajouté. Lien de choix du mot de passe envoyé via ${delivery}.${avatarWarning}`); } catch (error) { let message = 'Utilisateur non ajouté.'; try { const details = JSON.parse(error.message); if (details.error === 'User already exists') message = 'Cet e-mail existe déjà.'; if (details.error?.includes('chantier')) message = 'Sélectionnez au moins un chantier pour l’ouvrier.'; if (details.error?.includes('Email delivery') || details.error?.includes('email')) message = 'E-mail non envoyé : configurez SMTP/Brevo sur Render.'; if (details.error === 'Access denied') message = 'Seul le gérant peut ajouter des utilisateurs.'; } catch {} toast(message); } });
	async function submitDocumentUpload({ form, fileInput, message, projectId, stay }) {
		const file = fileInput.files[0];
		message.textContent = '';
		message.classList.remove('error');
		if (!file) { message.classList.add('error'); message.textContent = 'Sélectionnez un fichier avant l’enregistrement.'; return; }
		if (!projectId) { message.classList.add('error'); message.textContent = 'Choisissez un chantier dans la liste avant d’enregistrer. Si la liste est vide, créez d’abord un chantier dans l’onglet Devis.'; return; }
		const body = new FormData(form);
		body.set('file', file, file.name);
		body.set('projectId', projectId);
		body.set('responseLanguage', language);
		const submitButton = form.querySelector('button');
		const submitButtonLabel = submitButton?.textContent;
		if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Enregistrement en cours…'; }
		message.textContent = 'Enregistrement en cours… sur chantier avec un réseau faible, l’envoi d’un gros fichier peut prendre plusieurs minutes - ne fermez pas cette page.';
		try {
			// The upload itself only saves the file and the document record - it no longer waits for the AI
			// analysis (that used to run inline here and could take well over a minute for a large technical
			// PDF, timing out the whole request at an infra level even though the file was already safely
			// uploaded). Analysis is requested separately right below, so a slow or failed analysis can never
			// again make it look like the document itself wasn't saved.
			// Timeout is generous (4 min, not 90s) because this step's real bottleneck on a chantier is the
			// WORKER'S OWN mobile upload speed, not server processing - a large scanned plan PDF (up to the
			// 25MB server limit) over weak on-site cellular data can genuinely take minutes to transfer, and
			// cutting it off early would silently throw away a real upload in progress for no server-side reason.
			const response = await fetch(`${api}/documents/upload`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body, signal: AbortSignal.timeout(240000) });
			const result = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(result.error || `${response.status}`);
			form.reset();
			if (form.elements.projectId) form.elements.projectId.value = projectId;
			message.textContent = '';
			await refreshActiveView();
			if (!stay) showView('evidence-summary-view');
			toast('Document enregistré.');
			if (result.duplicateOfId) toast(`⚠ Ce fichier semble déjà avoir été ajouté (« ${result.duplicateOfName || 'document existant'} »). Vérifiez avant de garder les deux.`);
			const answerTarget = document.querySelector('#ai-answer');
			if (answerTarget) answerTarget.innerHTML = `<div class="list-item auto-analysis"><strong>Analyse automatique en cours…</strong><p>Le document est déjà enregistré ; l’analyse peut prendre jusqu’à une minute.</p></div>`;
			try {
				const analyzeResponse = await fetch(`${api}/documents/${result.id}/analyze`, { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token()}`}, body: JSON.stringify({ responseLanguage: language }), signal: AbortSignal.timeout(90000) });
				const analyzeResult = await analyzeResponse.json().catch(() => ({}));
				if (analyzeResponse.ok && analyzeResult.autoAnalysis && renderAutoAnalysis(answerTarget, analyzeResult.autoAnalysis)) toast('Analyse automatique terminée.');
				else if (answerTarget) answerTarget.innerHTML = `<div class="list-item auto-analysis"><strong>Analyse indisponible</strong><p>Le document est bien enregistré. Ouvrez-le manuellement pour vérifier son contenu.</p></div>`;
			} catch {
				if (answerTarget) answerTarget.innerHTML = `<div class="list-item auto-analysis"><strong>Analyse indisponible</strong><p>Le document est bien enregistré. Ouvrez-le manuellement pour vérifier son contenu.</p></div>`;
			}
		} catch (error) {
			message.classList.add('error');
			message.textContent = error.name === 'TimeoutError' || error.name === 'AbortError' ? 'L’envoi prend trop de temps (plus de 4 min) - probablement un réseau faible sur le chantier. Le document est peut-être quand même enregistré ; vérifiez la liste ci-contre avant de réessayer.' : `Document non enregistré : ${error.message || 'erreur inconnue'}`;
			toast('Document non enregistré ou sans réponse. Voir le message sous le formulaire.');
		} finally {
			if (submitButton) { submitButton.disabled = false; submitButton.textContent = submitButtonLabel; }
		}
	}
	document.querySelectorAll('select[name="evidenceType"]').forEach((select) => {
		const toggle = () => { const field = select.closest('form')?.querySelector('.plan-type-field'); if (field) field.hidden = select.value !== 'plan'; };
		select.addEventListener('change', toggle);
		toggle();
	});
	document.querySelector('#upload-form').addEventListener('submit', async (event) => {
		event.preventDefault();
		const form = event.currentTarget;
		const message = document.querySelector('#upload-form-message') || (() => { const p = document.createElement('p'); p.id = 'upload-form-message'; p.className = 'error'; form.append(p); return p; })();
		await submitDocumentUpload({ form, fileInput: document.querySelector('#file-input'), message, projectId: form.elements.projectId.value, stay: false });
	});
	document.querySelector('#evidence-upload-form')?.addEventListener('submit', async (event) => {
		event.preventDefault();
		const form = event.currentTarget;
		const message = document.querySelector('#evidence-upload-message');
		await submitDocumentUpload({ form, fileInput: document.querySelector('#evidence-file-input'), message, projectId: currentProjectId(), stay: true });
	});
	document.querySelector('#upload-form select[name="projectId"]')?.addEventListener('change', (event) => {
		const button = document.querySelector('#upload-form-delete-chantier');
		if (!button) return;
		button.hidden = !event.currentTarget.value;
		button.dataset.project = event.currentTarget.value;
	});
	document.querySelector('#upload-form-delete-chantier')?.addEventListener('click', async (event) => {
		const button = event.currentTarget;
		const projectId = button.dataset.project;
		if (!projectId) return;
		const projectName = projectsCache.find((project) => project.id === projectId)?.name || projectId;
		if (!window.confirm(`Supprimer le chantier ${projectName} et les données associées ?`)) return;
		button.disabled = true; button.setAttribute('aria-busy', 'true');
		try {
			await request(`/projects/${projectId}`, { method: 'DELETE' });
			toast('Chantier je obrisan.');
			await refreshActiveView();
		} catch { toast('Suppression impossible.'); }
		finally { button.disabled = false; button.removeAttribute('aria-busy'); }
	});
	document.querySelector('#goto-documents-button')?.addEventListener('click', () => showView('documents-view'));
	document.querySelector('#ai-form')?.addEventListener('submit', async (event) => {
		event.preventDefault();
		const message = document.querySelector('#ai-form-message');
		if (message) message.textContent = '';
		const projectId = currentProjectId();
		if (!projectId) { if (message) message.textContent = language === 'fr' ? 'Sélectionnez un chantier actif.' : 'Izaberite aktivni chantier.'; return; }
		const question = String(new FormData(event.currentTarget).get('question') || '').trim();
		if (!question) return;
		try {
			const result = await request('/ai/technical-answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, projectId, responseLanguage: language }) });
			renderTechnicalAnswer(document.querySelector('#ai-answer'), result);
		} catch (error) {
			let details = ''; try { details = JSON.parse(error.message)?.error || ''; } catch { details = error.message || ''; }
			if (message) message.textContent = (language === 'fr' ? 'Impossible d’obtenir une réponse : ' : 'Réponse non obtenue : ') + (details || (language === 'fr' ? 'réessayez.' : 'réessayez.'));
		}
	});
	let pendingDevisLineItems = [];
	let pendingDevisLineItemsSource = 'manual';
	function renderPendingLineItems() {
		const panel = document.querySelector('#devis-line-items-pending-panel');
		const container = document.querySelector('#devis-line-items-pending-table');
		if (!panel || !container) return;
		if (!pendingDevisLineItems.length) { panel.hidden = true; container.innerHTML = ''; return; }
		panel.hidden = false;
		const aiWarning = pendingDevisLineItemsSource === 'ai'
			? '<p class="ai-badge">⚠ Lignes lues par IA depuis un PDF/photo — comparez les quantités avec le document original avant de confirmer, surtout si vous vérifiez un devis reçu d’un autre intervenant.</p>'
			: '';
		container.innerHTML = aiWarning + pendingDevisLineItems.map((item, index) => `<div class="list-item" data-pending-index="${index}"><label>Inclure<input type="checkbox" data-field="include" checked /></label><label>Catégorie<input type="text" data-field="category" value="${escapeHtml(item.category || '')}" /></label><label>Description<input type="text" data-field="description" value="${escapeHtml(item.description || '')}" /></label><label>Quantité<input type="number" step="0.01" data-field="quantity" value="${item.quantity ?? ''}" /></label><label>Unité<input type="text" data-field="unit" value="${escapeHtml(item.unit || '')}" /></label><label>Prix unitaire EUR<input type="number" step="0.01" data-field="unitPrice" value="${item.unitPrice ?? ''}" /></label><label>Total EUR<input type="number" step="0.01" data-field="lineTotal" value="${item.lineTotal ?? ''}" /></label></div>`).join('');
	}
	let pendingBudgetProjectCreation = null;
	async function ensureBudgetProjectId() {
		const form = document.querySelector('#budget-form');
		const select = form?.querySelector('[name="projectId"]');
		if (!select) return currentProjectId();
		if (select.value !== '__new') return select.value;
		if (pendingBudgetProjectCreation) return pendingBudgetProjectCreation;
		pendingBudgetProjectCreation = (async () => {
			const chantierName = form.querySelector('[name="chantierName"]').value.trim() || form.querySelector('[name="client"]').value.trim() || 'Nouveau chantier';
			const project = await request('/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: chantierName, chantierName }) });
			await loadProjectOptions();
			select.value = project.id;
			return project.id;
		})();
		try { return await pendingBudgetProjectCreation; }
		finally { pendingBudgetProjectCreation = null; }
	}
	document.querySelector('#devis-line-items-confirm-button')?.addEventListener('click', async () => {
		const button = document.querySelector('#devis-line-items-confirm-button');
		let projectId;
		try { projectId = await ensureBudgetProjectId(); } catch { toast('Impossible de créer le chantier.'); return; }
		if (!projectId) { toast('Enregistrez d’abord le devis pour créer le chantier.'); return; }
		const rows = [...document.querySelectorAll('#devis-line-items-pending-table [data-pending-index]')];
		const items = rows.filter((row) => row.querySelector('[data-field="include"]').checked).map((row) => ({
			category: row.querySelector('[data-field="category"]').value.trim(),
			description: row.querySelector('[data-field="description"]').value.trim(),
			quantity: Number(row.querySelector('[data-field="quantity"]').value || 0),
			unit: row.querySelector('[data-field="unit"]').value.trim(),
			unitPrice: Number(row.querySelector('[data-field="unitPrice"]').value || 0),
			lineTotal: Number(row.querySelector('[data-field="lineTotal"]').value || 0)
		})).filter((item) => item.description);
		if (!items.length) { toast('Sélectionnez au moins une ligne.'); return; }
		button.disabled = true; button.setAttribute('aria-busy', 'true');
		try {
			await request(`/projects/${projectId}/budget/line-items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, source: pendingDevisLineItemsSource }) });
			pendingDevisLineItems = [];
			pendingDevisLineItemsSource = 'manual';
			renderPendingLineItems();
			toast('Tâches créées à partir du devis.');
			if (document.querySelector('.view.active')?.id === 'line-items-view') await loadLineItems();
		} catch { toast('Impossible de créer les tâches.'); }
		finally { button.disabled = false; button.removeAttribute('aria-busy'); }
	});
	const lineItemStatusMeta = {
		unassigned: { label: 'Non assignée', className: 'status-pending' },
		assigned: { label: 'Assignée', className: 'status-attention' },
		in_progress: { label: 'En cours', className: 'status-attention' },
		done: { label: 'Terminée', className: 'status-good' }
	};
	async function loadLineItems() {
		const container = document.querySelector('#line-items-list');
		if (!container) return;
		const select = document.querySelector('#line-items-project-select');
		const projectId = select?.value || currentProjectId();
		const deleteProjectButton = document.querySelector('#line-items-delete-project-button');
		if (deleteProjectButton) {
			deleteProjectButton.hidden = !projectId;
			deleteProjectButton.dataset.project = projectId || '';
		}
		const quickTaskForm = document.querySelector('#quick-task-form');
		if (quickTaskForm) {
			quickTaskForm.hidden = !projectId;
			quickTaskForm.dataset.project = projectId || '';
		}
		if (!projectId) { container.innerHTML = '<small>Sélectionnez un chantier.</small>'; return; }
		try {
			const [items, contacts] = await Promise.all([request(`/projects/${projectId}/budget/line-items`), request('/contacts')]);
			if (!items.length) { container.innerHTML = '<small>Aucune ligne de devis pour ce chantier. Importez un devis depuis Budget.</small>'; return; }
			const eligibleWorkers = contacts.filter((contact) => isOwner(contact.role) || (contact.projectIds || []).includes(projectId));
			const workerOptions = eligibleWorkers.map((contact) => `<option value="${escapeHtml(contact.id)}">${escapeHtml(contact.name)}</option>`).join('');
			const categories = new Map();
			items.forEach((item) => {
				const key = item.category || item.description;
				if (!categories.has(key)) categories.set(key, []);
				categories.get(key).push(item);
			});
			container.innerHTML = [...categories.entries()].map(([category, rows]) => {
				const allDone = rows.every((row) => row.status === 'done');
				const anyAssigned = rows.some((row) => row.status !== 'unassigned');
				const meta = allDone ? lineItemStatusMeta.done : anyAssigned ? lineItemStatusMeta.assigned : lineItemStatusMeta.unassigned;
				const assignedName = eligibleWorkers.find((contact) => contact.id === rows[0].assignedTo)?.name || rows[0].assignedToName || '';
				const total = rows.reduce((sum, row) => sum + Number(row.lineTotal || 0), 0);
				const spent = rows.reduce((sum, row) => sum + Number(row.spent || 0), 0);
				const rowsHtml = rows.map((row) => `<li>${escapeHtml(row.description)} — ${row.quantity} ${escapeHtml(row.unit || '')} · ${formatEUR(row.lineTotal)}${Number(row.unitPrice) <= 0 ? ' <span class="production-method-tag plan-type-existant-tag">Sans prix</span>' : ''} <button type="button" class="secondary edit-line-item" data-item="${row.id}" data-quantity="${row.quantity}" data-unit="${escapeHtml(row.unit || '')}" data-price="${row.unitPrice}">Modifier</button></li>`).join('');
				return `<div class="list-item" data-category="${encodeURIComponent(category)}"><strong>${escapeHtml(category)}</strong><ul class="category-rows">${rowsHtml}</ul><span>Total : ${formatEUR(total)} · Dépensé : ${formatEUR(spent)} · Profit : ${formatEUR(total - spent)}</span><span class="worker-status ${meta.className}"><span class="worker-status-dot" aria-hidden="true"></span>${meta.label}${assignedName ? ` · ${escapeHtml(assignedName)}` : ''}</span>${allDone ? '' : `<form class="line-item-assign-form form-row" data-category-assign="${encodeURIComponent(category)}"><select name="workerId" required><option value="">Choisir un ouvrier</option>${workerOptions}</select><input type="file" name="file" accept="application/pdf,.pdf,image/jpeg,image/png" /><button type="submit" class="secondary">Dodijeli / Assigner la catégorie</button></form>`}<button type="button" class="danger" data-category-delete="${encodeURIComponent(category)}">Supprimer cette catégorie</button></div>`;
			}).join('');
			container.querySelectorAll('[data-category-assign]').forEach((form) => form.addEventListener('submit', async (event) => {
				event.preventDefault();
				const category = form.dataset.categoryAssign;
				const button = form.querySelector('button');
				const body = new FormData(form);
				if (!body.get('workerId')) { toast('Choisissez un ouvrier.'); return; }
				button.disabled = true; button.setAttribute('aria-busy', 'true');
				try {
					const response = await fetch(`${api}/projects/${projectId}/budget/categories/${category}/assign`, { method: 'PATCH', headers: { Authorization: `Bearer ${token()}` }, body });
					if (!response.ok) throw new Error();
					toast('Catégorie assignée.');
					await loadLineItems();
				} catch { toast('Assignation impossible.'); }
				finally { button.disabled = false; button.removeAttribute('aria-busy'); }
			}));
			container.querySelectorAll('[data-category-delete]').forEach((button) => button.addEventListener('click', async () => {
				const category = button.dataset.categoryDelete;
				if (!confirm('Supprimer définitivement cette catégorie et toutes ses lignes de devis ?')) return;
				button.disabled = true; button.setAttribute('aria-busy', 'true');
				try {
					await request(`/projects/${projectId}/budget/categories/${category}`, { method: 'DELETE' });
					toast('Catégorie supprimée.');
					await loadLineItems();
				} catch { toast('Suppression impossible.'); button.disabled = false; button.removeAttribute('aria-busy'); }
			}));
			container.querySelectorAll('.edit-line-item').forEach((button) => button.addEventListener('click', async () => {
				const quantityInput = window.prompt('Quantité :', button.dataset.quantity);
				if (quantityInput === null) return;
				const quantity = Number(quantityInput);
				if (!Number.isFinite(quantity) || quantity < 0) { toast('Quantité invalide.'); return; }
				const unitInput = window.prompt('Unité (m², ml, unité...) :', button.dataset.unit);
				if (unitInput === null) return;
				const priceInput = window.prompt('Prix unitaire (€) - laissez 0 si pas encore connu :', button.dataset.price);
				if (priceInput === null) return;
				const unitPrice = Number(priceInput);
				if (!Number.isFinite(unitPrice) || unitPrice < 0) { toast('Prix invalide.'); return; }
				button.disabled = true; button.setAttribute('aria-busy', 'true');
				try {
					await request(`/budget/line-items/${button.dataset.item}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity, unit: unitInput.trim(), unitPrice }) });
					toast('Stavka izmijenjena.');
					await loadLineItems();
				} catch { toast('Modification impossible.'); button.disabled = false; button.removeAttribute('aria-busy'); }
			}));
		} catch { container.innerHTML = '<small>Impossible de charger les lignes de devis.</small>'; }
	}
	document.querySelector('#line-items-project-select')?.addEventListener('change', loadLineItems);
	document.querySelector('#line-items-delete-project-button')?.addEventListener('click', async (event) => {
		const button = event.currentTarget;
		const projectId = button.dataset.project;
		if (!projectId) return;
		const projectName = projectsCache.find((project) => project.id === projectId)?.name || projectId;
		if (!window.confirm(`Supprimer le chantier ${projectName} et les données associées ?`)) return;
		button.disabled = true; button.setAttribute('aria-busy', 'true');
		try {
			await request(`/projects/${projectId}`, { method: 'DELETE' });
			toast('Chantier je obrisan.');
			await loadProjectOptions();
			await loadLineItems();
		} catch { toast('Suppression impossible.'); }
		finally { button.disabled = false; button.removeAttribute('aria-busy'); }
	});
	// A chantier with no devis yet (common for a quick site visit or prep work before a formal quote
	// exists) previously had no way at all to tell a worker what to do - the entire task/assignment
	// system runs on devis line items. This creates a minimal one (no price, quantity 1, its own
	// description as the category) through the exact same endpoint and assignment UI already used for
	// real devis lines, instead of building a second, parallel task system.
	document.querySelector('#quick-task-form')?.addEventListener('submit', async (event) => {
		event.preventDefault();
		const form = event.currentTarget;
		const projectId = form.dataset.project;
		if (!projectId) return;
		const description = form.elements.description.value.trim();
		if (!description) return;
		const button = form.querySelector('button');
		button.disabled = true; button.setAttribute('aria-busy', 'true');
		try {
			await request(`/projects/${projectId}/budget/line-items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ description, quantity: 1, unit: '', unitPrice: 0, lineTotal: 0, category: description }], source: 'manual' }) });
			form.reset();
			toast('Tâche créée.');
			await loadLineItems();
		} catch { toast('Tâche non créée.'); }
		finally { button.disabled = false; button.removeAttribute('aria-busy'); }
	});
	async function loadMyTasks() {
		const container = document.querySelector('#my-tasks-list');
		if (!container || isOwner()) return;
		try {
			const tasks = await request('/tasks/mine');
			if (!tasks.length) { container.innerHTML = '<small>Aucune tâche assignée.</small>'; return; }
			const categories = new Map();
			tasks.forEach((task) => {
				const key = `${task.projectId}::${task.category || task.description}`;
				if (!categories.has(key)) categories.set(key, { projectId: task.projectId, category: task.category || task.description, rows: [] });
				categories.get(key).rows.push(task);
			});
			container.innerHTML = [...categories.values()].map((group) => {
				const allDone = group.rows.every((row) => row.status === 'done');
				const rowsHtml = group.rows.map((row) => `<li>${escapeHtml(row.description)} — ${row.quantity} ${escapeHtml(row.unit || '')}${row.attachmentName ? ` · <button type="button" class="secondary view-task-attachment" data-task-attachment="${row.id}">Voir le plan / la fiche</button>` : ''}</li>`).join('');
				return `<div class="list-item" data-task-category="${encodeURIComponent(group.category)}" data-task-project="${group.projectId}"><strong>${escapeHtml(group.category)}</strong><ul class="category-rows">${rowsHtml}</ul>${allDone ? '<span class="worker-status status-good"><span class="worker-status-dot" aria-hidden="true"></span>Terminée · en attente de la prochaine tâche du gérant</span>' : `<form class="task-complete-form form-row" data-task-complete="${encodeURIComponent(group.category)}" data-task-complete-project="${group.projectId}"><label>Photo (optionnelle)<input type="file" name="photo" accept="image/jpeg,image/png" /></label><button type="submit" class="secondary">Marquer la catégorie terminée</button></form>`}</div>`;
			}).join('');
			container.querySelectorAll('.view-task-attachment').forEach((button) => button.addEventListener('click', () => viewDocument(`/tasks/${button.dataset.taskAttachment}/attachment`, button)));
			container.querySelectorAll('[data-task-complete]').forEach((form) => form.addEventListener('submit', async (event) => {
				event.preventDefault();
				const category = form.dataset.taskComplete;
				const projectId = form.dataset.taskCompleteProject;
				const button = form.querySelector('button');
				const body = new FormData(form);
				button.disabled = true; button.setAttribute('aria-busy', 'true');
				try {
					const response = await fetch(`${api}/projects/${projectId}/tasks/category/${category}/complete`, { method: 'PATCH', headers: { Authorization: `Bearer ${token()}` }, body });
					if (!response.ok) throw new Error();
					toast('Catégorie marquée terminée. Le gérant a été notifié.');
					await loadMyTasks();
				} catch { toast('Mise à jour impossible.'); }
				finally { button.disabled = false; button.removeAttribute('aria-busy'); }
			}));
		} catch { container.innerHTML = '<small>Impossible de charger vos tâches.</small>'; }
	}
	const factureStatusMeta = {
		green: { label: 'Payée', className: 'status-good' },
		orange: { label: 'En attente', className: 'status-attention' },
		red: { label: 'En retard', className: 'status-critical' }
	};
	async function loadFactures() {
		const container = document.querySelector('#factures-list');
		if (!container) return;
		const select = document.querySelector('#facture-project-select');
		const projectId = select?.value || currentProjectId();
		if (!projectId) { container.innerHTML = '<small>Sélectionnez un chantier.</small>'; return; }
		try {
			const factures = await request(`/projects/${projectId}/factures`);
			if (!factures.length) { container.innerHTML = '<small>Aucune facture.</small>'; return; }
			container.innerHTML = factures.map((facture) => {
				const meta = factureStatusMeta[facture.colorStatus] || factureStatusMeta.orange;
				return `<div class="list-item" data-facture="${facture.id}"><strong>${escapeHtml(facture.invoiceNumber || 'Facture')} · ${escapeHtml(facture.clientName || '')}</strong>${facture.duplicateOfId ? `<span class="production-method-tag duplicate-tag" title="Doublon possible d’une facture déjà enregistrée">⚠ Doublon possible</span>` : ''}<span class="worker-status ${meta.className}"><span class="worker-status-dot" aria-hidden="true"></span>${meta.label}</span><span>${formatEUR(facture.amount)} · échéance ${escapeHtml(facture.dueDate || '')}</span><div class="form-row">${facture.sourceFile ? `<button type="button" class="secondary view-facture-document" data-facture-document="${facture.id}">Voir le PDF</button>` : ''}${facture.status !== 'paid' ? `<button type="button" class="secondary mark-facture-paid" data-facture-mark-paid="${facture.id}">Marquer payée</button>` : ''}${facture.colorStatus === 'red' ? `<button type="button" class="secondary send-facture-relance" data-facture-relance="${facture.id}">Envoyer un rappel</button>` : ''}<button type="button" class="secondary danger delete-facture" data-facture-delete="${facture.id}">Supprimer</button></div></div>`;
			}).join('');
			container.querySelectorAll('.view-facture-document').forEach((button) => button.addEventListener('click', () => viewDocument(`/factures/${button.dataset.factureDocument}/document`, button)));
			container.querySelectorAll('.mark-facture-paid').forEach((button) => button.addEventListener('click', async () => {
				button.disabled = true; button.setAttribute('aria-busy', 'true');
				try { await request(`/factures/${button.dataset.factureMarkPaid}/mark-paid`, { method: 'PATCH' }); toast('Facture marquée payée.'); await loadFactures(); }
				catch { toast('Impossible de marquer la facture payée.'); }
				finally { button.disabled = false; button.removeAttribute('aria-busy'); }
			}));
			container.querySelectorAll('.delete-facture').forEach((button) => button.addEventListener('click', async () => {
				if (!window.confirm('Supprimer définitivement cette facture ?')) return;
				button.disabled = true; button.setAttribute('aria-busy', 'true');
				try { await request(`/factures/${button.dataset.factureDelete}`, { method: 'DELETE' }); toast('Facture supprimée.'); await loadFactures(); }
				catch { toast('Facture non supprimée.'); button.disabled = false; button.removeAttribute('aria-busy'); }
			}));
			container.querySelectorAll('.send-facture-relance').forEach((button) => button.addEventListener('click', async () => {
				if (!window.confirm('Envoyer un e-mail de rappel au client pour cette facture ?')) return;
				button.disabled = true; button.setAttribute('aria-busy', 'true');
				try { await request(`/factures/${button.dataset.factureRelance}/relance`, { method: 'POST' }); toast('Rappel envoyé au client.'); await loadFactures(); }
				catch (error) { let details = ''; try { details = JSON.parse(error.message)?.error || ''; } catch { details = ''; } toast(details || 'Envoi du rappel impossible.'); }
				finally { button.disabled = false; button.removeAttribute('aria-busy'); }
			}));
		} catch { container.innerHTML = '<small>Impossible de charger les factures.</small>'; }
	}
	document.querySelector('#facture-project-select')?.addEventListener('change', loadFactures);
	document.querySelector('#facture-file')?.addEventListener('change', async (event) => { const file = event.currentTarget.files[0]; if (!file) return; const body = new FormData(); body.append('file', file); const status = document.querySelector('#facture-extraction-status'); status.textContent = 'Lecture du PDF...'; try { const response = await fetch(`${api}/factures/inspect`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); if (!response.ok) throw new Error(); const result = await response.json(); const form = document.querySelector('#facture-form'); if (result.extracted.invoiceNumber) form.querySelector('[name="invoiceNumber"]').value = result.extracted.invoiceNumber; if (result.extracted.clientName) form.querySelector('[name="clientName"]').value = result.extracted.clientName; if (result.extracted.clientEmail) form.querySelector('[name="clientEmail"]').value = result.extracted.clientEmail; if (result.extracted.amount) form.querySelector('[name="amount"]').value = result.extracted.amount; if (result.extracted.issuedDate) form.querySelector('[name="issuedDate"]').value = result.extracted.issuedDate; if (result.extracted.dueDate) form.querySelector('[name="dueDate"]').value = result.extracted.dueDate; status.textContent = result.needsConfirmation ? 'Le PDF a été lu partiellement. Vérifiez les champs avant l’enregistrement.' : `Lu automatiquement depuis : ${result.source}`; } catch { status.textContent = 'Impossible de lire le PDF automatiquement. Saisissez les valeurs manuellement.'; } });
	document.querySelector('#facture-form')?.addEventListener('submit', async (event) => {
		event.preventDefault();
		const form = event.currentTarget;
		const projectId = form.querySelector('[name="projectId"]').value || currentProjectId();
		if (!projectId) { toast('Sélectionnez un chantier.'); return; }
		const body = new FormData(form);
		body.set('projectId', projectId);
		const file = document.querySelector('#facture-file').files[0];
		if (file) body.set('file', file, file.name);
		const submitButton = form.querySelector('button.primary');
		submitButton.disabled = true; submitButton.setAttribute('aria-busy', 'true');
		try {
			const response = await fetch(`${api}/projects/${projectId}/factures`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body });
			const result = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error();
			form.reset();
			toast(result.duplicateOfId ? `Facture enregistrée. ⚠ Doublon possible (numéro ou fichier déjà utilisé).` : 'Facture enregistrée.');
			await loadFactures();
		} catch { toast('Facture non enregistrée.'); }
		finally { submitButton.disabled = false; submitButton.removeAttribute('aria-busy'); }
	});
	async function populatePurchaseLineItemSelect() {
		const select = document.querySelector('#purchase-form [name="lineItemId"]');
		const projectSelect = document.querySelector('#purchase-form [name="projectId"]');
		if (!select || !projectSelect) return;
		const projectId = projectSelect.value;
		if (!projectId) { select.innerHTML = '<option value="">Aucune</option>'; return; }
		try {
			const items = await request(`/projects/${projectId}/budget/line-items`);
			select.innerHTML = `<option value="">Aucune</option>${items.map((item) => `<option value="${item.id}">${escapeHtml(item.description)}</option>`).join('')}`;
		} catch { select.innerHTML = '<option value="">Aucune</option>'; }
	}
	document.querySelector('#purchase-form [name="projectId"]')?.addEventListener('change', populatePurchaseLineItemSelect);
	document.querySelector('#budget-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const file = document.querySelector('#budget-file').files[0]; const form = event.currentTarget; const submitButton = form.querySelector('button.primary'); const originalLabel = submitButton?.textContent; if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Enregistrement...'; submitButton.setAttribute('aria-busy', 'true'); } const sendBudget = async (replaceExisting = false) => { const projectId = await ensureBudgetProjectId(); const body = new FormData(form); body.set('projectId', projectId); if (file) body.set('file', file, file.name); if (replaceExisting) body.set('replaceExisting', 'true'); return fetch(`${api}/projects/${projectId}/budget`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); }; try { let response = await sendBudget(false); if (response.status === 409 && window.confirm('Un Devis existe deja pour ce chantier. Remplacer par le nouveau PDF ?')) response = await sendBudget(true); if (!response.ok) { const details = await response.text(); throw new Error(`${response.status}: ${details}`); } form.reset(); await refreshActiveView(); toast('Devis et chantier enregistres.'); } catch (error) { toast(`Devis non enregistre : ${error.message || 'erreur inconnue'}`); } finally { if (submitButton) { submitButton.disabled = false; submitButton.textContent = originalLabel; submitButton.removeAttribute('aria-busy'); } } });
	document.querySelector('#budget-file')?.addEventListener('change', async (event) => { const file = event.currentTarget.files[0]; if (!file) return; const body = new FormData(); body.append('file', file); const status = document.querySelector('#devis-extraction-status'); status.textContent = 'Lecture du fichier...'; try { const response = await fetch(`${api}/budget/inspect`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); if (!response.ok) throw new Error(); const result = await response.json(); const form = document.querySelector('#budget-form'); form.querySelector('[name="devisNumber"]').value = result.extracted.number; form.querySelector('[name="client"]').value = result.extracted.client; form.querySelector('[name="chantierName"]').value = result.extracted.chantier; form.querySelector('[name="total"]').value = result.extracted.total || ''; const projectSelect = form.querySelector('[name="projectId"]'); const chantierText = result.extracted.chantier.toLowerCase(); const matchingOption = [...projectSelect.options].find((option) => option.value !== '__new' && chantierText && option.textContent.toLowerCase().includes(chantierText)); projectSelect.value = matchingOption ? matchingOption.value : '__new'; status.textContent = result.needsConfirmation ? 'Le PDF a été lu partiellement. Vérifiez les champs signalés avant d’enregistrer.' : `Lu automatiquement depuis : ${result.source}`; pendingDevisLineItems = Array.isArray(result.lineItems) ? result.lineItems : []; pendingDevisLineItemsSource = result.lineItemsSource === 'ai' ? 'ai' : result.lineItemsSource === 'excel' ? 'excel' : 'manual'; status.textContent += result.lineItemsError ? ` · Lignes : ${result.lineItemsError}` : ` · Lignes détectées : ${pendingDevisLineItems.length}`; renderPendingLineItems(); } catch (error) { status.textContent = `Impossible de lire le fichier automatiquement (${error?.message || 'erreur inconnue'}). Saisissez les valeurs manuellement.`; } });
	document.querySelector('#budget-form [name="projectId"]')?.addEventListener('change', loadBudget);
		document.querySelector('#purchase-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const file = document.querySelector('#invoice-file').files[0]; const form = event.currentTarget; const body = new FormData(form); if (!file) { toast('Ajoutez une facture, un ticket ou une photo du justificatif.'); return; } body.append('invoice', file); const submitButton = form.querySelector('button.primary'); const originalLabel = submitButton?.textContent; if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Enregistrement...'; submitButton.setAttribute('aria-busy', 'true'); } try { const response = await fetch(`${api}/purchases`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); if (!response.ok) throw new Error(); form.reset(); await refreshActiveView(); toast('La dépense et le justificatif ont été enregistrés ; le devis est à jour.'); } catch { toast('Dépense non enregistrée.'); } finally { if (submitButton) { submitButton.disabled = false; submitButton.textContent = originalLabel; submitButton.removeAttribute('aria-busy'); } } });
	document.querySelector('#invoice-file')?.addEventListener('change', async (event) => { const file = event.currentTarget.files[0]; if (!file) return; const body = new FormData(); body.append('file', file); const status = document.querySelector('#purchase-extraction-status'); status.textContent = 'Lecture du justificatif...'; try { const response = await fetch(`${api}/pdf/inspect`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); if (!response.ok) throw new Error(); const result = await response.json(); const form = document.querySelector('#purchase-form'); form.querySelector('[name="supplier"]').value = result.extracted.supplier; if (result.extracted.description) form.querySelector('[name="description"]').value = result.extracted.description; form.querySelector('[name="amount"]').value = result.extracted.amount || ''; form.querySelector('[name="purchaseDate"]').value = result.extracted.date || ''; status.textContent = result.needsOcr ? 'Lecture automatique indisponible. Saisissez les valeurs manuellement.' : result.aiUsed ? `⚠ Lu par IA depuis : ${result.source} - à vérifier avant d’enregistrer.` : `Lu automatiquement depuis : ${result.source}`; } catch { status.textContent = 'Impossible de lire le justificatif automatiquement. Saisissez les valeurs manuellement.'; } });
	restoreSession();
});
