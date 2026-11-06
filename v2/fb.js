/* Appli Équipe – Eurexpo · couche Firebase (connexion, données en direct, enregistrements)
 * Remplace les appels au script Google (Code.gs) pour les données. Le script ne sert plus
 * qu'à l'agenda GL events et à l'envoi des mails d'attribution.
 */
const V = '10.14.1';
const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
const A = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
const F = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
import { SCHEMA, prepare, summary_, nouveauxAttribues, normaliserReprise, list_, estPerso_, checkNacelle_, now_, newId, money_ } from './logic.js';

let app, auth, db, CFG;
let me = '', meEmail = '', meAcc = null;
const unsub = [];

export function init(cfg) {
  CFG = cfg;
  app = initializeApp(cfg.firebase);
  auth = A.getAuth(app);
  A.setPersistence(auth, A.browserLocalPersistence).catch(() => {});
  try {
    db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch (e) { db = F.getFirestore(app); } // navigation privée : pas de copie locale
}

/* ---------- Connexion ---------- */

const MSG = {
  'auth/invalid-email': 'Adresse e-mail invalide',
  'auth/invalid-credential': 'E-mail ou mot de passe incorrect',
  'auth/wrong-password': 'E-mail ou mot de passe incorrect',
  'auth/user-not-found': 'Aucun compte avec cette adresse : utilise « Première connexion »',
  'auth/email-already-in-use': 'Un compte existe déjà avec cette adresse : connecte-toi (ou « Mot de passe oublié »)',
  'auth/weak-password': 'Mot de passe trop court (6 caractères minimum)',
  'auth/too-many-requests': 'Trop d\'essais : patiente quelques minutes',
  'auth/network-request-failed': 'Pas de connexion internet',
  'permission-denied': 'Accès refusé (ton compte n\'a pas les droits pour cette action)',
  'unavailable': 'Serveur injoignable (pas de connexion ?)'
};
export const errMsg = e => MSG[e && e.code] || (e && e.message) || String(e);
const wrap = p => p.catch(e => { throw new Error(errMsg(e)); });

export const login = (email, pw) => wrap(A.signInWithEmailAndPassword(auth, email.trim(), pw));
export async function signup(email, pw) {
  const c = await wrap(A.createUserWithEmailAndPassword(auth, email.trim(), pw));
  await wrap(A.sendEmailVerification(c.user, { url: location.href.split('#')[0] }));
}
export const resetPw = email => wrap(A.sendPasswordResetEmail(auth, email.trim(), { url: location.href.split('#')[0] }));
export const resendVerif = () => wrap(A.sendEmailVerification(auth.currentUser, { url: location.href.split('#')[0] }));
export async function logout() { stop(); me = ''; meAcc = null; await A.signOut(auth); }
export const whoami = () => ({ nom: me, email: meEmail, role: meAcc ? meAcc.role : '' });

/* cb({etat, email, nom, role})
 * etat : 'deconnecte' | 'non-verifie' | 'sans-acces' | 'ok' */
export function onAuth(cb) {
  let accUnsub = null;
  A.onAuthStateChanged(auth, async u => {
    if (accUnsub) { accUnsub(); accUnsub = null; }
    if (!u) { meEmail = ''; me = ''; meAcc = null; return cb({ etat: 'deconnecte' }); }
    meEmail = String(u.email || '').toLowerCase();
    if (!u.emailVerified) {
      await u.reload().catch(() => {});
      if (!auth.currentUser.emailVerified) return cb({ etat: 'non-verifie', email: meEmail });
      await u.getIdToken(true).catch(() => {}); // le jeton doit porter « e-mail vérifié »
    }
    accUnsub = F.onSnapshot(F.doc(db, 'Acces', meEmail), s => {
      const a = s.exists() ? s.data() : null;
      const ok = a && a.actif !== 'non';
      const chg = !!ok !== !!(meAcc && meAcc.actif !== 'non') || (a && a.nom) !== me;
      meAcc = a; me = ok ? a.nom : '';
      if (ok) { if (chg) cb({ etat: 'ok', email: meEmail, nom: me, role: a.role }); }
      else cb({ etat: 'sans-acces', email: meEmail });
    }, e => cb({ etat: 'sans-acces', email: meEmail, err: errMsg(e) }));
  });
}

/* ---------- Données en direct ---------- */

export function stop() { while (unsub.length) { try { unsub.pop()(); } catch (e) {} } }

// D : objet des listes de l'appli · onChange(premierChargementTerminé) · onErr(message)
export function start(D, onChange, onErr) {
  stop();
  const parts = {}; let pending = 0, done = false;
  const merge = (name) => {
    const L = []; Object.keys(parts).filter(k => k.split('|')[0] === name).forEach(k => L.push(...parts[k]));
    D[name] = L;
  };
  const sub = (name, q) => {
    const key = name + '|' + (pending++);
    let first = true;
    unsub.push(F.onSnapshot(q, { includeMetadataChanges: false }, s => {
      parts[key] = s.docs.map(d => Object.assign({}, d.data(), { id: d.id }));
      merge(name);
      if (first) { first = false; pending--; }
      if (!done && pending === 0) done = true;
      if (done) onChange(true, s.metadata.fromCache);
    }, e => { if (first) { first = false; pending--; } onErr(errMsg(e)); if (!done && pending === 0) { done = true; onChange(true, true); } }));
  };
  Object.keys(SCHEMA).forEach(name => {
    const c = F.collection(db, name);
    if (name === 'Taches') {
      sub(name, F.query(c, F.where('prive', '==', 'non')));
      sub(name, F.query(c, F.where('prive', '==', 'oui'), F.where('creePar', '==', me)));
    } else if (name === 'Commentaires') {
      sub(name, F.query(c, F.where('prive', '==', 'non')));
      sub(name, F.query(c, F.where('prive', '==', 'oui'), F.where('proprio', '==', me)));
    } else sub(name, c);
  });
}

/* ---------- Écritures ---------- */

let D_ = null;               // listes actuelles (pour les contrôles de doublons)
export const bind = D => { D_ = D; };
let onBgErr = () => {};
export const onBackgroundError = f => { onBgErr = f; };

const ref = (name, id) => F.doc(db, name, id);
const bg = p => p.catch(e => onBgErr(errMsg(e)));

function journal(action, name, id, detail) {
  bg(F.addDoc(F.collection(db, 'Journal'), { date: now_(), auteur: me, action, feuille: name, id: String(id || ''), detail: String(detail || '').slice(0, 200) }));
}

async function notifier(o, nouveaux) {
  if (!nouveaux.length || !CFG.apiUrl) return;
  try {
    const idToken = await auth.currentUser.getIdToken();
    await fetch(CFG.apiUrl, { method: 'POST', body: JSON.stringify({ action: 'notify', idToken, id: o.id, nouveaux, appUrl: location.href.split('#')[0] }) });
  } catch (e) { /* le mail n'est pas indispensable */ }
}

async function save(name, item, opts = {}) {
  const L = (D_ && D_[name]) || [];
  const cur = item.id ? L.find(x => x.id === String(item.id)) || null : null;
  const o = prepare(name, item, me, cur, L, Object.assign({ taches: D_ && D_.Taches }, opts));

  if (name === 'Nacelle') { await saveNacelle(o); journal(cur ? 'modification' : 'ajout', name, o.id, summary_(name, o)); return o; }

  if (name === 'Equipe') {
    const b = F.writeBatch(db);
    b.set(ref('Equipe', o.id), o);
    if (cur && cur.email && cur.email !== o.email) b.delete(ref('Acces', cur.email));
    if (o.email) b.set(ref('Acces', o.email), { nom: o.nom, role: o.role, actif: o.actif, equipeId: o.id });
    await wrap(b.commit()); // les droits d'accès : on attend la confirmation du serveur
  } else {
    const w = F.setDoc(ref(name, o.id), o);
    if (name === 'Taches') {
      const nv = nouveauxAttribues(o, cur, me);
      bg(w.then(() => notifier(o, nv)));
    } else bg(w);
  }
  journal(cur ? 'modification' : 'ajout', name, o.id, summary_(name, o));
  return o;
}

// La nacelle : contrôle des chevauchements fait au moment de l'écriture, sur les données du serveur
async function saveNacelle(o) {
  if (!navigator.onLine) throw new Error('Connexion internet nécessaire pour réserver la nacelle');
  const lock = ref('Verrous', 'nacelle');
  await wrap(F.runTransaction(db, async tx => {
    const lk = await tx.get(lock);
    const s = await F.getDocsFromServer(F.collection(db, 'Nacelle'));
    checkNacelle_(o, s.docs.map(d => Object.assign({}, d.data(), { id: d.id })));
    tx.set(lock, { v: (lk.exists() ? Number(lk.data().v) || 0 : 0) + 1, par: me, le: now_() });
    tx.set(ref('Nacelle', o.id), o);
  }));
}

async function remove(name, id) {
  const L = (D_ && D_[name]) || [];
  const cur = L.find(x => x.id === String(id));
  if (!cur) throw new Error('Élément introuvable (déjà supprimé ?)');
  if (name === 'Equipe') throw new Error('Pour retirer quelqu\'un, utilise « Retirer »');
  const b = F.writeBatch(db);
  b.delete(ref(name, cur.id));
  const child = { Taches: ['Commentaires', 'tacheId'], BudgetLignes: ['BudgetMvts', 'ligneId'] }[name];
  if (child) (D_[child[0]] || []).filter(c => c[child[1]] === cur.id).forEach(c => b.delete(ref(child[0], c.id)));
  bg(b.commit());
  journal('suppression', name, cur.id, summary_(name, cur));
  return { id: cur.id };
}

// Mise à jour qui part de la version du serveur (deux personnes peuvent cocher en même temps)
async function txUpdate(name, id, fn) {
  const r = ref(name, String(id));
  if (navigator.onLine) {
    try {
      return await F.runTransaction(db, async tx => {
        const s = await tx.get(r);
        if (!s.exists()) throw new Error('Élément introuvable (supprimé ?)');
        const n = fn(Object.assign({}, s.data(), { id: s.id }));
        tx.set(r, n); return n;
      });
    } catch (e) { if (e.code !== 'unavailable') throw new Error(errMsg(e)); }
  }
  const cur = ((D_ && D_[name]) || []).find(x => x.id === String(id));
  if (!cur) throw new Error('Élément introuvable (supprimé ?)');
  const n = fn(Object.assign({}, cur)); bg(F.setDoc(r, n)); return n;
}

async function partFaite(id, fait) {
  if (!me) throw new Error('Connexion nécessaire');
  const n = await txUpdate('Taches', id, cur => {
    if (estPerso_(cur) && cur.creePar !== me) throw new Error('Tâche introuvable (supprimée ?)');
    if (list_(cur.assigne).indexOf(me) < 0) throw new Error(me + " n'est pas attribué à cette tâche");
    const f = list_(cur.faitPar).filter(x => x !== me); if (fait) f.push(me);
    return prepare('Taches', Object.assign({}, cur, { faitPar: f.join(', ') }), me, cur, [], { part: true });
  });
  journal('modification', 'Taches', n.id, summary_('Taches', n));
  return n;
}

async function memoLu(id, lu) {
  if (!me) throw new Error('Connexion nécessaire');
  return txUpdate('Memos', id, cur => {
    const l = list_(cur.luPar).filter(x => x !== me); if (lu) l.push(me);
    return Object.assign({}, cur, { luPar: l.join(', ') });
  });
}

async function bulk(name, items) {
  for (let i = 0; i < items.length; i += 400) {
    const b = F.writeBatch(db);
    items.slice(i, i + 400).forEach(o => b.set(ref(name, o.id), o));
    await wrap(b.commit());
  }
}
const fill = (name, x) => { const o = {}; SCHEMA[name].forEach(k => { o[k] = x[k] === undefined || x[k] === null ? '' : String(x[k]); }); return o; };

async function importDrapeaux(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('Inventaire vide');
  if ((D_.Drapeaux || []).length) throw new Error("L'inventaire contient déjà des drapeaux : reprise refusée");
  const L = items.map((x, i) => { if (!x.nom || !x.format) throw new Error('Ligne ' + (i + 1) + ' : nom ou format manquant');
    return prepare('Drapeaux', Object.assign({}, x, { ordre: String(i + 1) }), me, null, [], {}); });
  await bulk('Drapeaux', L); journal('reprise', 'Drapeaux', '', L.length + ' lignes');
  return { lignes: L.length };
}

async function importBudget(data) {
  if (!data || !data.lignes) throw new Error('Données de reprise manquantes');
  if ((D_.BudgetLignes || []).length) throw new Error('Le budget contient déjà des lignes : reprise refusée');
  const L = [], M = [], now = now_(), id = () => newId();
  data.lignes.forEach(l => {
    const o = fill('BudgetLignes', { id: id(), type: l.type, famille: l.famille, code: l.code, prestataire: l.prestataire, intitule: l.intitule,
      budget: l.budget === '' || l.budget === undefined ? '' : money_(l.budget, 'Budget'), bc: l.bc || '', horsTotal: l.horsTotal || '',
      note: l.note || '', ordre: String(l.ordre || ''), majPar: me });
    L.push(o);
    (l.mvts || []).forEach(m => M.push(fill('BudgetMvts', { id: id(), ligneId: o.id, date: m.date, nature: m.nature, numero: m.numero || '',
      montant: money_(m.montant, 'Montant'), libelle: m.libelle || '', creeLe: now, majPar: me })));
  });
  await bulk('BudgetLignes', L); await bulk('BudgetMvts', M);
  if (data.inventaire && !(D_.Inventaire || []).length) await bulk('Inventaire', data.inventaire.map(x => fill('Inventaire', Object.assign({ majPar: me }, x, { id: id() }))));
  if (data.sap && !(D_.SAP || []).length) await bulk('SAP', data.sap.map(x => fill('SAP', Object.assign({ majPar: me }, x, { id: id() }))));
  journal('reprise', 'Budget', '', L.length + ' lignes, ' + M.length + ' mouvements');
  return { lignes: L.length, mvts: M.length };
}

// Même interface que l'ancien api(action, p) de l'appli
export async function api(action, p = {}) {
  switch (action) {
    case 'save': return save(p.sheet, p.item);
    case 'delete': return remove(p.sheet, p.id);
    case 'partFaite': return partFaite(p.id, p.fait);
    case 'lu': return memoLu(p.id, p.lu);
    case 'importDrapeaux': return importDrapeaux(p.items);
    case 'importBudget': return importBudget(p.data);
    default: throw new Error('Action inconnue : ' + action);
  }
}

/* ---------- Reprise des données du Google Sheet (une seule fois, par le propriétaire) ---------- */

async function oldCall(user) {
  const r = await fetch(CFG.apiUrl, { method: 'POST', body: JSON.stringify({ action: 'all', user }) });
  if (!r.ok) throw new Error('Ancien serveur injoignable (' + r.status + ')');
  const j = await r.json(); if (!j.ok) throw new Error(j.error || 'Erreur de l\'ancien serveur'); return j.data;
}

// 1re étape : liste des membres du Sheet (pour que le propriétaire choisisse son nom)
export async function repriseMembres() { const d = await oldCall(''); return (d.Equipe || []).filter(e => e.actif !== 'non'); }

// true / false pour le propriétaire ; null si on n'a pas le droit de lire (pas propriétaire, accès pas encore ouvert)
export async function dejaRepris() {
  try {
    const s = await F.getDocsFromServer(F.query(F.collection(db, 'Equipe'), F.limit(1)));
    return !s.empty;
  } catch (e) { if (e.code === 'permission-denied') return null; throw new Error(errMsg(e)); }
}

export async function reprise(ownerNom, progress = () => {}) {
  if (await dejaRepris()) throw new Error('Les données ont déjà été reprises');
  progress('Lecture du Google Sheet…');
  const all = await oldCall(ownerNom);
  const noms = (all.Equipe || []).map(e => e.nom).filter(Boolean);
  const perso = {};
  for (let i = 0; i < noms.length; i += 4) {
    progress(`Tâches perso : ${Math.min(i + 4, noms.length)}/${noms.length} personnes…`);
    const r = await Promise.all(noms.slice(i, i + 4).map(n => oldCall(n).then(d => [n, d])));
    r.forEach(([n, d]) => { perso[n] = d; });
  }
  const data = normaliserReprise(all, perso);
  const moi = data.Equipe.find(e => e.nom === ownerNom);
  if (!moi) throw new Error('Nom introuvable dans l\'équipe : ' + ownerNom);
  data.Equipe.filter(e => e.email === meEmail && e !== moi).forEach(e => { e.email = ''; });
  moi.email = meEmail; moi.actif = 'oui'; if (!moi.role) moi.role = 'Responsable';

  progress('Création des accès…');
  const b = F.writeBatch(db);
  data.Equipe.forEach(e => { b.set(ref('Equipe', e.id), e); if (e.email) b.set(ref('Acces', e.email), { nom: e.nom, role: e.role, actif: e.actif, equipeId: e.id }); });
  await wrap(b.commit());

  const noms2 = Object.keys(SCHEMA).filter(k => k !== 'Equipe');
  let n = 0;
  for (const k of noms2) {
    progress(`Copie : ${k} (${data[k].length})…`);
    await bulk(k, data[k]); n += data[k].length;
  }
  bg(F.addDoc(F.collection(db, 'Journal'), { date: now_(), auteur: ownerNom, action: 'reprise', feuille: 'Tout', id: '', detail: 'Reprise du Google Sheet : ' + n + ' éléments' }));
  return { elements: n, membres: data.Equipe.length, sansEmail: data.Equipe.filter(e => !e.email && e.actif !== 'non').map(e => e.nom) };
}
