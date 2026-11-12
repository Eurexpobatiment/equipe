/**
 * Appli Équipe – Eurexpo · API (Google Apps Script lié au Google Sheet)
 *
 * Onglets créés automatiquement : Equipe, Taches, Commentaires, Nacelle,
 * Regisseurs, Cloisons (cloisons + tribune), EDL, Drapeaux, Pavoisements, Memos (mémo vigilance & comptes rendus),
 * Journal (trace de qui a fait quoi).
 *
 * Installation : coller ce fichier dans Extensions > Apps Script du Google Sheet,
 * exécuter une fois la fonction « installer », puis Déployer > Application Web
 * (Exécuter en tant que : moi · Accès : tout le monde).
 */

const TZ = 'Europe/Paris';
const APP_URL = 'https://eurexpobatiment.github.io/equipe/';

const SCHEMA = {
  Equipe:       ['id', 'nom', 'role', 'actif', 'email'],
  Taches:       ['id', 'titre', 'description', 'assigne', 'priorite', 'statut', 'echeance', 'lieu', 'creePar', 'creeLe', 'majLe', 'majPar', 'faitPar', 'prive'],
  Commentaires: ['id', 'tacheId', 'auteur', 'date', 'texte'],
  Nacelle:      ['id', 'nom', 'debut', 'fin', 'lieu', 'motif', 'creeLe', 'majPar'],
  Regisseurs:   ['id', 'regisseur', 'dateDebut', 'dateFin', 'statut', 'salon', 'note', 'majPar'],
  Cloisons:     ['id', 'date', 'heure', 'hall', 'mouvement', 'cloison', 'salon', 'responsable', 'statut', 'note', 'majPar', 'dateFin', 'heureFin', 'objet', 'position'],
  EDL:          ['id', 'date', 'heure', 'salon', 'type', 'halls', 'responsable', 'statut', 'note', 'majPar'],
  BudgetLignes: ['id', 'type', 'famille', 'code', 'prestataire', 'intitule', 'budget', 'bc', 'horsTotal', 'note', 'ordre', 'majPar'],
  BudgetMvts:   ['id', 'ligneId', 'date', 'nature', 'numero', 'montant', 'libelle', 'creeLe', 'majPar'],
  Inventaire:   ['id', 'responsable', 'designation', 'code', 'montant', 'commentaire', 'avancement', 'majPar'],
  SAP:          ['id', 'societe', 'sap', 'majPar'],
  Chantiers:    ['id', 'titre', 'espace', 'zone', 'type', 'entreprise', 'responsable', 'dateDebut', 'dateFin', 'horaires', 'statut',
                 'avancement', 'montant', 'codeBudget', 'demande', 'nacelle', 'contraintes', 'note', 'creeLe', 'majLe', 'majPar'],
  Drapeaux:     ['id', 'nom', 'groupe', 'format', 'neufs', 'occasions', 'uses', 'note', 'ordre', 'majPar'],
  Pavoisements: ['id', 'titre', 'lieu', 'dateDebut', 'dateFin', 'statut', 'responsable', 'liste', 'note', 'creeLe', 'majLe', 'majPar'],
  Memos:        ['id', 'type', 'titre', 'niveau', 'texte', 'decisions', 'lieu', 'jusquau', 'epingle', 'statut', 'dateReunion', 'participants',
                 'luPar', 'creePar', 'creeLe', 'majLe', 'majPar']
};
const JOURNAL = ['date', 'auteur', 'action', 'feuille', 'id', 'detail'];

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const LONG_FIELDS = ['description', 'texte', 'note', 'designation', 'commentaire', 'libelle', 'intitule', 'contraintes', 'decisions', 'liste'];

/* ---------- Installation ---------- */

function installer() {
  Object.keys(SCHEMA).forEach(sheet_);
  sheet_('Journal');
}

/* ---------- Points d'entrée Web ---------- */

function doGet(e) {
  const p = (e && e.parameter && e.parameter.action) ? e.parameter : { action: 'ping' };
  return handle_(p);
}

function doPost(e) {
  let p;
  try {
    p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return out_({ ok: false, error: 'Requête illisible' });
  }
  AC_TOKEN = String(p.appCheck || '').slice(0, 4000);
  return handle_(p);
}

// Jeton App Check envoyé par l'appli : transmis à Firestore pour que les lectures du script passent
// aussi quand le blocage App Check sera activé (depuis le 10 nov. 2026).
let AC_TOKEN = '';
function fsHeaders_(tok) {
  const h = {};
  if (tok) h.Authorization = 'Bearer ' + tok;
  if (AC_TOKEN) h['X-Firebase-AppCheck'] = AC_TOKEN;
  return h;
}

// Depuis le 6 nov. 2026 l'appli utilise Firebase : ce Google Sheet n'est plus qu'une archive (lecture seule).
const LECTURE_SEULE = true;

