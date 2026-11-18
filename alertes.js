/* Appli Équipe – Eurexpo · tableau de bord des alertes (page d'accueil, au-dessus du Mémo vigilance)
 * Calculs seuls, sans écran ni Firebase : utilisés par la page (index.html) et par les tests (Node).
 *
 * Une alerte : { id, dom, niv, cat, titre, detail, val, go }
 *   dom : 'energie' | 'eau' | 'budget' | 'surete' | 'exploit'
 *   niv : 3 = critique · 2 = à surveiller · 1 = information
 *   go  : où ouvrir dans l'appli, ex. ['tab','Conso'], ['budget',idLigne], ['memo',id], ['sv',id], ['tache',id]…
 */

export const DOMAINES = [
  { id: 'energie', l: 'Énergie', i: '⚡' },
  { id: 'eau', l: 'Eau', i: '💧' },
  { id: 'budget', l: 'Budget', i: '💶' },
  { id: 'surete', l: 'Sûreté', i: '🛡️' },
  { id: 'exploit', l: 'Exploitation', i: '🛠️' }];
export const NIVEAUX = { 3: 'Critique', 2: 'À surveiller', 1: 'Info' };

/* Seuils réglables (⚙️ Réglages du tableau de bord) : k = clé, d = valeur par défaut, u = unité, g = groupe */
export const SEUILS = [
  { k: 'consoEcartPrev', d: 15, u: '%', g: 'energie', l: 'Salon : consommation CVC + gaz au-dessus de la prévision de plus de' },
  { k: 'consoEcartEdition', d: 15, u: '%', g: 'energie', l: 'Salon : consommation au-dessus de l\'édition précédente de plus de' },
  { k: 'consoJours', d: 45, u: 'jours', g: 'energie', l: 'Salons regardés : en cours ou terminés depuis moins de' },
  { k: 'consoIndexJours', d: 3, u: 'jours', g: 'energie', l: 'Index d\'un salon toujours incomplets après la fin du salon, au bout de' },
  { k: 'pvJours', d: 7, u: 'jours', g: 'energie', l: 'PV hall 4.3 : production nulle ou absente regardée sur les derniers' },
  { k: 'cptJourMois', d: 10, u: 'du mois', g: 'eau', l: 'Relevés mensuels de compteurs manquants signalés à partir du' },
  { k: 'budgetPct', d: 90, u: '%', g: 'budget', l: 'Ligne ou enveloppe budgétaire consommée à plus de' },
  { k: 'budgetFinEx', d: 45, u: 'jours', g: 'budget', l: 'Rappel du reste à engager avant la fin d\'exercice, à partir de' },
  { k: 'memoJours', d: 2, u: 'jours', g: 'surete', l: 'Point critique ou important pas encore lu par toute l\'équipe au bout de' },
  { k: 'ticketMin', d: 30, u: 'min', g: 'exploit', l: 'Ticket pas pris en charge par l\'entreprise au bout de' },
  { k: 'ticketUrgMin', d: 10, u: 'min', g: 'exploit', l: 'Ticket urgent pas pris en charge au bout de' },
  { k: 'demandeJours', d: 3, u: 'jours', g: 'exploit', l: 'Demande de travaux « Nouvelle » sans suite au bout de' },
  { k: 'demandeImpJours', d: 7, u: 'jours', g: 'exploit', l: 'Demande avec date impérative dans moins de' },
  { k: 'pavJours', d: 14, u: 'jours', g: 'exploit', l: 'Pavoisement avec drapeaux manquants dans moins de' },
  { k: 'cacheMin', d: 30, u: 'min', g: 'general', l: 'Données des autres applis (conso, compteurs, tickets…) relues au plus toutes les' }];

export function seuils(regl) {
  const o = {}, s = (regl && regl.seuils) || {};
  SEUILS.forEach(x => { const v = Number(s[x.k]); o[x.k] = s[x.k] !== '' && s[x.k] != null && isFinite(v) && v >= 0 ? v : x.d; });
  return o;
}

