/* Fonction Firebase « veille-surete » – appli Équipe (Eurexpo)
 * Sert la tâche planifiée de veille sûreté (mardi et jeudi), et rien d'autre :
 *  - GET  : liste minimale des salons J-7 → J+60 (nom, halls, montage, démontage, EDL, ouverture si connue),
 *           zones de travaux (sans entreprise ni montant) et titres des bulletins déjà en cours (pour éviter les doublons).
 *  - POST : dépose des bulletins « Veille sûreté » dans l'onglet 🛡️ de l'appli (collection Memos), signés « Veille automatique ».
 * Accès : en-tête « Authorization: Bearer <code> ». Seule l'empreinte SHA-256 du code est connue de la fonction (variable VEILLE_HASH).
 * Jamais renvoyé : noms de personnes, e-mails, notes, tâches, budget, clefs, documents.
 */
const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');
const crypto = require('crypto');
admin.initializeApp();
const db = admin.firestore();

const AUTEUR = 'Veille automatique';
const TYPE = 'Veille sûreté';
const NIVEAUX = ['Info', 'Important', 'Critique'];
const MAX_PAR_APPEL = 10;
const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;

const d10 = v => (typeof v === 'string' && RE_DATE.test(v.slice(0, 10)) ? v.slice(0, 10) : '');
const cle = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const halls_ = v => String(v || '').split(/[,;/+]|\set\s/).map(h => h.trim()).filter(Boolean);
const min = (a, b) => (!a ? b : !b ? a : a < b ? a : b);
const max = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);
const paris = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return { jour: `${p.year}-${p.month}-${p.day}`, maintenant: `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` };
};

function autorise(req) {
  const h = process.env.VEILLE_HASH || '';
  const m = /^Bearer\s+(\S+)$/.exec(req.get('authorization') || '');
  if (!h || !m) return false;
  const a = crypto.createHash('sha256').update(m[1], 'utf8').digest();
  const b = Buffer.from(h, 'hex');
  return b.length === a.length && crypto.timingSafeEqual(a, b);
}

const lire = async name => (await db.collection(name).get()).docs.map(d => ({ ...d.data(), id: d.id }));

// Mêmes règles que l'onglet 🛡️ de l'appli et que scripts/export-veille/build.mjs
function salons(D, today) {
  const from = addDays(today, -7), to = addDays(today, 60), S = new Map();
  const get = nom => { const k = cle(nom); if (!k) return null;
    if (!S.has(k)) S.set(k, { nom: String(nom).trim(), halls: new Set(), dm: '', fd: '', pd: '', pf: '', edl: [] }); return S.get(k); };
  D.EDL.forEach(x => { if (x.statut === 'Annulé') return; const s = get(x.salon), dt = d10(x.date); if (!s || !dt) return;
    halls_(x.halls).forEach(h => s.halls.add(h));
    const type = ['Entrée', 'Sortie', 'Intermédiaire'].includes(x.type) ? x.type : 'Intermédiaire';
    s.edl.push({ type, date: dt, confirme: x.confirmation === 'Confirmé' });
    if (type === 'Entrée') s.dm = min(s.dm, dt); if (type === 'Sortie') s.fd = max(s.fd, dt); });
  D.Regisseurs.forEach(x => { if (x.statut === 'Annulé') return; const s = get(x.salon), a = d10(x.dateDebut), b = d10(x.dateFin) || a; if (!s || !a) return;
    s.pd = min(s.pd, a); s.pf = max(s.pf, b); });
  D.Cloisons.forEach(x => { if (x.statut === 'Annulé') return; const s = get(x.salon), a = d10(x.date), b = d10(x.dateFin) || a; if (!s || !a) return;
    halls_(x.hall).forEach(h => s.halls.add(h)); s.pd = min(s.pd, a); s.pf = max(s.pf, b); });
  return [...S.values()].map(s => {
    const debut = s.dm || s.pd, fin = s.fd || s.pf || debut;
    return { nom: s.nom, halls: [...s.halls].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })), debutMontage: debut, finDemontage: fin,
      precision: s.dm && s.fd ? 'EDL entrée et sortie' : 'estimée (régisseurs / cloisons)', etatsDesLieux: s.edl.sort((a, b) => a.date.localeCompare(b.date)) };
  }).filter(s => s.debutMontage && s.finDemontage >= from && s.debutMontage <= to)
    .sort((a, b) => a.debutMontage.localeCompare(b.debutMontage) || a.nom.localeCompare(b.nom, 'fr'));
}

