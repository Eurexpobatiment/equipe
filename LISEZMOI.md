# Appli Équipe – Eurexpo

Tâches de l'équipe, planning de la nacelle, présence des régisseurs, mouvements de cloisons et états des lieux des salons.
Les données sont dans un Google Sheet, et la page est hébergée sur GitHub Pages, comme tes autres applis.

## 1. Le Google Sheet + Apps Script
1. Crée un Google Sheet vide, par exemple « Appli Équipe – Eurexpo ».
2. Va dans **Extensions › Apps Script**, efface le contenu et colle **Code.gs**. Enregistre.
3. Choisis la fonction **installer** puis clique sur **Exécuter**, et accepte les autorisations.
   Les onglets se créent : Equipe, Taches, Commentaires, Nacelle, Regisseurs, Cloisons, EDL, Journal.
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
- **Connexion** : à la première ouverture, chacun choisit son nom (ou l'ajoute). Le nom est mémorisé sur son téléphone, et le bouton 👤 permet d'en changer.
- **Équipe** (onglet 👥) : ajouter ou retirer des membres et donner les rôles. Seules les personnes qui ont le rôle **Régisseur** apparaissent dans le planning de présence. Le bouton 👤 en haut sert à changer d'utilisateur.
- **Tâches** : trois colonnes, À faire, En cours et Terminé. Le bouton « → En cours » attribue la tâche à celui qui la prend si personne ne l'avait. Chaque tâche a un fil d'échanges.
- **Nacelle** : réservation par plage horaire libre, sur une ou plusieurs journées. Si le créneau en chevauche un autre, l'appli refuse et indique qui a déjà réservé. Le contrôle est fait aussi côté serveur, donc deux personnes ne peuvent pas réserver le même créneau en même temps.
- **Régisseurs** : un tableau sur 2 semaines. Touche une case pour saisir une période (Présent, Salon, Astreinte, Formation, Repos, Congé, Absent). La dernière ligne compte les présents de chaque jour.
- **Cloisons / États des lieux** : un agenda par date. Touche le badge de statut pour passer de Prévu ou Planifié à Fait.
- **Travaux** : les demandes de l'appli « Demandes de travaux » (https://eurexpobatiment.github.io/travaux/), avec le code Bâtiment de cette appli. On y change le statut, la priorité, la personne en charge et la date prévue, et on peut créer une tâche d'équipe à partir d'une demande. Les réponses au demandeur et les notes internes se font dans la fiche complète de l'appli travaux.
- **Budget** : budget bâtiment 2026 repris du classeur BUDGET 2026 (onglets Entretien BA24, Contrats BA25, Travaux prévus, N° SAP). On saisit chaque BDC, facture ou avoir sur sa ligne ; engagé, restant, % et « hors budget » se calculent seuls. Export Excel complet en un clic. Les données sont dans les onglets BudgetLignes, BudgetMvts, Inventaire et SAP du Google Sheet.
- L'appli se rafraîchit toute seule toutes les 60 s et dès qu'on revient dessus.
- L'onglet **Journal** du Sheet garde la trace de qui a ajouté, modifié ou supprimé quoi.

⚠️ L'accès se fait sans mot de passe : toute personne qui a le lien peut consulter et modifier. Garde le lien dans l'équipe. Le Journal permet de retrouver qui a fait une modification.
