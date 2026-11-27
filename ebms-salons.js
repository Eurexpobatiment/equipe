/* Salons de l'appli Consommations halls d'après le Planning EBMS (fichier commun aux applis Équipe et Consommations :
 * le même fichier est rangé dans les deux dépôts, garder les deux copies identiques).
 *
 * Règles (choisies le 27 nov. 2026) :
 *  - un salon = une réservation EBMS bleu foncé ou bleue (couleurs 002060 et 0070C0 ; les vertes, options et travaux
 *    sont laissés de côté) qui a une phase d'exploitation (code E) ;
 *  - dates du salon = premier et dernier jour d'EXPLOITATION (montage et démontage laissés de côté) ;
 *  - halls du salon = ceux qui ont de l'exploitation (pas ceux réservés pour le seul montage ou la logistique) ;
 *  - les réservations dont le titre contient « stockage » ne sont pas des salons ;
 *  - seuls les salons pas encore finis sont proposés ; rien n'est écrit sans validation.
 * Un salon créé garde dans ses notes « Créé depuis le planning EBMS : <titre EBMS> » : c'est ce qui le relie à sa
 * réservation pour proposer ensuite les changements de dates.
 */
(function (root) {
  'use strict';
  var COULEURS = ['002060', '0070C0'];
  var EXCLUS = ['stockage'];
  var NOTE = 'Créé depuis le planning EBMS : ';
  var SALON_KEYS = ['id', 'salon', 'debut', 'fin', 'confort', 'halls', 'surface', 'elecParc', 'pv', 'gaz',
    'djuForces', 'elecMontage', 'joursMontage', 'dateAvant', 'dateApres', 'fige', 'fElec', 'fCVC', 'fFM', 'fECL', 'notes'];

  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function jourN(iso) { var p = String(iso).split('-').map(Number); return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 864e5); }
  function isoN(n) { return new Date(n * 864e5).toISOString().slice(0, 10); }
  function estIso(s) { return /^\d{4}-\d\d-\d\d$/.test(String(s || '')); }

  /* ---------- Lecture d'un export Excel « Planning réservations » d'EBMS (même lecture que l'appli Équipe) ----------
   * wb : classeur lu par SheetJS avec { cellStyles: true }. Retour : { debut, fin, esp, titres, cols, T, P }. */
  var MOIS = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
  var REP = { 'JOURS FERIES': 1, 'MATCH UEFA': 1, 'TRAVAUX': 1, 'VACANCES SCOLAIRES': 1 };
  var NOMS = { 'Accueil Princip': 'Accueil Principal', 'Accueil Conflue': 'Accueil Confluence', 'Local multifonc': 'Local multifonction', 'Park. Expo. Nor': 'Park. Expo. Nord', 'Expo. Extérieur': 'Expo. Extérieure' };
  var HORS = /exterieur|parking/;
  function lire(wb, nom, XLSX) {
    var ws = wb.Sheets[wb.SheetNames[0]]; if (!ws || !ws['!ref']) throw new Error('classeur vide');
    var R = XLSX.utils.decode_range(ws['!ref']);
    function cell(r, c) { return ws[XLSX.utils.encode_cell({ r: r, c: c })]; }
    function brut(r, c) { var x = cell(r, c); return x && x.v != null ? String(x.v) : ''; }
    function val(r, c) { return brut(r, c).trim(); }
    function rgb(x) { var s = x && x.s; if (!s || !s.patternType || s.patternType === 'none') return ''; var v = String((s.fgColor || {}).rgb || '').toUpperCase(); return /^[0-9A-F]{6,8}$/.test(v) ? v.slice(-6) : ''; }
    var m = norm(val(1, 0)).match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})\s*-\s*[a-z.]+\s+(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if (!/^planning/i.test(val(0, 0)) || !m || !MOIS[m[2]] || !MOIS[m[5]]) throw new Error('ce n\'est pas un export « Planning réservations » d\'EBMS');
    var debut = m[3] + '-' + pad(MOIS[m[2]]) + '-' + pad(+m[1]), fin = m[6] + '-' + pad(MOIS[m[5]]) + '-' + pad(+m[4]), N = jourN(fin) - jourN(debut) + 1;
    if (!(N > 0 && N <= 400)) throw new Error('période illisible');
    var jr = /^[a-zéû.]+\s*\d{2}$/i, hr = -1, r;
    for (r = 2; r <= 8 && hr < 0; r++) if (jr.test(val(r, 1)) && jr.test(val(r, 2))) hr = r;
    if (hr < 0 || +val(hr, 1).slice(-2) !== +debut.slice(8) || +val(hr, N).slice(-2) !== +fin.slice(8)) throw new Error('la ligne des jours ne correspond pas à la période annoncée');
    var span = {}; (ws['!merges'] || []).forEach(function (g) { span[g.s.r + ',' + g.s.c] = g.e.c - g.s.c + 1; });
    function sp(r, c) { return Math.max(1, Math.min(span[r + ',' + c] || 1, N - c + 1)); }
    function has(r) { for (var c = 1; c <= N; c++) if (val(r, c)) return true; return false; }
    var esp = [], T = [], P = [], titres = [], cols = [], ti = {}, ci = {};
    function idx(M, A, v) { var k = '$' + v, i = M[k]; if (i == null) { i = A.length; A.push(v); M[k] = i; } return i; }
    function ligne(rt, rp, g, l) {
      var e = esp.length, c, b, k, t, v; esp.push([g, NOMS[l] || l]);
      for (c = 1; c <= N; c++) {
        b = brut(rt, c); if (!b.trim()) continue;
        k = b.match(/^(\d+) (.+)$/); t = (k ? k[2] : b).replace(/\s+/g, ' ').trim();
        T.push([e, c - 1, sp(rt, c), idx(ti, titres, t), idx(ci, cols, rgb(cell(rt, c))), k ? Math.min(9, +k[1]) : 1]);
      }
      if (rp != null) for (c = 1; c <= N; c++) { v = val(rp, c); if (v) P.push([e, c - 1, sp(rp, c), v.slice(0, 3), idx(ci, cols, rgb(cell(rp, c)))]); }
    }
    var g = '', l;
    for (r = hr + 1; r <= R.e.r; r++) {
      l = val(r, 0); if (!l) continue;
      if (val(r + 1, 0) !== l) { if (has(r)) ligne(r, null, REP[l.toUpperCase()] ? 'Repères' : g, l); else if (!REP[l.toUpperCase()]) g = l; continue; }
      if (/^(halls|no level)$/i.test(l) && !has(r) && !has(r + 1)) { if (/^halls$/i.test(l)) g = l; r++; continue; }
      if (!HORS.test(norm(g))) ligne(r, r + 1, g, l);
      r++;
    }
    if (!T.length) throw new Error('aucune réservation dans ce fichier');
    return { v: 1, debut: debut, fin: fin, fichier: String(nom || '').slice(0, 120), esp: esp, titres: titres, cols: cols, T: T, P: P };
  }

  /* ---------- Réservations de toutes les périodes importées ----------
   * periodes : [{ debut, fin, esp, titres, cols, T, P, majLe }] (le champ « data » des documents Documents/ebms-…, ou la
   * lecture directe d'un fichier). Sur les jours communs à deux imports, le plus récent l'emporte ; une réservation à
   * cheval sur deux trimestres est recollée par son titre.
   * Retour : [{ titre, couleur, debut, fin (exploitation, '' s'il n'y en a pas), esp: [espaces EBMS réservés],
 *            espE: [ceux qui ont de l'exploitation : un hall réservé pour le seul montage ou la logistique n'en fait pas partie],
 *            resDebut, resFin : premier et dernier jour de la réservation, montage et démontage compris }] */
  function evenements(periodes) {
    var per = (periodes || []).filter(function (o) { return o && estIso(o.debut) && estIso(o.fin) && Array.isArray(o.T) && Array.isArray(o.esp) && Array.isArray(o.titres); })
      .map(function (o) { return Object.assign({}, o, { majLe: String(o.majLe || '') }); });
    per.sort(function (a, b) { return a.majLe.localeCompare(b.majLe) || a.debut.localeCompare(b.debut); });
    function reste(s, e, i) {
      var Rg = [[s, e]], j, x, y;
      for (j = i + 1; j < per.length && Rg.length; j++) {
        x = jourN(per[j].debut); y = jourN(per[j].fin);
        Rg = Rg.reduce(function (acc, ab) {
          var a = ab[0], b = ab[1];
          if (b < x || a > y) acc.push([a, b]); else { if (a < x) acc.push([a, x - 1]); if (b > y) acc.push([y + 1, b]); }
          return acc;
        }, []);
      }
      return Rg;
    }
    var evs = {}, ordre = [];
    per.forEach(function (p, i) {
      var o = jourN(p.debut), expl = {};
      (p.P || []).forEach(function (q) { if (q[3] === 'E') (expl[q[0]] = expl[q[0]] || []).push([o + q[1], o + q[1] + q[2] - 1]); });
      p.T.forEach(function (t) {
        var esp = p.esp[t[0]], titre = String(p.titres[t[3]] || '').trim(), col = String((p.cols || [])[t[4]] || '');
        if (!esp || !titre || esp[0] === 'Repères') return;
        reste(o + t[1], o + t[1] + t[2] - 1, i).forEach(function (xy) {
          var k = '$' + titre, ev = evs[k];
          if (!ev) { ev = evs[k] = { titre: titre, esp: [], vus: {}, espE: [], vusE: {}, cols: {}, d: Infinity, f: -Infinity, rd: Infinity, rf: -Infinity }; ordre.push(ev); }
          if (!ev.vus[esp[1]]) { ev.vus[esp[1]] = 1; ev.esp.push(esp[1]); }
          ev.cols[col] = (ev.cols[col] || 0) + (xy[1] - xy[0] + 1);
          ev.rd = Math.min(ev.rd, xy[0]); ev.rf = Math.max(ev.rf, xy[1]);
          (expl[t[0]] || []).forEach(function (ab) { var a = Math.max(ab[0], xy[0]), b = Math.min(ab[1], xy[1]); if (a <= b) { ev.d = Math.min(ev.d, a); ev.f = Math.max(ev.f, b); if (!ev.vusE[esp[1]]) { ev.vusE[esp[1]] = 1; ev.espE.push(esp[1]); } } });
        });
      });
    });
    return ordre.map(function (ev) {
      var best = '', n = -1; Object.keys(ev.cols).forEach(function (c) { if (ev.cols[c] > n) { n = ev.cols[c]; best = c; } });
      // une réservation bleue garde sa couleur même si une partie de ses cases est d'une autre teinte
      COULEURS.forEach(function (c) { if (ev.cols[c] && COULEURS.indexOf(best) < 0) best = c; });
      return { titre: ev.titre, couleur: best, debut: isFinite(ev.d) ? isoN(ev.d) : '', fin: isFinite(ev.f) ? isoN(ev.f) : '', esp: ev.esp, espE: ev.espE,
        resDebut: isoN(ev.rd), resFin: isoN(ev.rf) };
    });
  }
  /** Les réservations qui sont des salons pour l'appli Consommations (bleu foncé ou bleu, avec exploitation, hors stockage) */
  function salonsEbms(periodes) {
    return evenements(periodes).filter(function (e) {
      var t = norm(e.titre);
      return e.debut && COULEURS.indexOf(e.couleur) >= 0 && !EXCLUS.some(function (m) { return t.indexOf(m) >= 0; });
    }).sort(function (a, b) { return a.debut.localeCompare(b.debut) || a.titre.localeCompare(b.titre); });
  }

  /* ---------- Halls de l'appli Consommations réservés par un salon ----------
   * EBMS affiche aussi une réservation sur les lignes « parentes » et sur les combinaisons (le 2.1.A réservé apparaît sur
   * « H. 2 », « H. 2.1 » et « H. 2.1 A+B ») : seules les lignes les plus fines comptent. Un hall réservé en entier donne
   * toutes ses parties (« Hall 6.2 » → Hall 6.2A et Hall 6.2B). Les galeries suivent (« Gal. 4 » → Galerie 4).
   * Accueils, passages, commissariats et locaux n'ont pas de comptage : ils ne sont pas repris.
   * hallsListe : les halls de l'appli (Réglages › Surfaces), dans leur ordre. Retour : noms de l'appli, dans cet ordre. */
  var HALL = /^(?:H\.|Hall)\s*0?(\d+)(?:\.(\d+))?(?:[ .]([A-C](?:\+[A-C])*))?$/i;
  function cle(s) { return norm(s).replace(/[^a-z0-9.]/g, ''); }
  function hallsConso(espaces, hallsListe) {
    var P = (espaces || []).map(function (n) { return HALL.exec(String(n).trim()); }).filter(Boolean), sous = {}, H = {}, veut = {};
    P.forEach(function (m) { if (m[2]) sous[m[1]] = 1; });
    P.forEach(function (m) {
      if (!m[2] && !m[3] && sous[m[1]]) return;
      var k = 'hall' + Number(m[1]) + (m[2] ? '.' + Number(m[2]) : '');
      var h = H[k] || (H[k] = { seuls: {}, combis: {} });
      if (m[3]) { var l = m[3].toUpperCase().split('+'); l.forEach(function (x) { (l.length > 1 ? h.combis : h.seuls)[x] = 1; }); }
    });
    Object.keys(H).forEach(function (k) {
      var s = Object.keys(H[k].seuls), c = Object.keys(H[k].combis), lettres = s.length ? s : c.length ? c : null;
      if (lettres) lettres.forEach(function (x) { veut[k + x.toLowerCase()] = 1; }); else veut[k + '*'] = 1;
    });
    (espaces || []).forEach(function (n) { var g = /^Gal(?:\.|erie)\s*0?(\d+)$/i.exec(String(n).trim()); if (g) veut['galerie' + Number(g[1])] = 1; });
    return (hallsListe || []).map(function (h) { return typeof h === 'string' ? h : h && h.hall; }).filter(function (nom) {
      var k = cle(nom); if (!k) return false;
      if (veut[k]) return true;
      var m = /^(hall\d+(?:\.\d+)?)([a-c])?$/.exec(k);
      return !!(m && veut[m[1] + '*']);   // hall réservé en entier : lui-même et toutes ses parties
    });
  }

  /* ---------- Nom proposé pour le salon ----------
   * « SIRHA LYON 01/2027 » → « Sirha Lyon 2027 ». EBMS écrit tout en capitales et sans accents : le nom reste modifiable
   * avant la création. avecMois : garder « 01/2027 » (deux éditions la même année). */
  var PETITS = { of: 1, de: 1, du: 1, des: 1, la: 1, le: 1, les: 1, et: 1, en: 1, au: 1, aux: 1, a: 1, un: 1, une: 1, pour: 1, sur: 1 };
  var MOISRE = '(?:janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)';
  function nomPropose(titre, debut, avecMois) {
    var an = String(debut || '').slice(0, 4), mo = String(debut || '').slice(5, 7);
    var t = String(titre || '').replace(/\s+/g, ' ').trim()
      .replace(/\b\d{1,2}\s*[\/.]\s*(?:20)?\d{2}\b/g, ' ')                      // 01/2027, 06.27
      .replace(new RegExp('\\b' + MOISRE + '\\s+(?:20)\\d{2}\\b', 'gi'), ' ')   // avril 2027
      .replace(/\b20\d{2}\b/g, ' ')                                             // 2027
      .replace(/^[#\s\-–]+/, '').replace(/[\s\-–]+$/, '').replace(/\s+/g, ' ').trim();
    if (!t) t = String(titre || '').trim();
    var mots = t.split(' ').map(function (w, i) {
      if (/[a-zà-ÿ]/.test(w) && /[A-Z]/.test(w) && w !== w.toUpperCase()) return w;   // déjà en casse mixte (« Disney »)
      var b = w.toLowerCase();
      if (i > 0 && PETITS[b]) return b;
      if (/^[a-z]{1,2}'/.test(b) && i > 0) { var q = b.indexOf('\''); return b.slice(0, q + 1) + b.charAt(q + 1).toUpperCase() + b.slice(q + 2); }   // l'étudiant
      if (/^[A-Z0-9&]{2,5}$/.test(w) && (/\d/.test(w) || !/[AEIOUY]/.test(w))) return w;   // sigles (S2R, LSX)
      return b.replace(/(^|[\-\/(])([a-zà-ÿ])/g, function (_, p, c) { return p + c.toUpperCase(); });
    });
    var nom = mots.join(' ');
    return (nom + (an ? ' ' + (avecMois && mo ? mo + '/' : '') + an : '')).slice(0, 120);
  }

  /* ---------- Propositions ----------
   * salons : les salons de l'appli Consommations ; hallsListe : ses halls ; auj : date du jour (AAAA-MM-JJ).
   * Retour : {
   *   creer : [{ titre, salon (nom proposé), debut, fin, halls, hallsEbms }]  réservations sans salon dans l'appli,
   *   dates : [{ id, salon, titre, debut, fin (actuelles), nd, nf (EBMS) }]    salons créés depuis EBMS dont les dates ont bougé,
   *   nbEbms : nombre de salons EBMS à venir, nbLies : ceux qui ont déjà leur salon,
 *   coupes : titres des réservations au bord du planning importé (laissées de côté tant que le trimestre voisin manque) } */
  function mots(s) { return norm(String(s || '').replace(/\b\d{1,2}\s*[\/.]\s*(?:20)?\d{2}\b/g, ' ')).split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 4 && !/^20\d\d$/.test(w) && !PETITS[w] && ['salon', 'festival', 'lyon', 'concours', 'expo', 'exposition', 'congres', 'france', 'europe', 'world'].indexOf(w) < 0; }); }
  function titreNote(s) { var n = String(s && s.notes || ''), i = n.indexOf(NOTE); return i < 0 ? '' : n.slice(i + NOTE.length).split('\n')[0].trim(); }
  function propositions(periodes, salons, hallsListe, auj) {
    auj = estIso(auj) ? auj : new Date().toISOString().slice(0, 10);
    // réservation qui touche le bord du planning importé (le trimestre voisin n'est pas là) : ses dates peuvent être incomplètes
    var deb = {}, fins = {};
    (periodes || []).forEach(function (p) { if (p && estIso(p.debut) && estIso(p.fin)) { deb[jourN(p.debut)] = 1; fins[jourN(p.fin)] = 1; } });
    function coupee(e) { var a = jourN(e.resDebut), b = jourN(e.resFin); return (deb[a] && !fins[a - 1]) || (fins[b] && !deb[b + 1]); }
    var coupes = [];
    var E = salonsEbms(periodes).filter(function (e) { return e.fin >= auj; }).filter(function (e) { if (coupee(e)) { coupes.push(e.titre); return false; } return true; });
    var S = (salons || []).filter(function (s) { return s && s.id; });
    var parNote = {}; S.forEach(function (s) { var t = titreNote(s); if (t) parNote['$' + norm(t)] = s; });
    var creer = [], dates = [], lies = 0;
    E.forEach(function (e) {
      var s = parNote['$' + norm(e.titre)], halls = hallsConso(e.espE, hallsListe);
      if (s) {
        lies++;
        if (String(s.fige || '').toUpperCase() !== 'OUI' && (s.debut !== e.debut || s.fin !== e.fin))
          dates.push({ id: s.id, salon: s.salon, titre: e.titre, debut: s.debut || '', fin: s.fin || '', nd: e.debut, nf: e.fin });
        return;
      }
      // salon saisi à la main : mêmes jours (au moins un en commun) et un hall ou un mot du nom en commun
      var M = mots(e.titre);
      var deja = S.some(function (x) {
        if (titreNote(x) || !estIso(x.debut) || !estIso(x.fin) || x.fin < e.debut || x.debut > e.fin) return false;
        var hx = String(x.halls || '').split(/\s*,\s*/).filter(Boolean);
        if (hx.some(function (h) { return halls.indexOf(h) >= 0; })) return true;
        var mx = mots(x.salon); return mx.some(function (w) { return M.indexOf(w) >= 0; }) || (cle(x.salon).length >= 4 && cle(e.titre).indexOf(cle(x.salon).replace(/20\d\d$/, '')) >= 0);
      });
      if (deja) { lies++; return; }
      creer.push({ titre: e.titre, debut: e.debut, fin: e.fin, halls: halls.join(', '), couleur: e.couleur, esp: e.esp });
    });
    // noms : l'année suffit, sauf si deux salons porteraient le même nom (deux éditions la même année)
    var compte = {};
    function base(n) { return norm(String(n).replace(/\b\d{1,2}\s*\/\s*(20\d\d)\b/, '$1')); }   // « … 03/2027 » et « … 2027 » : même nom
    S.forEach(function (s) { compte[base(s.salon)] = 1; });
    creer.forEach(function (c) { c.salon = nomPropose(c.titre, c.debut); var k = base(c.salon); compte[k] = (compte[k] || 0) + 1; });
    creer.forEach(function (c) { if (compte[base(c.salon)] > 1) c.salon = nomPropose(c.titre, c.debut, true); });
    return { creer: creer, dates: dates, nbEbms: E.length, nbLies: lies, coupes: coupes };
  }

  /** Numéro du prochain salon (« S098 ») */
  function idSuivant(salons, deja) {
    var max = 0; (salons || []).concat(deja || []).forEach(function (x) { var m = String(x && x.id || x).match(/^S(\d+)$/); if (m) max = Math.max(max, +m[1]); });
    return 'S' + ('00' + (max + 1)).slice(-3);
  }
  /** Document ConsoSalons d'un salon à créer (mêmes champs que l'appli Consommations, les consommations restent vides) */
  function docSalon(c, id) {
    var o = {}; SALON_KEYS.forEach(function (k) { o[k] = ''; });
    o.id = String(id); o.salon = String(c.salon || '').trim().slice(0, 120); o.debut = c.debut; o.fin = c.fin; o.halls = String(c.halls || '');
    o.fige = 'NON'; o.notes = NOTE + c.titre;
    return o;
  }

  /* Réservations décochées à la dernière validation : reproposées, mais décochées d'office (gardé sur l'appareil) */
  var CLE_NON = 'ebms_conso_non';
  function refus() { try { var a = JSON.parse(root.localStorage.getItem(CLE_NON) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function noterRefus(non, oui) {
    try {
      var a = refus().filter(function (t) { return (oui || []).indexOf(t) < 0; });
      (non || []).forEach(function (t) { if (a.indexOf(t) < 0) a.push(t); });
      root.localStorage.setItem(CLE_NON, JSON.stringify(a.slice(-300)));
    } catch (e) {}
  }

  root.EBS = { refus: refus, noterRefus: noterRefus, lire: lire, evenements: evenements, salonsEbms: salonsEbms, hallsConso: hallsConso, nomPropose: nomPropose,
    propositions: propositions, idSuivant: idSuivant, docSalon: docSalon, titreNote: titreNote, NOTE: NOTE, COULEURS: COULEURS, SALON_KEYS: SALON_KEYS };
})(typeof window !== 'undefined' ? window : globalThis);