function handle_(p) {
  try {
    if (LECTURE_SEULE && ['save', 'delete', 'partFaite', 'lu', 'importDrapeaux', 'importBudget'].indexOf(p.action) >= 0)
      throw new Error("L'appli a été mise à jour : ferme-la et rouvre-la (lien habituel) pour enregistrer.");
    switch (p.action) {
      case 'ping':   return out_({ ok: true, data: 'pong' });
      case 'all':    return out_({ ok: true, data: readAll_(p.user) });
      case 'save':   return out_({ ok: true, data: withLock_(function () { return save_(p.sheet, p.item, p.user); }) });
      case 'delete': return out_({ ok: true, data: withLock_(function () { return remove_(p.sheet, p.id, p.user); }) });
      case 'partFaite': return out_({ ok: true, data: withLock_(function () { return partFaite_(p.id, p.user, p.fait); }) });
      case 'lu':     return out_({ ok: true, data: withLock_(function () { return memoLu_(p.id, p.user, p.lu); }) });
      case 'importDrapeaux': return out_({ ok: true, data: withLock_(function () { return importDrapeaux_(p.items, p.user); }) });
      case 'importBudget': return out_({ ok: true, data: withLock_(function () { return importBudget_(p.data, p.user); }) });
      case 'agenda': return out_({ ok: true, data: agenda_() });
      case 'notify': return out_({ ok: true, data: notifyFirebase_(p) });
      default: throw new Error('Action inconnue : ' + p.action);
    }
  } catch (err) {
    return out_({ ok: false, error: String((err && err.message) || err) });
  }
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Serveur occupé, réessaie dans quelques secondes');
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------- Lecture ---------- */

function readAll_(user) {
  user = clean_(user, 80);
  const out = {};
  Object.keys(SCHEMA).forEach(function (name) {
    out[name] = rows_(sheet_(name)).map(function (o) { delete o._row; return o; });
  });
  // Tâches perso : chacun ne reçoit que les siennes (et leurs commentaires)
  const cachees = {};
  out.Taches = out.Taches.filter(function (t) {
    if (!estPerso_(t) || t.creePar === user) return true;
    cachees[t.id] = 1; return false;
  });
  out.Commentaires = out.Commentaires.filter(function (c) { return !cachees[c.tacheId]; });
  return out;
}

/* ---------- Tâches perso (visibles par leur auteur seulement) ---------- */

function estPerso_(t) { return !!t && t.prive === 'oui'; }

function checkPerso_(t, user) {
  if (estPerso_(t) && t.creePar !== user) throw new Error('Tâche introuvable (supprimée ?)');
}

/* ---------- Écriture ---------- */

function save_(name, item, user, opts) {
  opts = opts || {};
  if (!SCHEMA[name]) throw new Error('Onglet non modifiable : ' + name);
  if (!item || typeof item !== 'object') throw new Error('Données manquantes');
  user = clean_(user, 80);

  const sh = sheet_(name);
  const head = headers_(sh);
  const rows = rows_(sh);
  const cur = item.id ? rows.filter(function (r) { return r.id === String(item.id); })[0] : null;
  const o = cur ? Object.assign({}, cur) : {};
  delete o._row;

  SCHEMA[name].forEach(function (k) {
    if (k in item && k !== 'id') o[k] = clean_(item[k], name === 'Memos' && k === 'texte' ? 30000 : LONG_FIELDS.indexOf(k) >= 0 ? 5000 : 300);
  });
  if (!cur) o.id = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  const now = now_();

  switch (name) {
    case 'Equipe':
      if (!o.nom) throw new Error('Nom obligatoire');
      if (!cur && rows.some(function (r) { return String(r.nom).toLowerCase() === o.nom.toLowerCase(); }))
        throw new Error(o.nom + " est déjà dans l'équipe");
      if (!o.actif) o.actif = 'oui';
      if (!o.role) o.role = 'Technicien';
      o.email = String(o.email || '').toLowerCase();
      if (o.email && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(o.email)) throw new Error('Adresse e-mail invalide : ' + o.email);
      break;
    case 'Taches':
      if (!o.titre) throw new Error('Titre obligatoire');
      checkPerso_(cur, user);
      if (!cur) { o.creePar = user; o.creeLe = now; }
      if (cur && estPerso_(cur)) o.prive = 'oui';                  // une tâche perso le reste
      if (o.prive === 'oui') { if (!o.creePar) throw new Error("Choisis d'abord ton nom (bouton 👤)"); o.assigne = o.creePar; }
      else o.prive = '';
      if (!o.statut) o.statut = 'À faire';
      if (!opts.part) o.faitPar = cur ? (cur.faitPar || '') : ''; // les parts ne changent que par « Ma part faite »
      parts_(o, cur, !!opts.part);
      o.majLe = now; o.majPar = user;
      break;
    case 'Commentaires':
      if (!o.texte) throw new Error('Commentaire vide');
      if (!o.tacheId) throw new Error('Tâche inconnue');
      checkPerso_(rows_(sheet_('Taches')).filter(function (t) { return t.id === String(o.tacheId); })[0], user);
      if (!cur) { o.auteur = o.auteur || user; o.date = now; }
      break;
    case 'Nacelle':
      checkNacelle_(o, rows);
      if (!cur) o.creeLe = now;
      o.majPar = user;
      break;
    case 'Regisseurs':
      if (!o.regisseur) throw new Error('Régisseur obligatoire');
      if (!RE_DATE.test(o.dateDebut || '')) throw new Error('Date de début obligatoire');
      if (!o.dateFin) o.dateFin = o.dateDebut;
      if (o.dateFin < o.dateDebut) throw new Error('La date de fin est avant la date de début');
      o.majPar = user;
      break;
    case 'BudgetLignes':
      if (o.type !== 'Entretien' && o.type !== 'Contrat') throw new Error('Type de ligne inconnu');
      if (!o.intitule && !o.code) throw new Error('Intitulé obligatoire');
      if (o.budget !== '' && o.budget !== undefined) o.budget = money_(o.budget, 'Budget');
      if (!cur && !o.ordre) o.ordre = String(rows.reduce(function (m, r) { return Math.max(m, Number(r.ordre) || 0); }, 0) + 1);
      o.majPar = user;
      break;
    case 'BudgetMvts':
      if (!o.ligneId) throw new Error('Ligne budgétaire inconnue');
      if (!RE_DATE.test(o.date || '')) throw new Error('Date obligatoire');
      o.montant = money_(o.montant, 'Montant');
      if (!o.nature) o.nature = 'BDC';
      if (!cur) o.creeLe = now;
      o.majPar = user;
      break;
    case 'Inventaire':
      if (!o.designation) throw new Error('Désignation obligatoire');
      o.majPar = user;
      break;
    case 'SAP':
      if (!o.societe) throw new Error('Société obligatoire');
      o.majPar = user;
      break;
    case 'Chantiers':
      if (!o.titre) throw new Error('Intitulé du chantier obligatoire');
      if (!RE_DATE.test(o.dateDebut || '')) throw new Error('Date de début obligatoire');
      if (!o.dateFin) o.dateFin = o.dateDebut;
      if (!RE_DATE.test(o.dateFin)) throw new Error('Date de fin invalide');
      if (o.dateFin < o.dateDebut) throw new Error('La date de fin est avant la date de début');
      if (o.montant) o.montant = money_(o.montant, 'Montant');
      if (o.avancement) { const a = Math.round(Number(o.avancement)); if (!isFinite(a) || a < 0 || a > 100) throw new Error('Avancement entre 0 et 100 %'); o.avancement = String(a); }
      if (!o.statut) o.statut = 'Prévu';
      if (!cur) o.creeLe = now;
      o.majLe = now; o.majPar = user;
      break;
    case 'Memos':
      if (o.type !== 'Vigilance' && o.type !== 'Compte rendu') throw new Error('Type de mémo inconnu');
      if (!o.titre) throw new Error(o.type === 'Vigilance' ? 'Titre obligatoire' : 'Objet de la réunion obligatoire');
      if (o.type === 'Compte rendu' && !RE_DATE.test(o.dateReunion || '')) throw new Error('Date de réunion obligatoire');
      if (o.jusquau && !RE_DATE.test(o.jusquau)) throw new Error("Date « valable jusqu'au » invalide");
      if (!o.statut) o.statut = 'Actif';
      if (o.type === 'Vigilance' && !o.niveau) o.niveau = 'Important';
      if (!opts.lu) { // « lu par » ne change que par « J'ai lu » ; si le contenu change, chacun doit relire
        const same = cur && ['titre', 'texte', 'decisions', 'niveau'].every(function (k) { return String(cur[k] || '') === String(o[k] || ''); });
        o.luPar = same ? (cur.luPar || '') : user; // l'auteur de la modification l'a forcément lu
      }
      if (!cur) { o.creePar = user; o.creeLe = now; }
      o.majLe = now; o.majPar = user;
      break;
    case 'Drapeaux':
      if (!o.nom) throw new Error('Nom du drapeau obligatoire');
      if (!o.format) throw new Error('Format obligatoire');
      ['neufs', 'occasions', 'uses'].forEach(function (k) { o[k] = qte_(o[k], k === 'uses' ? 'usés' : k); });
      if (!cur && rows.some(function (r) { return String(r.nom).toLowerCase() === o.nom.toLowerCase() && r.format === o.format; }))
        throw new Error(o.nom + ' en ' + o.format + ' existe déjà : modifie la ligne existante');
      o.majPar = user;
      break;
    case 'Pavoisements':
      if (!o.titre) throw new Error('Salon / événement obligatoire');
      if (!RE_DATE.test(o.dateDebut || '')) throw new Error('Date de pose obligatoire');
      if (!o.dateFin) o.dateFin = o.dateDebut;
      if (!RE_DATE.test(o.dateFin)) throw new Error('Date de dépose invalide');
      if (o.dateFin < o.dateDebut) throw new Error('La dépose est avant la pose');
      let l;
      try { l = JSON.parse(o.liste || '[]'); } catch (err) { throw new Error('Liste de drapeaux illisible'); }
      if (!Array.isArray(l)) throw new Error('Liste de drapeaux illisible');
      o.liste = JSON.stringify(l.filter(function (x) { return x && x.d && x.f && Number(x.q) > 0; })
        .map(function (x) { return { d: clean_(x.d, 80), f: clean_(x.f, 20), q: Number(qte_(x.q, 'quantité')) }; }));
      if (!o.statut) o.statut = 'Prévu';
      if (!cur) o.creeLe = now;
      o.majLe = now; o.majPar = user;
      break;
    case 'Cloisons':
      if (!o.objet) o.objet = 'Cloison';
      if (!RE_DATE.test(o.date || '')) throw new Error('Date de début obligatoire');
      if (!o.dateFin) o.dateFin = o.date;
      if (!RE_DATE.test(o.dateFin)) throw new Error('Date de fin invalide');
      if (o.dateFin < o.date) throw new Error('La date de fin est avant la date de début');
      if (o.dateFin === o.date && o.heure && o.heureFin && o.heureFin < o.heure) throw new Error("L'heure de fin est avant l'heure de début");
      o.majPar = user;
      break;
    default: // EDL
      if (!RE_DATE.test(o.date || '')) throw new Error('Date obligatoire');
      o.majPar = user;
  }

  const line = head.map(function (h) { return (h in o) ? safe_(o[h]) : ''; });
  if (cur) sh.getRange(cur._row, 1, 1, head.length).setValues([line]);
  else append_(sh, line);

  journal_(user, cur ? 'modification' : 'ajout', name, o.id, summary_(name, o));
  if (name === 'Taches') notifierAttribution_(o, cur, user);
  return o;
}

/* ---------- Notifications par e-mail ---------- */

// Envoie un mail à chaque personne nouvellement attribuée à une tâche (sauf à celui qui fait l'attribution).
// Une erreur d'envoi ne bloque jamais l'enregistrement de la tâche.
function notifierAttribution_(o, cur, user) {
  try {
    if (estPerso_(o) || o.statut === 'Terminé') return;
    const avant = cur ? list_(cur.assigne) : [];
    const nouveaux = list_(o.assigne).filter(function (n) { return avant.indexOf(n) < 0 && n !== user; });
    if (!nouveaux.length) return;
    const mails = {};
    rows_(sheet_('Equipe')).forEach(function (e) { if (e.actif !== 'non' && e.email) mails[e.nom] = e.email; });
    nouveaux.forEach(function (nom) {
      if (!mails[nom]) return;
      MailApp.sendEmail(mailTache_(o, nom, user, mails[nom]));
      journal_(user, 'mail', 'Taches', o.id, 'Attribution notifiée à ' + nom);
    });
  } catch (err) {
    journal_(user, 'erreur mail', 'Taches', o.id, String((err && err.message) || err));
  }
}

function mailTache_(t, nom, par, to) {
  const lien = APP_URL + '#tache=' + t.id;
  const autres = list_(t.assigne).filter(function (n) { return n !== nom; });
  const lignes = [
    ['Priorité', t.priorite || 'Normale'],
    ['Échéance', t.echeance ? dateFr_(t.echeance) : ''],
    ['Lieu', t.lieu],
    ['Avec', autres.join(', ')],
    ['Attribuée par', par || '?']
  ].filter(function (l) { return l[1]; });
  const h = function (v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  const html =
    '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1d2433;max-width:560px">' +
    '<p>Bonjour ' + h(nom) + ',</p><p>Une tâche t\'a été attribuée dans l\'appli Équipe :</p>' +
    '<div style="border:1px solid #d5d9e2;border-left:4px solid #14213d;border-radius:8px;padding:12px 14px;margin:12px 0">' +
    '<div style="font-size:16px;font-weight:bold;margin-bottom:6px">' + h(t.titre) + '</div>' +
    (t.description ? '<div style="white-space:pre-wrap;margin-bottom:8px">' + h(t.description) + '</div>' : '') +
    lignes.map(function (l) { return '<div><span style="color:#667">' + l[0] + ' :</span> ' + h(l[1]) + '</div>'; }).join('') +
    '</div><p><a href="' + lien + '" style="background:#14213d;color:#fff;padding:9px 14px;border-radius:8px;text-decoration:none;display:inline-block">Ouvrir la tâche</a></p>' +
    '<p style="color:#889;font-size:12px">Mail automatique de l\'appli Équipe · Eurexpo. Pour ne plus le recevoir, efface ton adresse dans l\'onglet 👥 Équipe.</p></div>';
  const texte = 'Bonjour ' + nom + ',\n\nUne tâche t\'a été attribuée : ' + t.titre + '\n' +
    (t.description ? t.description + '\n' : '') +
    lignes.map(function (l) { return l[0] + ' : ' + l[1]; }).join('\n') + '\n\nOuvrir : ' + lien;
  return {
    to: to,
    subject: '[Équipe] Nouvelle tâche : ' + t.titre + (t.echeance ? ' (pour le ' + dateFr_(t.echeance) + ')' : ''),
    body: texte, htmlBody: html, name: 'Appli Équipe Eurexpo'
  };
}

function dateFr_(d) {
  d = String(d || '');
  return RE_DATE.test(d.slice(0, 10)) ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : d;
}

// À exécuter une fois dans l'éditeur Apps Script : autorise l'envoi de mails et t'envoie un mail d'essai.
function testerMail() {
  const moi = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail(mailTache_({ id: 'essai', titre: 'Mail d\'essai des notifications', description: 'Si tu lis ce mail, les notifications fonctionnent.',
    priorite: 'Normale', echeance: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), lieu: 'Hall 1', assigne: 'Toi' }, 'Toi', 'Apps Script', moi));
  Logger.log('Mail d\'essai envoyé à ' + moi + ' · quota restant aujourd\'hui : ' + MailApp.getRemainingDailyQuota());
}

/* ---------- Tâches à plusieurs : chacun coche sa part ---------- */

function list_(s) {
  return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
}

// faitPar = personnes qui ont fini leur part. Tâche terminée quand toutes les personnes attribuées ont fini.
function parts_(o, cur, part) {
  const a = list_(o.assigne);
  let f = a.length > 1 ? list_(o.faitPar).filter(function (n) { return a.indexOf(n) >= 0; }) : [];
  if (!part && cur && cur.statut === 'Terminé' && o.statut !== 'Terminé') f = []; // tâche rouverte : on repart de zéro
  if (a.length > 1 && f.length === a.length) o.statut = 'Terminé';
  else if (part && o.statut === 'Terminé') o.statut = 'En cours';             // une part décochée
  else if (part && f.length && o.statut === 'À faire') o.statut = 'En cours';
  o.faitPar = f.join(', ');
}

function partFaite_(id, user, fait) {
  user = clean_(user, 80);
  if (!user) throw new Error("Choisis d'abord ton nom (bouton 👤)");
  const cur = rows_(sheet_('Taches')).filter(function (r) { return r.id === String(id); })[0];
  if (!cur) throw new Error('Tâche introuvable (supprimée ?)');
  checkPerso_(cur, user);
  if (list_(cur.assigne).indexOf(user) < 0) throw new Error(user + " n'est pas attribué à cette tâche");
  const f = list_(cur.faitPar).filter(function (n) { return n !== user; });
  if (fait) f.push(user);
  const item = Object.assign({}, cur, { faitPar: f.join(', ') });
  delete item._row;
  return save_('Taches', item, user, { part: true });
}

// Mémo : chacun confirme qu'il a lu (« J'ai lu »)
function memoLu_(id, user, lu) {
  user = clean_(user, 80);
  if (!user) throw new Error("Choisis d'abord ton nom (bouton 👤)");
  const sh = sheet_('Memos');
  const cur = rows_(sh).filter(function (r) { return r.id === String(id); })[0];
  if (!cur) throw new Error('Mémo introuvable (supprimé ?)');
  const l = list_(cur.luPar).filter(function (n) { return n !== user; });
  if (lu) l.push(user);
  const head = headers_(sh), c = head.indexOf('luPar');
  sh.getRange(cur._row, c + 1).setValue(safe_(l.join(', ')));
  cur.luPar = l.join(', ');
  delete cur._row;
  return cur;
}

function remove_(name, id, user) {
  if (!SCHEMA[name]) throw new Error('Onglet non modifiable : ' + name);
  const sh = sheet_(name);
  const rows = rows_(sh);
  const cur = rows.filter(function (r) { return r.id === String(id); })[0];
  if (!cur) throw new Error('Élément introuvable (déjà supprimé ?)');
  user = clean_(user, 80);
  if (name === 'Taches') checkPerso_(cur, user);
  if (name === 'Commentaires') checkPerso_(rows_(sheet_('Taches')).filter(function (t) { return t.id === cur.tacheId; })[0], user);
  sh.deleteRow(cur._row);

  const child = { Taches: ['Commentaires', 'tacheId'], BudgetLignes: ['BudgetMvts', 'ligneId'] }[name];
  if (child) { // supprime aussi les éléments rattachés (commentaires, mouvements)
    const cs = sheet_(child[0]);
    rows_(cs).filter(function (c) { return c[child[1]] === cur.id; })
      .map(function (c) { return c._row; })
      .sort(function (a, b) { return b - a; })
      .forEach(function (r) { cs.deleteRow(r); });
  }
  journal_(clean_(user, 80), 'suppression', name, cur.id, summary_(name, cur));
  return { id: cur.id };
}

// Reprise initiale du classeur budget : uniquement si les onglets budget sont vides
function importBudget_(data, user) {
  if (!data || !data.lignes) throw new Error('Données de reprise manquantes');
  if (rows_(sheet_('BudgetLignes')).length) throw new Error('Le budget contient déjà des lignes : reprise refusée');
  const now = now_(), id = function () { return Utilities.getUuid().replace(/-/g, '').slice(0, 10); };
  const L = [], M = [];
  data.lignes.forEach(function (l) {
    const o = { id: id(), type: l.type, famille: l.famille, code: l.code, prestataire: l.prestataire, intitule: l.intitule,
      budget: l.budget === '' || l.budget === undefined ? '' : money_(l.budget, 'Budget'), bc: l.bc || '', horsTotal: l.horsTotal || '',
      note: l.note || '', ordre: String(l.ordre || ''), majPar: user };
    L.push(o);
    (l.mvts || []).forEach(function (m) {
      M.push({ id: id(), ligneId: o.id, date: m.date, nature: m.nature, numero: m.numero || '', montant: money_(m.montant, 'Montant'),
        libelle: m.libelle || '', creeLe: now, majPar: user });
    });
  });
  bulk_('BudgetLignes', L); bulk_('BudgetMvts', M);
  if (data.inventaire && !rows_(sheet_('Inventaire')).length) bulk_('Inventaire', data.inventaire.map(function (x) { return Object.assign({ id: id(), majPar: user }, x); }));
  if (data.sap && !rows_(sheet_('SAP')).length) bulk_('SAP', data.sap.map(function (x) { return Object.assign({ id: id(), majPar: user }, x); }));
  journal_(user, 'reprise', 'Budget', '', L.length + ' lignes, ' + M.length + ' mouvements');
  return { lignes: L.length, mvts: M.length };
}

// Reprise initiale de l'inventaire des drapeaux : uniquement si l'onglet Drapeaux est vide
function importDrapeaux_(items, user) {
  if (!Array.isArray(items) || !items.length) throw new Error('Inventaire vide');
  if (rows_(sheet_('Drapeaux')).length) throw new Error("L'inventaire contient déjà des drapeaux : reprise refusée");
  const L = items.map(function (x, i) {
    if (!x.nom || !x.format) throw new Error('Ligne ' + (i + 1) + ' : nom ou format manquant');
    return { id: Utilities.getUuid().replace(/-/g, '').slice(0, 10), nom: x.nom, groupe: x.groupe || '', format: x.format,
      neufs: qte_(x.neufs, 'neufs'), occasions: qte_(x.occasions, 'occasions'), uses: qte_(x.uses, 'usés'), note: x.note || '', ordre: String(i + 1), majPar: user };
  });
  bulk_('Drapeaux', L);
  journal_(user, 'reprise', 'Drapeaux', '', L.length + ' lignes');
  return { lignes: L.length };
}

// Quantité entière ≥ 0 (vide = 0)
function qte_(v, label) {
  const s = String(v === null || v === undefined ? '' : v).trim();
  if (s === '') return '0';
  const n = Number(s.replace(',', '.'));
  if (!isFinite(n) || n < 0 || Math.round(n) !== n) throw new Error('Quantité invalide (' + label + ') : ' + v);
  return String(n);
}

function bulk_(name, items) {
  if (!items.length) return;
  const sh = sheet_(name), head = headers_(sh);
  const vals = items.map(function (o) { return head.map(function (h) { return (h in o) ? safe_(clean_(o[h], 5000)) : ''; }); });
  const need = sh.getLastRow() + vals.length - sh.getMaxRows();
  if (need > 0) sh.insertRowsAfter(sh.getMaxRows(), need + 200);
  sh.getRange(sh.getLastRow() + 1, 1, vals.length, head.length).setNumberFormat('@').setValues(vals);
}

// Montant : accepte « 1 234,56 », « 1234.56 », « 1 234,56 € » ; renvoie « 1234.56 »
function money_(v, label) {
  const s = String(v === null || v === undefined ? '' : v).replace(/[\s\u00a0\u202f€]/g, '').replace(',', '.');
  const n = Number(s);
  if (s === '' || !isFinite(n)) throw new Error((label || 'Montant') + ' invalide : ' + v);
  return String(Math.round(n * 100) / 100);
}

function checkNacelle_(o, rows) {
  if (!o.nom) throw new Error('Indique qui réserve la nacelle');
  if (!RE_DT.test(o.debut || '') || !RE_DT.test(o.fin || '')) throw new Error('Début et fin obligatoires');
  if (o.fin <= o.debut) throw new Error('La fin doit être après le début');
  const c = rows.filter(function (r) { return r.id !== o.id && o.debut < r.fin && r.debut < o.fin; })[0];
  if (c) throw new Error('Nacelle déjà réservée par ' + c.nom + ' du ' + fr_(c.debut) + ' au ' + fr_(c.fin));
}

/* ---------- Outils feuille ---------- */

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cols = SCHEMA[name] || JOURNAL;
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, cols.length).setValues([cols])
      .setFontWeight('bold').setBackground('#14213d').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    return sh;
  }
  const head = headers_(sh);
  const miss = cols.filter(function (c) { return head.indexOf(c) < 0; });
  if (miss.length) {
    const start = head.length + 1;
    sh.getRange(1, start, sh.getMaxRows(), miss.length).setNumberFormat('@');
    sh.getRange(1, start, 1, miss.length).setValues([miss]).setFontWeight('bold');
  }
  return sh;
}

