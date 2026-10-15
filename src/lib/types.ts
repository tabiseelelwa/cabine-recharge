import type { ModePaiement } from './modes';

export type Role = 'admin' | 'gerant' | 'operateur';
export type Utilisateur = {
  id: number;
  nom: string;
  identifiant: string;
  role: Role;
  actif?: number;
  cree_le?: string;
  sites_ids?: string | null;
  sites_codes?: string | null;
};

/** Un point de recharge */
export type Site = {
  id: number;
  code: string;
  nom: string;
  adresse: string;
  telephone: string;
  seuil_batterie: number;
  message_ticket: string;
  actif: number;
  nb_emplacements?: number;
  nb_utilisateurs?: number;
};

export type InfosSites = { sites: Site[]; actif: number | null; accessibles: number[]; peut_tous: boolean };

/** Champs ajoutés aux lignes qui appartiennent à un site */
type DeSite = { site_id: number; site_code: string; site_nom: string };

export type StatutRecharge = 'en_charge' | 'pret' | 'retire' | 'annule';
export type Recharge = {
  id: number;
  ticket: string;
  client_id: number;
  client_nom: string;
  client_telephone: string;
  appareil: string;
  batterie_depot: number | null;
  emplacement_id: number | null;
  emplacement_code: string | null;
  tarif_id: number;
  tarif_libelle: string;
  montant: number;
  montant_paye: number;
  reste: number;
  statut: StatutRecharge;
  depose_le: string;
  pret_le: string | null;
  retire_le: string | null;
  operateur_nom: string | null;
  notes: string | null;
  modes_paiement: string | null;
  paiements?: Paiement[];
  site_adresse?: string;
  site_telephone?: string;
  site_message?: string;
} & DeSite;

export type Paiement = {
  id: number;
  montant: number;
  mode: ModePaiement;
  reference: string | null;
  paye_le: string;
  operateur_nom: string | null;
};

export type Client = {
  id: number;
  nom: string;
  telephone: string;
  notes: string | null;
  cree_le: string;
  nb_recharges: number;
  total_paye: number;
  total_du: number;
  derniere_visite: string | null;
};

export type StatutEmplacement = 'libre' | 'occupe' | 'hors_service';
export type Emplacement = {
  id: number;
  code: string;
  type_prise: string;
  statut: StatutEmplacement;
  notes: string | null;
  recharge_id: number | null;
  ticket: string | null;
  appareil: string | null;
  recharge_statut: StatutRecharge | null;
  depose_le: string | null;
  client_nom: string | null;
} & DeSite;

/** Tarif tel qu'il s'applique : sur le site choisi, ou commun en vue « Tous les sites » */
export type Tarif = {
  id: number;
  libelle: string;
  description: string | null;
  duree_minutes: number | null;
  /** Prix appliqué (prix du site s'il existe, sinon prix commun) */
  prix: number;
  prix_commun: number;
  prix_site: number | null;
  actif: number | boolean;
  actif_commun: number | boolean;
  actif_site: number | boolean;
  /** En vue « Tous les sites » : sites qui ont un prix ou un état différent */
  exceptions?: { site_id: number; site_code: string; site_nom: string; prix: number | null; actif: number | boolean }[];
};

export type Depense = {
  id: number;
  date_depense: string;
  categorie: string;
  description: string;
  montant: number;
  mode: ModePaiement;
  caisse_id: number | null;
  operateur_nom: string | null;
  site_id: number | null;
  site_code: string | null;
  site_nom: string | null;
};

export type Meteo = 'ensoleille' | 'nuageux' | 'pluvieux';
export type Releve = {
  id: number;
  releve_le: string;
  niveau_batterie: number;
  tension: number | null;
  production_wh: number | null;
  meteo: Meteo | null;
  notes: string | null;
  operateur_nom: string | null;
  seuil_batterie: number;
} & DeSite;

/** Paramètres communs à toute l'entreprise (les coordonnées sont propres à chaque site) */
export type Parametres = {
  nom_cabine: string;
  devise: string;
  modes_paiement: string;
  caisse_obligatoire: string;
  derniere_sauvegarde?: string;
  derniere_sauvegarde_auto?: string;
};

