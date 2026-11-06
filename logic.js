/* Appli Équipe – Eurexpo · règles métier (reprises de Code.gs)
 * Fonctions pures, sans Firebase : contrôles et calculs faits avant chaque enregistrement.
 */

export const SCHEMA = {
  Equipe:       ['id', 'nom', 'role', 'actif', 'email'],
  Taches:       ['id', 'titre', 'description', 'assigne', 'priorite', 'statut', 'echeance', 'lieu', 'creePar', 'creeLe', 'majLe', 'majPar', 'faitPar', 'prive'],
  Commentaires: ['id', 'tacheId', 'auteur', 'date', 'texte', 'prive', 'proprio'],
  Nacelle:      ['id', 'nom', 'debut', 'fin', 'lieu', 'motif', 'creeLe', 'majPar'],
  Regisseurs:   ['id', 'regisseur', 'dateDebut', 'dateFin', 'statut', 'salon', 'note', 'majPar'],
  Cloisons:     ['id', 'date', 'heure', 'hall', 'mouvement', 'cloison', 'salon', 'responsable', 'statut', 'note', 'majPar', 'dateFin', 'heureFin', 'objet'],
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
                 'luPar', 'creePar', 'creeLe', 'majLe', 'majPar'],
  Clefs:        ['id', 'espace', 'acces', 'numero', 'stock', 'reserve', 'commentaire', 'majPar'],
  ClefsPrets:   ['id', 'lot', 'societe', 'prenom', 'nom', 'contact', 'clefId', 'numero', 'designation', 'qte', 'rendu', 'statut',
                 'remisPar', 'remisA', 'datePrepa', 'retireLe', 'renduLe', 'recuperePar', 'renduPar', 'finDemontage', 'commentaire', 'creeLe', 'majPar'],
  Documents:    ['id', 'titre', 'categorie', 'espaces', 'equipement', 'lien', 'apercu', 'source', 'dateDoc', 'version', 'motsCles', 'note', 'creePar', 'creeLe', 'majLe', 'majPar']
};
// Collections créées dans Firebase (absentes de l'ancien Google Sheet) : jamais touchées par la reprise / mise à jour depuis le Sheet
export const HORS_SHEET = ['Clefs', 'ClefsPrets', 'Documents'];

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const LONG_FIELDS = ['description', 'texte', 'note', 'designation', 'commentaire', 'libelle', 'intitule', 'contraintes', 'decisions', 'liste'];

