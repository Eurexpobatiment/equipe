# Appli Équipe – version Firebase (v2)

Même appli que la version actuelle, avec les données dans **Firebase** au lieu du Google Sheet :
connexion par e-mail et mot de passe, mises à jour en direct, consultation et saisie hors connexion.

Adresse de test : https://eurexpobatiment.github.io/equipe/v2/
Tant que `CONFIG.firebase` est vide dans `v2/index.html`, cette page fonctionne exactement comme l'appli actuelle (Google Sheet).

## Mise en route
1. Console Firebase : projet créé, **Firestore** (europe-west9, mode production) et **Authentication › E-mail/Mot de passe** activés.
2. **Règles** : copier `firestore.rules` dans Firestore Database › Règles, remplacer `VOTRE_EMAIL` par l'adresse du propriétaire, puis **Publier**.
3. **Authentication › Paramètres › Domaines autorisés** : ajouter `eurexpobatiment.github.io`.
4. Dans `v2/index.html`, coller le bloc `firebaseConfig` dans `CONFIG.firebase`.
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
