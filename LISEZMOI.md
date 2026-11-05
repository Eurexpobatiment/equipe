# Appli Équipe – Eurexpo

Tâches de l'équipe, planning de la nacelle, régie évènementielle (présence des régisseurs, cloisons et tribune, états des lieux), inventaire des drapeaux et pavoisements.
Les données sont dans un Google Sheet, et la page est hébergée sur GitHub Pages, comme tes autres applis.

## 1. Le Google Sheet + Apps Script
1. Crée un Google Sheet vide, par exemple « Appli Équipe – Eurexpo ».
2. Va dans **Extensions › Apps Script**, efface le contenu et colle **Code.gs**. Enregistre.
3. Choisis la fonction **installer** puis clique sur **Exécuter**, et accepte les autorisations.
   Les onglets se créent : Equipe, Taches, Commentaires, Nacelle, Regisseurs, Cloisons, EDL, Drapeaux, Pavoisements, Memos, Journal.
4. Va dans **Déployer › Nouveau déploiement › Application Web** :
   - Exécuter en tant que : **moi**
   - Qui a accès : **Tout le monde**
5. Copie l'URL qui se termine par **/exec**.

> Si tu modifies Code.gs plus tard, va dans **Déployer › Gérer les déploiements › ✏️ › Version : Nouvelle version**. Sinon, l'URL continue d'utiliser l'ancien code.

## 2. La page
1. Dans **index.html**, tout en haut du script, colle l'URL dans `CONFIG.apiUrl: '...'`.
   Tant que l'URL n'est pas renseignée, l'appli tourne en **mode démo** avec des données fictives.
2. Adapte si besoin `CONFIG.halls` : ce sont les suggestions des champs Hall/lieu, mais on peut toujours taper autre chose.

## 3. GitHub Pages
1. Le dépôt **equipe** du compte **Eurexpobatiment** contient `index.html`, `logo.png`, `manifest.webmanifest` et `icons/`. `Code.gs` y est aussi, pour référence : il ne sert que dans Apps Script.
2. Va dans **Settings › Pages › Branch : main / (root)** et clique sur Save.
3. L'appli sera à l'adresse **https://eurexpobatiment.github.io/equipe/**. Envoie ce lien à l'équipe sur WhatsApp. Sur téléphone, « Ajouter à l'écran d'accueil » la fait apparaître comme une appli.

