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
	const toast = (message) => { const french = { 'Korisnik je dodat.': 'Utilisateur enregistré.', 'Poruka je sačuvana.': 'Message enregistré.', 'Radno vreme je sačuvano.': 'Temps de travail enregistré.', 'Radno vreme nije sačuvano.': 'Temps de travail non enregistré.', 'Korisnik nije dodat.': 'Utilisateur non enregistré.', 'Trošak nije sačuvan.': 'Dépense non enregistrée.', 'Devis nije sačuvan.': 'Devis non enregistré.', 'Devis i budžet su sačuvani.': 'Devis et budget enregistrés.' }; const translated = french[message] || String(message).replace('Dokument je obrisan.', 'Document supprimé.').replace('Dokument je preimenovan.', 'Document renommé.').replace('Kopija dokumenta je dodata.', 'Copie du document ajoutée.'); const el = document.querySelector('#toast'); el.textContent = translated; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); };
	const formatEUR = (value) => new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'sr-Latn-RS', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(value || 0));
	const translations = { 'Dashboard':'Tableau de bord','Devis':'Devis','Nabavke':'Achats','Chantier kontrole':'Contrôles chantier','RGE / QUALIBAT':'RGE / QUALIBAT','Dokumenti i slike':'Documents et photos','Zadaci i komunikacija':'Tâches et communication','Korisnici':'Utilisateurs','Dokazni paket':'Dossier de preuves','Odjava':'Déconnexion','Kontrola pravilnog izvođenja radova':'Contrôle de la bonne exécution des travaux','Plan, fiche technique, fotografije i potvrda Gerant-a u jednom toku.':'Plan, fiche technique, photos et validation du Gerant dans un seul parcours.','Otvorene kontrole':'Contrôles ouverts','Radno vreme':'Temps de travail','Trošak rada ovog meseca':'Coût du travail ce mois-ci','Preostali budžet':'Budget restant','Materijal, alat i mašine':'Matériaux, outils et machines','Radnici':'Travailleurs','Sous-traitance':'Sous-traitance','Nema Devis-a':'Aucun devis','Bez kašnjenja':'Aucun retard','Début de travaux i rok':'Début des travaux et délai','Début de travaux: nije unet':'Début des travaux : non renseigné','Planirani rok: nije unet · Prilagođeni rok: nije izračunat':'Échéance prévue : non renseignée · Échéance ajustée : non calculée','Chantier kontrole':'Contrôles chantier','Dokumenti i slike':'Documents et photos','AIDE RGE / QUALIBAT':'AIDE RGE / QUALIBAT','ITE - znanje, kontrole i odgovori':'ITE - connaissances, contrôles et réponses','Za učenje i chantier provjeru':'Pour apprendre et contrôler le chantier','Pretraga pitanja i odgovora':'Recherche questions/réponses',"Traži po riječi, npr. RGE, pare-vapeur, BAR-EN-102, lame d'air, MaPrimeRenov":"Rechercher par mot-clé, ex. RGE, pare-vapeur, BAR-EN-102, lame d'air, MaPrimeRenov",'Upiši pojam...':'Saisir un terme...','RGE kontrolna lista':'Liste de contrôle RGE','Kompletno znanje po temama':'Connaissance complète par thèmes','Francuski tehnički termini su ostavljeni da odgovaraju RGE/QUALIBAT dokumentaciji.':'Les termes techniques français sont conservés pour correspondre à la documentation RGE/QUALIBAT.' };
	const runtimeFrench = {
		'Nabavke': 'Achats', 'Dokumenti i slike': 'Documents et photos', 'Zadaci i komunikacija': 'Tâches et communication', 'Korisnici': 'Utilisateurs',
		'Rizik chantier-a': 'Risque du chantier', 'KRITIČAN': 'CRITIQUE', 'PAŽNJA': 'ATTENTION', 'STABILAN': 'STABLE',
		'Bez kašnjenja': 'Aucun retard', 'dana kašnjenja': 'jours de retard', 'nije unet': 'non renseigné', 'nije izračunat': 'non calculé', 'Planirani rok:': 'Échéance prévue :', 'Prilagođeni rok:': 'Échéance ajustée :', 'Début de travaux:': 'Début des travaux :',
		'Nema promena.': 'Aucune modification.', 'Nema poruka.': 'Aucun message.', 'Nema troškova.': 'Aucune dépense.', 'Nema sačuvanih dokumenata.': 'Aucun document enregistré.',
		'Kontrola nije ažurirana.': 'Le contrôle n’a pas été mis à jour.', 'Kontrola je ažurirana.': 'Le contrôle a été mis à jour.', 'Završi': 'Terminer', 'Vrati na ispravku': 'Renvoyer pour correction', 'review': 'En revue', 'incomplete': 'Incomplet', 'complete': 'Terminé', 'Dokazni paket': 'Dossier de preuves', 'Nedostaje:': 'Manquants :', 'fiche-technique': 'fiche technique', 'photo-before': 'photo avant travaux', 'photo-during': 'photo pendant les travaux', 'photo-after': 'photo après travaux',
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
	const encodingRepairs = [['Cat?gorie','Catégorie'],['cat?gorie','catégorie'],['ext?rieur','extérieur'],['?nerg?tique','énergétique'],['continuit?','continuité'],['r?duction','réduction'],['qualit?','qualité'],['contr?le','contrôle'],['contr?les','contrôles'],['?uvre','œuvre'],['r?ception','réception'],['conductivit?','conductivité'],['r?sistance','résistance'],['?lev?','élevé'],['cr?er','créer'],['ventil?','ventilé'],['diff?rents','différents'],['?tre','être'],['r?solique','résolique'],['min?rale','minérale'],['li?ge','liège'],['d?pend','dépend'],['humidit?','humidité'],['r?fl?chissants','réfléchissants'],['?pais','épais'],['compl?ment','complément'],['ferm?','fermé'],['?tanch?it?','étanchéité'],['entr?es','entrées'],['pi?ces','pièces'],['concern?es','concernées'],['s?jour','séjour'],['?l?ments','éléments'],['chauff?s','chauffés'],['D?but','Début'],['d?but','début'],['?ch?ance','Échéance'],['renseign?e','renseignée'],['renseign?','renseigné'],['ajust?e','ajustée'],['ajust?','ajusté'],['calcul?e','calculée'],['calcul?','calculé'],['D?clarer','Déclarer'],['Cat?gorie','Catégorie'],['M?t?o','Météo'],['enregistr?','enregistré'],['sa?uvan','sačuvan'],['s?uvan','sačuvan'],['potro?eno','potrošeno'],['Obri?i','Obriši'],['S?lectionnez','Sélectionnez'],['l?enregistrement','l’enregistrement'],['Tra?im','Tražim'],['prona?ena','pronađena'],['ru?no','ručno'],['? l\'','à l\''],['m?t?','mété'],['m?tallique','métallique'],['m?tal','métal'],['n?cessaire','nécessaire'],['r?glementation','réglementation'],['r?gles','règles'],['s?curit?','sécurité'],['v?rifier','vérifier'],['v?rifi?','vérifié'],['d?grad?','dégradé'],['d?tails','détails'],['? cause','à cause'],['? partir','À partir'],['?ligible','éligible'],['R?novation','Rénovation'],['R?ception','Réception'],['probl?me','problème'],['obligatoire','obligatoire']];
	const repairEncoding = () => { const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode); nodes.forEach((node) => { let text = node.nodeValue; encodingRepairs.forEach(([source, target]) => { text = text.split(source).join(target); }); if (text !== node.nodeValue) node.nodeValue = text; }); };
	Object.assign(runtimeFrench, { 'Obracun ovog unosa:': 'Calcul de cette saisie :', 'Unesite datum, satnicu/dnevnicu, pocetak, kraj i pauzu.': 'Saisissez la date, le tarif, le début, la fin et la pause.', 'Kalendar radnih dana se ucitava...': 'Chargement du calendrier des jours travaillés…', 'Radnik / ouvrier': 'Travailleur', 'Creer un chantier u Devis sekciji': 'Créez un chantier depuis Devis', 'Creer un chantier dans Devis': 'Créer un chantier dans Devis', 'Tip cene': 'Type de tarif', 'Cena rada EUR': 'Tarif de travail EUR', 'Dodaj radnika': 'Ajouter un travailleur', 'Nom et prenom': 'Nom et prénom', 'Email radnika': 'E-mail du travailleur', 'Dnevnica EUR': 'Tarif journalier EUR', 'Satnica / radni sat EUR': 'Tarif horaire EUR', 'Chantier-i na kojima radnik radi': 'Chantiers attribués', 'Pošalji email poziv': 'Envoyer l’invitation e-mail', 'Radnik dobija email poziv i pristup samo za svoje dane, dodeljene chantier-e i RDV/odsustvo.': 'Le travailleur reçoit une invitation e-mail et accède uniquement à ses jours, chantiers et rendez-vous.', 'Prvo registruj chantier u Devis sekciji.': 'Créez d’abord un chantier dans Devis.', 'Nema promena za izabrani chantier.': 'Aucune modification pour ce chantier.', 'Aucune saisie de temps de travail pour ce travailleur.': 'Aucune saisie de temps pour ce travailleur.' });
	encodingRepairs.push(['pr?vue', 'prévue'], ['pr?vu', 'prévu'], ['ajust?e', 'ajustée'], ['enregistr?', 'enregistré'], ['non renseign?', 'non renseigné'], ['?t?', 'été'], ['D?but', 'Début'], ['?ch?ance', 'Échéance'], ['Cat?gorie', 'Catégorie'], ['M?t?o', 'Météo']);
	Object.assign(runtimeFrench, {
		'Creer un chantier dans Devis': 'Créer un chantier dans Devis', 'Creer un chantier u Devis sekciji': 'Créez d’abord un chantier dans Devis',
		'Planovi i fiches techniques u PDF-u, fotografije sa gradilišta · 25 Mo maksimum': 'Plans et fiches techniques PDF, photos de chantier · 25 Mo maximum',
		'ITE - znanje, kontrole i odgovori': 'ITE · connaissances, contrôles et réponses', 'Za učenje i chantier provjeru': 'Pour apprendre et contrôler le chantier',
		'Pretraga pitanja i odgovora': 'Recherche de questions et réponses', 'Traži po riječi, npr. RGE, pare-vapeur, BAR-EN-102, lame d’air, MaPrimeRenov': 'Rechercher par mot-clé, ex. RGE, pare-vapeur, BAR-EN-102, lame d’air, MaPrimeRénov',
		'Upiši pojam...': 'Saisir un terme…', 'RGE kontrolna lista': 'Liste de contrôle RGE', 'Kompletno znanje po temama': 'Connaissances par thème', 'Učitavanje RGE baze...': 'Chargement de la base RGE…', 'Učitavanje kontrola...': 'Chargement des contrôles…', 'Učitavanje tema...': 'Chargement des thèmes…',
		'Obracun ovog unosa: 0.00 h ? 0,00 EUR': 'Calcul de cette saisie : 0,00 h · 0,00 €', 'Unesite datum, satnicu/dnevnicu, pocetak, kraj i pauzu.': 'Saisissez la date, le tarif, le début, la fin et la pause.', 'Kalendar radnih dana se ucitava...': 'Chargement du calendrier des jours travaillés…',
		'Radnik / ouvrier': 'Travailleur', 'Tip cene': 'Type de tarif', 'Cena rada EUR': 'Tarif de travail EUR', 'Dnevnica': 'Tarif journalier', 'Satnica': 'Tarif horaire', 'Dodaj radnika': 'Ajouter un travailleur', 'Nom et prenom': 'Nom et prénom', 'Email radnika': 'E-mail du travailleur', 'Dnevnica EUR': 'Tarif journalier EUR', 'Satnica / radni sat EUR': 'Tarif horaire EUR',
		'Chantier-i na kojima radnik radi': 'Chantiers attribués', 'Izaberi jedan ili više chantier-a za ovog radnika.': 'Sélectionnez un ou plusieurs chantiers.', 'Pošalji email poziv': 'Envoyer l’invitation e-mail', 'Radnik dobija email poziv i pristup samo za svoje dane, dodeljene chantier-e i RDV/odsustvo.': 'Le travailleur reçoit une invitation e-mail et accède uniquement à ses jours, chantiers et rendez-vous.',
		'Role': 'Rôle', 'Utilisateur / radnik': 'Travailleur', 'Gerant / gazda': 'Gérant', 'Ime firme': 'Nom de l’entreprise', 'Za dodatnog gazdu unesite ime firme i SIRET. Radnik nasljedjuje firmu gazde koji ga poziva.': 'Pour un gérant supplémentaire, renseignez le nom de l’entreprise et le SIRET. Le travailleur reprend l’entreprise du gérant qui l’invite.',
		'Izaberi jedan ili više chantier-a za ovog radnika.': 'Sélectionnez un ou plusieurs chantiers.', 'Nema registrovanih chantier-a': 'Aucun chantier enregistré', 'Nema promena za izabrani chantier.': 'Aucune modification pour ce chantier.', 'Nema sačuvanih dokumenata.': 'Aucun document enregistré.', 'Nema troškova.': 'Aucune dépense.', 'Nema unosa radnog vremena.': 'Aucune saisie de temps de travail.', 'Nema RDV/odsustva.': 'Aucun rendez-vous ni absence.',
		'RADNIK · MJESEČNI PREGLED': 'TRAVAILLEUR · VUE MENSUELLE', 'Detalji radnika': 'Détails du travailleur', 'Mjesec pregleda': 'Mois affiché', 'Učitavanje': 'Chargement', 'KALENDAR': 'CALENDRIER', 'Radni dani i RDV': 'Jours travaillés et rendez-vous', 'ISPLATA': 'PAIEMENT', 'Plata i status': 'Paiement et statut', 'RDV / ODSUSTVO': 'RENDEZ-VOUS / ABSENCES', 'Termini': 'Rendez-vous', 'EVIDENCIJA': 'SUIVI', 'Unosi rada': 'Saisies de temps',
		'Preimenuj': 'Renommer', 'Obriši': 'Supprimer', 'Otvori': 'Ouvrir', 'Otvori praćenje': 'Ouvrir le suivi', 'Izmeni profil': 'Modifier le profil', 'Pošalji link za lozinku': 'Envoyer le lien de mot de passe', 'Obriši radnika': 'Supprimer le travailleur', 'Nema dodeljenog chantier-a': 'Aucun chantier attribué', 'Nema zakazanog RDV': 'Aucun rendez-vous prévu',
		'Chantier controle': 'Contrôles chantier', 'Izaberite aktivni chantier da biste videli rizik.': 'Sélectionnez un chantier pour afficher les priorités.', 'Prvo registruj chantier u Devis sekciji.': 'Créez d’abord un chantier dans Devis.', 'Nema chantier-a': 'Aucun chantier', 'Nema Devis-a': 'Aucun devis', 'Nedostupno': 'Indisponible',
		'Radno vreme je odobreno.': 'Le temps de travail a été approuvé.', 'Radno vreme je odbijeno.': 'Le temps de travail a été refusé.', 'Radno vreme je sačuvano.': 'Le temps de travail a été enregistré.', 'Radno vreme nije sačuvano.': 'Le temps de travail n’a pas été enregistré.', 'Poruka je sačuvana.': 'Le message a été enregistré.', 'Poruka nije poslata.': 'Le message n’a pas été envoyé.', 'Kontrola je ažurirana.': 'Le contrôle a été mis à jour.', 'Kontrola nije ažurirana.': 'Le contrôle n’a pas été mis à jour.'
	});
	Object.assign(runtimeFrench, {
		"Salarié · Gerant · Gérant": "Travailleur · Gérant", "Chaque jour: chantier, durée et prix": "Chaque jour : chantier, durée et tarif", "Temps de travail": "Temps de travail", "Jours :": "Jours :", "Calcul :": "Calcul :", "Pause en minutes": "Pause en minutes",
		"Npr. kojim redom se izvodi ovaj sistem?": "Ex. dans quel ordre exécuter ce système ?", "Tip izvora": "Type de preuve", "Fotografija pre radova": "Photo avant travaux", "Fotografija tokom radova": "Photo pendant les travaux", "Fotografija posle radova": "Photo après travaux", "Sačuvaj i automatski analiziraj": "Enregistrer et analyser",
		"Ubacite plan, fiche technique PDF ili fotografiju. Aplikacija automatski kaže u čemu se radi, kojim sistemom/materijalom, kako se izvodi, šta kontrolisati i šta slikati kao dokaz.": "Ajoutez un plan, une fiche technique PDF ou une photo. L’analyse propose le type de travaux, le système, les contrôles et les preuves à conserver.",
		"Nabavke": "Achats et dépenses", "Korisnici": "Utilisateurs", "Zadaci i komunikacija": "Tâches et communication", "Dokumenti i slike": "Documents et photos", "Devis i chantiers": "Devis et chantiers", "Chantier kontrole": "Contrôles chantier", "Odjava": "Se déconnecter",
		"Prijavljen korisnik": "Utilisateur connecté", "Izaberite aktivni chantier da biste videli rizik.": "Sélectionnez un chantier pour afficher les priorités.", "NEMA CHANTIER": "AUCUN CHANTIER", "Aucun chantier": "Aucun chantier", "Nema chantier-a": "Aucun chantier",
		"zavrseno": "terminé", "kontrola zavrseno": "contrôles terminés", "Kontrola": "Contrôle", "Nedostaje dokaz:": "Preuve manquante :", "Kontrola je ažurirana.": "Le contrôle a été mis à jour.", "Kontrola nije ažurirana.": "Le contrôle n’a pas été mis à jour.", "Završi": "Terminer", "Vrati na ispravku": "Renvoyer pour correction",
		"Budžet:": "Budget :", "Nabavke:": "Achats :", "Rad:": "Travail :", "Ukupno potrošeno:": "Total dépensé :", "Preostalo:": "Solde restant :", "Devis nije sačuvan": "Le devis n’a pas été enregistré", "Devis i budžet su sačuvani.": "Le devis et le budget ont été enregistrés.", "Devis i chantier su sačuvani.": "Le devis et le chantier ont été enregistrés.", "Devis et chantier enregistrés.": "Devis et chantier enregistrés.",
		"Nema promena za izabrani chantier.": "Aucune modification pour ce chantier.", "Nema poruka.": "Aucun message.", "Nema troškova.": "Aucune dépense.", "Nema sačuvanih dokumenata.": "Aucun document enregistré.", "Nema registrovanih chantiers.": "Aucun chantier enregistré.", "Nema unosa rada u ovom mesecu": "Aucune saisie de temps ce mois-ci", "Nema RDV/odsustva u izabranom mesecu.": "Aucun rendez-vous ni absence ce mois-ci.",
		"Radno vreme": "Temps de travail", "Radni dani": "Jours travaillés", "Sati": "Heures", "Dnevnica:": "Tarif journalier :", "Satnica:": "Tarif horaire :", "Obračun:": "Calcul :", "Obracun ovog unosa:": "Calcul de cette saisie :", "Radni dan je oznacen u kalendaru.": "La journée a été ajoutée au calendrier.",
		"Radnik dobija email poziv": "Le travailleur reçoit une invitation e-mail", "Dodaj radnika": "Ajouter un travailleur", "Radnik je obrisan.": "Le travailleur a été supprimé.", "Radnik nije obrisan.": "Le travailleur n’a pas été supprimé.", "Radnik je preimenovan.": "Le travailleur a été renommé.", "Radnik nije izmijenjen.": "Le travailleur n’a pas été modifié.",
		"Mesec pregleda": "Mois affiché", "Mjesec pregleda": "Mois affiché", "Radni dani i RDV": "Jours travaillés et rendez-vous", "Plata i status": "Paiement et statut", "Nema zahteva": "Aucune demande", "Rok nije određen": "Aucune échéance", "Zahtev je poslat · čeka pregled": "Demande envoyée · en attente de vérification", "Nema zahteva za isplatu": "Aucune demande de paiement",
		"Izaberite aktivni chantier pre čuvanja proizvodnje.": "Sélectionnez un chantier avant d’enregistrer la production.", "Izaberite aktivni chantier pre slanja poruke.": "Sélectionnez un chantier avant d’envoyer le message.", "Izaberite aktivni chantier pre slanja RDV-a.": "Sélectionnez un chantier avant d’envoyer le rendez-vous.", "Prvo izaberite ili uploadujte sliku koju hocete mjeriti.": "Sélectionnez d’abord une photo à mesurer.", "Selektujte fajl pre snimanja.": "Sélectionnez un fichier avant l’enregistrement.",
		"S?lectionnez un fichier avant l?enregistrement.": "Sélectionnez un fichier avant l’enregistrement.", "Dokument je sa?uvan i automatski analiziran.": "Le document a été enregistré et analysé.", "Dokument non enregistr?": "Document non enregistré", "Devis non enregistr?": "Devis non enregistré", "Trošak nije sačuvan.": "La dépense n’a pas été enregistrée.", "Trošak i PDF faktura su sačuvani; Devis je automatski ažuriran.": "La dépense et la facture PDF ont été enregistrées ; le devis est à jour.",
		"Tražim firmu po SIRET/SIREN...": "Recherche de l’entreprise par SIRET/SIREN…", "Firma nije pronađena automatski; unesite ime firme ručno.": "Entreprise introuvable automatiquement ; saisissez le nom manuellement.", "Email/telefon ili password nisu tačni.": "E-mail/téléphone ou mot de passe incorrect.", "Izabrani profil ne odgovara ovom nalogu.": "Le profil sélectionné ne correspond pas à ce compte.", "Password i potvrda se razlikuju.": "Les mots de passe ne correspondent pas.", "Nalog je kreiran za": "Compte créé pour", "Lozinka je poslata na": "Le lien a été envoyé à", "Kliknite dalje kada želite da unesete password.": "Continuez pour définir le mot de passe.", "Pristup je spreman.": "L’accès est prêt.", "Kreiraj pristup": "Créer l’accès",
		"Planovi i fiches techniques u PDF-u, fotografije sa gradilišta · 25 Mo maksimum": "Plans et fiches techniques PDF, photos de chantier · 25 Mo maximum", "Telephone (optionnel)": "Téléphone (facultatif)", "Nema registrovanih chantier-a": "Aucun chantier enregistré", "Učitavanje": "Chargement", "Učitavanje...": "Chargement…", "Dodaj radnika": "Ajouter un travailleur", "Pošalji email poziv": "Envoyer l’invitation e-mail", "Pitaj na osnovu dokumentacije": "Poser la question", "Sačuvaj i automatski analiziraj": "Enregistrer et analyser", "Kalendar radnih dana se ucitava...": "Chargement du calendrier des jours travaillés…", "Kalendar radnih dana se ucitava": "Chargement du calendrier des jours travaillés…"
	});
	const localeVersion = 'fr-first-v1';
	if (localStorage.getItem('ibra-locale-version') !== localeVersion) { localStorage.setItem('ibra-locale-version', localeVersion); localStorage.setItem('ibra-language', 'fr'); }
	let language = localStorage.getItem('ibra-language') || 'fr';
	let rgeQualibatKnowledge;
	const originalText = new Map();
	document.querySelectorAll('body *').forEach((element) => { if (element.children.length === 0) originalText.set(element, element.textContent); });
	const setLanguage = (next) => { language = next; localStorage.setItem('ibra-language', next); originalText.forEach((text, element) => { element.textContent = next === 'fr' ? (translations[text] || text) : text; }); document.querySelectorAll('.language-button').forEach((button) => button.classList.toggle('active', button.dataset.language === next)); if (rgeQualibatKnowledge) loadRgeQualibat(); };
	document.querySelectorAll('.language-button').forEach((button) => button.addEventListener('click', () => setLanguage(button.dataset.language)));
	setLanguage(language);
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
			preview.textContent = 'Tražim firmu po SIRET/SIREN...';
			try {
				const company = await request(`/siret/${digits}`);
				if (companyInput && !companyInput.value.trim()) companyInput.value = company.name || '';
				preview.textContent = `${company.name} · SIRET ${company.siret}${company.address ? ` · ${company.address}` : ''}`;
			} catch {
				preview.textContent = 'Firma nije pronađena automatski; unesite ime firme ručno.';
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
			toast('Photo du travailleur enregistrée.');
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
			toast('Photo du travailleur supprimée.');
		} catch { toast('La photo n’a pas pu être supprimée.'); }
	});
	async function resetUserPassword(user, trigger) {
		if (!user?.email || !window.confirm(`Envoyer un nouveau lien de mot de passe à ${user.email} ?`)) return;
		trigger.disabled = true; trigger.setAttribute('aria-busy', 'true');
		try { const result = await request(`/users/${encodeURIComponent(user.id)}/password-reset`, { method: 'POST' }); toast(result.setupUrl ? `Lien de configuration : ${result.setupUrl}` : 'Lien de mot de passe envoyé.'); }
		catch (error) { try { toast(JSON.parse(error.message).error || 'Lien de mot de passe non envoyé.'); } catch { toast('Lien de mot de passe non envoyé.'); } }
		finally { trigger.disabled = false; trigger.removeAttribute('aria-busy'); }
	}
	const workerRosterState = { month: new Date().toISOString().slice(0, 7), query: '', statusFilter: 'all', users: [], entries: [], rendezvous: [], payouts: [], loading: false, error: null, menuWorkerId: '', detailWorkerId: '', detailMonth: '', detailSelectedDate: '', detailSnapshot: null };
	const workerStatusMeta = {
		critical: { label: 'Kritično', className: 'status-critical' },
		attention: { label: 'Pažnja', className: 'status-attention' },
		pending: { label: 'Čeka pregled', className: 'status-pending' },
		good: { label: 'Plaćeno', className: 'status-good' },
		empty: { label: 'Bez unosa', className: 'status-empty' }
	};
	const workerStatusRank = { critical: 0, attention: 1, pending: 2, good: 3, empty: 4 };
	const payoutStatusLabels = { pending: 'Čeka odobrenje', approved: 'Odobreno · nije plaćeno', rejected: 'Odbijeno', paid: 'Plaćeno' };
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
		const dueDate = payout?.paymentDate || '';
		const overdue = Boolean(dueDate && dueDate < new Date().toISOString().slice(0, 10) && payout?.status !== 'paid');
		let paymentState = 'empty';
		if (entries.length) {
			if (missingRate || payout?.status === 'rejected' || overdue) paymentState = 'critical';
			else if (payout?.status === 'paid') paymentState = 'good';
			else if (!payout || payout.status === 'approved') paymentState = 'attention';
			else paymentState = 'pending';
		}
		const paymentDetail = paymentState === 'empty' ? 'Nema unosa rada u ovom mesecu' : paymentState === 'critical' ? (missingRate ? 'Nedostaje tarifa za jedan ili više unosa' : payout?.status === 'rejected' ? 'Zahtev za isplatu je odbijen' : `Rok plaćanja je prošao${dueDate ? ` · ${formatRosterDate(dueDate)}` : ''}`) : paymentState === 'attention' ? (payout?.status === 'approved' ? `Odobreno · čeka uplatu${dueDate ? ` do ${formatRosterDate(dueDate)}` : ''}` : 'Nema zahteva za isplatu') : paymentState === 'good' ? `Isplaćeno${payout?.paymentDate ? ` · ${formatRosterDate(payout.paymentDate)}` : ''}` : 'Zahtev je poslat · čeka pregled';
		return { user, month, entries, rendezvous, payout, workedDays, hours, amount, nextRendezvous: nextWorkerRendezvous(allRendezvous), paymentState, paymentDetail, assignedProjects: assignedWorkerProjects(user), rateMissing: missingRate };
	}
	const renderRosterStatus = (snapshot) => { const meta = workerStatusMeta[snapshot.paymentState] || workerStatusMeta.empty; return `<span class="worker-status ${meta.className}"><span class="worker-status-dot" aria-hidden="true"></span>${meta.label}</span><small class="worker-status-detail">${escapeHtml(snapshot.paymentDetail)}</small>`; };
	function renderWorkerRosterSummary(snapshots) {
		const summary = document.querySelector('#worker-roster-summary');
		if (!summary) return;
		const totalAmount = snapshots.reduce((sum, snapshot) => sum + snapshot.amount, 0);
		const counts = Object.fromEntries(Object.keys(workerStatusMeta).map((status) => [status, snapshots.filter((snapshot) => snapshot.paymentState === status).length]));
		summary.innerHTML = `<div><dt>Radnici</dt><dd>${snapshots.length}</dd><small>${counts.empty ? `${counts.empty} bez unosa` : 'aktivni registar'}</small></div><div class="summary-critical"><dt>Kritično</dt><dd>${counts.critical}</dd><small>rok, tarifa ili odbijen zahtev</small></div><div class="summary-attention"><dt>Za pregled</dt><dd>${counts.attention + counts.pending}</dd><small>${counts.attention} čeka uplatu · ${counts.pending} čeka pregled</small></div><div class="summary-total"><dt>Ukupno ovog meseca</dt><dd>${formatEUR(totalAmount)}</dd><small>${escapeHtml(formatMonthLabel(workerRosterState.month))}</small></div>`;
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
		const filtered = snapshots.filter((snapshot) => { const haystack = [snapshot.user.name, snapshot.user.email, snapshot.user.phone, snapshot.user.company, snapshot.user.employerCompany, ...snapshot.assignedProjects].filter(Boolean).join(' ').toLowerCase(); return (!query || haystack.includes(query)) && (workerRosterState.statusFilter === 'all' || snapshot.paymentState === workerRosterState.statusFilter); }).sort((first, second) => (workerStatusRank[first.paymentState] - workerStatusRank[second.paymentState]) || String(first.user.name || '').localeCompare(String(second.user.name || ''), 'fr', { sensitivity: 'base' }));
		renderWorkerRosterSummary(snapshots);
		document.querySelector('#worker-roster-period-label').textContent = `${formatMonthLabel(workerRosterState.month)} · ${filtered.length} od ${snapshots.length} radnika`;
		if (workerRosterState.error) { stateTarget.hidden = false; stateTarget.innerHTML = `<strong>Podaci ekipe nisu dostupni.</strong><small>Pokušajte ponovo bez brisanja prethodnog prikaza.</small><button class="secondary" id="worker-roster-retry" type="button">Pokušaj ponovo</button>`; table.hidden = !workerUsers.length; } else if (workerRosterState.loading && !workerUsers.length) { stateTarget.hidden = false; stateTarget.innerHTML = '<strong>Données en cours de chargement…</strong>'; table.hidden = true; } else if (!workerUsers.length) { stateTarget.hidden = false; stateTarget.innerHTML = '<strong>Nema dodatih radnika</strong><small>Dodajte prvog radnika da biste pratili dane, sate i isplate.</small>'; table.hidden = true; } else if (!filtered.length) { stateTarget.hidden = false; stateTarget.innerHTML = '<strong>Nema radnika za ovaj filter</strong><small>Promenite pretragu ili status.</small>'; table.hidden = false; } else { stateTarget.hidden = true; stateTarget.innerHTML = ''; table.hidden = false; }
		body.innerHTML = filtered.map((snapshot) => { const user = snapshot.user; const contact = user.email || user.phone || 'Kontakt nije unet'; const roleLabel = userRoleLabels[user.role] || 'Radnik'; const canManage = isOwner() && user.id !== (currentUser?.id || currentUser?.sub); const projectLabel = snapshot.assignedProjects.length ? snapshot.assignedProjects.join(', ') : 'Nema dodeljenog chantier-a'; const nextRdv = snapshot.nextRendezvous ? `${formatRosterDate(snapshot.nextRendezvous.absenceDate || snapshot.nextRendezvous.date)} · ${snapshot.nextRendezvous.time || ''}` : 'Nema zakazanog RDV'; return `<tr class="worker-roster-row ${workerStatusMeta[snapshot.paymentState]?.className || ''}" data-worker-row="${escapeHtml(user.id)}"><th scope="row"><div class="worker-name-cell">${identityTokenHtml(user.avatarUrl, user.name, 'worker-avatar worker-avatar--roster')}<button class="worker-detail-primary" data-worker-detail="${escapeHtml(user.id)}" type="button"><strong>${escapeHtml(user.name || 'Radnik')}</strong><span>Otvori praćenje</span></button><span class="user-role">${escapeHtml(roleLabel)}</span></div><small class="worker-contact">${escapeHtml(contact)}</small><small class="worker-projects" title="${escapeHtml(projectLabel)}">${escapeHtml(projectLabel)}</small></th><td data-label="Jours"><strong>${snapshot.workedDays}</strong><small> ce mois</small></td><td data-label="Heures"><strong>${snapshot.hours.toFixed(2)}</strong><small> h</small></td><td data-label="Tarif"><span>${formatEUR(user.dailyRate || 0)}/j</span><small>${formatEUR(user.hourlyRate || 0)}/h</small></td><td data-label="Montant du mois" class="worker-amount"><strong>${formatEUR(snapshot.amount)}</strong><small>${snapshot.entries.length ? `${snapshot.entries.length} unosa` : 'bez unosa'}</small></td><td data-label="Paiement" class="worker-payment-cell">${renderRosterStatus(snapshot)}</td><td data-label="Prochain RDV"><span class="worker-next-rdv">${escapeHtml(nextRdv)}</span>${snapshot.nextRendezvous?.reason ? `<small>${escapeHtml(snapshot.nextRendezvous.reason)}</small>` : ''}</td><td data-label="Actions" class="worker-actions-cell"><div class="worker-row-actions"><button class="secondary worker-detail-primary worker-detail-action" data-worker-detail="${escapeHtml(user.id)}" type="button">Otvori</button>${canManage ? `<div class="worker-action-menu-wrap"><button class="secondary worker-action-menu-trigger" data-worker-menu="${escapeHtml(user.id)}" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Akcije za ${escapeHtml(user.name || 'radnika')}">⋯</button><div class="worker-action-menu" role="menu" hidden><button type="button" role="menuitem" data-worker-action="edit" data-worker="${escapeHtml(user.id)}">Izmeni profil</button><button type="button" role="menuitem" data-worker-action="reset" data-worker="${escapeHtml(user.id)}"${user.email ? '' : ' disabled'}>Pošalji link za lozinku</button><button type="button" role="menuitem" class="danger" data-worker-action="delete" data-worker="${escapeHtml(user.id)}">Obriši radnika</button></div></div>` : ''}</div></td></tr>`; }).join('');
		document.querySelector('#worker-roster-retry')?.addEventListener('click', () => loadUsers());
	}
	function setupWorkerRosterControls() {
		const monthInput = document.querySelector('#worker-roster-month');
		const searchInput = document.querySelector('#worker-roster-search');
		const filterInput = document.querySelector('#worker-roster-status-filter');
		if (monthInput && monthInput.dataset.wired !== 'true') { monthInput.dataset.wired = 'true'; monthInput.addEventListener('change', () => { workerRosterState.month = monthInput.value || new Date().toISOString().slice(0, 7); workerRosterState.detailSelectedDate = ''; renderWorkerRoster(); if (workerRosterState.detailWorkerId) { workerRosterState.detailMonth = workerRosterState.month; renderWorkerDetail(); } }); }
		if (searchInput && searchInput.dataset.wired !== 'true') { searchInput.dataset.wired = 'true'; searchInput.addEventListener('input', () => { workerRosterState.query = searchInput.value; renderWorkerRoster(); }); }
		if (filterInput && filterInput.dataset.wired !== 'true') { filterInput.dataset.wired = 'true'; filterInput.addEventListener('change', () => { workerRosterState.statusFilter = filterInput.value; renderWorkerRoster(); }); }
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
		const [year, monthNumber] = month.split('-').map(Number); const first = new Date(year, monthNumber - 1, 1); const last = new Date(year, monthNumber, 0); const entryByDate = new Map(snapshot.entries.map((entry) => [entry.date, entry])); const rendezvousByDate = new Map(); snapshot.rendezvous.forEach((item) => { const date = item.absenceDate || item.date; const list = rendezvousByDate.get(date) || []; list.push(item); rendezvousByDate.set(date, list); }); let cells = ''; for (let pad = 0; pad < (first.getDay() || 7) - 1; pad += 1) cells += '<span class="calendar-cell empty" aria-hidden="true"></span>'; for (let day = 1; day <= last.getDate(); day += 1) { const date = `${month}-${String(day).padStart(2, '0')}`; const weekday = new Date(year, monthNumber - 1, day).getDay(); const weekend = weekday === 0 || weekday === 6; const entry = entryByDate.get(date); const rdv = rendezvousByDate.get(date) || []; const title = [entry ? `${Number(entry.hours || 0).toFixed(2)} h · ${formatEUR(workerEntryAmount(entry, snapshot.user))}` : '', rdv.map((item) => `RDV ${item.time || ''} · ${item.reason || ''}`).join(' | ')].filter(Boolean).join(' · ') || 'Bez unosa'; const marker = [entry ? `<small>${Number(entry.hours || 0).toFixed(1)}h</small>` : '', ...rdv.map((item) => `<span class="calendar-rendezvous" title="${escapeHtml(item.reason || '')}">RDV ${escapeHtml(item.time || '')}</span>`)].join('') || '<small>—</small>'; cells += `<button type="button" class="calendar-cell${weekend ? ' weekend' : ''}${entry ? ' worked' : ''}${rdv.length ? ' has-rendezvous' : ''}" data-detail-date="${date}" title="${escapeHtml(title)}" aria-label="${escapeHtml(`${date}: ${title}`)}"><strong>${day}</strong>${marker}</button>`; }
		const workedDays = new Set(snapshot.entries.map((entry) => entry.date)).size; const hours = snapshot.entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0); const rdvDays = rendezvousByDate.size; target.innerHTML = `<div class="work-calendar-head"><strong>${escapeHtml(formatMonthLabel(month))}</strong><small>${workedDays} radnih dana · ${hours.toFixed(2)} h · ${rdvDays} RDV</small></div><p class="calendar-hint">Zeleno = radni dan · žuto = RDV/odsustvo. Klikni datum za evidenciju tog dana.</p><div class="calendar-weekdays"><span>Pon</span><span>Uto</span><span>Sri</span><span>Čet</span><span>Pet</span><span>Sub</span><span>Ned</span></div><div class="calendar-grid">${cells}</div>`;
	}
	function renderWorkerDetail() {
		const user = workerRosterState.users.find((item) => item.id === workerRosterState.detailWorkerId); if (!user) return; const month = workerRosterState.detailMonth || workerRosterState.month; const snapshot = deriveWorkerSnapshot(user, month); workerRosterState.detailSnapshot = snapshot; const title = document.querySelector('#worker-detail-title'); const subtitle = document.querySelector('#worker-detail-subtitle'); const monthInput = document.querySelector('#worker-detail-month'); const badge = document.querySelector('#worker-detail-payment-badge'); paintIdentityToken(document.querySelector('#worker-detail-avatar'), user.avatarUrl || '', user.name); if (title) title.textContent = user.name || 'Radnik'; if (subtitle) subtitle.textContent = [user.email || user.phone || 'Kontakt nije unet', user.company || user.employerCompany || '', snapshot.assignedProjects.join(', ')].filter(Boolean).join(' · '); if (monthInput) monthInput.value = month; if (badge) { badge.className = `worker-status ${workerStatusMeta[snapshot.paymentState].className}`; badge.innerHTML = `<span class="worker-status-dot" aria-hidden="true"></span>${workerStatusMeta[snapshot.paymentState].label}`; }
		document.querySelector('#worker-detail-summary').innerHTML = `<div><small>Radni dani</small><strong>${snapshot.workedDays}</strong><span>${escapeHtml(formatMonthLabel(month))}</span></div><div><small>Sati</small><strong>${snapshot.hours.toFixed(2)}</strong><span>ukupno</span></div><div><small>Dnevnica</small><strong>${formatEUR(user.dailyRate || 0)}</strong><span>po danu</span></div><div><small>Satnica</small><strong>${formatEUR(user.hourlyRate || 0)}</strong><span>po satu</span></div><div class="detail-summary-amount"><small>Obračunato</small><strong>${formatEUR(snapshot.amount)}</strong><span>${snapshot.entries.length} unosa</span></div>`;
		renderWorkerDetailCalendar(snapshot, month); renderWorkerDetailPayment(snapshot); renderWorkerDetailRendezvous(snapshot); renderWorkerDetailEntries(snapshot);
	}
	function renderWorkerDetailPayment(snapshot) { const target = document.querySelector('#worker-detail-payment'); if (!target) return; const payout = snapshot.payout; const payoutLabel = payout ? (payoutStatusLabels[payout.status] || payout.status) : 'Nema zahteva'; const due = payout?.paymentDate ? `Rok plaćanja: ${formatRosterDate(payout.paymentDate)}` : 'Rok nije određen'; const actions = isOwner() && payout ? payout.status === 'pending' ? `<button class="secondary" data-payout-status="approved" data-payout="${escapeHtml(payout.id)}">Odobri</button><button class="secondary" data-payout-status="rejected" data-payout="${escapeHtml(payout.id)}">Odbij</button>` : payout.status === 'approved' ? `<button class="primary" data-payout-status="paid" data-payout="${escapeHtml(payout.id)}">Označi plaćeno</button>` : '' : ''; target.innerHTML = `<div class="detail-payment-status ${workerStatusMeta[snapshot.paymentState].className}"><div><span class="worker-status ${workerStatusMeta[snapshot.paymentState].className}"><span class="worker-status-dot" aria-hidden="true"></span>${workerStatusMeta[snapshot.paymentState].label}</span><strong>${formatEUR(snapshot.amount)}</strong></div><p>${escapeHtml(snapshot.paymentDetail)}</p><small>${escapeHtml(payoutLabel)} · ${escapeHtml(due)}</small>${actions ? `<div class="detail-payment-actions">${actions}</div>` : ''}</div>`; }
	function renderWorkerDetailRendezvous(snapshot) { const target = document.querySelector('#worker-detail-rendezvous'); if (!target) return; target.innerHTML = snapshot.rendezvous.length ? snapshot.rendezvous.slice().sort((first, second) => `${first.absenceDate || first.date} ${first.time}`.localeCompare(`${second.absenceDate || second.date} ${second.time}`)).map((item) => `<div class="detail-list-item"><strong>${escapeHtml(formatRosterDate(item.absenceDate || item.date))} · ${escapeHtml(item.time || '')}</strong><small>${escapeHtml(item.reason || 'Bez razloga')} · ${escapeHtml(assignedWorkerProjects({ projectIds: [item.projectId] })[0] || item.projectId || '')}</small></div>`).join('') : '<small>Nema RDV/odsustva u izabranom mesecu.</small>'; }
	function renderWorkerDetailEntries(snapshot) { const target = document.querySelector('#worker-detail-entries'); if (!target) return; const selectedDate = workerRosterState.detailSelectedDate; const entries = selectedDate ? snapshot.entries.filter((entry) => entry.date === selectedDate) : snapshot.entries; const heading = selectedDate ? `<div class="detail-list-filter"><small>Prikazan dan: ${escapeHtml(formatRosterDate(selectedDate))}</small><button class="secondary" type="button" data-detail-clear>Prikaži sve</button></div>` : ''; target.innerHTML = `${heading}${entries.length ? entries.slice().sort((first, second) => String(second.date).localeCompare(String(first.date))).map((item) => `<div class="detail-list-item"><strong>${escapeHtml(formatRosterDate(item.date))} · ${Number(item.hours || 0).toFixed(2)} h · ${formatEUR(workerEntryAmount(item, snapshot.user))}</strong><small>${escapeHtml(item.start || '')}${item.end ? `–${escapeHtml(item.end)}` : ''} · ${item.rateType === 'hourly' ? 'Satnica' : 'Dnevnica'} · ${item.status === 'approved' ? 'Odobreno' : item.status === 'rejected' ? 'Odbijeno' : 'Čeka pregled'}</small></div>`).join('') : '<small>Nema unosa rada u izabranom mesecu.</small>'}`; }
	workerDetailModal?.addEventListener('click', async (event) => { if (event.target === workerDetailModal) { closeWorkerDetail(); return; } const dateButton = event.target.closest('[data-detail-date]'); if (dateButton) { workerRosterState.detailSelectedDate = dateButton.dataset.detailDate; renderWorkerDetail(); return; } if (event.target.closest('[data-detail-clear]')) { workerRosterState.detailSelectedDate = ''; renderWorkerDetail(); return; } const payoutButton = event.target.closest('[data-payout-status]'); if (payoutButton) { payoutButton.disabled = true; try { await request(`/payout-requests/${encodeURIComponent(payoutButton.dataset.payout)}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: payoutButton.dataset.payoutStatus }) }); await loadUsers(); renderWorkerDetail(); toast(payoutButton.dataset.payoutStatus === 'paid' ? 'Plaćanje je označeno kao završeno.' : 'Status zahteva je promenjen.'); } catch { toast('Status plaćanja nije promenjen.'); } finally { payoutButton.disabled = false; } } });
	workerDetailModal?.querySelector('#worker-detail-close')?.addEventListener('click', closeWorkerDetail);
	workerDetailModal?.addEventListener('change', (event) => { if (event.target.id !== 'worker-detail-month') return; workerRosterState.detailMonth = event.target.value || workerRosterState.month; workerRosterState.detailSelectedDate = ''; renderWorkerDetail(); });
	document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeWorkerActionMenus(); if (workerDetailModal && !workerDetailModal.hidden) closeWorkerDetail(); } if (event.key === 'Tab' && workerDetailModal && !workerDetailModal.hidden) { const focusable = [...workerDetailModal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')].filter((element) => !element.hidden && element.offsetParent !== null); if (!focusable.length) return; const first = focusable[0]; const last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } });
	document.addEventListener('click', (event) => { if (!event.target.closest('.worker-action-menu-wrap')) closeWorkerActionMenus(); });
	document.querySelector('#worker-roster-body')?.addEventListener('click', async (event) => { const detailButton = event.target.closest('[data-worker-detail]'); if (detailButton) { openWorkerDetail(detailButton.dataset.workerDetail, detailButton); return; } const menuTrigger = event.target.closest('[data-worker-menu]'); if (menuTrigger) { event.stopPropagation(); toggleWorkerActionMenu(menuTrigger.dataset.workerMenu, menuTrigger); return; } const action = event.target.closest('[data-worker-action]'); if (!action) return; const user = workerRosterState.users.find((item) => item.id === action.dataset.worker); closeWorkerActionMenus(); if (!user) return; if (action.dataset.workerAction === 'edit') { openUserEditor(user, action); return; } if (action.dataset.workerAction === 'reset') { await resetUserPassword(user, action); return; } if (action.dataset.workerAction === 'delete' && window.confirm(`Obrisati radnika ${user.name}?`)) { try { await request(`/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' }); await refreshActiveView(); toast('Radnik je uklonjen.'); } catch (error) { let message = 'Radnik nije uklonjen.'; try { message = JSON.parse(error.message).error || message; } catch {} toast(message); } } });
	async function loadUsers() {
		setupWorkerRosterControls();
		workerRosterState.loading = true; workerRosterState.error = null; renderWorkerRoster();
		try {
			await loadProjectOptions();
			const [users, entries, rendezvous, payouts] = await Promise.all([request('/contacts'), request('/time-entries'), request('/rendezvous'), request('/payout-requests')]);
			workerRosterState.users = users; workerRosterState.entries = entries; workerRosterState.rendezvous = rendezvous; workerRosterState.payouts = payouts; workerRosterState.loading = false; workerRosterState.error = null; renderWorkerRoster();
			const currentUserId = currentUser?.id || currentUser?.sub; const recipient = document.querySelector('#recipient'); if (recipient) recipient.innerHTML = users.filter((user) => user.id !== currentUserId).map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)} · ${escapeHtml(user.role)}</option>`).join('');
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
		headRow.innerHTML = `<th scope="col">Travailleur</th>${projects.map((project) => `<th scope="col">${escapeHtml(project.name)}</th>`).join('')}`;
		const query = workerAssignmentState.query.trim().toLowerCase();
		const workers = workerAssignmentState.workers.filter((worker) => !query || [worker.name, worker.email, worker.phone].filter(Boolean).join(' ').toLowerCase().includes(query));
		if (!workerAssignmentState.workers.length) { stateTarget.hidden = false; stateTarget.innerHTML = '<strong>Aucun travailleur à attribuer</strong><small>Invitez un travailleur par e-mail, puis attribuez-lui un chantier.</small>'; table.hidden = true; }
		else if (!projects.length) { stateTarget.hidden = false; stateTarget.innerHTML = '<strong>Aucun chantier disponible</strong><small>Créez un chantier depuis un devis avant de gérer les attributions.</small>'; table.hidden = true; }
		else if (!workers.length) { stateTarget.hidden = false; stateTarget.innerHTML = '<strong>Aucun travailleur ne correspond à cette recherche.</strong>'; table.hidden = true; }
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
	function ensureRendezvousForm() {
		if (document.querySelector('#rendezvous-form')) return;
		const panel = document.querySelector('#tasks-view .panel');
		if (!panel) return;
		const form = document.createElement('form');
		form.id = 'rendezvous-form';
		form.innerHTML = `<h3>RDV / odsustvo sa posla</h3><small>Radnik ovdje javlja da nece doci na posao. Mora poslati najmanje 3 dana ranije. Gazda vidi termin u kalendaru u aplikaciji.</small><label>Datum odsustva<input name="absenceDate" type="date" required /></label><label>Sat RDV / odsustva<input name="time" type="time" required /></label><label>Motif / razlog<textarea name="reason" required></textarea></label><button class="secondary" type="submit">Sacuvaj RDV</button>`;
		panel.append(form);
		const minimumDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
		form.elements.absenceDate.min = minimumDate;
		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			const values = Object.fromEntries(new FormData(form).entries());
			values.date = values.absenceDate;
			values.projectId = currentProjectId();
			if (!values.projectId) { toast('Izaberite aktivni chantier pre slanja RDV-a.'); return; }
			try {
				await request('/rendezvous', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
				form.reset();
				form.elements.absenceDate.min = minimumDate;
				await refreshActiveView();
				toast('Odsustvo/RDV je sacuvano. Gazda ga vidi u kalendaru.');
			} catch (error) { toast(`RDV nije poslat: ${error.message || 'greska'}`); }
		});
	}
	async function loadRendezvous(items) {
		const activeProject = currentProjectId();
		latestRendezvous = (items || await request('/rendezvous')).filter((item) => !activeProject || item.projectId === activeProject);
		const panel = document.querySelector('#tasks-view .panel');
		if (!panel) return;
		const target = document.querySelector('#rendezvous-list') || (() => { const element = document.createElement('div'); element.id = 'rendezvous-list'; element.className = 'list'; panel.append(element); return element; })();
		const french = language === 'fr';
		const sorted = latestRendezvous.slice().sort((first, second) => `${first.absenceDate} ${first.time}`.localeCompare(`${second.absenceDate} ${second.time}`));
		target.innerHTML = sorted.length ? `<h3>${french ? 'RDV / absences' : 'RDV / odsustva'}</h3>${sorted.map((item) => `<div class="list-item rendezvous-list-item"><strong>${escapeHtml(item.absenceDate)} · ${escapeHtml(item.time)}</strong><small>${escapeHtml(item.workerName || '')} · chantier ${escapeHtml(item.projectId || '')}</small><div>${escapeHtml(item.reason || '')}</div></div>`).join('')}` : `<small>${french ? 'Aucun RDV/absence.' : 'Nema RDV/odsustva.'}</small>`;
	}
	async function loadMessages() { await loadProjectOptions(); ensureRendezvousForm(); const activeProject = currentProjectId(); const messages = (await request('/messages')).filter((item) => !activeProject || item.projectId === activeProject); document.querySelector('#messages').innerHTML = messages.length ? messages.map((item) => `<div class="list-item"><strong>${item.senderName} → ${item.recipientName}</strong><div>${item.text}</div><small>${item.projectId} · ${new Date(item.createdAt).toLocaleString()}</small></div>`).join('') : '<small>Nema poruka.</small>'; await loadRendezvous(); }
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
			if (!projectId) { toast('Izaberite aktivni chantier pre čuvanja proizvodnje.'); return; }
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
		const workerTotals = summary.byWorker?.map((item) => `${item.workerName}: ${Number(item.quantityM2 || 0).toFixed(2)} m2 ? ${Number(item.quantityMl || 0).toFixed(2)} ml${managerView ? ` ? ${formatEUR(item.amount)}` : ''}`).join(' | ') || 'Aucun detail par utilisateur';
		summaryTarget.innerHTML = `<div class="list-item"><strong>Situation du ${today}</strong><small>${summary.reportCount} rapport(s) approuve(s) ? ${Number(summary.quantityM2 || 0).toFixed(2)} m2 ? ${Number(summary.quantityMl || 0).toFixed(2)} ml${managerView ? ` ? ${formatEUR(summary.amount)}` : ''}</small><small>${workerTotals}</small><small>Calcul base uniquement sur les rapports approuves. Validation humaine requise.</small></div>`;
		const canReview = isOwner();
		reportTarget.innerHTML = reports.length ? `<h3>Rapports de production</h3>${reports.slice().reverse().map((item) => `<div class="list-item"><strong>${item.date} ? ${item.workerName} ? ${quantityLabel(item)}</strong><small>${item.description} ? ${managerView ? `${formatEUR(item.calculatedAmount)} ? ` : ''}${item.status} ? ${item.aiStatus} ? ${item.capturedAt} ? ${item.locationName}</small>${canReview && item.status === 'pending' ? `<button class="secondary production-status" data-report="${item.id}" data-status="approved">Approuver</button><button class="secondary production-status" data-report="${item.id}" data-status="rejected">Refuser</button>` : ''}</div>`).join('')}` : '<small>Aucun rapport de production.</small>';
		document.querySelectorAll('.production-status').forEach((button) => button.addEventListener('click', async () => { await request(`/work-reports/${button.dataset.report}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: button.dataset.status }) }); await loadProduction(); }));
	}
	async function loadWorkSequence() { const panel = document.querySelector('.ai-panel'); if (!panel || document.querySelector('#work-sequence')) return; const section = document.createElement('div'); section.id = 'work-sequence'; section.className = 'list'; section.innerHTML = '<h3>Ordre des travaux selon les plans</h3><small>Analyse de la documentation...</small>'; panel.append(section); const projectId = currentProjectId(); if (!projectId) { section.innerHTML = '<h3>Ordre des travaux selon les plans</h3><small>Primo izaberite aktivni chantier.</small>'; return; } try { const result = await request(`/projects/${projectId}/work-sequence`); section.innerHTML = `<h3>Ordre des travaux selon les plans</h3><small>${result.answer}</small>${result.steps?.length ? result.steps.map((step) => `<div class="list-item"><strong>${step.order}. ${step.title}</strong><small>${step.instruction} · Preuve requise : ${step.requiredEvidence || 'à confirmer'} · Source : ${step.sourcePage || 'à confirmer'}</small></div>`).join('') : '<small>La séquence ne peut pas être affichée sans documentation source et configuration AI.</small>'}`; } catch { section.innerHTML = '<h3>Ordre des travaux selon les plans</h3><small>Analyse indisponible. Ajoutez un plan ou une fiche technique PDF.</small>'; } }
	function renderAutoAnalysis(target, analysis) {
		if (!target || !analysis) return false;
		const french = language === 'fr';
		const section = (title, items) => items?.length ? `<div class="auto-analysis-section"><strong>${escapeHtml(title)}</strong><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : '';
		const specificAnswer = analysis.answer ? `<div class="auto-analysis-answer"><strong>${french ? 'Réponse selon ce plan' : 'Odgovor prema ovom planu'}</strong><p>${escapeHtml(analysis.answer)}</p></div>` : '';
		target.innerHTML = `<div class="list-item auto-analysis"><strong>${french ? 'Analyse automatique' : 'Automatska analiza'} · ${escapeHtml(analysis.workType)}</strong><small>${french ? 'Confiance' : 'Sigurnost'}: ${Math.round(Number(analysis.confidence || 0) * 100)}% · ${escapeHtml(analysis.fileName || '')}</small>${specificAnswer}${section(french ? 'Système' : 'Sistem', analysis.systems)}${section(french ? 'Matériaux détectés' : 'Prepoznati materijali', analysis.materials)}${section(french ? 'Comment exécuter' : 'Kako se radi', analysis.howTo)}${section(french ? 'Contrôles' : 'Šta kontrolisati', analysis.controls)}${section(french ? 'Preuves photos' : 'Šta slikati kao dokaz', analysis.evidence)}${section(french ? 'Risques / à confirmer' : 'Rizici / šta potvrditi', analysis.risks)}</div>`;
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
		target.innerHTML = canManage && latestTimeWorkers.length ? `<h3>Radnici</h3>${latestTimeWorkers.map((worker) => `<div class="list-item"><strong>${escapeHtml(worker.name)}</strong><small>${escapeHtml(worker.email || worker.phone || 'bez kontakta')} · Chantier: ${escapeHtml(assignedProjectNames(worker) || 'nije izabran')} · Dnevnica ${formatEUR(worker.dailyRate || 0)} · Satnica ${formatEUR(worker.hourlyRate || 0)}</small><div class="worker-actions"><button class="secondary rename-worker" data-worker="${worker.id}" type="button">Preimenuj</button><button class="secondary delete-worker" data-worker="${worker.id}" type="button">Obriši</button></div></div>`).join('')}` : '';
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
			const title = [entry ? `${Number(entry.hours || 0).toFixed(2)} h · ${formatEUR(entry.workAmount || 0)}` : '', rendezvousLabel, entry || dayRendezvous.length ? '' : `Oznaci sate za ${date}`].filter(Boolean).join(' · ');
			const marker = [entry ? `<small>${Number(entry.hours || 0).toFixed(1)}h</small>` : '', ...dayRendezvous.map((item) => `<span class="calendar-rendezvous" title="${escapeHtml(item.reason || '')}">RDV ${escapeHtml(item.time || '')}</span>`)].join('') || '<small>+</small>';
			cells += `<button type="button" class="calendar-cell${weekend ? ' weekend' : ''}${entry ? ' worked' : ''}${dayRendezvous.length ? ' has-rendezvous' : ''}" data-work-date="${date}" title="${escapeHtml(title)}" aria-label="${escapeHtml(`${date}: ${title}`)}"><strong>${day}</strong>${marker}</button>`;
		}
		const workedDays = new Set(monthEntries.map((entry) => entry.date)).size;
		const monthHours = monthEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
		const monthAmount = monthEntries.reduce((sum, entry) => sum + Number(entry.workAmount || 0), 0);
		const rendezvousDays = rendezvousByDate.size;
		const monthLabel = formatMonthLabel(month);
		target.innerHTML = `<div class="work-calendar-head"><strong>Kalendar radnih dana · ${escapeHtml(monthLabel)}</strong><small>Radnih dana: ${workingDays} · Uneseno: ${workedDays} · ${monthHours.toFixed(2)} h · ${formatEUR(monthAmount)} · RDV: ${rendezvousDays}</small></div><div class="calendar-hint">Klikni dan da oznacis sate direktno iz kalendara. <span class="calendar-legend"><span class="legend-work">Rad</span> · <span class="legend-rendezvous">RDV / odsustvo</span></span></div><div class="calendar-weekdays"><span>Pon</span><span>Uto</span><span>Sri</span><span>Cet</span><span>Pet</span><span>Sub</span><span>Ned</span></div><div class="calendar-grid">${cells}</div>`;
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
	function ensureWorkerMonthSummaryPanel() {
		if (!isOwner()) { document.querySelector('#worker-month-summary')?.remove(); return null; }
		const existing = document.querySelector('#worker-month-summary');
		if (existing) return existing;
		const panel = document.querySelector('#time-form')?.closest('.panel') || document.querySelector('#tasks-view .panel');
		if (!panel) return null;
		const section = document.createElement('section');
		section.id = 'worker-month-summary';
		section.className = 'worker-month-summary';
		section.innerHTML = '<div class="section-head"><div><h3>Sažetak korisnika</h3><small id="worker-month-summary-label"></small></div></div><div id="worker-month-summary-content" aria-live="polite"></div>';
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
			target.innerHTML = `<small>${french ? 'Aucun utilisateur travailleur.' : 'Nema dodatih korisnika.'}</small>`;
			return;
		}
		const labels = french ? { worker: 'Utilisateur', workDays: 'Jours travaillés', hours: 'Heures', rendezvous: 'RDV / absences' } : { worker: 'Korisnik', workDays: 'Radni dani', hours: 'Sati', rendezvous: 'RDV / odsustva' };
		target.innerHTML = `<div class="worker-month-summary-table-wrap"><table class="worker-month-summary-table"><caption class="visually-hidden">${escapeHtml(`${french ? 'Résumé des utilisateurs pour' : 'Sažetak korisnika za'} ${formatMonthLabel(month)}`)}</caption><thead><tr><th scope="col">${labels.worker}</th><th scope="col">${labels.workDays}</th><th scope="col">${labels.hours}</th><th scope="col">${labels.rendezvous}</th></tr></thead><tbody>${workers.map((worker) => { const summary = summarizeWorkerMonth(worker.id, month); return `<tr><th scope="row">${escapeHtml(worker.name)}</th><td>${summary.workDays}</td><td>${summary.hours.toFixed(2)}</td><td>${summary.rendezvousDays}${summary.rendezvousCount > summary.rendezvousDays ? ` <small>(${summary.rendezvousCount} ${french ? 'termin.' : 'termina'})</small>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
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
		latestOwnTimeEntries = entries;
		ensureTimeAutoCalculation(selectedWorker);
		renderWorkCalendar(latestOwnTimeEntries, selectedDate, latestRendezvous);
		renderWorkerMonthSummary(selectedMonth);
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
	async function loadDocuments() { await loadProjectOptions(); const activeProject = currentProjectId(); const documents = (await request('/documents')).filter((item) => !activeProject || item.projectId === activeProject); const canManage = isOwner(); document.querySelector('#documents').innerHTML = documents.length ? documents.map((item) => `<div class="list-item"><strong>${item.originalName}</strong><small>${item.evidenceType || 'other'} · ${item.phase || 'general'} · ${Math.max(1, Math.round(item.size / 1024))} KB · ${item.projectId}</small>${canManage ? `<div class="document-actions"><button class="secondary rename-document" data-document="${item.id}">Preimenuj</button><button class="secondary copy-document" data-document="${item.id}">Kopiraj</button><button class="secondary delete-document" data-document="${item.id}">Obriši</button></div>` : ''}</div>`).join('') : '<small>Nema sačuvanih dokumenata.</small>'; document.querySelectorAll('.rename-document').forEach((button) => button.addEventListener('click', async () => { const item = documents.find((document) => document.id === button.dataset.document); const name = window.prompt('Novo ime dokumenta:', item?.originalName || ''); if (!name?.trim()) return; await request(`/documents/${button.dataset.document}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) }); await refreshActiveView(); toast('Dokument je preimenovan.'); })); document.querySelectorAll('.copy-document').forEach((button) => button.addEventListener('click', async () => { await request(`/documents/${button.dataset.document}/copy`, { method: 'POST' }); await refreshActiveView(); toast('Kopija dokumenta je dodata.'); })); document.querySelectorAll('.delete-document').forEach((button) => button.addEventListener('click', async () => { const item = documents.find((document) => document.id === button.dataset.document); if (!item || !window.confirm(`Obrisati dokument „${item.originalName}“?`)) return; await request(`/documents/${button.dataset.document}`, { method: 'DELETE' }); await refreshActiveView(); toast('Dokument je obrisan.'); })); }
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
		const loads = [loadDashboard(), loadEvidenceSummary(), loadRgeQualibat(), loadControlHistory(), loadBudget(), loadFinancialSummary(), loadSchedule(), loadUsers(), loadMessages(), loadTime(), loadPayroll(), loadDocuments(), loadPurchases(), loadProduction(), loadWorkSequence(), loadPayouts(), loadCompanyProfile()];
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
			'tasks-view': () => Promise.allSettled([loadMessages(), loadTime(), loadPayroll(), loadProduction(), loadPayouts()]),
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
			document.querySelector('#registration-success-message').textContent = data.delivery === 'password-set' ? `Nalog je kreiran za ${deliveryTarget}. Prijavite se passwordom koji ste izabrali.` : `Lozinka je poslata na ${deliveryTarget}. Kliknite dalje kada želite da unesete password.`;
			loginForm.elements.phone.value = deliveryTarget || '';
			if (loginForm.elements.role && data.role) loginForm.elements.role.value = data.role;
		} catch (error) { message.textContent = error.message || 'Inscription impossible.'; }
	});
		document.querySelector('#login-form').addEventListener('submit', async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const submitButton = event.currentTarget.querySelector('button[type="submit"]'); const errorTarget = document.querySelector('#login-error'); errorTarget.textContent = ''; submitButton.disabled = true; submitButton.setAttribute('aria-busy', 'true'); try { const result = await fetch(`${api}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(form.entries())) }); if (!result.ok) { const details = await result.json().catch(() => ({})); const error = new Error(details.error || 'Login failed'); error.status = result.status; throw error; } const data = await result.json(); localStorage.setItem('ibra-auth-token', data.token); currentUser = data.user; applyRole(currentUser.role); setupWorkerSelfProfile(); showView(document.querySelector('.view.active')?.id || 'dashboard-view'); loginModal.classList.add('hidden'); document.querySelector('#current-role').textContent = `${currentUser.name} - ${currentUser.role}`; await loadInitialData(); } catch (error) { errorTarget.textContent = error.status === 403 ? 'Izabrani profil ne odgovara ovom nalogu.' : 'Email/telefon ili password nisu tačni.'; } finally { submitButton.disabled = false; submitButton.removeAttribute('aria-busy'); } });
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
	document.querySelector('#message-form').addEventListener('submit', async (event) => { event.preventDefault(); const projectId = currentProjectId(); if (!projectId) { toast('Izaberite aktivni chantier pre slanja poruke.'); return; } try { await request('/messages', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ...Object.fromEntries(new FormData(event.currentTarget).entries()), projectId }) }); event.currentTarget.reset(); await refreshActiveView(); toast('Poruka je sačuvana.'); } catch { toast('Poruka nije poslata.'); } });
	document.querySelector('#time-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await saveTimeEntryFromForm(event.currentTarget); const prefs = loadTimePrefs(); event.currentTarget.reset(); event.currentTarget.elements.start.value = prefs.start || '08:00'; event.currentTarget.elements.end.value = prefs.end || '17:00'; event.currentTarget.elements.breakMinutes.value = prefs.breakMinutes || '60'; event.currentTarget.elements.rateType.value = prefs.rateType || 'daily'; event.currentTarget.elements.rate.value = prefs.rate || ''; await refreshActiveView(); toast('Radno vreme je sa?uvano.'); } catch { toast('Radno vreme nije sa?uvano.'); } });
	document.querySelector('#quick-worker-form')?.addEventListener('submit', async (event) => { event.preventDefault(); try { const values = formValues(event.currentTarget); values.email = values.contact; await request('/workers', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(values) }); event.currentTarget.reset(); await Promise.allSettled([loadUsers(), loadMessages(), loadPayroll(), loadTime()]); toast('Email poziv je poslat radniku da sam izabere password.'); } catch (error) { let message = 'Ouvrier nije dodat.'; try { const details = JSON.parse(error.message); if (details.error === 'Worker already exists') message = 'Ovaj radnik vec postoji.'; if (details.error?.includes('chantier')) message = 'Izaberi najmanje jedan chantier za radnika.'; if (details.error?.includes('Email delivery')) message = 'Email nije poslat: podesite SMTP/Brevo na Renderu.'; } catch {} toast(message); } });
	const userRoleField = document.querySelector('#user-role'); const updateUserRoleFields = () => { const role = userRoleField?.value; const siretField = document.querySelector('#siret-field'); const companyField = document.querySelector('#company-field'); const rateFields = document.querySelectorAll('.rate-field'); const projectField = document.querySelector('#user-project-field'); const projectSelect = document.querySelector('#user-project-field select'); if (siretField) { siretField.hidden = role !== 'gerant'; siretField.querySelector('input').required = role === 'gerant'; } if (companyField) { companyField.hidden = role !== 'gerant'; companyField.querySelector('input').required = role === 'gerant'; } rateFields.forEach((field) => { field.hidden = role !== 'user'; }); if (projectField) projectField.hidden = role !== 'user'; if (projectSelect) projectSelect.required = role === 'user'; }; userRoleField?.addEventListener('change', updateUserRoleFields); updateUserRoleFields(); wireSiretLookup(document.querySelector('#user-form')?.elements.siret, document.querySelector('#user-company-preview'), document.querySelector('#user-form')?.elements.company);
	const userFormAvatarInput = document.querySelector('#user-form-avatar-input');
	const userFormAvatarPreview = document.querySelector('#user-form-avatar-preview');
	userFormAvatarInput?.addEventListener('change', () => { const file = userFormAvatarInput.files[0]; if (!file || !userFormAvatarPreview) return; userFormAvatarPreview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="" />`; });
		document.querySelector('#user-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const created = await request('/users', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(formValues(event.currentTarget)) }); let avatarWarning = ''; const avatarFile = userFormAvatarInput?.files[0]; if (avatarFile && created.id) { const avatarBody = new FormData(); avatarBody.set('avatar', avatarFile); try { const avatarResponse = await fetch(`${api}/users/${encodeURIComponent(created.id)}/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: avatarBody }); if (!avatarResponse.ok) throw new Error(); } catch { avatarWarning = ' Fotografija nije sačuvana; probajte iz izmene profila.'; } } event.currentTarget.reset(); if (userFormAvatarPreview) userFormAvatarPreview.innerHTML = '?'; updateUserRoleFields(); await refreshActiveView(); const delivery = created.delivery === 'email' ? 'e-mail' : `lokalni link: ${created.setupUrl}`; toast(`Korisnik je dodat. Link za izbor passworda poslat preko ${delivery}.${avatarWarning}`); } catch (error) { let message = 'Korisnik nije dodat.'; try { const details = JSON.parse(error.message); if (details.error === 'User already exists') message = 'Ovaj e-mail već postoji.'; if (details.error?.includes('chantier')) message = 'Izaberi najmanje jedan chantier za radnika.'; if (details.error?.includes('Email delivery') || details.error?.includes('email')) message = 'Email nije poslat: podesite SMTP/Brevo na Renderu.'; if (details.error === 'Access denied') message = 'Samo gazda može dodavati korisnike.'; } catch {} toast(message); } });
	document.querySelector('#upload-form').addEventListener('submit', async (event) => { event.preventDefault(); const file = document.querySelector('#file-input').files[0]; if (!file) { toast('Sélectionnez un fichier avant l’enregistrement.'); return; } const body = new FormData(event.currentTarget); body.set('file', file, file.name); body.set('responseLanguage', language); try { const response = await fetch(`${api}/documents/upload`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || `${response.status}`); event.currentTarget.reset(); await refreshActiveView(); if (result.autoAnalysis) { showView('evidence-summary-view'); renderAutoAnalysis(document.querySelector('#ai-answer'), result.autoAnalysis); } toast(result.autoAnalysis ? 'Document enregistré et analysé automatiquement.' : 'Le document a été enregistré sur le serveur.'); } catch (error) { toast(`Document non enregistré : ${error.message || 'erreur inconnue'}`); } });
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
			if (message) message.textContent = language === 'fr' ? 'Impossible d’obtenir une réponse. Réessayez.' : 'Odgovor nije dobijen. Pokušajte ponovo.';
		}
	});
	document.querySelector('#budget-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const file = document.querySelector('#budget-file').files[0]; const form = event.currentTarget; const ensureProjectId = async () => { const select = form.querySelector('[name="projectId"]'); if (select.value !== '__new') return select.value; const chantierName = form.querySelector('[name="chantierName"]').value.trim() || form.querySelector('[name="client"]').value.trim() || 'Nouveau chantier'; const project = await request('/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name: chantierName, chantierName }) }); await loadProjectOptions(); select.value = project.id; return project.id; }; const sendBudget = async (replaceExisting = false) => { const projectId = await ensureProjectId(); const body = new FormData(form); body.set('projectId', projectId); if (file) body.set('file', file, file.name); if (replaceExisting) body.set('replaceExisting', 'true'); return fetch(`${api}/projects/${projectId}/budget`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); }; try { let response = await sendBudget(false); if (response.status === 409 && window.confirm('Un Devis existe deja pour ce chantier. Remplacer par le nouveau PDF ?')) response = await sendBudget(true); if (!response.ok) { const details = await response.text(); throw new Error(`${response.status}: ${details}`); } form.reset(); await refreshActiveView(); toast('Devis et chantier enregistres.'); } catch (error) { toast(`Devis non enregistre : ${error.message || 'erreur inconnue'}`); } });
	document.querySelector('#budget-file')?.addEventListener('change', async (event) => { const file = event.currentTarget.files[0]; if (!file) return; const body = new FormData(); body.append('file', file); const status = document.querySelector('#devis-extraction-status'); status.textContent = 'Čitanje PDF-a...'; try { const response = await fetch(`${api}/budget/inspect`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); if (!response.ok) throw new Error(); const result = await response.json(); const form = document.querySelector('#budget-form'); form.querySelector('[name="devisNumber"]').value = result.extracted.number; form.querySelector('[name="client"]').value = result.extracted.client; form.querySelector('[name="chantierName"]').value = result.extracted.chantier; form.querySelector('[name="total"]').value = result.extracted.total || ''; const projectSelect = form.querySelector('[name="projectId"]'); const chantierText = result.extracted.chantier.toLowerCase(); const matchingOption = [...projectSelect.options].find((option) => option.value !== '__new' && chantierText && option.textContent.toLowerCase().includes(chantierText)); projectSelect.value = matchingOption ? matchingOption.value : '__new'; status.textContent = result.needsConfirmation ? 'PDF je pročitan delimično. Proveri označena polja pre čuvanja.' : `Automatski pročitano iz: ${result.source}`; } catch { status.textContent = 'PDF nije moguće automatski pročitati. Unesi vrednosti ručno.'; } });
	document.querySelector('#budget-form [name="projectId"]')?.addEventListener('change', loadBudget);
		document.querySelector('#purchase-form')?.addEventListener('submit', async (event) => { event.preventDefault(); const file = document.querySelector('#invoice-file').files[0]; const body = new FormData(event.currentTarget); if (!file) { toast('Dodaj PDF račun ili opravdanje.'); return; } body.append('invoice', file); try { const response = await fetch(`${api}/purchases`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); if (!response.ok) throw new Error(); event.currentTarget.reset(); await refreshActiveView(); toast('Trošak i PDF faktura su sačuvani; Devis je automatski ažuriran.'); } catch { toast('Trošak nije sačuvan.'); } });
	document.querySelector('#invoice-file')?.addEventListener('change', async (event) => { const file = event.currentTarget.files[0]; if (!file) return; const body = new FormData(); body.append('file', file); const status = document.querySelector('#purchase-extraction-status'); status.textContent = 'Čitanje PDF fakture...'; try { const response = await fetch(`${api}/pdf/inspect`, { method:'POST', headers:{Authorization:`Bearer ${token()}`}, body }); if (!response.ok) throw new Error(); const result = await response.json(); const form = document.querySelector('#purchase-form'); form.querySelector('[name="supplier"]').value = result.extracted.supplier; form.querySelector('[name="amount"]').value = result.extracted.amount || ''; form.querySelector('[name="purchaseDate"]').value = result.extracted.date || ''; status.textContent = result.needsOcr ? 'PDF je skeniran. Potrebna je ručna provera/OCR.' : `Automatski pročitano iz: ${result.source}`; } catch { status.textContent = 'PDF nije moguće automatski pročitati. Unesi vrednosti ručno.'; } });
	restoreSession();
});