function headers_(sh) {
  const lc = sh.getLastColumn();
  if (!lc) return [];
  return sh.getRange(1, 1, 1, lc).getValues()[0].map(String);
}

function rows_(sh) {
  const v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  const head = v[0].map(String);
  const out = [];
  for (let i = 1; i < v.length; i++) {
    const o = { _row: i + 1 };
    head.forEach(function (h, j) { if (h) o[h] = str_(v[i][j]); });
    if (o.id) out.push(o);
  }
  return out;
}

function append_(sh, line) {
  if (sh.getLastRow() >= sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 500);
  sh.getRange(sh.getLastRow() + 1, 1, 1, line.length).setNumberFormat('@').setValues([line]);
}

function journal_(user, action, name, id, detail) {
  const sh = sheet_('Journal');
  append_(sh, [now_(), user || '?', action, name, id, String(detail || '').slice(0, 200)].map(safe_));
}

function summary_(name, o) {
  switch (name) {
    case 'Equipe': return o.nom + ' (' + o.role + ', actif : ' + o.actif + ')';
    case 'Taches': if (estPerso_(o)) return 'Tâche perso de ' + o.creePar + ' · ' + o.statut;
      return o.titre + ' · ' + o.statut + (o.assigne ? ' · ' + o.assigne : '') + (o.faitPar ? ' · fait : ' + o.faitPar : '');
    case 'Commentaires': return (o.texte || '').slice(0, 80);
    case 'Nacelle': return o.nom + ' ' + fr_(o.debut) + ' → ' + fr_(o.fin);
    case 'Regisseurs': return o.regisseur + ' ' + o.statut + ' ' + o.dateDebut + ' → ' + o.dateFin;
    case 'Drapeaux': return o.nom + ' ' + o.format + ' : ' + o.neufs + ' neufs, ' + o.occasions + ' occasions, ' + o.uses + ' usés';
    case 'Pavoisements': return o.titre + ' · ' + o.dateDebut + ' → ' + o.dateFin + ' · ' + o.statut;
    case 'Cloisons': return (o.objet === 'Tribune' ? 'Tribune ' : '') + o.date + (o.dateFin && o.dateFin !== o.date ? ' → ' + o.dateFin : '') + ' ' + o.hall + ' ' + o.mouvement + ' ' + o.statut;
    case 'EDL': return o.date + ' ' + o.salon + ' ' + o.type + ' ' + o.statut;
    case 'BudgetLignes': return o.type + ' ' + o.code + ' ' + o.intitule + ' · budget ' + o.budget;
    case 'BudgetMvts': return o.nature + ' ' + o.montant + ' € ' + (o.numero || '') + ' ' + (o.libelle || '');
    case 'Inventaire': return (o.designation || '').slice(0, 80) + ' ' + o.montant;
    case 'SAP': return o.societe + ' ' + o.sap;
    case 'Memos': return o.type + ' · ' + o.titre + (o.niveau ? ' · ' + o.niveau : '') + ' · ' + o.statut;
    case 'Chantiers': return o.titre + ' · ' + o.espace + ' · ' + o.dateDebut + ' → ' + o.dateFin + ' · ' + o.statut;
  }
  return '';
}

