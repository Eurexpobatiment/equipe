/**
 * Appli Équipe – Eurexpo · API (Google Apps Script lié au Google Sheet)
 *
 * Onglets créés automatiquement : Equipe, Taches, Commentaires, Nacelle,
 * Regisseurs, Cloisons, EDL, Journal (trace de qui a fait quoi).
 *
 * Installation : coller ce fichier dans Extensions > Apps Script du Google Sheet,
 * exécuter une fois la fonction « installer », puis Déployer > Application Web
 * (Exécuter en tant que : moi · Accès : tout le monde).
 */

const TZ = 'Europe/Paris';

const SCHEMA = {
  Equipe:       ['id', 'nom', 'role', 'actif'],
  Taches:       ['id', 'titre', 'description', 'assigne', 'priorite', 'statut', 'echeance', 'lieu', 'creePar', 'creeLe', 'majLe', 'majPar'],
  Commentaires: ['id', 'tacheId', 'auteur', 'date', 'texte'],
  Nacelle:      ['id', 'nom', 'debut', 'fin', 'lieu', 'motif', 'creeLe', 'majPar'],
  Regisseurs:   ['id', 'regisseur', 'dateDebut', 'dateFin', 'statut', 'salon', 'note', 'majPar'],
  Cloisons:     ['id', 'date', 'heure', 'hall', 'mouvement', 'cloison', 'salon', 'responsable', 'statut', 'note', 'majPar'],
  EDL:          ['id', 'date', 'heure', 'salon', 'type', 'halls', 'responsable', 'statut', 'note', 'majPar'],
  BudgetLignes: ['id', 'type', 'famille', 'code', 'prestataire', 'intitule', 'budget', 'bc', 'horsTotal', 'note', 'ordre', 'majPar'],
  BudgetMvts:   ['id', 'ligneId', 'date', 'nature', 'numero', 'montant', 'libelle', 'creeLe', 'majPar'],
  Inventaire:   ['id', 'responsable', 'designation', 'code', 'montant', 'commentaire', 'avancement', 'majPar'],
  SAP:          ['id', 'societe', 'sap', 'majPar']
};
const JOURNAL = ['date', 'auteur', 'action', 'feuille', 'id', 'detail'];

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const LONG_FIELDS = ['description', 'texte', 'note', 'designation', 'commentaire', 'libelle', 'intitule'];

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
  return handle_(p);
}

function handle_(p) {
  try {
    switch (p.action) {
      case 'ping':   return out_({ ok: true, data: 'pong' });
      case 'all':    return out_({ ok: true, data: readAll_() });
      case 'save':   return out_({ ok: true, data: withLock_(function () { return save_(p.sheet, p.item, p.user); }) });
      case 'delete': return out_({ ok: true, data: withLock_(function () { return remove_(p.sheet, p.id, p.user); }) });
      case 'importBudget': return out_({ ok: true, data: withLock_(function () { return importBudget_(p.data, p.user); }) });
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

function readAll_() {
  const out = {};
  Object.keys(SCHEMA).forEach(function (name) {
    out[name] = rows_(sheet_(name)).map(function (o) { delete o._row; return o; });
  });
  return out;
}

/* ---------- Écriture ---------- */

function save_(name, item, user) {
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
    if (k in item && k !== 'id') o[k] = clean_(item[k], LONG_FIELDS.indexOf(k) >= 0 ? 5000 : 300);
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
      break;
    case 'Taches':
      if (!o.titre) throw new Error('Titre obligatoire');
      if (!cur) { o.creePar = user; o.creeLe = now; }
      if (!o.statut) o.statut = 'À faire';
      o.majLe = now; o.majPar = user;
      break;
    case 'Commentaires':
      if (!o.texte) throw new Error('Commentaire vide');
      if (!o.tacheId) throw new Error('Tâche inconnue');
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
    default: // Cloisons, EDL
      if (!RE_DATE.test(o.date || '')) throw new Error('Date obligatoire');
      o.majPar = user;
  }

  const line = head.map(function (h) { return (h in o) ? safe_(o[h]) : ''; });
  if (cur) sh.getRange(cur._row, 1, 1, head.length).setValues([line]);
  else append_(sh, line);

  journal_(user, cur ? 'modification' : 'ajout', name, o.id, summary_(name, o));
  return o;
}

function remove_(name, id, user) {
  if (!SCHEMA[name]) throw new Error('Onglet non modifiable : ' + name);
  const sh = sheet_(name);
  const rows = rows_(sh);
  const cur = rows.filter(function (r) { return r.id === String(id); })[0];
  if (!cur) throw new Error('Élément introuvable (déjà supprimé ?)');
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
    case 'Taches': return o.titre + ' · ' + o.statut + (o.assigne ? ' · ' + o.assigne : '');
    case 'Commentaires': return (o.texte || '').slice(0, 80);
    case 'Nacelle': return o.nom + ' ' + fr_(o.debut) + ' → ' + fr_(o.fin);
    case 'Regisseurs': return o.regisseur + ' ' + o.statut + ' ' + o.dateDebut + ' → ' + o.dateFin;
    case 'Cloisons': return o.date + ' ' + o.hall + ' ' + o.mouvement + ' ' + o.statut;
    case 'EDL': return o.date + ' ' + o.salon + ' ' + o.type + ' ' + o.statut;
    case 'BudgetLignes': return o.type + ' ' + o.code + ' ' + o.intitule + ' · budget ' + o.budget;
    case 'BudgetMvts': return o.nature + ' ' + o.montant + ' € ' + (o.numero || '') + ' ' + (o.libelle || '');
    case 'Inventaire': return (o.designation || '').slice(0, 80) + ' ' + o.montant;
    case 'SAP': return o.societe + ' ' + o.sap;
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