export type Stats = {
  jour: { nb_depots: number; encaisse: number; mobile: number; depenses: number };
  mois: { nb_depots: number; encaisse: number; depenses: number; benefice: number };
  en_charge: number;
  prets: number;
  emplacements: { total: number; libres: number; occupes: number; hors_service: number };
  impayes: { nb: number; total: number };
  energie: Releve | null;
  seuil_batterie: number;
  semaine: { jour: string; encaisse: number; nb: number }[];
  caisse: { id: number; ouverte_le: string; ouverte_par_nom: string | null; especes_attendues: number } | null;
  caisse_obligatoire: boolean;
  derniere_sauvegarde?: string | null;
  site_actif: number | null;
  /** Vue « Tous les sites » : une ligne par site */
  sites: ResumeSite[];
};

export type ResumeSite = {
  id: number;
  code: string;
  nom: string;
  encaisse_jour: number;
  depots_jour: number;
  en_charge: number;
  prets: number;
  emplacements_libres: number;
  emplacements_total: number;
  hors_service: number;
  batterie: number | null;
  batterie_le: string | null;
  seuil_batterie: number;
  caisse_ouverte: boolean;
};

export type Rapport = {
  du: string;
  au: string;
  totaux: {
    nb_recharges: number;
    nb_clients: number;
    facture: number;
    encaisse: number;
    depenses: number;
    benefice: number;
    impaye: number;
    annulees: number;
    ecarts_caisse: number;
  };
  par_jour: { jour: string; nb: number; encaisse: number; mobile: number; depenses: number }[];
  par_mode: { mode: ModePaiement; nb: number; recu: number; rembourse: number; net: number }[];
  caisses: {
    id: number;
    site_code: string;
    site_nom: string;
    ouverte_le: string;
    fermee_le: string;
    especes_attendues: number;
    especes_comptees: number;
    ecart: number;
    notes: string | null;
    fermee_par_nom: string | null;
  }[];
  par_tarif: { libelle: string; nb: number; encaisse: number }[];
  par_operateur: { nom: string; nb: number; encaisse: number }[];
  par_categorie: { categorie: string; total: number }[];
  par_site: { id: number; code: string; nom: string; nb: number; encaisse: number; depenses: number; benefice: number }[];
  depenses_generales: number;
};

export type ResumeCaisse = {
  fond_initial: number;
  par_mode: { mode: ModePaiement; recu: number; rembourse: number; net: number; nb: number }[];
  total_encaisse: number;
  total_mobile: number;
  especes_nettes: number;
  depenses_especes: number;
  nb_depenses: number;
  especes_attendues: number;
};

export type Caisse = {
  id: number;
  statut: 'ouverte' | 'fermee';
  ouverte_le: string;
  fond_initial: number;
  fermee_le: string | null;
  especes_attendues: number | null;
  especes_comptees: number | null;
  ecart: number | null;
  notes: string | null;
  ouverte_par_nom: string | null;
  fermee_par_nom: string | null;
} & DeSite;

export type EtatCaisse = {
  actif: number | null;
  ouverte: (Caisse & { resume: ResumeCaisse }) | null;
  historique: Caisse[];
  /** Vue « Tous les sites » : la caisse de chaque site */
  sites: { id: number; code: string; nom: string; caisse: (Caisse & { resume: ResumeCaisse }) | null }[];
};

export type DetailCaisse = Caisse & {
  site_adresse: string;
  resume: ResumeCaisse;
  paiements: {
    paye_le: string;
    montant: number;
    mode: ModePaiement;
    reference: string | null;
    ticket: string | null;
    client_nom: string | null;
    operateur_nom: string | null;
  }[];
  depenses: { date_depense: string; categorie: string; description: string; montant: number; mode: ModePaiement }[];
};

export type LigneJournal = {
  id: number;
  cree_le: string;
  utilisateur_id: number | null;
  utilisateur_nom: string | null;
  action: string;
  entite: string;
  entite_id: number | null;
  details: string | null;
  ip: string | null;
  site_code: string | null;
};

export type InfosSauvegarde = {
  dossier: string;
  fichiers: { nom: string; taille: number; date: string }[];
  derniere_sauvegarde: string | null;
  derniere_sauvegarde_auto: string | null;
};
