# Fonction Firebase « veille-surete »

Sert la tâche planifiée « Veille sûreté » (mardi et jeudi matin) de l'appli Équipe, et rien d'autre.
Remplace l'export public `veille.json` : les dates internes des salons ne sont plus publiées sur Internet.

- Région : europe-west9 (Paris) · URL : https://europe-west9-equipe-batiment.cloudfunctions.net/veille-surete
- **GET** : salons J-7 → J+60 (nom, halls, début de montage, fin de démontage, états des lieux), zones de travaux
  (sans entreprise ni montant) et titres des bulletins déjà en cours.
- **POST** `{"bulletins":[{titre, niveau, salon, lieu, source, texte, debut, jusquau}]}` : 10 bulletins au plus par appel,
  déposés dans l'onglet 🛡️ Veille sûreté (collection Memos, type « Veille sûreté »), signés « Veille automatique ».
  Un bulletin déjà en cours (même titre, même salon) est ignoré. Validité : 7 jours par défaut, 90 au plus.
- Ne renvoie jamais : noms de personnes, e-mails, notes, tâches, budget, clefs, documents.
- Accès : en-tête `Authorization: Bearer <code>`. La fonction ne connaît que l'empreinte SHA-256 du code
  (variable `VEILLE_HASH`), le code lui-même n'est que dans la consigne de la tâche planifiée.

Mettre à jour le code (Cloud Shell) :
```
rm -rf ~/equipe && git clone -q --depth 1 https://github.com/Eurexpobatiment/equipe ~/equipe && cd ~/equipe/functions/veille-surete && gcloud functions deploy veille-surete --gen2 --region=europe-west9 --runtime=nodejs22 --source=. --entry-point=veille --trigger-http --allow-unauthenticated --memory=256Mi --max-instances=1 --timeout=60s --update-env-vars=VEILLE_HASH=05dde0d29b0ba82eca9b3c3935ebe79f9c7abcadc23e4ba9c318f3848616e67c
```

Changer le code d'accès : demander à Claude un nouveau code ; il met à jour la tâche planifiée et donne la commande
`gcloud run services update veille-surete --region=europe-west9 --update-env-vars=VEILLE_HASH=<nouvelle empreinte>`.

Couper la veille automatique : désactiver la tâche planifiée, ou
`gcloud run services update veille-surete --region=europe-west9 --update-env-vars=VEILLE_HASH=coupe` (plus aucun code n'est accepté).