/* ---------- utilitaires ---------- */
const num = v => { if (v == null || v === '') return 0; const n = parseFloat(String(v).replace(/[\s  €]/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
const liste = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
const jour = iso => { const p = String(iso).slice(0, 10).split('-'); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000); };
const estJour = d => /^\d{4}-\d{2}-\d{2}/.test(d || '');
const ecartJ = (a, b) => jour(a) - jour(b); // a − b en jours
const plus = (iso, n) => new Date((jour(iso) + n) * 86400000).toISOString().slice(0, 10);
const fr = (n, d = 0) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const eur = n => fr(Math.round(n)) + ' €';
const pct = p => (p > 0 ? '+' : '') + fr(p * 100) + ' %';
const dFr = iso => { const p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] : String(iso || ''); };
const court = (s, n = 110) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const pl = (n, mot, plur) => n + ' ' + (n > 1 ? (plur || mot + 's') : mot);
const duree = min => min < 90 ? Math.round(min) + ' min' : min < 2880 ? fr(min / 60, min < 600 ? 1 : 0) + ' h' : Math.round(min / 1440) + ' j';

/* ================== BUDGET (données de l'appli Équipe) ================== */
function budgetLigne(l, mvts) {
  let bdc = 0, fac = 0;
  mvts.forEach(m => { if (m.ligneId !== l.id) return; const v = num(m.montant) * (m.nature === 'Avoir' ? -1 : 1); if (m.nature === 'BDC') bdc += v; else fac += v; });
  const bud = num(l.budget), eng = bdc + fac;
  return { bud, eng, rest: bud - eng, pct: bud ? eng / bud : (eng ? Infinity : 0) };
}
const TYPES = { Entretien: 'Entretien (BA24)', Contrat: 'Contrats (BA25)' };

export function alertesBudget(D, S, auj, moi) {
  const A = [], lignes = D.BudgetLignes || [], mvts = D.BudgetMvts || [], seuil = S.budgetPct / 100;
  Object.keys(TYPES).forEach(type => {
    const L = lignes.filter(l => l.type === type && l.horsTotal !== 'oui');
    const tot = { bud: 0, eng: 0 };
    L.forEach(l => {
      const c = budgetLigne(l, mvts); tot.bud += c.bud; tot.eng += c.eng;
      if (c.bud === 0 && c.eng === 0) return;
      const nom = [l.code, l.intitule].filter(Boolean).join(' · '), qui = l.prestataire ? ' (' + l.prestataire + ')' : '';
      if (c.rest < -0.005) A.push({ id: 'bl-' + l.id + '-hors', dom: 'budget', niv: 3, cat: TYPES[type], titre: 'Ligne hors budget : ' + nom,
        detail: 'Engagé ' + eur(c.eng) + ' pour ' + eur(c.bud) + ' de budget' + qui + '.', val: 'dépassement ' + eur(-c.rest), go: ['budget', l.id], tri: -c.rest });
      else if (c.bud > 0 && c.pct >= seuil) A.push({ id: 'bl-' + l.id + '-pct', dom: 'budget', niv: 2, cat: TYPES[type], titre: 'Ligne presque épuisée : ' + nom,
        detail: 'Engagé ' + eur(c.eng) + ' sur ' + eur(c.bud) + qui + '.', val: 'reste ' + eur(c.rest), go: ['budget', l.id], tri: c.pct });
    });
    if (!tot.bud) return;
    const p = tot.eng / tot.bud, rest = tot.bud - tot.eng;
    if (rest < -0.005) A.push({ id: 'bt-' + type + '-hors', dom: 'budget', niv: 3, cat: TYPES[type], titre: 'Enveloppe ' + TYPES[type] + ' dépassée',
      detail: 'Engagé ' + eur(tot.eng) + ' pour ' + eur(tot.bud) + ' de budget.', val: 'dépassement ' + eur(-rest), go: ['budgetTab', type], tri: 1e12 });
    else if (p >= seuil) A.push({ id: 'bt-' + type + '-pct', dom: 'budget', niv: 2, cat: TYPES[type], titre: 'Enveloppe ' + TYPES[type] + ' consommée à ' + fr(p * 100) + ' %',
      detail: 'Engagé ' + eur(tot.eng) + ' sur ' + eur(tot.bud) + '.', val: 'reste ' + eur(rest), go: ['budgetTab', type], tri: 1e11 });
    // Fin d'exercice : ce qui reste à engager, pour décider des priorités
    const fin = auj.slice(0, 4) + '-12-31', j = ecartJ(fin, auj);
    if (j >= 0 && j <= S.budgetFinEx && rest > 0.005) A.push({ id: 'bt-' + type + '-fin-' + auj.slice(0, 4), dom: 'budget', niv: 1, cat: TYPES[type],
      titre: 'Fin d\'exercice dans ' + pl(j, 'jour') + ' : ' + eur(rest) + ' à engager',
      detail: TYPES[type] + ' : ' + fr(p * 100) + ' % du budget engagé à ce jour.', val: 'reste ' + eur(rest), go: ['budgetTab', type], tri: rest });
  });
  // Mes projets (suivi financier) et ceux partagés avec moi
  (D.Projets || []).forEach(p => {
    if (['Clôturé', 'Annulé'].includes(p.statut) || ![p.proprio, ...liste(p.partage)].includes(moi)) return;
    let bdc = 0, fac = 0;
    (D.ProjetMvts || []).forEach(m => { if (m.projetId !== p.id) return; const v = num(m.montant);
      if (m.nature === 'BDC') bdc += v; else if (m.nature === 'Facture') fac += v; else if (m.nature === 'Avoir') fac -= v; });
    const bud = num(p.budget), eng = Math.max(bdc, fac);
    if (p.budget !== '' && bud > 0 && eng > bud + 0.005) A.push({ id: 'pj-' + p.id + '-hors', dom: 'budget', niv: 3, cat: 'Projet', titre: 'Projet au-dessus de son budget : ' + p.titre,
      detail: 'BDC ' + eur(bdc) + ', factures ' + eur(fac) + ' pour ' + eur(bud) + ' de budget.', val: 'dépassement ' + eur(eng - bud), go: ['projet', p.id], tri: eng - bud });
    else if (p.budget !== '' && bud > 0 && bdc / bud >= seuil) A.push({ id: 'pj-' + p.id + '-pct', dom: 'budget', niv: 2, cat: 'Projet', titre: 'Projet presque au bout de son budget : ' + p.titre,
      detail: 'BDC ' + eur(bdc) + ' sur ' + eur(bud) + '.', val: 'reste ' + eur(bud - bdc), go: ['projet', p.id], tri: bdc / bud });
    if (fac > bdc + 0.005) A.push({ id: 'pj-' + p.id + '-fac', dom: 'budget', niv: 2, cat: 'Projet', titre: 'Projet facturé au-delà des BDC : ' + p.titre,
      detail: 'Factures ' + eur(fac) + ' pour ' + eur(bdc) + ' de BDC.', val: 'écart ' + eur(fac - bdc), go: ['projet', p.id], tri: fac - bdc });
  });
  return A;
}

/* ================== SÛRETÉ & VIGILANCE (Mémos de l'appli Équipe) ================== */
const SV = 'Veille sûreté';
const memoActif = (m, auj) => m.statut !== 'Archivé' && !(m.jusquau && m.jusquau < auj);
const svDebut = m => m.dateDebut || m.dateBulletin || String(m.creeLe || '').slice(0, 10);

export function alertesSurete(D, S, auj, moi) {
  const A = [], equipe = (D.Equipe || []).filter(e => e.actif !== 'non').map(e => e.nom);
  (D.Memos || []).forEach(m => {
    if (!memoActif(m, auj) || !['Critique', 'Important'].includes(m.niveau)) return;
    const sv = m.type === SV; if (!sv && m.type !== 'Vigilance') return;
    if (sv && svDebut(m) > auj) return; // risque pas encore commencé
    const lus = liste(m.luPar), pasLus = equipe.filter(n => !lus.includes(n)), crit = m.niveau === 'Critique';
    const ou = [m.salon && 'Salon : ' + m.salon, m.lieu, m.jusquau && 'jusqu\'au ' + dFr(m.jusquau)].filter(Boolean).join(' · ');
    A.push({ id: 'mm-' + m.id, dom: 'surete', niv: crit ? 3 : 2, cat: sv ? 'Veille sûreté' : 'Vigilance', titre: m.titre || (sv ? 'Bulletin de veille' : 'Point de vigilance'),
      detail: court([ou, m.texte].filter(Boolean).join(' — '), 170), val: lus.includes(moi) ? '' : 'pas encore lu par toi', go: [sv ? 'sv' : 'memo', m.id], tri: m.creeLe || '' });
    const age = estJour(m.majLe || m.creeLe) ? ecartJ(auj, String(m.majLe || m.creeLe).slice(0, 10)) : 0;
    if (pasLus.length && equipe.length && age >= S.memoJours) A.push({ id: 'ml-' + m.id + '-' + pasLus.length, dom: 'surete', niv: crit ? 2 : 1, cat: 'Lecture équipe',
      titre: pl(pasLus.length, 'personne') + ' n\'' + (pasLus.length > 1 ? 'ont' : 'a') + ' pas lu : ' + (m.titre || ''),
      detail: 'Pas encore lu par ' + court(pasLus.join(', '), 140) + '.', val: lus.filter(n => equipe.includes(n)).length + '/' + equipe.length + ' lu', go: [sv ? 'sv' : 'memo', m.id], tri: pasLus.length });
  });
  return A;
}

/* ================== EXPLOITATION (tâches, chantiers, pavoisements de l'appli Équipe) ================== */
export function alertesExploitInternes(D, S, auj, manquesPav) {
  const A = [];
  const T = (D.Taches || []).filter(t => t.prive !== 'oui' && t.statut !== 'Terminé' && estJour(t.echeance) && t.echeance < auj);
  T.forEach(t => { const j = ecartJ(auj, t.echeance), urg = t.priorite === 'Urgente' || t.priorite === 'Haute';
    A.push({ id: 'ta-' + t.id, dom: 'exploit', niv: urg || j > 14 ? 3 : 2, cat: 'Tâche', titre: 'Tâche en retard : ' + t.titre,
      detail: [t.assigne ? 'Attribuée à ' + t.assigne : 'Attribuée à personne', t.lieu, 'échéance ' + dFr(t.echeance)].filter(Boolean).join(' · '), val: pl(j, 'jour') + ' de retard', go: ['tache', t.id], tri: j }); });
  (D.Chantiers || []).forEach(c => {
    const fin = c.dateFin || c.dateDebut; if (!estJour(fin) || fin >= auj || !['Prévu', 'En cours'].includes(c.statut)) return;
    const j = ecartJ(auj, fin);
    A.push({ id: 'ch-' + c.id, dom: 'exploit', niv: 2, cat: 'Chantier', titre: 'Chantier pas clôturé : ' + c.titre,
      detail: [c.entreprise, c.espace, 'fin prévue ' + dFr(fin), 'statut « ' + c.statut + ' »'].filter(Boolean).join(' · '), val: pl(j, 'jour') + ' après la fin', go: ['chantier', c.id], tri: j });
  });
  // manquesPav : [{ id, titre, dateDebut, lieu, manques: 'texte' }] calculé par la page (stock de drapeaux)
  (manquesPav || []).forEach(p => {
    const j = estJour(p.dateDebut) ? ecartJ(p.dateDebut, auj) : 0; if (j > S.pavJours) return;
    A.push({ id: 'pv-' + p.id, dom: 'exploit', niv: j <= 3 ? 3 : 2, cat: 'Drapeaux', titre: 'Drapeaux manquants : ' + p.titre,
      detail: court([p.lieu, p.manques].filter(Boolean).join(' — '), 170), val: j > 0 ? 'pose dans ' + pl(j, 'jour') : 'en cours', go: ['tab', 'Regie'], tri: -j });
  });
  return A;
}

/* ================== DONNÉES DES AUTRES APPLIS (ext : voir reduire() plus bas) ================== */
export function alertesExternes(ext, S, auj, maintenant) {
  const A = []; if (!ext) return A;
  const now = maintenant || Date.now();

  /* --- Consommations des salons --- */
  (ext.salons || []).forEach(s => {
    if (!estJour(s.debut) || !estJour(s.fin) || s.debut > auj) return;
    const fini = s.fin < auj, depuis = fini ? ecartJ(auj, s.fin) : 0;
    if (depuis > S.consoJours) return;
    const quand = fini ? 'terminé le ' + dFr(s.fin) : 'en cours jusqu\'au ' + dFr(s.fin);
    const complet = s.fige === 'OUI' || (s.saisies > 0 && !s.incompl);
    if (s.negatifs > 0) A.push({ id: 'cs-' + s.id + '-neg', dom: 'energie', niv: 2, cat: 'Index', titre: 'Index incohérents : ' + s.salon,
      detail: pl(s.negatifs, 'ligne') + ' de comptage avec une consommation négative (' + quand + ').', val: 'à corriger', go: ['tab', 'Conso'], tri: 5 });
    if (fini && !complet && depuis >= S.consoIndexJours) A.push({ id: 'cs-' + s.id + '-idx', dom: 'energie', niv: depuis > 14 ? 3 : 2, cat: 'Index',
      titre: 'Index de fin de salon à compléter : ' + s.salon,
      detail: (s.saisies ? pl(s.incompl, 'ligne') + ' incomplète' + (s.incompl > 1 ? 's' : '') : 'Aucun index saisi') + ' (' + quand + ').', val: pl(depuis, 'jour') + ' après le salon', go: ['tab', 'Conso'], tri: depuis });
    if (!fini || !complet) return; // le bilan ne se juge que sur un salon terminé et relevé
    const motifs = []; let pire = 0;
    if (typeof s.ecart === 'number' && s.ecart * 100 > S.consoEcartPrev) { motifs.push(pct(s.ecart) + ' par rapport à la prévision (' + fr(s.cvcGaz, 1) + ' MWh CVC + gaz pour ' + fr(s.prevision, 1) + ' prévus)'); pire = Math.max(pire, s.ecart * 100 / S.consoEcartPrev); }
    const p = s.prec;
    if (p) {
      const k = typeof s.kwhM2DJU === 'number' && typeof p.kwhM2DJU === 'number' && p.kwhM2DJU > 0 ? 'kwhM2DJU'
        : typeof s.kwhM2Jour === 'number' && typeof p.kwhM2Jour === 'number' && p.kwhM2Jour > 0 ? 'kwhM2Jour' : '';
      if (k) { const e = s[k] / p[k] - 1;
        if (e * 100 > S.consoEcartEdition) { motifs.push(pct(e) + ' par rapport à l\'édition ' + String(p.debut).slice(0, 4) + ' (' + fr(s[k], 2) + ' contre ' + fr(p[k], 2) + (k === 'kwhM2DJU' ? ' kWh/m²/DJU' : ' kWh/m²/jour') + ')'); pire = Math.max(pire, e * 100 / S.consoEcartEdition); } }
    }
    if (motifs.length) A.push({ id: 'cs-' + s.id + '-ecart', dom: 'energie', niv: pire >= 2 ? 3 : 2, cat: 'Élec + gaz', titre: 'Surconsommation : ' + s.salon,
      detail: motifs.join(' ; ') + ' — ' + quand + '.', val: typeof s.ecart === 'number' && s.ecart * 100 > S.consoEcartPrev ? pct(s.ecart) + ' / prévision' : 'au-dessus de l\'édition précédente', go: ['tab', 'Conso'], tri: pire * 100 });
  });

  /* --- PV hall 4.3 : jours sans production (FusionSolar) --- */
  if (ext.pv && ext.pv.jours) {
    const J = ext.pv.jours, dates = Object.keys(J).sort(), der = dates[dates.length - 1];
    if (der) {
      const nuls = []; for (let i = 1; i <= S.pvJours; i++) { const d = plus(auj, -i); if (d <= der && J[d] !== undefined && !(J[d] > 0)) nuls.push(d); }
      if (nuls.length) A.push({ id: 'pv43-nul-' + nuls[0], dom: 'energie', niv: nuls.length >= 2 ? 3 : 2, cat: 'PV', titre: 'PV hall 4.3 : production nulle',
        detail: 'Aucune production le ' + nuls.slice(0, 5).map(dFr).reverse().join(', ') + (nuls.length > 5 ? '…' : '') + ' : onduleur ou comptage à vérifier.', val: pl(nuls.length, 'jour'), go: ['tab', 'Conso'], tri: nuls.length });
      const trou = ecartJ(auj, der) - 1;
      if (trou >= Math.max(3, S.pvJours)) A.push({ id: 'pv43-trou-' + der, dom: 'energie', niv: 1, cat: 'PV', titre: 'PV hall 4.3 : données FusionSolar plus à jour',
        detail: 'Dernière production reçue le ' + dFr(der) + '.', val: pl(trou, 'jour') + ' sans donnée', go: ['tab', 'Conso'], tri: trou });
    }
  }

  /* --- Températures des halls (plage de confort de l'appli Dalkia) --- */
  if (ext.temp && (ext.temp.hors || []).length) {
    const H = ext.temp.hors, sal = [...new Set(H.map(h => h.salon).filter(Boolean))];
    A.push({ id: 'tp-' + H.map(h => h.point).sort().join('|').slice(0, 80), dom: 'energie', niv: H.some(h => h.ecart >= 3) ? 3 : 2, cat: 'Températures',
      titre: pl(H.length, 'point') + ' de mesure hors plage (' + fr(ext.temp.min, 1) + ' – ' + fr(ext.temp.max, 1) + ' °C)',
      detail: court(H.slice().sort((a, b) => b.ecart - a.ecart).map(h => h.point + ' ' + fr(h.v, 1) + ' °C').join(', '), 170) + (sal.length ? ' — ' + sal.join(', ') : '') + '.',
      val: 'dernier relevé ' + String(H[0].at).slice(11, 16), go: ['tab', 'Conso'], tri: H.length });
  }

  /* --- Compteurs : fuites d'eau (synthèse Eau) et relevés signalés --- */
  (ext.eau || []).forEach((a, i) => {
    A.push({ id: 'eau-' + (ext.eauMois || '') + '-' + (a.num || 'bilan') + '-' + i, dom: 'eau', niv: a.niveau === 'haute' ? 3 : a.niveau === 'moyenne' ? 2 : 1, cat: a.num ? 'Compteur ' + a.num : 'Bilan',
      titre: a.titre, detail: court(a.detail, 200), val: ext.eauMois ? 'relevés de ' + ext.eauMois.slice(5, 7) + '/' + ext.eauMois.slice(0, 4) : '', go: ['tab', 'Compteurs'], tri: 0 });
  });
  const TYPE = { EAU: ['eau', 'Eau'], GAZ: ['energie', 'Gaz'], ELC: ['energie', 'Élec'], FUEL: ['energie', 'Fioul'] };
  const C = ext.ctrl;
  if (C) {
    (C.signales || []).forEach(r => { const t = TYPE[r.type] || ['energie', r.type || 'Compteur'];
      A.push({ id: 'cp-' + r.num + '-' + r.per, dom: t[0], niv: 2, cat: t[1], titre: 'Relevé à vérifier : ' + (r.designation || 'compteur ' + r.num),
        detail: [r.ctrl, r.conso != null ? 'conso ' + fr(r.conso, 1) + ' ' + (r.unite || '') : '', r.localisation, r.com].filter(Boolean).join(' · '), val: 'période ' + String(r.per).slice(5, 7) + '/' + String(r.per).slice(0, 4), go: ['tab', 'Compteurs'], tri: 0 }); });
    if (C.manquants > 0) {
      const par = Object.keys(C.manquantsType || {}).map(k => C.manquantsType[k] + ' ' + ((TYPE[k] || [0, k])[1] || k).toLowerCase()).join(', ');
      A.push({ id: 'cp-manq-' + C.periode, dom: (C.manquantsType || {}).EAU === C.manquants ? 'eau' : 'energie', niv: C.manquants === C.actifs ? 3 : 2, cat: 'Relevés',
        titre: pl(C.manquants, 'compteur') + ' pas encore relevé' + (C.manquants > 1 ? 's' : '') + ' pour ' + String(C.periode).slice(5, 7) + '/' + String(C.periode).slice(0, 4),
        detail: 'Sur ' + pl(C.actifs, 'compteur') + ' actif' + (C.actifs > 1 ? 's' : '') + (par ? ' : ' + par : '') + '. Relevé mensuel Dalkia.', val: C.manquants + '/' + C.actifs, go: ['tab', 'Compteurs'], tri: C.manquants });
    }
  }

  /* --- Tickets (signalements aux entreprises) --- */
  (ext.tickets || []).forEach(t => {
    if (!['Nouveau', 'Envoyé'].includes(t.statut)) return;
    const min = (now - new Date(t.creeLe).getTime()) / 60000, urg = t.priorite === 'Urgente', lim = urg ? S.ticketUrgMin : S.ticketMin;
    if (!(min > lim)) return;
    A.push({ id: 'tk-' + t.numero, dom: 'exploit', niv: urg || min > lim * 4 ? 3 : 2, cat: urg ? 'Ticket urgent' : 'Ticket', titre: (t.numero || 'Ticket') + ' pas pris en charge' + (t.entreprise ? ' par ' + t.entreprise : ''),
      detail: court([t.hall, t.salon, t.description].filter(Boolean).join(' · '), 170) + (t.statut === 'Nouveau' ? ' — pas encore envoyé sur WhatsApp' : ''), val: 'en attente depuis ' + duree(min), go: ['tab', 'Tickets'], tri: min });
  });

  /* --- Demandes de travaux --- */
  (ext.demandes || []).forEach(d => {
    if (['Terminée', 'Refusée'].includes(d.statut)) return;
    const cree = String(d.creeLe || '').slice(0, 10), nom = (d.numero ? d.numero + ' · ' : '') + (d.intitule || '');
    if (estJour(d.dateImperative)) { const j = ecartJ(d.dateImperative, auj);
      if (j <= S.demandeImpJours && !['En cours'].includes(d.statut) || j < 0) { A.push({ id: 'dt-' + d.numero + '-imp', dom: 'exploit', niv: j <= 2 ? 3 : 2, cat: 'Demande', titre: 'Date impérative ' + (j < 0 ? 'dépassée' : 'proche') + ' : ' + nom,
        detail: [d.service, d.lieu, 'statut « ' + d.statut + ' »', d.chargeDe ? 'suivie par ' + d.chargeDe : 'personne en charge'].filter(Boolean).join(' · '), val: j < 0 ? pl(-j, 'jour') + ' de retard' : j === 0 ? 'aujourd\'hui' : 'dans ' + pl(j, 'jour'), go: ['tab', 'Demandes'], tri: 100 - j }); return; } }
    if (d.statut === 'Nouvelle' && estJour(cree)) { const j = ecartJ(auj, cree);
      if (j >= S.demandeJours) A.push({ id: 'dt-' + d.numero + '-new', dom: 'exploit', niv: j > 10 ? 3 : 2, cat: 'Demande', titre: 'Demande de travaux sans suite : ' + nom,
        detail: [d.service, d.demandeur, d.lieu].filter(Boolean).join(' · '), val: 'reçue il y a ' + pl(j, 'jour'), go: ['tab', 'Demandes'], tri: j }); }
  });

  /* --- Sources illisibles : on le dit plutôt que d'afficher « tout va bien » --- */
  const NOMS = { conso: ['energie', 'Consommations des halls'], cpt: ['eau', 'Relevés de compteurs'], temp: ['energie', 'Températures des halls'], tickets: ['exploit', 'Ticketing'], demandes: ['exploit', 'Demandes de travaux'] };
  Object.keys(ext.errs || {}).forEach(k => { const n = NOMS[k] || ['exploit', k];
    A.push({ id: 'err-' + k, dom: n[0], niv: 1, cat: 'Données', titre: n[1] + ' : données non lues', detail: 'Ces alertes ne sont pas à jour (' + court(ext.errs[k], 120) + ').', val: '', go: ['recharger'], tri: -1 }); });
  return A;
}

/* ================== Réduction des données lues (pour les garder en mémoire de l'appareil) ==================
 * brut = { conso: { tous (salons calculés par conso/metier.js) }, h43, cptEau, cptCtrl (contrôles de la période cible), cptActifs,
 *          temp: { pts, seuils, releves }, tickets, demandes, errs } */
// Période de relevés de compteurs qui doit être complète : le mois dernier à partir du « jour du mois » réglé, sinon celui d'avant
export function periodeCible(auj, S) {
  let y = +auj.slice(0, 4), m = +auj.slice(5, 7) - (+auj.slice(8, 10) >= S.cptJourMois ? 1 : 2);
  while (m < 1) { m += 12; y--; }
  return y + '-' + String(m).padStart(2, '0') + '-01';
}
export function reduire(brut, auj, editionPrecedente) {
  const ext = { at: Date.now(), errs: brut.errs || {} };
  if (brut.conso) {
    const tous = brut.conso.tous || [], lim = plus(auj, -200);
    ext.salons = tous.filter(s => estJour(s.debut) && estJour(s.fin) && s.fin >= lim && s.debut <= auj).map(s => {
      const o = s.ind || {}, p = editionPrecedente ? editionPrecedente(s, tous) : null;
      return { id: s.id, salon: s.salon, debut: s.debut, fin: s.fin, fige: s.fige, ecart: o.ecart, cvcGaz: o.cvcGaz, prevision: o.prevision, kwhM2Jour: o.kwhM2JourCvc, kwhM2DJU: o.kwhM2DJU,
        saisies: o.lignesSaisies || 0, incompl: o.lignesIncompletes || 0, negatifs: o.negatifs || 0,
        prec: p && p.ind ? { salon: p.salon, debut: p.debut, kwhM2Jour: p.ind.kwhM2JourCvc, kwhM2DJU: p.ind.kwhM2DJU } : null };
    });
  }
  if (brut.h43) { const J = {}, lim = plus(auj, -40); Object.keys(brut.h43).forEach(d => { if (d >= lim && d <= auj) J[d] = brut.h43[d]; }); ext.pv = { jours: J }; }
  if (brut.cptEau) { ext.eau = (brut.cptEau.alertes || []).map(a => ({ niveau: a.niveau, num: a.num, titre: a.titre, detail: a.detail })); const m = brut.cptEau.mois || []; ext.eauMois = m.length ? String(m[m.length - 1]).slice(0, 7) : ''; }
  if (brut.cptCtrl) {
    const c = brut.cptCtrl, depuis = String(c.periode).slice(0, 7);
    const mt = {}; (c.manquants || []).forEach(x => { mt[x.type || '?'] = (mt[x.type || '?'] || 0) + 1; });
    ext.ctrl = { periode: String(c.periode).slice(0, 7), manquants: (c.manquants || []).length, manquantsType: mt, actifs: brut.cptActifs || 0,
      signales: (c.signales || []).filter(r => String(r.per).slice(0, 7) >= depuis).slice(0, 40)
        .map(r => ({ num: r.num, designation: r.designation, localisation: r.localisation, type: r.type, unite: r.unite, per: String(r.per).slice(0, 7), conso: r.conso, ctrl: r.ctrl, com: r.com })) };
  }
  if (brut.temp) {
    const t = brut.temp, s = t.seuils || {}, lab = {}; (t.pts || []).forEach(p => { lab[p[0]] = p[1]; });
    ext.temp = { min: s.min, max: s.max, hors: [] };
    if (typeof s.min === 'number' && typeof s.max === 'number') {
      const R = (t.releves || []).filter(r => r.at).sort((a, b) => String(b.at).localeCompare(String(a.at))), vus = {};
      const heure = iso => { const d = new Date(iso); return isNaN(d) ? String(iso) : new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }).format(d).replace(' ', 'T'); };
      R.forEach(r => Object.keys(r.values || {}).forEach(id => { if (vus[id] || !lab[id] || typeof r.values[id] !== 'number') return; vus[id] = 1; const v = r.values[id];
        if (v < s.min || v > s.max) ext.temp.hors.push({ point: lab[id], v, ecart: v < s.min ? s.min - v : v - s.max, at: heure(r.at), salon: String(r.salon || '') }); }));
    }
  }
  if (brut.tickets) ext.tickets = brut.tickets.map(t => ({ numero: t.numero, statut: t.statut, priorite: t.priorite, creeLe: t.creeLe, hall: t.hall, entreprise: t.entreprise, salon: t.salon, description: court(t.description, 140) }));
  if (brut.demandes) ext.demandes = brut.demandes.filter(d => !['Terminée', 'Refusée'].includes(d.statut))
    .map(d => ({ numero: d.numero, statut: d.statut, creeLe: d.creeLe, intitule: d.intitule, dateImperative: d.dateImperative, chargeDe: d.chargeDe, service: d.service, demandeur: d.demandeur, lieu: d.lieu }));
  return ext;
}