function str_(v) {
  if (v instanceof Date) {
    const hasTime = v.getHours() || v.getMinutes();
    return Utilities.formatDate(v, TZ, hasTime ? "yyyy-MM-dd'T'HH:mm" : 'yyyy-MM-dd');
  }
  return v === null || v === undefined ? '' : String(v);
}

function clean_(v, max) {
  return String(v === null || v === undefined ? '' : v).trim().slice(0, max || 300);
}

// Empêche qu'un texte commençant par « = » soit pris pour une formule
function safe_(v) {
  v = String(v === null || v === undefined ? '' : v);
  return /^[=+@]/.test(v) ? "'" + v : v;
}

function now_() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm");
}

function fr_(s) {
  s = String(s || '');
  return s.slice(8, 10) + '/' + s.slice(5, 7) + ' ' + s.slice(11, 16);
}


/* ---------- Agenda des évènements Eurexpo (site gl-lyonevents.com) ---------- */
// Relu au plus toutes les 6 h. Seuls les évènements « Eurexpo Lyon » sont gardés (pas le Centre de Congrès, ni les autres lieux).
const AGENDA_SITE = 'https://www.gl-lyonevents.com';
const MOIS_ = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };

function agenda_() {
  const cache = CacheService.getScriptCache();
  const c = cache.get('agendaEurexpo2');
  if (c) return JSON.parse(c);
  const list = [], vus = {};
  for (let page = 0; page < 8; page++) {
    const r = UrlFetchApp.fetch(AGENDA_SITE + '/fr/agenda?page=' + page, { muteHttpExceptions: true, followRedirects: true });
    if (r.getResponseCode() !== 200) break;
    const blocs = r.getContentText().split('views-row').slice(1);
    if (!blocs.length) break;
    let nouveaux = 0;
    blocs.forEach(function (b) {
      const h = b.match(/href="(\/fr\/eurexpo-lyon\/[^"#?]+)"/);
      const t = b.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
      if (!h || !t || vus[h[1]]) return;
      vus[h[1]] = 1; nouveaux++;
      const d = texte_((b.match(/text-primary[^>]*>([\s\S]*?)<\/span>/) || [])[1] || '');
      list.push({ url: AGENDA_SITE + h[1], nom: texte_(t[1]), dates: d });
    });
    if (!nouveaux) break;
  }
  // détail de chaque évènement : dates complètes (avec l'année), type, horaires
  const reps = UrlFetchApp.fetchAll(list.map(function (e) { return { url: e.url, muteHttpExceptions: true }; }));
  const auj = new Date();
  const out = list.map(function (e, i) {
    let d0 = '', d1 = '', type = '', horaires = '';
    if (reps[i].getResponseCode() === 200) {
      const tx = texte_(reps[i].getContentText().replace(/<(br|\/div|\/p|\/h\d|\/span|\/li)[^>]*>/gi, '\n'));
      const dd = [];
      const k = tx.indexOf('Date de début');
      (k >= 0 ? tx.slice(k, k + 200) : '').replace(/(\d{1,2})(?:er)?\s+([a-zéèûô]+)\s+(\d{4})/gi, function (m, j, mo, a) {
        const n = MOIS_[mo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
        if (n && dd.length < 2) dd.push(a + '-' + ('0' + n).slice(-2) + '-' + ('0' + j).slice(-2));
        return m;
      });
      d0 = dd[0] || ''; d1 = dd[1] || d0;
      // le type est juste avant « Entité lieu liée » (le menu du site, plus haut, cite tous les types)
      const kl = tx.indexOf('Entité lieu liée');
      const ty = (kl >= 0 ? tx.slice(Math.max(0, kl - 300), kl) : '').match(/Salon professionnel|Salon grand public|Congrès|Concert|Évènement d'entreprise|Exposition culturelle/gi);
      type = ty ? ty[ty.length - 1] : '';
      const ho = tx.match(/Horaires\s*\n+\s*([^\n]+)/);
      horaires = ho ? ho[1].trim().slice(0, 200) : '';
    }
    if (!d0) { // repli : dates « 06/11 » ou « Du 06/11 au 08/11 » de la liste, année devinée
      const m = (e.dates.match(/\d{2}\/\d{2}/g) || []).map(function (x) {
        const j = +x.slice(0, 2), mo = +x.slice(3, 5);
        let a = auj.getFullYear(); if (mo < auj.getMonth() - 1) a++;
        return a + '-' + ('0' + mo).slice(-2) + '-' + ('0' + j).slice(-2);
      });
      d0 = m[0] || ''; d1 = m[1] || d0;
      if (d1 < d0) d1 = (+d1.slice(0, 4) + 1) + d1.slice(4);
    }
    return { nom: e.nom, d0: d0, d1: d1, type: type, horaires: horaires, url: e.url };
  }).filter(function (e) { return e.d0; });
  cache.put('agendaEurexpo2', JSON.stringify(out), 6 * 3600);
  return out;
}

function texte_(h) {
  return String(h).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&rsquo;|&apos;/g, '’')
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); })
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
}