const pad = n => String(n).padStart(2, '0');
export function now_() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
export function newId() {
  const a = new Uint8Array(5); crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function clean_(v, max) { return String(v === null || v === undefined ? '' : v).trim().slice(0, max || 300); }
export function list_(s) { return String(s || '').split(',').map(x => x.trim()).filter(Boolean); }
export const estPerso_ = t => !!t && t.prive === 'oui';

export function money_(v, label) {
  const s = String(v === null || v === undefined ? '' : v).replace(/[\s  €]/g, '').replace(',', '.');
  const n = Number(s);
  if (s === '' || !isFinite(n)) throw new Error((label || 'Montant') + ' invalide : ' + v);
  return String(Math.round(n * 100) / 100);
}
export function qte_(v, label) {
  const s = String(v === null || v === undefined ? '' : v).trim();
  if (s === '') return '0';
  const n = Number(s.replace(',', '.'));
  if (!isFinite(n) || n < 0 || Math.round(n) !== n) throw new Error('Quantité invalide (' + label + ') : ' + v);
  return String(n);
}
const fr_ = s => { s = String(s || ''); return s.slice(8, 10) + '/' + s.slice(5, 7) + ' ' + s.slice(11, 16); };

// faitPar = personnes qui ont fini leur part. Tâche terminée quand toutes les personnes attribuées ont fini.
export function parts_(o, cur, part) {
  const a = list_(o.assigne);
  let f = a.length > 1 ? list_(o.faitPar).filter(n => a.indexOf(n) >= 0) : [];
  if (!part && cur && cur.statut === 'Terminé' && o.statut !== 'Terminé') f = [];
  if (a.length > 1 && f.length === a.length) o.statut = 'Terminé';
  else if (part && o.statut === 'Terminé') o.statut = 'En cours';
  else if (part && f.length && o.statut === 'À faire') o.statut = 'En cours';
  o.faitPar = f.join(', ');
}

export function checkNacelle_(o, rows) {
  if (!o.nom) throw new Error('Indique qui réserve la nacelle');
  if (!RE_DT.test(o.debut || '') || !RE_DT.test(o.fin || '')) throw new Error('Début et fin obligatoires');
  if (o.fin <= o.debut) throw new Error('La fin doit être après le début');
  const c = rows.filter(r => r.id !== o.id && o.debut < r.fin && r.debut < o.fin)[0];
  if (c) throw new Error('Nacelle déjà réservée par ' + c.nom + ' du ' + fr_(c.debut) + ' au ' + fr_(c.fin));
}

/* Prépare l'élément à enregistrer : mêmes contrôles que save_ de Code.gs.
 * name : collection · item : saisie · user : nom de la personne connectée
 * cur : version actuelle (ou null) · rows : éléments de la collection (pour les doublons) · taches : pour les commentaires */
export function prepare(name, item, user, cur, rows, opts = {}) {
  if (!SCHEMA[name]) throw new Error('Onglet non modifiable : ' + name);
  if (!item || typeof item !== 'object') throw new Error('Données manquantes');
  user = clean_(user, 80);
  if (!user) throw new Error('Connexion nécessaire');
  const o = cur ? Object.assign({}, cur) : {};
  SCHEMA[name].forEach(k => {
    if (k in item && k !== 'id') o[k] = clean_(item[k], name === 'Memos' && k === 'texte' ? 30000 : LONG_FIELDS.indexOf(k) >= 0 ? 5000 : 300);
  });
  o.id = cur ? cur.id : (item.id && opts.keepId ? String(item.id) : newId());
  const now = now_();

  switch (name) {
    case 'Equipe':
      if (!o.nom) throw new Error('Nom obligatoire');
      if (rows.some(r => r.id !== o.id && String(r.nom).toLowerCase() === o.nom.toLowerCase())) throw new Error(o.nom + " est déjà dans l'équipe");
      if (!o.actif) o.actif = 'oui';
      if (!o.role) o.role = 'Technicien';
      o.email = String(o.email || '').toLowerCase();
      if (o.email && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(o.email)) throw new Error('Adresse e-mail invalide : ' + o.email);
      if (o.email && rows.some(r => r.id !== o.id && String(r.email || '').toLowerCase() === o.email)) throw new Error('Cette adresse est déjà utilisée par un autre membre');
      break;
    case 'Taches':
      if (!o.titre) throw new Error('Titre obligatoire');
      if (estPerso_(cur) && cur.creePar !== user) throw new Error('Tâche introuvable (supprimée ?)');
      if (!cur) { o.creePar = user; o.creeLe = now; }
      if (cur && estPerso_(cur)) o.prive = 'oui';
      if (o.prive === 'oui') o.assigne = o.creePar;
      else o.prive = 'non';
      if (!o.statut) o.statut = 'À faire';
      if (!opts.part) o.faitPar = cur ? (cur.faitPar || '') : '';
      parts_(o, cur, !!opts.part);
      o.majLe = now; o.majPar = user;
      break;
    case 'Commentaires': {
      if (!o.texte) throw new Error('Commentaire vide');
      if (!o.tacheId) throw new Error('Tâche inconnue');
      const t = (opts.taches || []).filter(x => x.id === String(o.tacheId))[0];
      if (!t || (estPerso_(t) && t.creePar !== user)) throw new Error('Tâche introuvable (supprimée ?)');
      o.prive = estPerso_(t) ? 'oui' : 'non';
      o.proprio = estPerso_(t) ? t.creePar : '';
      if (!cur) { o.auteur = user; o.date = now; }
      break;
    }
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
      if (!cur && !o.ordre) o.ordre = String(rows.reduce((m, r) => Math.max(m, Number(r.ordre) || 0), 0) + 1);
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
      if (!opts.lu) {
        const same = cur && ['titre', 'texte', 'decisions', 'niveau'].every(k => String(cur[k] || '') === String(o[k] || ''));
        o.luPar = same ? (cur.luPar || '') : user;
      }
      if (!cur) { o.creePar = user; o.creeLe = now; }
      o.majLe = now; o.majPar = user;
      break;
    case 'Drapeaux':
      if (!o.nom) throw new Error('Nom du drapeau obligatoire');
      if (!o.format) throw new Error('Format obligatoire');
      ['neufs', 'occasions', 'uses'].forEach(k => { o[k] = qte_(o[k], k === 'uses' ? 'usés' : k); });
      if (!cur && rows.some(r => String(r.nom).toLowerCase() === o.nom.toLowerCase() && r.format === o.format))
        throw new Error(o.nom + ' en ' + o.format + ' existe déjà : modifie la ligne existante');
      o.majPar = user;
      break;
    case 'Pavoisements': {
      if (!o.titre) throw new Error('Salon / événement obligatoire');
      if (!RE_DATE.test(o.dateDebut || '')) throw new Error('Date de pose obligatoire');
      if (!o.dateFin) o.dateFin = o.dateDebut;
      if (!RE_DATE.test(o.dateFin)) throw new Error('Date de dépose invalide');
      if (o.dateFin < o.dateDebut) throw new Error('La dépose est avant la pose');
      let l;
      try { l = JSON.parse(o.liste || '[]'); } catch (err) { throw new Error('Liste de drapeaux illisible'); }
      if (!Array.isArray(l)) throw new Error('Liste de drapeaux illisible');
      o.liste = JSON.stringify(l.filter(x => x && x.d && x.f && Number(x.q) > 0)
        .map(x => ({ d: clean_(x.d, 80), f: clean_(x.f, 20), q: Number(qte_(x.q, 'quantité')) })));
      if (!o.statut) o.statut = 'Prévu';
      if (!cur) o.creeLe = now;
      o.majLe = now; o.majPar = user;
      break;
    }
    case 'Cloisons':
      if (!o.objet) o.objet = 'Cloison';
      if (!RE_DATE.test(o.date || '')) throw new Error('Date de début obligatoire');
      if (!o.dateFin) o.dateFin = o.date;
      if (!RE_DATE.test(o.dateFin)) throw new Error('Date de fin invalide');
      if (o.dateFin < o.date) throw new Error('La date de fin est avant la date de début');
      if (o.dateFin === o.date && o.heure && o.heureFin && o.heureFin < o.heure) throw new Error("L'heure de fin est avant l'heure de début");
      o.majPar = user;
      break;
    case 'Clefs':
      if (!o.numero && !o.acces) throw new Error('N° de clef ou accès obligatoire');
      o.stock = qte_(o.stock, 'stock'); o.reserve = qte_(o.reserve, 'archivées');
      o.majPar = user;
      break;
    case 'ClefsPrets': {
      if (!o.societe) throw new Error('Société / salon obligatoire');
      if (!o.numero && !o.designation) throw new Error('Clef obligatoire (n° ou désignation)');
      if (!RE_DATE.test(o.datePrepa || '')) throw new Error('Date de remise obligatoire');
      ['retireLe', 'renduLe'].forEach(k => { if (o[k] && !RE_DATE.test(o[k])) throw new Error('Date invalide : ' + o[k]); });
      if (o.finDemontage && o.finDemontage !== 'RAS' && !RE_DATE.test(o.finDemontage)) throw new Error('Fin de démontage : une date ou « RAS »');
      o.qte = qte_(o.qte, 'sorties'); o.rendu = qte_(o.rendu, 'rendues');
      if (Number(o.qte) < 1) throw new Error('Au moins 1 clef sortie');
      if (Number(o.rendu) > Number(o.qte)) throw new Error('Plus de clefs rendues (' + o.rendu + ') que sorties (' + o.qte + ')');
      if (['', 'Perdue', 'Facturée'].indexOf(o.statut || '') < 0) throw new Error('Statut inconnu : ' + o.statut);
      if (Number(o.rendu) === Number(o.qte)) o.statut = '';
      if (Number(o.rendu) > 0 && !o.renduLe) o.renduLe = now.slice(0, 10);
      if (Number(o.rendu) === 0 && !o.statut) o.renduLe = '';
      if (!o.lot) o.lot = o.id;
      if (!cur) o.creeLe = now;
      o.majPar = user;
      break;
    }
    case 'Documents':
      if (!o.titre) throw new Error('Titre du document obligatoire');
      o.lien = clean_(item.lien !== undefined ? item.lien : o.lien, 1500);
      if (!/^https:\/\/[^\s]+$/i.test(o.lien)) throw new Error('Lien invalide : colle l\'adresse complète (https://…) du fichier ou du dossier');
      o.source = sourceDoc_(o.lien);
      o.apercu = clean_(o.apercu, 1500);
      { const m = o.apercu.match(/src\s*=\s*["']([^"']+)["']/i); if (m) o.apercu = m[1].replace(/&amp;/g, '&'); }
      if (o.apercu && !/^https:\/\/[^\s]+$/i.test(o.apercu)) throw new Error('Lien d\'aperçu invalide : colle le code d\'incorporation ou une adresse https://');
      if (o.dateDoc && !RE_DATE.test(o.dateDoc)) throw new Error('Date du document invalide');
      if (!o.categorie) o.categorie = 'Autre';
      if (!cur) { o.creePar = user; o.creeLe = now; }
      o.majLe = now; o.majPar = user;
      break;
    default: // EDL
      if (!RE_DATE.test(o.date || '')) throw new Error('Date obligatoire');
      o.majPar = user;
  }
  // seulement les champs connus, tous en texte (comme dans le Sheet)
  const out = {};
  SCHEMA[name].forEach(k => { out[k] = o[k] === undefined || o[k] === null ? '' : String(o[k]); });
  return out;
}

// Où est rangé le document, d'après son lien
export function sourceDoc_(u) {
  const h = (String(u || '').match(/^https:\/\/([^/?#]+)/i) || [])[1] || '';
  if (/(^|\.)(drive|docs|sheets|slides)\.google\.com$/i.test(h)) return 'Drive';
  if (/(^|\.)sharepoint\.com$/i.test(h) || /(^|\.)teams\.microsoft\.com$/i.test(h) || /(^|\.)1drv\.ms$/i.test(h) || /(^|\.)onedrive\.live\.com$/i.test(h)) return 'Teams';
  return 'Autre';
}

export function summary_(name, o) {
  switch (name) {
    case 'Equipe': return o.nom + ' (' + o.role + ', actif : ' + o.actif + ')';
    case 'Taches': if (estPerso_(o)) return 'Tâche perso de ' + o.creePar + ' · ' + o.statut;
      return o.titre + ' · ' + o.statut + (o.assigne ? ' · ' + o.assigne : '') + (o.faitPar ? ' · fait : ' + o.faitPar : '');
    case 'Commentaires': return o.prive === 'oui' ? 'Commentaire sur tâche perso' : (o.texte || '').slice(0, 80);
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
    case 'Clefs': return (o.numero ? 'n° ' + o.numero + ' ' : '') + o.espace + ' - ' + o.acces + ' · stock ' + o.stock;
    case 'ClefsPrets': return o.societe + ' · ' + [o.prenom, o.nom].filter(Boolean).join(' ') + ' · ' + (o.numero || o.designation) + ' · ' + o.rendu + '/' + o.qte + ' rendue(s)' + (o.statut ? ' · ' + o.statut : '');
    case 'Documents': return o.titre + ' · ' + o.categorie + (o.espaces ? ' · ' + o.espaces : '') + ' · ' + o.source;
    case 'Chantiers': return o.titre + ' · ' + o.espace + ' · ' + o.dateDebut + ' → ' + o.dateFin + ' · ' + o.statut;
  }
  return '';
}

// Nouvelles personnes attribuées (à prévenir par mail), hors auteur de l'attribution
export function nouveauxAttribues(o, cur, user) {
  if (estPerso_(o) || o.statut === 'Terminé') return [];
  const avant = cur ? list_(cur.assigne) : [];
  return list_(o.assigne).filter(n => avant.indexOf(n) < 0 && n !== user);
}

// Données renvoyées par l'ancien script (Sheet) → documents Firestore
export function normaliserReprise(all, persoParNom) {
  const out = {};
  Object.keys(SCHEMA).forEach(k => {
    out[k] = (all[k] || []).filter(x => x && x.id).map(x => {
      const o = {}; SCHEMA[k].forEach(c => { o[c] = x[c] === undefined || x[c] === null ? '' : String(x[c]); }); return o;
    });
  });
  // tâches perso de chacun (le serveur ne les donne qu'à leur auteur)
  const vu = new Set(out.Taches.map(t => t.id));
  const vuC = new Set(out.Commentaires.map(c => c.id));
  Object.keys(persoParNom || {}).forEach(nom => {
    const p = persoParNom[nom] || {};
    (p.Taches || []).forEach(t => { if (t.prive === 'oui' && t.creePar === nom && !vu.has(t.id)) { vu.add(t.id); const o = {}; SCHEMA.Taches.forEach(c => { o[c] = String(t[c] ?? ''); }); out.Taches.push(o); } });
    (p.Commentaires || []).forEach(c => { if (!vuC.has(c.id)) { vuC.add(c.id); const o = {}; SCHEMA.Commentaires.forEach(k => { o[k] = String(c[k] ?? ''); }); out.Commentaires.push(o); } });
  });
  const tById = {};
  out.Taches.forEach(t => { t.prive = t.prive === 'oui' ? 'oui' : 'non'; if (t.prive === 'oui') t.assigne = t.creePar; tById[t.id] = t; });
  out.Commentaires = out.Commentaires.filter(c => tById[c.tacheId]).map(c => {
    const t = tById[c.tacheId]; c.prive = t.prive; c.proprio = t.prive === 'oui' ? t.creePar : ''; return c;
  });
  out.Equipe.forEach(e => { e.email = String(e.email || '').toLowerCase().trim(); if (!e.actif) e.actif = 'oui'; if (!e.role) e.role = 'Technicien'; });
  return out;
}