async function lecture(res) {
  const { jour } = paris();
  const D = {};
  for (const n of ['EDL', 'Regisseurs', 'Cloisons', 'Chantiers', 'Memos']) D[n] = await lire(n);
  const from = addDays(jour, -7), to = addDays(jour, 60);
  const travaux = D.Chantiers.filter(c => !['Annulé', 'Terminé'].includes(c.statut))
    .map(c => ({ zone: [c.espace, c.zone].filter(Boolean).join(' · '), type: c.type || '', debut: d10(c.dateDebut), fin: d10(c.dateFin) || d10(c.dateDebut) }))
    .filter(c => c.debut && c.fin >= from && c.debut <= to).sort((a, b) => a.debut.localeCompare(b.debut));
  const enCours = D.Memos.filter(m => m.type === TYPE && m.statut !== 'Archivé' && !(m.jusquau && m.jusquau < jour))
    .map(m => ({ titre: m.titre || '', niveau: m.niveau || '', salon: m.salon || '', date: m.dateBulletin || '', jusquau: m.jusquau || '' }));
  res.json({ ok: true, source: 'Équipe Bâtiment Eurexpo – veille sûreté', genereLe: new Date().toISOString(), aujourdhui: jour,
    fenetre: { du: from, au: to }, note: "Dates internes de montage / démontage (EDL d'entrée et de sortie). Ouverture au public : agenda GL events Lyon.",
    salons: salons(D, jour), travaux, bulletinsEnCours: enCours });
}

async function depot(req, res) {
  const L = req.body && Array.isArray(req.body.bulletins) ? req.body.bulletins : null;
  if (!L) return res.status(400).json({ ok: false, error: 'Corps attendu : {"bulletins":[...]}' });
  if (L.length > MAX_PAR_APPEL) return res.status(400).json({ ok: false, error: `${MAX_PAR_APPEL} bulletins au plus par appel` });
  const { jour, maintenant } = paris();
  const deja = new Set((await db.collection('Memos').where('type', '==', TYPE).get()).docs.map(d => d.data())
    .filter(m => m.statut !== 'Archivé' && !(m.jusquau && m.jusquau < jour)).map(m => cle(m.titre) + '|' + cle(m.salon)));
  const crees = [], ignores = [];
  const batch = db.batch();
  for (const b of L) {
    const titre = txt(b && b.titre, 200);
    if (!titre) { ignores.push({ titre: '', raison: 'titre manquant' }); continue; }
    const salon = txt(b.salon, 300), k = cle(titre) + '|' + cle(salon);
    if (deja.has(k)) { ignores.push({ titre, raison: 'déjà en cours' }); continue; }
    deja.add(k);
    let jusquau = txt(b.jusquau, 10);
    if (!RE_DATE.test(jusquau) || jusquau < jour) jusquau = addDays(jour, 7);
    if (jusquau > addDays(jour, 90)) jusquau = addDays(jour, 90);
    const id = crypto.randomBytes(5).toString('hex');
    const o = { id, type: TYPE, titre, niveau: NIVEAUX.includes(b.niveau) ? b.niveau : 'Info', texte: txt(b.texte, 8000), decisions: '',
      lieu: txt(b.lieu, 200), jusquau, epingle: '', statut: 'Actif', dateReunion: '', participants: '', salon, source: txt(b.source, 300),
      dateBulletin: jour, luPar: '', creePar: AUTEUR, creeLe: maintenant, majLe: maintenant, majPar: AUTEUR };
    batch.set(db.collection('Memos').doc(id), o);
    batch.set(db.collection('Journal').doc(), { date: maintenant, auteur: AUTEUR, action: 'save', feuille: 'Memos', id, detail: (TYPE + ' · ' + titre + ' · ' + o.niveau).slice(0, 200) });
    crees.push({ id, titre, niveau: o.niveau, salon });
  }
  if (crees.length) await batch.commit();
  res.json({ ok: true, crees, ignores });
}

functions.http('veille', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    if (!autorise(req)) return res.status(401).json({ ok: false, error: 'Code d\'accès absent ou incorrect' });
    if (req.method === 'GET') return await lecture(res);
    if (req.method === 'POST') return await depot(req, res);
    res.status(405).json({ ok: false, error: 'GET ou POST uniquement' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Erreur interne' });
  }
});
