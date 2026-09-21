document.addEventListener('DOMContentLoaded', () => {
	const api = window.location.protocol === 'file:' ? 'http://localhost:3000/api' : `${window.location.origin}/api`;
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
	const syncAuthModalState = () => { const hidden = loginModal.classList.contains('hidden'); loginModal.setAttribute('aria-hidden', String(hidden)); appShell?.setAttribute('aria-hidden', String(!hidden)); };
	new MutationObserver(syncAuthModalState).observe(loginModal, { attributes: true, attributeFilter: ['class'] });
	syncAuthModalState();
	const ownerRoles = ['admin', 'gerant', 'manager'];
	const workerRoles = ['user', 'worker'];
	const isOwner = (role = currentUser?.role) => ownerRoles.includes(role);
	const isWorkerRole = (role) => workerRoles.includes(role);
	const toast = (message) => { const french = { 'Korisnik je dodat.': 'Utilisateur enregistré.', 'Message enregistré.': 'Message enregistré.', 'Temps de travail enregistré.': 'Temps de travail enregistré.', 'Temps de travail non enregistré.': 'Temps de travail non enregistré.', 'Korisnik nije dodat.': 'Utilisateur non enregistré.', 'Dépense non enregistrée.': 'Dépense non enregistrée.', 'Devis non enregistré.': 'Devis non enregistré.', 'Le devis et le budget ont été enregistrés.': 'Devis et budget enregistrés.' }; const translated = french[message] || String(message).replace('Dokument je obrisan.', 'Document supprimé.').replace('Dokument je preimenovan.', 'Document renommé.').replace('Kopija dokumenta je dodata.', 'Copie du document ajoutée.'); const el = document.querySelector('#toast'); el.textContent = translated; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); };
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
		closeQuickEditOutsideHandler = (event) => { if (!event.target.closest('.quick-edit-popover') && !event.target.closest('[data-quick-hours],[data-quick-rdv]')) closeQuickEditPopover(); };
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
				if (!projectId) { toast('Izaberi aktivni chantier pre dodavanja RDV-a.'); return; }
				try {
					await request('/rendezvous', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, absenceDate: date, date, time, reason, ...(workerId ? { workerId } : {}) }) });
					closeQuickEditPopover(); await onSaved(); toast('RDV enregistré.');
				} catch (error) { toast(`RDV non enregistré : ${error.message || 'erreur'}`); }
			});
			popover.querySelector('[data-qe-cancel]').addEventListener('click', closeQuickEditPopover);
		});
	}
	const formatEUR = (value) => new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'sr-Latn-RS', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(value || 0));
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
	const language = 'fr';
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
	const paintIdentityToken = (el, url, label) => { if (!el) return; el.innerHTML = url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" />` : escapeHtml(workerInitials(label)); };
	const identityTokenHtml = (url, name, classNames) => `<span class="${classNames} ${classNames.split(' ')[0]}--initials">${url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" />` : escapeHtml(workerInitials(name))}</span>`;
	const formValues = (form) => {
		const values = Object.fromEntries(new FormData(form).entries());
		if (form.elements.projectIds) values.projectIds = [...form.elements.projectIds.selectedOptions].map((option) => option.value).filter(Boolean);
		return values;
	};
	const request = async (path, options = {}) => { const response = await fetch(`${api}${path}`, { cache: 'no-store', ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token()}` } }); if (!response.ok) throw new Error(await response.text()); return response.json(); };

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
	const showView = (id) => { document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === id)); document.querySelectorAll('.nav').forEach((item) => item.classList.toggle('active', item.dataset.view === id)); document.querySelector('#page-title').textContent = document.querySelector(`[data-view="${id}"]`)?.dataset.title || 'IBRA-BA'; };
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
	document.querySelectorAll('.nav').forEach((button) => button.addEventListener('click', async () => { setMobileNav(false); showView(button.dataset.view); if (button.dataset.view === 'devis-view' && currentUser) await loadBudget(); if (button.dataset.view === 'rge-help-view') await loadRgeQualibat(); }));

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
		const assignmentOptions = projectsCache.slice().sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'fr', { sensitivity: 'base' })).map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('');
		document.querySelectorAll('select[data-project-assignment]').forEach((select) => {
			const selected = new Set([...select.selectedOptions].map((option) => option.value));
			select.innerHTML = assignmentOptions || '<option value="">Nema registrovanih chantier-a</option>';
			[...select.options].forEach((option) => { option.selected = selected.has(option.value); });
			select.disabled = !projectsCache.length;
		});
	}
	async function loadDashboard() {
		await loadProjectOptions();
		const projectId = currentProjectId();
		const project = currentProject();
		if (!projectId) {
			document.querySelector('#progress-value').textContent = '0%';
			document.querySelector('#open-controls').textContent = '0';
			document.querySelector('#controls').innerHTML = '<small>Créez d’abord un chantier dans Devis.</small>';
			document.querySelector('#project-risk').textContent = 'AUCUN CHANTIER';
			document.querySelector('#project-risk-state').textContent = 'À configurer';
			document.querySelector('#project-risk-detail').textContent = 'Sélectionnez un chantier pour afficher les priorités.';
			document.querySelector('#project-risk-action').textContent = 'Action : créer ou sélectionner un chantier.';
			return;
		}
		const controls = await request(`/projects/${projectId}/chantier-controls`);
		const completedControls = controls.filter((item) => item.status === 'complete').length;
		const progress = controls.length ? Math.round((completedControls / controls.length) * 100) : Number(project?.progress || 0);
		document.querySelector('#progress-value').textContent = `${progress}%`;
		document.querySelector('#open-controls').textContent = controls.filter((item) => item.status !== 'complete').length;
		document.querySelector('#dashboard-view .hero small').textContent = `${project?.name || 'CHANTIER'} · ${progress}% d’avancement`;
		const schedule = await request(`/projects/${projectId}/schedule`);
		const financial = await request(`/projects/${projectId}/financial-summary`);
		const missingEvidence = (await request(`/projects/${projectId}/evidence-summary`)).missing.length;
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
		document.querySelector('#controls').innerHTML = `<div class="list-item chantier-progress"><strong>${escapeHtml(project?.name || 'Chantier')} · ${progress}% zavrseno</strong><small>${completedControls}/${controls.length} kontrola zavrseno</small></div>${controls.map((item) => `<div class="list-item ${item.status === 'complete' ? 'ok' : item.status === 'incomplete' ? 'bad' : 'warn'}"><strong>${item.name}</strong><small>${item.owner} · ${item.status}</small>${canUpdate ? `<div class="control-actions"><button class="secondary control-action" data-control="${item.id}" data-status="complete">Terminer</button><button class="secondary control-action" data-control="${item.id}" data-status="incomplete">Vrati na ispravku</button></div>` : ''}</div>`).join('')}`;
		document.querySelectorAll('.control-action').forEach((button) => button.addEventListener('click', async () => { try { await request(`/chantier-controls/${button.dataset.control}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status: button.dataset.status }) }); await Promise.allSettled([loadDashboard(), loadEvidenceSummary(), loadControlHistory()]); toast('Le contrôle a été mis à jour.'); } catch (error) { try { const details = JSON.parse(error.message); toast(details.missing ? `Nedostaje dokaz: ${details.missing.join(', ')}` : 'Le contrôle n’a pas été mis à jour.'); } catch { toast('Le contrôle n’a pas été mis à jour.'); } } }));
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
	const userRoleLabels = { admin: 'Administrateur', manager: 'Manager', gerant: 'Gérant', user: 'Utilisateur', worker: 'Ouvrier' };
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
		document.querySelector('#user-edit-role-preview').textContent = userRoleLabels[user.role] || user.role || 'Utilisateur';
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
		body.innerHTML = filtered.map((snapshot) => { const user = snapshot.user; const contact = user.email || user.phone || 'Contact non renseigné'; const canManage = isOwner() && user.id !== (currentUser?.id || currentUser?.sub); const projectLabel = snapshot.assignedProjects.length ? snapshot.assignedProjects.join(', ') : 'Aucun chantier attribué'; const nextRdv = snapshot.nextRendezvous ? `${formatRosterDate(snapshot.nextRendezvous.absenceDate || snapshot.nextRendezvous.date)} · ${snapshot.nextRendezvous.time || ''}` : 'Aucun rendez-vous prévu'; return `<tr class="worker-roster-row ${workerStatusMeta[snapshot.paymentState]?.className || ''}" data-worker-row="${escapeHtml(user.id)}"><th scope="row"><div class="worker-name-cell">${identityTokenHtml(user.avatarUrl, user.name, 'worker-avatar worker-avatar--roster')}<button class="worker-detail-primary" data-worker-detail="${escapeHtml(user.id)}" type="button"><strong>${escapeHtml(user.name || 'Ouvrier')}</strong><span>Ouvrir le suivi</span></button></div><small class="worker-contact">${escapeHtml(contact)}</small><small class="worker-projects" title="${escapeHtml(projectLabel)}">${escapeHtml(projectLabel)}</small></th><td data-label="Jours"><strong>${snapshot.workedDays}</strong><small> ce mois</small></td><td data-label="Heures"><strong>${snapshot.hours.toFixed(2)}</strong><small> h</small></td><td data-label="Tarif"><span>${formatEUR(user.dailyRate || 0)}/j</span><small>${formatEUR(user.hourlyRate || 0)}/h</small></td><td data-label="Montant du mois" class="worker-amount"><strong>${formatEUR(snapshot.amount)}</strong><small>${snapshot.entries.length ? `${snapshot.entries.length} saisies` : 'aucune saisie'}</small></td><td data-label="Paiement" class="worker-payment-cell">${renderRosterStatus(snapshot)}</td><td data-label="Prochain RDV"><span class="worker-next-rdv">${escapeHtml(nextRdv)}</span>${snapshot.nextRendezvous?.reason ? `<small>${escapeHtml(snapshot.nextRendezvous.reason)}</small>` : ''}</td><td data-label="Actions" class="worker-actions-cell"><div class="worker-row-actions"><button class="secondary worker-detail-primary worker-detail-action" data-worker-detail="${escapeHtml(user.id)}" type="button">Ouvrir</button>${isOwner() && snapshot.entries.length && snapshot.paymentState !== 'good' ? `<button class="primary worker-detail-action worker-paid-quick" data-mark-paid="${escapeHtml(user.id)}" data-mark-paid-month="${escapeHtml(snapshot.month)}" type="button" title="Marquer comme payé" aria-label="Marquer ${escapeHtml(user.name || 'cet ouvrier')} comme payé">✓</button>` : ''}${canManage ? `<div class="worker-action-menu-wrap"><button class="secondary worker-action-menu-trigger" data-worker-menu="${escapeHtml(user.id)}" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Actions pour ${escapeHtml(user.name || 'cet ouvrier')}">⋯</button><div class="worker-action-menu" role="menu" hidden><button type="button" role="menuitem" data-worker-action="edit" data-worker="${escapeHtml(user.id)}">Modifier le profil</button><button type="button" role="menuitem" data-worker-action="reset" data-worker="${escapeHtml(user.id)}"${user.email ? '' : ' disabled'}>Envoyer le lien de mot de passe</button><button type="button" role="menuitem" class="danger" data-worker-action="delete" data-worker="${escapeHtml(user.id)}">Supprimer l’ouvrier</button></div></div>` : ''}</div></td></tr>`; }).join('');
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
		const [year, monthNumber] = month.split('-').map(Number); const first = new Date(year, monthNumber - 1, 1); const last = new Date(year, monthNumber, 0); const entryByDate = new Map(snapshot.entries.map((entry) => [entry.date, entry])); const rendezvousByDate = new Map(); snapshot.rendezvous.forEach((item) => { const date = item.absenceDate || item.date; const list = rendezvousByDate.get(date) || []; list.push(item); rendezvousByDate.set(date, list); }); let cells = ''; for (let pad = 0; pad < (first.getDay() || 7) - 1; pad += 1) cells += '<span class="calendar-cell empty" aria-hidden="true"></span>'; for (let day = 1; day <= last.getDate(); day += 1) { const date = `${month}-${String(day).padStart(2, '0')}`; const weekday = new Date(year, monthNumber - 1, day).getDay(); const weekend = weekday === 0 || weekday === 6; const entry = entryByDate.get(date); const rdv = rendezvousByDate.get(date) || []; const title = [entry ? `${Number(entry.hours || 0).toFixed(2)} h · ${formatEUR(workerEntryAmount(entry, snapshot.user))}` : '', rdv.map((item) => `RDV ${item.time || ''} · ${item.reason || ''}`).join(' | ')].filter(Boolean).join(' · ') || 'Bez unosa'; const hoursButton = entry ? `<button type="button" class="calendar-quick-edit" data-quick-hours="${entry.id}" data-quick-hours-value="${Number(entry.hours || 0)}" title="Cliquez pour modifier les heures">${Number(entry.hours || 0).toFixed(1)}h</button>` : ''; const rdvButtons = rdv.map((item) => `<button type="button" class="calendar-quick-edit calendar-rendezvous" data-quick-rdv="${item.id}" data-quick-rdv-time="${escapeHtml(item.time || '')}" title="Cliquez pour modifier/supprimer le RDV">RDV ${escapeHtml(item.time || '')}</button>`).join(''); const addRdvButton = `<button type="button" class="calendar-quick-edit calendar-add-rdv" data-add-rdv="${date}" title="Dodaj RDV/odsustvo za ${date}">+RDV</button>`; const marker = hoursButton + rdvButtons + addRdvButton; const entryStatusClass = entry ? ` entry-${entry.status === 'approved' ? 'approved' : entry.status === 'rejected' ? 'rejected' : 'pending'}` : ''; cells += `<div class="calendar-cell${weekend ? ' weekend' : ''}${entry ? ' worked' : ''}${entryStatusClass}${rdv.length ? ' has-rendezvous' : ''}" data-detail-date="${date}" tabindex="0" role="button" title="${escapeHtml(title)}" aria-label="${escapeHtml(`${date}: ${title}`)}"><strong>${day}</strong>${marker}</div>`; }
		const workedDays = new Set(snapshot.entries.map((entry) => entry.date)).size; const hours = snapshot.entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0); const rdvDays = rendezvousByDate.size; target.className = `work-calendar worker-detail-calendar payment-${snapshot.paymentState}`; const clickableCalendarBadge = isOwner() && snapshot.entries.length; const calendarBadge = `<button type="button" class="worker-status ${workerStatusMeta[snapshot.paymentState].className}"${clickableCalendarBadge ? ` data-cycle-status data-cycle-status-worker="${escapeHtml(snapshot.user.id)}" data-cycle-status-month="${escapeHtml(snapshot.month)}" data-cycle-status-state="${snapshot.paymentState}"` : ' disabled'}><span class="worker-status-dot" aria-hidden="true"></span>${workerStatusMeta[snapshot.paymentState].label}</button>`; target.innerHTML = `<div class="work-calendar-head"><strong>${escapeHtml(formatMonthLabel(month))}</strong>${calendarBadge}<small>${workedDays} jours travaillés · ${hours.toFixed(2)} h · ${rdvDays} RDV</small></div><p class="calendar-hint">Jaune = en attente d’approbation du gérant · vert = approuvé · rouge = refusé. Cliquez sur une date pour voir le suivi de ce jour.</p><div class="calendar-weekdays"><span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span></div><div class="calendar-grid">${cells}</div>`;
	}
	function renderWorkerDetail() {
		const user = workerRosterState.users.find((item) => item.id === workerRosterState.detailWorkerId); if (!user) return; const month = workerRosterState.detailMonth || workerRosterState.month; const snapshot = deriveWorkerSnapshot(user, month); workerRosterState.detailSnapshot = snapshot; const title = document.querySelector('#worker-detail-title'); const subtitle = document.querySelector('#worker-detail-subtitle'); const monthInput = document.querySelector('#worker-detail-month'); const badge = document.querySelector('#worker-detail-payment-badge'); paintIdentityToken(document.querySelector('#worker-detail-avatar'), user.avatarUrl || '', user.name); if (title) title.textContent = user.name || 'Radnik'; if (subtitle) subtitle.textContent = [user.email || user.phone || 'Kontakt nije unet', user.company || user.employerCompany || '', snapshot.assignedProjects.join(', ')].filter(Boolean).join(' · '); if (monthInput) monthInput.value = month; if (badge) { badge.className = `worker-status ${workerStatusMeta[snapshot.paymentState].className}`; badge.innerHTML = `<span class="worker-status-dot" aria-hidden="true"></span>${workerStatusMeta[snapshot.paymentState].label}`; const clickable = isOwner() && snapshot.entries.length; badge.disabled = !clickable; if (clickable) { badge.dataset.cycleStatusWorker = user.id; badge.dataset.cycleStatusMonth = month; badge.dataset.cycleStatusState = snapshot.paymentState; } else { delete badge.dataset.cycleStatusWorker; delete badge.dataset.cycleStatusMonth; delete badge.dataset.cycleStatusState; } }
		document.querySelector('#worker-detail-summary').innerHTML = `<div><small>Jours travaillés</small><strong>${snapshot.workedDays}</strong><span>${escapeHtml(formatMonthLabel(month))}</span></div><div><small>Heures</small><strong>${snapshot.hours.toFixed(2)}</strong><span>total</span></div><div><small>Tarif journalier</small><strong>${formatEUR(user.dailyRate || 0)}</strong><span>par jour</span></div><div><small>Tarif horaire</small><strong>${formatEUR(user.hourlyRate || 0)}</strong><span>par heure</span></div><div class="detail-summary-amount"><small>Calculé</small><strong>${formatEUR(snapshot.amount)}</strong><span>${snapshot.entries.length} saisies</span></div>`;
		renderWorkerDetailCalendar(snapshot, month); renderWorkerDetailPayment(snapshot); renderWorkerDetailRendezvous(snapshot); renderWorkerDetailEntries(snapshot);
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
		const quickHoursButton = event.target.closest('[data-quick-hours]'); if (quickHoursButton) { openHoursQuickEdit(quickHoursButton, quickHoursButton.dataset.quickHours, quickHoursButton.dataset.quickHoursValue, async () => { await loadUsers(); renderWorkerDetail(); }); return; }
		const quickRdvButton = event.target.closest('[data-quick-rdv]'); if (quickRdvButton) { openRdvQuickEdit(quickRdvButton, quickRdvButton.dataset.quickRdv, quickRdvButton.dataset.quickRdvTime, async () => { await loadUsers(); renderWorkerDetail(); }); return; }
		const addRdvButton = event.target.closest('[data-add-rdv]'); if (addRdvButton) { const snapshot = workerRosterState.detailSnapshot; openRdvCreateQuickEdit(addRdvButton, { date: addRdvButton.dataset.addRdv, projectId: snapshot?.user?.projectIds?.[0], workerId: snapshot?.user?.id }, async () => { await loadUsers(); renderWorkerDetail(); }); return; }
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
	workerDetailModal?.addEventListener('change', (event) => { if (event.target.id !== 'worker-detail-month') return; workerRosterState.detailMonth = event.target.value || workerRosterState.month; workerRosterState.detailSelectedDate = ''; renderWorkerDetail(); });
	document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeWorkerActionMenus(); if (workerDetailModal && !workerDetailModal.hidden) closeWorkerDetail(); } if (event.key === 'Tab' && workerDetailModal && !workerDetailModal.hidden) { const focusable = [...workerDetailModal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')].filter((element) => !element.hidden && element.offsetParent !== null); if (!focusable.length) return; const first = focusable[0]; const last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } });
	document.addEventListener('click', (event) => { if (!event.target.closest('.worker-action-menu-wrap')) closeWorkerActionMenus(); });
	document.querySelector('#worker-roster-body')?.addEventListener('click', async (event) => { const cycleButton = event.target.closest('[data-cycle-status]'); if (cycleButton && !cycleButton.disabled) { await cycleWorkerPaymentStatus(cycleButton.dataset.cycleStatusWorker, cycleButton.dataset.cycleStatusMonth, cycleButton.dataset.cycleStatusState, cycleButton); return; } const detailButton = event.target.closest('[data-worker-detail]'); if (detailButton) { openWorkerDetail(detailButton.dataset.workerDetail, detailButton); return; } const menuTrigger = event.target.closest('[data-worker-menu]'); if (menuTrigger) { event.stopPropagation(); toggleWorkerActionMenu(menuTrigger.dataset.workerMenu, menuTrigger); return; } const action = event.target.closest('[data-worker-action]'); if (!action) return; const user = workerRosterState.users.find((item) => item.id === action.dataset.worker); closeWorkerActionMenus(); if (!user) return; if (action.dataset.workerAction === 'edit') { openUserEditor(user, action); return; } if (action.dataset.workerAction === 'reset') { await resetUserPassword(user, action); return; } if (action.dataset.workerAction === 'delete' && window.confirm(`Supprimer l’ouvrier ${user.name} ?`)) { try { await request(`/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' }); await refreshActiveView(); toast('Radnik je uklonjen.'); } catch (error) { let message = 'Radnik nije uklonjen.'; try { message = JSON.parse(error.message).error || message; } catch {} toast(message); } } });
	async function loadUsers() {
		setupWorkerRosterControls();
		workerRosterState.loading = true; workerRosterState.error = null; renderWorkerRoster();
		try {
			await loadProjectOptions();
			const [users, entries, rendezvous, payouts] = await Promise.all([request('/contacts'), request('/time-entries'), request('/rendezvous'), request('/payout-requests')]);
			workerRosterState.users = users; workerRosterState.entries = entries; workerRosterState.rendezvous = rendezvous; workerRosterState.payouts = payouts; workerRosterState.loading = false; workerRosterState.error = null; renderWorkerRoster();
			const currentUserId = currentUser?.id || currentUser?.sub; const recipient = document.querySelector('#recipient'); if (recipient) { const previousValue = recipient.value; recipient.innerHTML = users.filter((user) => user.id !== currentUserId).map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)} · ${escapeHtml(user.role)}</option>`).join(''); if (previousValue && [...recipient.options].some((option) => option.value === previousValue)) recipient.value = previousValue; renderChatThread(); }
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
		latestRendezvous = (items || await request('/rendezvous')).filter((item) => !activeProject || item.projectId === activeProject);
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
	async function loadMessages() { await loadProjectOptions(); const activeProject = currentProjectId(); latestChatMessages = (await request('/messages')).filter((item) => !activeProject || item.projectId === activeProject); renderChatThread(); await loadRendezvous(); }
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
		overlay.innerHTML = `<canvas></canvas><div class="ar-meter-panel"><strong>Mjerenje iz uploadovane slike</strong><small>1) Choisissez la mesure connue ci-dessous. 2) Cliquez les deux points de cette mesure (jaune). 3) Cliquez les points de la ligne/les coins de la surface à mesurer (vert). 4) Choisissez ci-dessous m² ou ml.</small><label>Poznata mjera</label><div class="photo-meter-presets"><button type="button" class="secondary photo-meter-preset" data-value="2.10">Vrata 2.10m</button><button type="button" class="secondary photo-meter-preset" data-value="1.20">Prozor 1.20m</button><button type="button" class="secondary photo-meter-preset" data-value="0.25">Cigla 0.25m</button><button type="button" class="secondary photo-meter-preset" data-value="">Sopstveno</button></div><input id="photo-meter-reference" type="number" min="0.01" step="0.01" placeholder="Saisissez votre mesure en mètres" /><span id="photo-meter-status">Referenca: 0/2 tacke</span><button class="secondary" id="photo-meter-reset" type="button">Ponovi tacke</button><div class="photo-meter-finish-row"><button class="primary" id="photo-meter-finish-m2" type="button">Calculer m²</button><button class="primary" id="photo-meter-finish-ml" type="button">Calculer ml</button></div><button class="secondary" id="photo-meter-cancel" type="button">Zatvori</button></div>`;
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
		const referenceInput = overlay.querySelector('#photo-meter-reference');
		overlay.querySelectorAll('.photo-meter-preset').forEach((button) => button.addEventListener('click', () => {
			overlay.querySelectorAll('.photo-meter-preset').forEach((other) => other.classList.remove('active'));
			button.classList.add('active');
			if (button.dataset.value) { referenceInput.value = button.dataset.value; referenceInput.readOnly = true; }
			else { referenceInput.value = ''; referenceInput.readOnly = false; referenceInput.focus(); }
		}));
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
			status.textContent = `Mjera iz slike: ${value.toFixed(2)} ${unit}. Kalibracija: ${referenceLength} m. Sacuvajte izvjestaj ako je tacno.`;
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
		section.innerHTML = `<div class="section-head production-head"><div><small>PRODUCTION CHANTIER</small><h2>Production et situations</h2><p>Photo preuve, mesure m2/ml, GPS et validation avant situation.</p></div><span class="status">Validation requise</span></div><form id="production-form" class="production-form"><div class="production-grid"><fieldset><legend>1. Preuve photo</legend><label>Photo du travail realise (opciono)<input name="photo" type="file" accept="image/*" /></label><label>Date (opciono)<input name="date" type="date" /></label></fieldset><fieldset><legend>2. Mesure</legend><label>Unite a calculer<select name="quantityUnit"><option value="m2">m2 - surface</option><option value="ml">ml - metre lineaire</option></select></label><div class="measure-actions"><button class="secondary" id="estimate-area" type="button">Estimer avec l'IA</button><button class="secondary" id="ar-meter" type="button">Mesurer avec camera AR</button><button class="secondary" id="photo-meter" type="button">Mesurer une photo uploadée</button></div><small id="area-estimate-status">IA utilise les plans/fiches. AR mesure en direct. Photo uploadée se mesure avec une calibration connue.</small></fieldset><fieldset><legend>3. Travaux</legend><label>Description des travaux<input name="description" required /></label><label><span data-quantity-label>Quantite IA ou AR</span><input name="quantity" type="number" min="0" step="0.01" value="" required readonly /></label><input name="quantityM2" type="hidden" value="" /></fieldset><fieldset><legend>4. Prix</legend><label><span data-rate-label>Prix par unite EUR</span><input name="unitRate" type="number" min="0" step="0.01" required /></label><small>La validation humaine du Gerant ou du Gerant reste obligatoire avant la Situation.</small></fieldset></div><button class="primary production-submit" type="submit">Enregistrer la production</button></form><div class="production-results"><div id="production-summary" class="list"></div><div id="production-reports" class="list"></div></div>`;
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
		if (!isOwner()) { document.querySelector('.production-panel')?.remove(); return; }
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
		const methodLabel = (item) => { const source = String(item.quantitySource || item.m2Source || ''); if (source.startsWith('ai-')) return 'IA'; if (source.startsWith('ar-')) return 'AR'; if (source.startsWith('photo-calibrated')) return 'Photo'; return 'Manuel'; };
		const statusLabel = (status) => status === 'approved' ? 'Approuvé' : status === 'rejected' ? 'Refusé' : 'En attente';
		const workerTotals = summary.byWorker?.map((item) => `${item.workerName} : ${Number(item.quantityM2 || 0).toFixed(2)} m² · ${Number(item.quantityMl || 0).toFixed(2)} ml${managerView ? ` · ${formatEUR(item.amount)}` : ''}`).join(' | ') || 'Aucun détail par ouvrier';
		summaryTarget.innerHTML = `<div class="production-summary-card"><strong>Situation du ${today}</strong><span>${summary.reportCount} rapport(s) approuvé(s) · ${Number(summary.quantityM2 || 0).toFixed(2)} m² · ${Number(summary.quantityMl || 0).toFixed(2)} ml${managerView ? ` · ${formatEUR(summary.amount)}` : ''}</span><small>${workerTotals}</small><small>Calcul basé uniquement sur les rapports approuvés. Validation humaine requise.</small></div>`;
		const canReview = isOwner();
		reportTarget.innerHTML = reports.length ? `<h3>Rapports de production</h3><div class="production-report-list">${reports.slice().reverse().map((item) => `<div class="production-report-row"><div class="production-report-main"><strong>${escapeHtml(item.date)} · ${escapeHtml(item.workerName)}</strong><span class="entry-status-pill entry-status-${item.status}">${statusLabel(item.status)}</span></div><small>${escapeHtml(item.description)}</small><div class="production-report-meta"><span>${quantityLabel(item)}</span><span class="production-method-tag">${methodLabel(item)}</span>${managerView ? `<span>${formatEUR(item.calculatedAmount)}</span>` : ''}</div>${canReview && item.status === 'pending' ? `<div class="production-report-actions"><button class="secondary production-status" data-report="${item.id}" data-status="approved">Approuver</button><button class="secondary production-status" data-report="${item.id}" data-status="rejected">Refuser</button></div>` : ''}</div>`).join('')}</div>` : '<small>Aucun rapport de production.</small>';
		document.querySelectorAll('.production-status').forEach((button) => button.addEventListener('click', async () => { button.disabled = true; button.setAttribute('aria-busy', 'true'); try { await request(`/work-reports/${button.dataset.report}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: button.dataset.status }) }); await loadProduction(); } catch { toast('Statut non modifié.'); button.disabled = false; button.removeAttribute('aria-busy'); } }));
	}
	async function loadWorkSequence() { const panel = document.querySelector('#ai-form')?.closest('.ai-panel'); if (!panel || document.querySelector('#work-sequence')) return; const section = document.createElement('div'); section.id = 'work-sequence'; section.className = 'list'; section.innerHTML = '<h3>Ordre des travaux selon les plans</h3><small>Analyse de la documentation...</small>'; panel.append(section); const projectId = currentProjectId(); if (!projectId) { section.innerHTML = '<h3>Ordre des travaux selon les plans</h3><small>Sélectionnez d’abord un chantier actif.</small>'; return; } try { const result = await request(`/projects/${projectId}/work-sequence`); section.innerHTML = `<h3>Ordre des travaux selon les plans</h3><small>${result.answer}</small>${result.steps?.length ? result.steps.map((step) => `<div class="list-item"><strong>${step.order}. ${step.title}</strong><small>${step.instruction} · Preuve requise : ${step.requiredEvidence || 'à confirmer'} · Source : ${step.sourcePage || 'à confirmer'}</small></div>`).join('') : '<small>La séquence ne peut pas être affichée sans documentation source et configuration AI.</small>'}`; } catch { section.innerHTML = '<h3>Ordre des travaux selon les plans</h3><small>Analyse indisponible. Ajoutez un plan ou une fiche technique PDF.</small>'; } }
	function renderAutoAnalysis(target, analysis) {
		if (!target || !analysis) return false;
		const french = language === 'fr';
		const section = (title, items) => items?.length ? `<div class="auto-analysis-section"><strong>${escapeHtml(title)}</strong><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : '';
		const specificAnswer = analysis.answer ? `<div class="auto-analysis-answer"><strong>${french ? 'Réponse selon ce plan' : 'Odgovor prema ovom planu'}</strong><p>${escapeHtml(analysis.answer)}</p></div>` : '';
		const imagesSection = analysis.referenceImages?.length ? `<div class="auto-analysis-section auto-analysis-images"><strong>${french ? 'Schémas extraits du document' : 'Schémas extraits du document'}</strong><div class="auto-analysis-image-grid">${analysis.referenceImages.map((img) => `<a href="${escapeHtml(img.dataUrl)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(img.dataUrl)}" alt="${french ? 'Schéma page' : 'Schéma page'} ${escapeHtml(String(img.page))}" loading="lazy" /></a>`).join('')}</div></div>` : '';
		const rulesSection = section(french ? 'Règles et valeurs (extraites du document)' : 'Règles et valeurs (extraites du document)', analysis.extractedRules);
		const referencesSection = analysis.references?.length ? `<div class="auto-analysis-section"><strong>${french ? 'Vidéos et guides de référence' : 'Vidéos et guides de référence'}</strong><ul>${analysis.references.map((ref) => `<li><a href="${escapeHtml(ref.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ref.title)}</a></li>`).join('')}</ul></div>` : '';
		target.innerHTML = `<div class="list-item auto-analysis"><strong>${french ? 'Analyse automatique' : 'Automatska analiza'} · ${escapeHtml(analysis.workType)}</strong><small>${french ? 'Confiance' : 'Sigurnost'}: ${Math.round(Number(analysis.confidence || 0) * 100)}% · ${escapeHtml(analysis.fileName || '')}</small>${specificAnswer}${rulesSection}${imagesSection}${section(french ? 'Système' : 'Sistem', analysis.systems)}${section(french ? 'Matériaux détectés' : 'Prepoznati materijali', analysis.materials)}${section(french ? 'Comment exécuter' : 'Kako se radi', analysis.howTo)}${section(french ? 'Contrôles' : 'Quoi contrôler', analysis.controls)}${section(french ? 'Preuves photos' : 'Quoi photographier comme preuve', analysis.evidence)}${section(french ? 'Risques / à confirmer' : 'Risques / à confirmer', analysis.risks)}${referencesSection}</div>`;
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
			form.elements.date?.addEventListener('input', () => { const month = monthKeyFromDate(form.elements.date.value); renderWorkCalendar(latestOwnTimeEntries, form.elements.date.value, latestRendezvous); renderWorkerMonthSummary(month); });
			form.elements.workerId?.addEventListener('change', () => { form.elements.rate.value = ''; fillDefaultRate(); const month = monthKeyFromDate(form.elements.date.value); renderWorkCalendar(latestOwnTimeEntries, form.elements.date.value, latestRendezvous); renderWorkerMonthSummary(month); updateTimeLiveCalculation(); saveTimePrefs(form); });
			form.elements.rateType?.addEventListener('change', () => { form.elements.rate.value = ''; fillDefaultRate(); updateTimeLiveCalculation(); });
		}
		fillDefaultRate(); updateTimeLiveCalculation();
	}
	function renderQuickWorkers() {
		const target = document.querySelector('#quick-workers');
		if (!target) return;
		const canManage = isOwner();
		target.innerHTML = canManage && latestTimeWorkers.length ? `<h3>Radnici</h3>${latestTimeWorkers.map((worker) => `<div class="list-item"><strong>${escapeHtml(worker.name)}</strong><small>${escapeHtml(worker.email || worker.phone || 'sans contact')} · Chantier : ${escapeHtml(assignedProjectNames(worker) || 'non sélectionné')} · Dnevnica ${formatEUR(worker.dailyRate || 0)} · Satnica ${formatEUR(worker.hourlyRate || 0)}</small><div class="worker-actions"><button class="secondary rename-worker" data-worker="${worker.id}" type="button">Renommer</button><button class="secondary delete-worker" data-worker="${worker.id}" type="button">Supprimer</button></div></div>`).join('')}` : '';
		target.querySelectorAll('.rename-worker').forEach((button) => button.addEventListener('click', async () => {
			const worker = latestTimeWorkers.find((item) => item.id === button.dataset.worker);
			if (!worker) return;
			const name = window.prompt('Ime i prezime:', worker.name);
			if (!name?.trim()) return;
			const contact = window.prompt('Telefon ili email:', worker.email || worker.phone || '');
			if (!contact?.trim()) return;
			const dailyRate = window.prompt('Dnevnica EUR:', worker.dailyRate || 0);
			const hourlyRate = window.prompt('Satnica EUR:', worker.hourlyRate || 0);
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
		const visibleRendezvous = (rendezvous || []).filter((item) => (!selectedWorkerId || item.workerId === selectedWorkerId) && (!activeProject || item.projectId === activeProject));
		const month = monthKeyFromDate(selectedDate);
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
			const rendezvousLabel = dayRendezvous.map((item) => `RDV ${item.time || ''}${item.reason ? ` · ${item.reason}` : ''}`).join(' | ');
			const title = [entry ? `${Number(entry.hours || 0).toFixed(2)} h · ${formatEUR(entry.workAmount || 0)}` : '', rendezvousLabel, entry || dayRendezvous.length ? '' : `Indiquer les heures pour ${date}`].filter(Boolean).join(' · ');
			const hoursButton = entry ? `<button type="button" class="calendar-quick-edit" data-quick-hours="${entry.id}" data-quick-hours-value="${Number(entry.hours || 0)}" title="Cliquez pour modifier les heures">${Number(entry.hours || 0).toFixed(1)}h</button>` : '';
			const rdvButtons = dayRendezvous.map((item) => `<button type="button" class="calendar-quick-edit calendar-rendezvous" data-quick-rdv="${item.id}" data-quick-rdv-time="${escapeHtml(item.time || '')}" data-quick-rdv-reason="${escapeHtml(item.reason || '')}" title="Cliquez pour modifier/supprimer le RDV">RDV ${escapeHtml(item.time || '')}</button>`).join('');
			const addRdvButton = `<button type="button" class="calendar-quick-edit calendar-add-rdv" data-add-rdv="${date}" title="Dodaj RDV/odsustvo za ${date}">+RDV</button>`;
			const marker = hoursButton + rdvButtons + addRdvButton;
			const entryStatusClass = entry ? ` entry-${entry.status === 'approved' ? 'approved' : entry.status === 'rejected' ? 'rejected' : 'pending'}` : '';
			cells += `<div class="calendar-cell${weekend ? ' weekend' : ''}${entry ? ' worked' : ''}${entryStatusClass}${dayRendezvous.length ? ' has-rendezvous' : ''}" data-work-date="${date}" tabindex="0" role="button" title="${escapeHtml(title)}" aria-label="${escapeHtml(`${date}: ${title}`)}"><strong>${day}</strong>${marker}</div>`;
		}
		const workedDays = new Set(monthEntries.map((entry) => entry.date)).size;
		const monthHours = monthEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
		const monthAmount = monthEntries.reduce((sum, entry) => sum + Number(entry.workAmount || 0), 0);
		const rendezvousDays = rendezvousByDate.size;
		const monthLabel = formatMonthLabel(month);
		target.innerHTML = `<div class="work-calendar-head"><strong>Calendrier des jours travaillés · ${escapeHtml(monthLabel)}</strong><small>Jours ouvrés : ${workingDays} · Saisis : ${workedDays} · ${monthHours.toFixed(2)} h · ${formatEUR(monthAmount)} · RDV : ${rendezvousDays}</small></div><div class="calendar-hint">Cliquez sur un jour pour saisir les heures directement depuis le calendrier. Jaune = en attente d’approbation du gérant, vert = approuvé. <span class="calendar-legend"><span class="legend-work">Travail</span> · <span class="legend-rendezvous">RDV / absence</span></span></div><div class="calendar-weekdays"><span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span></div><div class="calendar-grid">${cells}</div>`;
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
		target.querySelectorAll('[data-quick-hours]').forEach((button) => button.addEventListener('click', (event) => {
			event.stopPropagation();
			openHoursQuickEdit(button, button.dataset.quickHours, button.dataset.quickHoursValue, refreshActiveView);
		}));
		target.querySelectorAll('[data-quick-rdv]').forEach((button) => button.addEventListener('click', (event) => {
			event.stopPropagation();
			openRdvQuickEdit(button, button.dataset.quickRdv, button.dataset.quickRdvTime, refreshActiveView);
		}));
		target.querySelectorAll('[data-add-rdv]').forEach((button) => button.addEventListener('click', (event) => {
			event.stopPropagation();
			openRdvCreateQuickEdit(button, { date: button.dataset.addRdv, projectId: activeProject, workerId: selectedWorkerId !== currentUser?.id ? selectedWorkerId : undefined }, refreshActiveView);
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
		const entries = (await request('/time-entries')).filter((entry) => !activeProject || entry.projectId === activeProject);
		const own = await request('/my-payroll-summary');
		const rendezvous = (await request('/rendezvous')).filter((item) => !activeProject || item.projectId === activeProject);
		const managerView = isOwner();
		latestRendezvous = rendezvous;
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
		const renderItem = (item) => `<div class="list-item"><strong>${item.originalName}</strong><small>${item.phase || 'general'} · ${Math.max(1, Math.round(item.size / 1024))} KB · ${item.projectId}</small>${canManage ? `<div class="document-actions"><button class="secondary rename-document" data-document="${item.id}">Renommer</button><button class="secondary copy-document" data-document="${item.id}">Copier</button><button class="secondary delete-document" data-document="${item.id}">Supprimer</button></div>` : ''}</div>`;
		const groups = documentGroupOrder.map((type) => ({ type, items: documents.filter((item) => (item.evidenceType || 'other') === type) })).filter((group) => group.items.length);
		document.querySelector('#documents').innerHTML = groups.length ? groups.map((group) => `<div class="document-group"><h4>${documentGroupLabels[group.type]} · ${group.items.length}</h4>${group.items.map(renderItem).join('')}</div>`).join('') : '<small>Aucun document enregistré.</small>';
		document.querySelectorAll('.rename-document').forEach((button) => button.addEventListener('click', async () => { const item = documents.find((document) => document.id === button.dataset.document); const name = window.prompt('Novo ime dokumenta:', item?.originalName || ''); if (!name?.trim()) return; button.disabled = true; button.setAttribute('aria-busy', 'true'); try { await request(`/documents/${button.dataset.document}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) }); await refreshActiveView(); toast('Document renommé.'); } catch { toast('Document non renommé.'); button.disabled = false; button.removeAttribute('aria-busy'); } })); document.querySelectorAll('.copy-document').forEach((button) => button.addEventListener('click', async () => { button.disabled = true; button.setAttribute('aria-busy', 'true'); try { await request(`/documents/${button.dataset.document}/copy`, { method: 'POST' }); await refreshActiveView(); toast('Copie du document ajoutée.'); } catch { toast('Copie non ajoutée.'); button.disabled = false; button.removeAttribute('aria-busy'); } })); document.querySelectorAll('.delete-document').forEach((button) => button.addEventListener('click', async () => { const item = documents.find((document) => document.id === button.dataset.document); if (!item || !window.confirm(`Obrisati dokument „${item.originalName}“?`)) return; const originalLabel = button.textContent; button.disabled = true; button.textContent = 'Brisanje...'; try { await request(`/documents/${button.dataset.document}`, { method: 'DELETE' }); await refreshActiveView(); toast('Dokument je obrisan.'); } catch { toast('Dokument nije obrisan.'); button.disabled = false; button.textContent = originalLabel; } })); }
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
			if (!window.confirm(`Supprimer le chantier ${button.dataset.name} et les données associées ?`)) return;
			button.disabled = true; button.setAttribute('aria-busy', 'true');
			try { await request(`/projects/${button.dataset.project}`, { method: 'DELETE' }); await refreshActiveView(); toast('Chantier je obrisan.'); }
			catch (error) { let message = 'Chantier nije obrisan.'; try { message = JSON.parse(error.message).error || message; } catch {} toast(message); button.disabled = false; button.removeAttribute('aria-busy'); }
		}));
	}
	async function loadPurchases() { const purchases = await request('/purchases'); const groups = { material: [], tools: [], machines: [], workers: [], subcontracting: [] }; purchases.forEach((item) => { if (groups[item.category]) groups[item.category].push(item); }); const render = (items, target, totalTarget) => { document.querySelector(`#${totalTarget}`).textContent = `${items.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2)} EUR`; document.querySelector(`#${target}`).innerHTML = items.length ? items.map((item) => `<div class="list-item"><strong>${item.category} · ${item.supplier}</strong><small>${item.description} · ${Number(item.amount).toFixed(2)} EUR · ${item.purchaseDate}</small></div>`).join('') : '<small>Aucune dépense.</small>'; }; render([...groups.material, ...groups.tools, ...groups.machines], 'purchase-material-tools', 'purchase-total-material-tools'); render(groups.workers, 'purchase-workers', 'purchase-total-workers'); render(groups.subcontracting, 'purchase-subcontracting', 'purchase-total-subcontracting'); }
	function ensureHoursPdfButton() {
		if (document.querySelector('#download-hours-pdf')) return;
		const form = document.querySelector('#time-form'); if (!form) return;
		const previous = new Date(); previous.setMonth(previous.getMonth() - 1);
		const defaultMonth = previous.toISOString().slice(0, 7);
		const panel = document.createElement('div');
		panel.className = 'hours-pdf-panel';
		panel.innerHTML = `<label>Preuzmi PDF listu dana<input id="hours-pdf-month" type="month" value="${defaultMonth}" /></label><button class="secondary" id="download-hours-pdf" type="button">Preuzmi PDF</button><small>Contient les jours approuvés, les heures et le montant pour le mois sélectionné.</small>`;
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
		const loads = [loadDashboard(), loadEvidenceSummary(), loadRgeQualibat(), loadControlHistory(), loadBudget(), loadFinancialSummary(), loadSchedule(), loadUsers(), loadMessages(), loadTime(), loadPayroll(), loadDocuments(), loadPurchases(), loadProduction(), loadWorkSequence(), loadCompanyProfile()];
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
			'chantier-view': () => Promise.allSettled([loadDashboard(), loadControlHistory(), loadSchedule(), loadFinancialSummary()]),
			'evidence-summary-view': () => Promise.allSettled([loadEvidenceSummary(), loadDocuments(), loadWorkSequence()]),
			'documents-view': () => Promise.allSettled([loadDocuments(), loadEvidenceSummary(), loadWorkSequence()]),
			'tasks-view': () => Promise.allSettled([loadMessages(), loadTime(), loadPayroll(), loadProduction()]),
			'settings-view': () => Promise.allSettled([loadUsers(), loadMessages()])
		};
		await (refreshers[active]?.() || loadInitialData());
	};
	const restoreSession = async () => {
		if (!localStorage.getItem('ibra-auth-token')) return;
		try {
			const result = await request('/me');
			currentUser = result.user; applyRole(currentUser.role); setupWorkerSelfProfile(); showView(document.querySelector('.view.active')?.id || 'dashboard-view'); loginModal.classList.add('hidden'); document.querySelector('#current-role').textContent = `${currentUser.name} - ${currentUser.role}`;
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
			document.querySelector('#registration-success-message').textContent = data.delivery === 'password-set' ? `Le compte a été créé pour ${deliveryTarget}. Connectez-vous avec le mot de passe choisi.` : `Un lien a été envoyé à ${deliveryTarget}. Cliquez dessus pour définir votre mot de passe.`;
			loginForm.elements.phone.value = deliveryTarget || '';
			if (loginForm.elements.role && data.role) loginForm.elements.role.value = data.role;
		} catch (error) { message.textContent = error.message || 'Inscription impossible.'; }
	});
		document.querySelector('#login-form').addEventListener('submit', async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const submitButton = event.currentTarget.querySelector('button[type="submit"]'); const errorTarget = document.querySelector('#login-error'); errorTarget.textContent = ''; submitButton.disabled = true; submitButton.setAttribute('aria-busy', 'true'); try { const result = await fetch(`${api}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(form.entries())) }); if (!result.ok) { const details = await result.json().catch(() => ({})); const error = new Error(details.error || 'Login failed'); error.status = result.status; throw error; } const data = await result.json(); localStorage.setItem('ibra-auth-token', data.token); currentUser = data.user; applyRole(currentUser.role); setupWorkerSelfProfile(); showView(document.querySelector('.view.active')?.id || 'dashboard-view'); loginModal.classList.add('hidden'); document.querySelector('#current-role').textContent = `${currentUser.name} - ${currentUser.role}`; await loadInitialData(); } catch (error) { errorTarget.textContent = error.status === 403 ? 'Izabrani profil ne odgovara ovom nalogu.' : 'L’e-mail/téléphone ou le mot de passe est incorrect.'; } finally { submitButton.disabled = false; submitButton.removeAttribute('aria-busy'); } });
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
	document.querySelector('#logout-button').addEventListener('click', () => { localStorage.removeItem('ibra-auth-token'); currentUser = undefined; companyProfileState = null; workerProfilePanel?.setAttribute('hidden', ''); document.querySelector('#company-identity-strip')?.setAttribute('hidden', ''); document.querySelector('#login-form').reset(); document.querySelector('#registration-form')?.reset(); document.querySelector('#registration-form')?.setAttribute('hidden', ''); document.querySelector('#registration-success')?.setAttribute('hidden', ''); document.querySelector('#login-form').setAttribute('hidden', ''); authChoice?.removeAttribute('hidden'); loginModal.classList.remove('hidden'); });
	document.querySelector('#message-form').addEventListener('submit', async (event) => {
		event.preventDefault();
		const form = event.currentTarget;
		const projectId = currentProjectId();
		if (!projectId) { toast('Izaberite aktivni chantier pre slanja poruke.'); return; }
		const recipientId = form.elements.recipientId.value;
		if (!recipientId) { toast('Izaberite sagovornika.'); return; }
		const text = form.elements.text.value.trim();
		if (!text) return;
		const submitButton = form.querySelector('button[type="submit"], button.primary');
		const currentUserId = currentUser?.id || currentUser?.sub;
		const optimistic = { id: `optimistic-${Date.now()}`, senderId: currentUserId, senderName: currentUser?.name || '', recipientId, projectId, text, createdAt: new Date().toISOString(), optimistic: true };
		latestChatMessages = [...latestChatMessages, optimistic];
		renderChatThread();
		form.elements.text.value = '';
		if (submitButton) { submitButton.disabled = true; submitButton.setAttribute('aria-busy', 'true'); }
		try {
			await request('/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientId, text, projectId }) });
			await loadMessages();
		} catch {
			latestChatMessages = latestChatMessages.filter((item) => item.id !== optimistic.id);
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
	document.querySelector('#quick-worker-form')?.addEventListener('submit', async (event) => { event.preventDefault(); try { const values = formValues(event.currentTarget); values.email = values.contact; await request('/workers', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(values) }); event.currentTarget.reset(); await Promise.allSettled([loadUsers(), loadMessages(), loadPayroll(), loadTime()]); toast('Email poziv je poslat radniku da sam izabere password.'); } catch (error) { let message = 'Ouvrier nije dodat.'; try { const details = JSON.parse(error.message); if (details.error === 'Worker already exists') message = 'Ovaj radnik vec postoji.'; if (details.error?.includes('chantier')) message = 'Izaberi najmanje jedan chantier za radnika.'; if (details.error?.includes('Email delivery')) message = 'Email nije poslat: podesite SMTP/Brevo na Renderu.'; } catch {} toast(message); } });
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
		if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Enregistrement et analyse en cours (peut prendre jusqu’à 30 s)…'; }
		message.textContent = 'Enregistrement et analyse en cours, veuillez patienter (le serveur peut mettre jusqu’à 1 min à se réveiller)…';
		try {
			const response = await fetch(`${api}/documents/upload`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body, signal: AbortSignal.timeout(90000) });
			const result = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(result.error || `${response.status}`);
			form.reset();
			if (form.elements.projectId) form.elements.projectId.value = projectId;
			message.textContent = '';
			await refreshActiveView();
			if (!stay) showView('evidence-summary-view');
			const answerTarget = document.querySelector('#ai-answer');
			if (result.autoAnalysis && renderAutoAnalysis(answerTarget, result.autoAnalysis)) {
				toast('Document enregistré et analysé automatiquement.');
			} else if (answerTarget) {
				answerTarget.innerHTML = `<div class="list-item auto-analysis"><strong>Document enregistré, analyse indisponible</strong><p>Le serveur n’a renvoyé aucune analyse pour ce document. Réponse reçue : ${escapeHtml(JSON.stringify(result).slice(0, 400))}</p></div>`;
				toast('Document enregistré, mais sans analyse automatique.');
			}
		} catch (error) {
			message.classList.add('error');
			message.textContent = error.name === 'TimeoutError' || error.name === 'AbortError' ? 'Le serveur met trop de temps à répondre (plus de 90 s). Le document est peut-être quand même enregistré ; vérifiez la liste ci-contre.' : `Document non enregistré : ${error.message || 'erreur inconnue'}`;
			toast('Document non enregistré ou sans réponse. Voir le message sous le formulaire.');
		} finally {
			if (submitButton) { submitButton.disabled = false; submitButton.textContent = submitButtonLabel; }
		}
	}
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
		} catch {
			if (message) message.textContent = language === 'fr' ? 'Impossible d’obtenir une réponse. Réessayez.' : 'Réponse non obtenue. Réessayez.';
		}
	});
	document.querySelector('#budget-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const file = document.querySelector('#budget-file').files[0]; const form = event.currentTarget; const submitButton = form.querySelector('button.primary'); const originalLabel = submitButton?.textContent; if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Enregistrement...'; submitButton.setAttribute('aria-busy', 'true'); } const ensureProjectId = async () => { const select = form.querySelector('[name="projectId"]'); if (select.value !== '__new') return select.value; const chantierName = form.querySelector('[name="chantierName"]').value.trim() || form.querySelector('[name="client"]').value.trim() || 'Nouveau chantier'; const project = await request('/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name: chantierName, chantierName }) }); await loadProjectOptions(); select.value = project.id; return project.id; }; const sendBudget = async (replaceExisting = false) => { const projectId = await ensureProjectId(); const body = new FormData(form); body.set('projectId', projectId); if (file) body.set('file', file, file.name); if (replaceExisting) body.set('replaceExisting', 'true'); return fetch(`${api}/projects/${projectId}/budget`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); }; try { let response = await sendBudget(false); if (response.status === 409 && window.confirm('Un Devis existe deja pour ce chantier. Remplacer par le nouveau PDF ?')) response = await sendBudget(true); if (!response.ok) { const details = await response.text(); throw new Error(`${response.status}: ${details}`); } form.reset(); await refreshActiveView(); toast('Devis et chantier enregistres.'); } catch (error) { toast(`Devis non enregistre : ${error.message || 'erreur inconnue'}`); } finally { if (submitButton) { submitButton.disabled = false; submitButton.textContent = originalLabel; submitButton.removeAttribute('aria-busy'); } } });
	document.querySelector('#budget-file')?.addEventListener('change', async (event) => { const file = event.currentTarget.files[0]; if (!file) return; const body = new FormData(); body.append('file', file); const status = document.querySelector('#devis-extraction-status'); status.textContent = 'Lecture du PDF...'; try { const response = await fetch(`${api}/budget/inspect`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); if (!response.ok) throw new Error(); const result = await response.json(); const form = document.querySelector('#budget-form'); form.querySelector('[name="devisNumber"]').value = result.extracted.number; form.querySelector('[name="client"]').value = result.extracted.client; form.querySelector('[name="chantierName"]').value = result.extracted.chantier; form.querySelector('[name="total"]').value = result.extracted.total || ''; const projectSelect = form.querySelector('[name="projectId"]'); const chantierText = result.extracted.chantier.toLowerCase(); const matchingOption = [...projectSelect.options].find((option) => option.value !== '__new' && chantierText && option.textContent.toLowerCase().includes(chantierText)); projectSelect.value = matchingOption ? matchingOption.value : '__new'; status.textContent = result.needsConfirmation ? 'Le PDF a été lu partiellement. Vérifiez les champs signalés avant d’enregistrer.' : `Lu automatiquement depuis : ${result.source}`; } catch { status.textContent = 'Impossible de lire le PDF automatiquement. Saisissez les valeurs manuellement.'; } });
	document.querySelector('#budget-form [name="projectId"]')?.addEventListener('change', loadBudget);
		document.querySelector('#purchase-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const file = document.querySelector('#invoice-file').files[0]; const form = event.currentTarget; const body = new FormData(form); if (!file) { toast('Ajoutez une facture PDF ou un justificatif.'); return; } body.append('invoice', file); const submitButton = form.querySelector('button.primary'); const originalLabel = submitButton?.textContent; if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Enregistrement...'; submitButton.setAttribute('aria-busy', 'true'); } try { const response = await fetch(`${api}/purchases`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); if (!response.ok) throw new Error(); form.reset(); await refreshActiveView(); toast('La dépense et la facture PDF ont été enregistrées ; le devis est à jour.'); } catch { toast('Dépense non enregistrée.'); } finally { if (submitButton) { submitButton.disabled = false; submitButton.textContent = originalLabel; submitButton.removeAttribute('aria-busy'); } } });
	document.querySelector('#invoice-file')?.addEventListener('change', async (event) => { const file = event.currentTarget.files[0]; if (!file) return; const body = new FormData(); body.append('file', file); const status = document.querySelector('#purchase-extraction-status'); status.textContent = 'Lecture de la facture PDF...'; try { const response = await fetch(`${api}/pdf/inspect`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); if (!response.ok) throw new Error(); const result = await response.json(); const form = document.querySelector('#purchase-form'); form.querySelector('[name="supplier"]').value = result.extracted.supplier; form.querySelector('[name="amount"]').value = result.extracted.amount || ''; form.querySelector('[name="purchaseDate"]').value = result.extracted.date || ''; status.textContent = result.needsOcr ? 'Le PDF est scanné. Une vérification manuelle/OCR est nécessaire.' : `Lu automatiquement depuis : ${result.source}`; } catch { status.textContent = 'Impossible de lire le PDF automatiquement. Saisissez les valeurs manuellement.'; } });
	restoreSession();
});
