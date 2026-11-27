# Appli Équipe – version Firebase

Même appli que la version actuelle, avec les données dans **Firebase** au lieu du Google Sheet :
connexion par e-mail et mot de passe, mises à jour en direct, consultation et saisie hors connexion.

Adresse : https://eurexpobatiment.github.io/equipe/ (en service depuis le 6 nov. 2026 ; /v2/ redirige ici)
L'ancienne version (Google Sheet) est en lecture seule depuis la bascule : le Sheet reste comme archive.

## Mise en route
1. Console Firebase : projet créé, **Firestore** (europe-west9, mode production) et **Authentication › E-mail/Mot de passe** activés.
2. **Règles** : copier `firestore.rules` dans Firestore Database › Règles, remplacer `VOTRE_EMAIL` par l'adresse du propriétaire, puis **Publier**.
   **Storage › Règles** : copier `storage.rules` puis **Publier** (fichier commun avec l'appli travaux : pièces jointes des demandes + devis des benchmarks).
3. **Authentication › Paramètres › Domaines autorisés** : ajouter `eurexpobatiment.github.io`.
4. Dans `index.html`, coller le bloc `firebaseConfig` dans `CONFIG.firebase`.
5. **Code.gs** (mails d'attribution) : renseigner `FIREBASE_PROJECT` avec le projectId, puis Déployer › Gérer les déploiements › Nouvelle version.
6. Ouvrir la v2 avec l'adresse du propriétaire : « Première connexion », vérifier l'adresse par le lien reçu, se connecter, puis « Reprendre les données ». Toutes les données du Sheet sont copiées (le Sheet n'est pas modifié).

## Fonctionnement
- **Connexion** : chacun se connecte avec l'adresse e-mail saisie à côté de son nom dans 👥 Équipe. Sans adresse, pas d'accès. Première fois : « Première connexion », puis lien de vérification reçu par mail.
- **Équipe** : seuls les **Responsables** (et le propriétaire) ajoutent, retirent ou modifient les membres et leurs adresses.
- **Tâches perso** : vraiment privées. Firebase ne les envoie qu'à leur auteur connecté.
- **Nacelle** : le chevauchement est contrôlé sur les données du serveur au moment de la réservation (connexion internet nécessaire pour réserver).
- **Hors connexion** : l'appli montre la dernière version gardée et enregistre les saisies, envoyées dès le retour du réseau.
- **Mails d'attribution** : envoyés par le script Google (action `notify`), qui vérifie la connexion de la personne et relit la tâche dans Firebase.
- **Agenda GL events** : toujours lu par le script Google.
- **Journal** : collection Journal de Firestore, lisible par les responsables.
- **⚖️ Benchmark devis** (groupe Gestion) : un benchmark par consultation, visible par son créateur et les membres avec qui il le partage (mêmes droits que le suivi de projets, collections `Benchmarks` / `BenchOffres`). On y glisse les devis (PDF texte, Excel, CSV) : entreprise, n°, date, total HT, délai, validité et lignes chiffrées sont lus dans la page, à vérifier dans chaque offre. Les fichiers sont gardés dans Firebase Storage (`benchmarks/{id}/{fichier}`). Comparaison : écart au moins-disant et au budget, notation pondérée (prix noté automatiquement : 10 × moins-disant ÷ montant, autres critères notés sur 10), comparatif poste par poste, offre retenue ★, export Excel. Un PDF scanné (image) ne se lit pas : le fichier est gardé, le montant se saisit à la main. Le bouton **📊 Présentation PowerPoint** d'un benchmark télécharge une présentation à la trame des rapports (charte GL events Lyon : page de garde, synthèse et chiffres clés, comparatif des offres, comparatif par famille de travaux, origine des écarts, options et variantes, conclusion) ; la photo et le logo de la page de garde sont ceux de la charte des rapports de l'appli Consommations (ConsoServeur/charte).

## 🎪 Planning EBMS (Planning global › « Planning EBMS »)
Le planning des réservations d'EBMS, dans l'appli : une ligne par espace, regroupées par hall (accueils et entrées, hall 1 à 7, locaux annexes), une couleur par salon (`EB_PAL`), et sous chaque barre un ruban des phases : montage (ambre), exploitation (vert), démontage (gris), jours réservés hors phase (hachures, code C d'EBMS). Teinte claire = case blanche dans EBMS. En haut, les salons en cours et les prochains.

- **Import** : dans EBMS, exporter le « Planning réservations » en Excel (un fichier par trimestre), puis « ⬆️ Importer un export EBMS » (plusieurs fichiers à la fois possibles). Le fichier est lu dans la page (fonction `ebLire`) ; il n'est pas gardé.
- **Mise à jour** : réimporter le trimestre concerné. Sur les jours communs, l'import le plus récent l'emporte. « n périodes importées » (sous le planning) liste les périodes et permet d'en retirer une.
- **Lecture** : zoom 2 semaines → 6 mois, « Aller au mois », filtre par hall, recherche d'un salon (les autres réservations s'estompent), jours fériés (rouge) et vacances scolaires (soulignés, couleurs de l'export), hachures sur une barre = plusieurs réservations le même jour sur l'espace (EBMS ne nomme que la première). La pastille d'une barre et la case « Couleurs EBMS » redonnent la couleur de la réservation dans EBMS. Une barre ou une carte ouvre le détail : dates de chaque phase, espace par espace.
- **Espaces extérieurs** (parkings, cours, exposition extérieure, piste 4x4) : laissés de côté à l'import (`EB_HORS`).
- **Données** : un document par période dans la collection `Documents` (`ebms-AAAAMMJJ-AAAAMMJJ`, `kind: 'index'`, `ebms: 'oui'`) : mêmes règles que les fiches, **rien à publier**. Visible par les membres de l'équipe seulement ; rien n'est mis dans le dépôt GitHub, qui est public.
- **Fichiers** : bloc « PLANNING EBMS » de `index.html`, fonctions `saveEbms` / `delEbms` de `fb.js`.

## 🚦 Dashboard : tableau de bord des alertes (onglet « Dashboard », tout en haut du menu)
Résumé de ce qui demande une décision, classé Critique / À surveiller / Info, par domaine : Énergie, Eau, Budget, Sûreté, Exploitation.

- **Qui le voit** : les personnes cochées dans ⚙️ Réglages (bouton réservé aux responsables). Tant que personne n'est coché : les responsables. Les autres membres n'ont pas l'onglet dans leur menu. La pastille de l'onglet compte les alertes critiques. C'est un affichage : les données elles-mêmes restent visibles dans leurs onglets, comme avant.
- **Énergie** : salon terminé au-dessus de la prévision ou de l'édition précédente (CVC + gaz, calculs de `conso/metier.js`), index de fin de salon incomplets ou négatifs, PV hall 4.3 sans production (FusionSolar), points de température hors de la plage de confort de l'appli Températures (dernier relevé des 48 h), relevés de compteurs élec / gaz / fioul signalés ou manquants.
- **Eau** : alertes de la synthèse Eau de l'appli Relevés compteurs (`compteurs/metier.js` : fuite possible, hausse, eau non comptabilisée), relevés d'eau signalés.
- **Budget** : lignes et enveloppes BA24 / BA25 hors budget ou presque épuisées, reste à engager avant la fin d'exercice, projets du suivi financier (les siens et ceux partagés) au-dessus de leur budget.
- **Sûreté** : points de vigilance et bulletins de veille en cours de niveau Critique ou Important, et ceux que toute l'équipe n'a pas encore lus.
- **Exploitation** : tickets pas pris en charge, demandes de travaux sans suite ou à date impérative proche, tâches d'équipe en retard, chantiers pas clôturés, pavoisements avec drapeaux manquants.
- **Seuils** : réglables dans ⚙️ Réglages (valeurs par défaut dans `alertes.js`, liste `SEUILS`). « Masquer » retire une alerte pendant 7 jours, sur l'appareil seulement.
- **Lectures Firebase** : budget, mémos, tâches, chantiers et drapeaux sont déjà dans l'appli (aucune lecture en plus). Conso, compteurs, températures, tickets et demandes sont lus une fois à l'ouverture de l'appli (pour les personnes qui ont l'onglet), puis gardés sur l'appareil 30 min (réglable) ; « ↻ Actualiser » force la relecture. Pas d'écoute en direct.
- **Fichiers** : `alertes.js` (calculs, sans écran), bloc « TABLEAU DE BORD DES ALERTES » de `index.html`, fonctions `alReglages` / `alSaveReglages` / `alLire` de `fb.js`.
- **Mise en service** : publier le bloc « Alertes » de `firestore.rules` (Firestore › Règles). Sans lui, le tableau de bord s'affiche pour les responsables avec les seuils par défaut, et les réglages ne s'enregistrent pas.

## 🎫 Ticketing (dossier `tickets/`, onglet « Ticketing » du groupe Au quotidien)
Signalement des problèmes aux entreprises pendant les salons, séparé des états des lieux BatiScript.
Adresse directe : https://eurexpobatiment.github.io/equipe/tickets/

- **Qui crée** : l'équipe Bâtiment (compte de l'appli Équipe) et les autres services (adresse @gl-events.com, même compte que les demandes de travaux). Tous voient tous les tickets.
- **Ticket** : problème, photos (réduites à ≈ 300 Ko sur le téléphone), priorité, hall, emplacement, pastille sur le plan de masse, entreprise et métier, salon. Numéro `TK-AAAA-NNNN`.
- **Alerte** : le bouton « Envoyer sur WhatsApp » ouvre WhatsApp avec le message prêt (métier – entreprise, lieu, description, lien du ticket) ; on choisit le groupe du salon et on envoie. « Partager avec la photo… » joint la première photo (téléphone). Rien n'est envoyé automatiquement : pas de fonction Firebase, pas de compte Meta.
- **Entreprise** : le lien du message ouvre le ticket sans compte (plan, photos) avec « Je prends en charge » et « Problème résolu » (commentaire et photo de fin). La clé du lien (32 caractères au hasard) sert de secret : qui a le lien voit ce ticket, et lui seul.
- **Mes interventions** (page de l'entreprise) : chaque entreprise de la liste ⚙️ Entreprises a un lien personnel (`tickets/?e=clé`) qui ouvre, sans compte, tous ses tickets et eux seuls : à prendre en charge, en cours, terminés, filtre par salon. Dans ⚙️ Entreprises : « Copier le lien », « Envoyer à … » (WhatsApp direct vers un contact), « Nouveau lien » (coupe l'ancien). À envoyer directement à l'entreprise, pas dans le groupe du salon : qui a le lien voit tous les tickets de cette entreprise. Un ticket est rattaché quand son entreprise est choisie dans la liste (même nom) ; fiche `TicketsEnt/{clé}` = nom, métier, clés des tickets.
- **Suivi** : tickets ouverts en direct, délais d'attente (en rouge après 30 min, 10 min si urgent : `attenteMin` / `attenteUrgentMin` dans `tickets/index.html`), filtres salon et entreprise, 200 derniers tickets dans « Terminés » / « Tous ».
- **⚙️ Entreprises** (Bâtiment) : liste des entreprises et de leur métier proposée à la saisie.
- **Plan** : `tickets/plan.webp` (détail) et `tickets/plan-s.webp` (vue d'ensemble), tirés du PDF « BatiScript plan de masse » (A0). Pour le remplacer : mêmes noms, même proportion (4400 × 3113), sinon ajuster `planRatio`.
- **Données** : collections `Tickets`, `TicketsCfg` et `TicketsEnt` (Firestore), photos dans `tickets/{clé}/{photo}` (Storage).
- **Mise en service** : publier les blocs « Ticketing » de `firestore.rules` (Firestore › Règles) et de `storage.rules` (Storage › Règles). Sans eux, l'onglet affiche « Accès refusé ».

## 🗺️ Plan des clefs (dossier `clefs-plan/`, sous-onglet « Plan » de l'onglet Clefs)
Plans tirés d'AutoCAD, avec les cylindres posés à la main : sous-sol, RDC, niveaux 1 et 2 (sélecteur en haut du plan). RDC : « SEPEL-Plan tech.de base-Plan de masse » (calques MUR) ; sous-sol et niveaux : « SEPEL-Plan tech. de base-Sous-sol / Niveau 1 / Niveau 2 » (calques Mur et noms des locaux), calés sur le RDC (mêmes coordonnées d'un niveau à l'autre).
- **Données du plan** (dans la page) : 746 cylindres du plan de fermeture NHKN (`EUREXPO_NHKN 2026.xlsx`) avec leurs clefs de groupe (PPG, PP-1…), espaces/accès de l'onglet « Inventaire HF2021 » du classeur clefs, 201 n° hors NHKN, noms des locaux et des halls du DWG.
- **Cylindres posés** : partagés par toute l'équipe, rangés dans la collection `Clefs` (documents `plan_xxx`, `kind: 'plan'`, numero, x, y, niveau, majPar) : mêmes règles que l'inventaire, rien à publier. Ils sont écartés de l'inventaire à la lecture (`D.ClefsPlan`).
- **Lien avec l'inventaire** : sur le plan, chaque cylindre montre la fiche de l'inventaire de l'appli (au tableau, en prêt, dispo, chez qui) avec « Ouvrir la fiche », « Ajouter à l'inventaire » et « Remettre cette clef… » ; dans l'inventaire, colonne « Plan » (📍 posé / ＋ à poser) et bouton dans la fiche.
- **Reprise** : « Importer » sur le plan reprend un fichier exporté depuis la version hors appli (`plan-cles.html` du Drive).
- **Mise à jour du fond** (nouveau DWG) : régénérer `clefs-plan/index.html` à partir d'une copie DXF du plan (même calage).

## Salons de l'appli Consommations d'après le Planning EBMS (28 nov. 2026)
Après chaque import d'un export EBMS, l'appli propose
les salons à créer dans l'appli Consommations et les changements de dates ; rien n'est écrit sans validation.
- Règles (`ebms-salons.js`, même fichier dans le dépôt `conso`, garder les deux copies identiques) : réservations bleu foncé
  et bleues (002060, 0070C0) qui ont de l'exploitation, hors « stockage » ; dates et halls d'exploitation ; salons pas encore finis.
- Un salon créé garde dans ses notes « Créé depuis le planning EBMS : <titre EBMS> » : c'est son lien avec la réservation.
- Réservé à l'appareil qui a donné le code des réglages dans l'appli Consommations (règles Firestore inchangées).
- Une proposition décochée est reproposée aux imports suivants, décochée d'office (gardé sur l'appareil).