// À lancer une fois dans l'éditeur Apps Script pour autoriser la lecture du site (accès « services externes »).
function testerAgenda() {
  CacheService.getScriptCache().remove('agendaEurexpo2');
  const l = agenda_();
  Logger.log(l.length + ' évènements Eurexpo : ' + l.map(function (e) { return e.d0 + ' ' + e.nom; }).join(' | '));
}


/* ---------- Version Firebase : mails d'attribution ---------- */
// L'appli Firebase appelle l'action « notify » avec le jeton de connexion de la personne.
// Le script relit la tâche et l'équipe dans Firestore avec ce jeton : seul un membre connecté peut déclencher un mail,
// et seulement vers les personnes réellement attribuées à la tâche.
const FIREBASE_PROJECT = 'equipe-batiment'; // identifiant du projet Firebase (projectId), ex. eurexpo-batiment

function notifyFirebase_(p) {
  if (!FIREBASE_PROJECT) throw new Error('FIREBASE_PROJECT non renseigné dans Code.gs');
  const tok = String(p.idToken || '');
  if (!tok) throw new Error('Connexion nécessaire');
  const base = 'https://firestore.googleapis.com/v1/projects/' + FIREBASE_PROJECT + '/databases/(default)/documents/';
  const get = function (path) {
    const r = UrlFetchApp.fetch(base + path, { headers: fsHeaders_(tok), muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error('Accès refusé');
    return JSON.parse(r.getContentText());
  };
  // qui appelle : e-mail du jeton (le jeton vient d'être accepté par Firestore)
  const payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(tok.split('.')[1] + '==='.slice((tok.split('.')[1].length + 3) % 4))).getDataAsString());
  const email = String(payload.email || '').toLowerCase();
  const acc = fsObj_(get('Acces/' + encodeURIComponent(email)));
  const user = acc.nom;
  if (!user || acc.actif === 'non') throw new Error('Accès refusé');

  const t = fsObj_(get('Taches/' + encodeURIComponent(String(p.id || ''))));
  if (t.prive === 'oui' || t.statut === 'Terminé') return { envoyes: 0 };
  const assigne = list_(t.assigne);
  const noms = (Array.isArray(p.nouveaux) ? p.nouveaux : []).map(String)
    .filter(function (n) { return assigne.indexOf(n) >= 0 && n !== user; });
  if (!noms.length) return { envoyes: 0 };

  const mails = {};
  let page = '';
  do {
    const r = get('Equipe?pageSize=300' + (page ? '&pageToken=' + encodeURIComponent(page) : ''));
    (r.documents || []).map(fsObj_).forEach(function (e) { if (e.actif !== 'non' && e.email) mails[e.nom] = e.email; });
    page = r.nextPageToken || '';
  } while (page);

  const appUrl = /^https:\/\/eurexpobatiment\.github\.io\//.test(String(p.appUrl || '')) ? String(p.appUrl).split('#')[0] : APP_URL;
  const cache = CacheService.getScriptCache();
  let n = 0;
  noms.forEach(function (nom) {
    if (!mails[nom]) return;
    const k = 'mail_' + t.id + '_' + Utilities.base64EncodeWebSafe(nom);
    if (cache.get(k)) return; // déjà prévenu il y a peu
    const m = mailTache_(t, nom, user, mails[nom]);
    m.htmlBody = m.htmlBody.split(APP_URL + '#tache=').join(appUrl + '#tache=');
    m.body = m.body.split(APP_URL + '#tache=').join(appUrl + '#tache=');
    MailApp.sendEmail(m);
    cache.put(k, '1', 600);
    n++;
  });
  return { envoyes: n };
}

// Document Firestore (API REST) → objet simple
function fsObj_(d) {
  const o = {};
  const f = (d && d.fields) || {};
  Object.keys(f).forEach(function (k) {
    const v = f[k];
    o[k] = 'stringValue' in v ? v.stringValue : 'integerValue' in v ? String(v.integerValue) : 'doubleValue' in v ? String(v.doubleValue)
      : 'booleanValue' in v ? String(v.booleanValue) : '';
  });
  if (!o.id && d && d.name) o.id = d.name.split('/').pop();
  return o;
}