/* ================== Tout ensemble ================== */
export function calculer({ D, ext, regl, auj, maintenant, moi, manquesPav }) {
  const S = seuils(regl);
  const A = [...alertesExternes(ext, S, auj, maintenant), ...alertesBudget(D, S, auj, moi), ...alertesSurete(D, S, auj, moi), ...alertesExploitInternes(D, S, auj, manquesPav)];
  const od = DOMAINES.map(d => d.id);
  const cmp = (a, b) => typeof a === 'string' || typeof b === 'string' ? String(b).localeCompare(String(a)) : (b || 0) - (a || 0);
  A.sort((a, b) => b.niv - a.niv || od.indexOf(a.dom) - od.indexOf(b.dom) || cmp(a.tri, b.tri));
  return A;
}
export function compter(A) {
  const c = {}; DOMAINES.forEach(d => { c[d.id] = { 3: 0, 2: 0, 1: 0, n: 0 }; });
  A.forEach(a => { c[a.dom][a.niv]++; c[a.dom].n++; });
  return c;
}
// Qui voit le tableau de bord : les personnes choisies dans les réglages ; tant que rien n'est choisi, les responsables
export function aAcces(regl, moi, role) {
  const L = liste(regl && regl.acces);
  return !!moi && (L.length ? L.includes(moi) : role === 'Responsable');
}
