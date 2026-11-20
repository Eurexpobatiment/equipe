# ⚡ Départs électriques – Eurexpo

Appli pour retrouver l'alimentation des armoires et des départs électriques en cas de disjonction :
recherche, chemin d'alimentation depuis le TGBT, plan des armoires (sous-sol, RDC, niveaux 1 à 3, plan de masse)
et arborescence complète. Le service Bâtiment peut ajouter, modifier, déplacer ou supprimer TGBT, armoires et départs,
et placer les armoires sur le plan.

Adresse : https://eurexpobatiment.github.io/equipe/elec/

## Qui voit quoi
- **Prestataires (Dalkia…)** : consultation avec le **code d'accès**, saisi une seule fois par appareil.
- **Service Bâtiment** : connexion avec le compte de l'appli Équipe (même adresse et même mot de passe). Il peut tout modifier.
  Chaque modification est notée dans l'historique (onglet Contrôle).

Les données ne sont **pas** dans ce dépôt public : elles sont dans Firebase (projet `equipe-batiment`) et ne se lisent
qu'avec le code d'accès ou un compte Équipe. Le dossier ne contient que la page et les fonds de plan du parc.

## Données (Firebase)
- `ElecArbre/{zone}` : une zone de la nomenclature (Accueil, Hall 1, TGBT 213…), arbre complet en JSON
- `ElecDivers/orphelins` : armoires du plan AutoCAD ou de la table de correspondance pas encore rattachées à la nomenclature
- `ElecDivers/postes` : postes HT et transfos (tableau 2018 de la nomenclature)
- `ElecHisto` : historique des modifications
- `ElecSessions/{appareil}` : appareils qui ont donné le code d'accès
- `ElecSecret/code` : le code d'accès (champ `code`), modifiable dans la console seulement

## Mise en route (une seule fois)
1. **Règles Firebase** : console Firebase › projet *equipe-batiment* › Firestore Database › Règles. Coller le contenu de
   `firestore-elec.rules` juste avant les deux dernières accolades `}` de la fin, puis **Publier**.
2. **Code d'accès** : Firestore Database › Données › **Démarrer une collection** `ElecSecret`, document `code`,
   champ `code` (chaîne) = le code à donner à Dalkia.
3. Ouvrir l'appli, onglet **Service Bâtiment**, se connecter avec son compte Équipe.
4. Onglet **Contrôle › Sauvegarde › Importer un fichier de données…** et choisir le fichier
   `departs-electriques-donnees-initiales.json` (dans le dossier Électricité du Drive, **pas** dans ce dépôt).
5. Donner à Dalkia l'adresse de l'appli et le code d'accès.

Changer le code dans `ElecSecret/code` bloque aussitôt les appareils qui avaient l'ancien : ils devront saisir le nouveau.

## Sauvegarde
Onglet Contrôle : **Exporter une sauvegarde (JSON)** (à réimporter si besoin) et **Exporter la nomenclature (CSV / Excel)**.

## Origine des données (21 nov. 2026)
- `NOMENCLATURE des TGBT.xlsx` et `Correspondance nom des armoires.xlsx` (CFO › 0- Plan elec global)
- `Plan electricité eurexpo.dwg` : position et étiquettes des armoires
- Plans SEPEL du parc (Plans du parc) : fonds de plan et calage exact des armoires
