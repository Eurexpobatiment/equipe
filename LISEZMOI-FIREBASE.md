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