## Fonctionnement
- **Mémo vigilance** (premier onglet) : deux parties. Les **points de vigilance** (Info, Important, Critique), à épingler en haut, avec un lieu et une date « valable jusqu'au » (après cette date ils passent dans « Archivés / expirés »). Les **comptes rendus de réunions** (date, participants, compte rendu, décisions / actions), avec un bouton « + Créer une tâche » pour chaque action. Chacun touche « ✓ J'ai lu » : on voit qui a lu et qui ne l'a pas encore fait, et l'onglet affiche le nombre de mémos que tu n'as pas encore lus. Si quelqu'un modifie le contenu, les autres doivent relire. Données dans l'onglet Memos du Google Sheet.
- **Connexion** : à la première ouverture, chacun choisit son nom (ou l'ajoute). Le nom est mémorisé sur son téléphone, et le bouton 👤 permet d'en changer.
- **Équipe** (onglet 👥) : ajouter ou retirer des membres et donner les rôles. Seules les personnes qui ont le rôle **Régisseur** apparaissent dans le planning de présence. Le bouton 👤 en haut sert à changer d'utilisateur.
- **Tâches** : trois colonnes, À faire, En cours et Terminé. Une tâche peut être attribuée à plusieurs personnes (cases à cocher) : elle apparaît dans « Moi » de chacune. Sur une tâche à plusieurs, chacun touche « ✓ Ma part faite » quand il a fini (son nom passe en vert, avec « 1/3 parts faites ») ; la tâche passe seule en « Terminé » quand tout le monde a coché. On peut aussi la clôturer d'office avec le statut de la fiche. Le compteur de chacun ne compte plus les tâches où il a fini sa part. Le bouton « → En cours » attribue la tâche à celui qui la prend si personne ne l'avait. Chaque tâche a un fil d'échanges. En haut de l'onglet, **🔒 Mes tâches perso** : des tâches à soi, que personne d'autre ne voit dans l'appli (elles n'apparaissent pas dans les tâches de l'équipe ; le serveur ne les envoie qu'à leur auteur). Attention, sans mot de passe ce n'est pas un coffre-fort : quelqu'un qui choisit ton nom avec le bouton 👤 les verrait, et elles sont lisibles dans l'onglet Taches du Google Sheet (colonne prive = oui).
- **Nacelle** : réservation par plage horaire libre, sur une ou plusieurs journées. Si le créneau en chevauche un autre, l'appli refuse et indique qui a déjà réservé. Le contrôle est fait aussi côté serveur, donc deux personnes ne peuvent pas réserver le même créneau en même temps.
- **Régie évènementielle** : un seul onglet avec quatre sous-onglets : Régisseurs, Cloisons & tribune, États des lieux et Drapeaux.
- **Régisseurs** : un tableau sur 2 semaines. Touche une case pour saisir une période (Présent, Salon, Astreinte, Formation, Repos, Congé, Absent). La dernière ligne compte les présents de chaque jour.
- **Cloisons & tribune / États des lieux** : un agenda par date. Touche le badge de statut pour passer de Prévu ou Planifié à Fait. Les mouvements de la tribune dépliable (À sortir, À rentrer) sont dans le même agenda (filtre Tout / Cloisons / Tribune) ; l'encadré du haut indique si la tribune est sortie ou rentrée (d'après le dernier mouvement marqué Fait), où, et son prochain mouvement, et signale les mouvements passés non marqués Fait. Dans le Google Sheet, c'est l'onglet Cloisons, colonne objet = Tribune.
- **Drapeaux** : le stock par drapeau et par format (200 x 300, 100 x 150, 140 x 220), avec neufs, occasions et usés, repris en un clic de l'inventaire d'octobre 2026. Chaque case affiche les disponibles / le stock, à la date choisie. Les **pavoisements** (salon, emplacement, pose, dépose, liste des drapeaux) sortent les drapeaux du stock de la pose à la dépose, et tant que la dépose n'est pas marquée faite (statuts Prévu → Posé → Déposé). Si un pavoisement demande plus que ce qui est disponible sur sa période, l'appli le signale (⚠️ manque) et demande une confirmation. Boutons « 1 de chaque » par groupe (Europe, Monde, Partenaires), copie de la liste pour WhatsApp, export Excel. Données dans les onglets Drapeaux et Pavoisements du Google Sheet.
- **Demandes** : les demandes de l'appli « Demandes de travaux » (https://eurexpobatiment.github.io/travaux/), avec le code Bâtiment de cette appli : statut, priorité, personne en charge, date prévue, création d'une tâche ou d'un chantier à partir d'une demande. Les réponses au demandeur et les notes internes se font dans la fiche complète de l'appli travaux.
- **Travaux** : qui est où à Eurexpo (vue « Qui est où » : entreprises présentes un jour donné, par espace, avec salons et nacelle), le planning des chantiers (Gantt par semaines, regroupé par espace, type, responsable ou entreprise, avec les salons d'après les états des lieux) et la liste des chantiers (espace, zone, type de travaux, entreprise, responsable, dates, horaires, statut, avancement, montant, ligne budgétaire, contraintes). Un chantier peut concerner plusieurs espaces (Hall 1, Hall 2.1 AB, Hall 2.1 Ext, Hall 2.2, Hall 2.3, Hall 3.1, Hall 3.2, Hall 4.1, Hall 4.2, Hall 4.3, Hall 5.1, Hall 5.2, Hall 6.1, Hall 6.2, Hall 6.3, Hall 7, plus bureaux, parvis, parkings, voiries, toitures, locaux techniques, sous-sol ; liste dans CONFIG.halls et CONFIG.autresEspaces). Les chantiers qui se chevauchent sur un même espace sont signalés ⚠️. Depuis un chantier : réserver la nacelle ou créer une tâche. Export Excel.
- **Budget** : budget bâtiment 2026 repris du classeur BUDGET 2026 (onglets Entretien BA24, Contrats BA25, Travaux prévus, N° SAP). On saisit chaque BDC, facture ou avoir sur sa ligne ; engagé, restant, % et « hors budget » se calculent seuls. Export Excel complet en un clic. Les données sont dans les onglets BudgetLignes, BudgetMvts, Inventaire et SAP du Google Sheet.
- **Notifications par e-mail** : dans l'onglet 👥 Équipe, renseigne l'adresse e-mail de chacun. Dès qu'une tâche est attribuée à quelqu'un (création ou ajout d'une personne), il reçoit un mail avec le détail et un bouton « Ouvrir la tâche » qui ouvre directement sa fiche dans l'appli. Pas de mail quand on se l'attribue soi-même, pour les tâches perso, ni pour les tâches déjà terminées. Les mails partent du compte Google qui a déployé le script (quota Gmail : 100 mails par jour). Chaque envoi est noté dans le Journal. Pour activer : après avoir collé le nouveau Code.gs, exécute une fois la fonction **testerMail** dans l'éditeur Apps Script (accepte l'autorisation d'envoyer des e-mails ; tu reçois un mail d'essai), puis publie une nouvelle version du déploiement.
- L'appli se rafraîchit toute seule toutes les 60 s et dès qu'on revient dessus.
- L'onglet **Journal** du Sheet garde la trace de qui a ajouté, modifié ou supprimé quoi.

⚠️ L'accès se fait sans mot de passe : toute personne qui a le lien peut consulter et modifier. Garde le lien dans l'équipe. Le Journal permet de retrouver qui a fait une modification.
