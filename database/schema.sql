-- Schéma MySQL : Cabines de recharge solaires (v4, multi-sites)
-- Toutes les instructions sont idempotentes : le fichier peut être rejoué sans risque.
-- Le passage d'une ancienne version (colonnes ajoutées, données reprises) est géré par src/lib/migrations.mjs.
SET NAMES utf8mb4;

-- Points de recharge (sites)
CREATE TABLE IF NOT EXISTS sites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  nom VARCHAR(100) NOT NULL,
  adresse VARCHAR(255) NOT NULL DEFAULT '',
  telephone VARCHAR(30) NOT NULL DEFAULT '',
  seuil_batterie TINYINT NOT NULL DEFAULT 25,
  message_ticket VARCHAR(500) NOT NULL DEFAULT 'Conservez ce ticket. Le code est exigé pour récupérer votre téléphone.',
  actif TINYINT(1) NOT NULL DEFAULT 1,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS utilisateurs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  identifiant VARCHAR(50) NOT NULL UNIQUE,
  mot_de_passe VARCHAR(255) NOT NULL,
  role ENUM('admin','gerant','operateur') NOT NULL DEFAULT 'operateur',
  actif TINYINT(1) NOT NULL DEFAULT 1,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sites sur lesquels travaille chaque gérant / opérateur (l'administrateur a accès à tous)
CREATE TABLE IF NOT EXISTS utilisateur_sites (
  utilisateur_id INT NOT NULL,
  site_id INT NOT NULL,
  PRIMARY KEY (utilisateur_id, site_id),
  CONSTRAINT fk_us_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  CONSTRAINT fk_us_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Paramètres communs à toute l'entreprise (devise, modes de paiement…)
CREATE TABLE IF NOT EXISTS parametres (
  cle VARCHAR(50) PRIMARY KEY,
  valeur VARCHAR(500) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Clients : communs à tous les sites
CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  telephone VARCHAR(30) NOT NULL,
  notes VARCHAR(255) NULL,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_clients_telephone (telephone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS emplacements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  site_id INT NOT NULL,
  code VARCHAR(20) NOT NULL,
  type_prise VARCHAR(50) NOT NULL DEFAULT 'Universel',
  statut ENUM('libre','occupe','hors_service') NOT NULL DEFAULT 'libre',
  notes VARCHAR(255) NULL,
  UNIQUE KEY uq_emplacements_site_code (site_id, code),
  CONSTRAINT fk_emplacements_site FOREIGN KEY (site_id) REFERENCES sites(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tarifs communs ; chaque site peut changer le prix ou désactiver un tarif (table tarifs_sites)
CREATE TABLE IF NOT EXISTS tarifs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  libelle VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  prix DECIMAL(12,2) NOT NULL,
  duree_minutes INT NULL,
  actif TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tarifs_sites (
  tarif_id INT NOT NULL,
  site_id INT NOT NULL,
  prix DECIMAL(12,2) NULL,          -- NULL = prix commun
  actif TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (tarif_id, site_id),
  CONSTRAINT fk_ts_tarif FOREIGN KEY (tarif_id) REFERENCES tarifs(id) ON DELETE CASCADE,
  CONSTRAINT fk_ts_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sessions de caisse : une seule caisse ouverte à la fois PAR SITE (contrainte unique site + ouverte_flag)
CREATE TABLE IF NOT EXISTS caisses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  site_id INT NOT NULL,
  statut ENUM('ouverte','fermee') NOT NULL DEFAULT 'ouverte',
  ouverte_flag TINYINT AS (IF(statut = 'ouverte', 1, NULL)) STORED,
  ouverte_par INT NULL,
  ouverte_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fond_initial DECIMAL(12,2) NOT NULL DEFAULT 0,
  fermee_par INT NULL,
  fermee_le DATETIME NULL,
  especes_attendues DECIMAL(12,2) NULL,
  especes_comptees DECIMAL(12,2) NULL,
  ecart DECIMAL(12,2) NULL,
  notes VARCHAR(255) NULL,
  UNIQUE KEY uq_caisse_ouverte_site (site_id, ouverte_flag),
  KEY idx_caisses_ouverte_le (ouverte_le),
  CONSTRAINT fk_caisses_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_caisses_ouverte_par FOREIGN KEY (ouverte_par) REFERENCES utilisateurs(id) ON DELETE SET NULL,
  CONSTRAINT fk_caisses_fermee_par FOREIGN KEY (fermee_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recharges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  site_id INT NOT NULL,
  ticket VARCHAR(10) NOT NULL UNIQUE,
  client_id INT NOT NULL,
  appareil VARCHAR(100) NOT NULL,
  batterie_depot TINYINT NULL,
  emplacement_id INT NULL,
  tarif_id INT NOT NULL,
  montant DECIMAL(12,2) NOT NULL,
  montant_paye DECIMAL(12,2) NOT NULL DEFAULT 0,
  statut ENUM('en_charge','pret','retire','annule') NOT NULL DEFAULT 'en_charge',
  depose_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  pret_le DATETIME NULL,
  retire_le DATETIME NULL,
  operateur_id INT NULL,
  notes VARCHAR(255) NULL,
  KEY idx_recharges_statut (statut),
  KEY idx_recharges_depose (depose_le),
  KEY idx_recharges_site (site_id, depose_le),
  CONSTRAINT fk_recharges_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_recharges_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_recharges_emplacement FOREIGN KEY (emplacement_id) REFERENCES emplacements(id) ON DELETE SET NULL,
  CONSTRAINT fk_recharges_tarif FOREIGN KEY (tarif_id) REFERENCES tarifs(id),
  CONSTRAINT fk_recharges_operateur FOREIGN KEY (operateur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Chaque mouvement d'argent lié à une recharge (montant négatif = remboursement)
CREATE TABLE IF NOT EXISTS paiements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  site_id INT NOT NULL,
  recharge_id INT NULL,
  montant DECIMAL(12,2) NOT NULL,
  mode ENUM('especes','mpesa','airtel','orange','autre') NOT NULL DEFAULT 'especes',
  reference VARCHAR(50) NULL,
  caisse_id INT NULL,
  operateur_id INT NULL,
  paye_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_paiements_date (paye_le),
  KEY idx_paiements_mode (mode),
  KEY idx_paiements_site (site_id, paye_le),
  CONSTRAINT fk_paiements_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_paiements_recharge FOREIGN KEY (recharge_id) REFERENCES recharges(id) ON DELETE CASCADE,
  CONSTRAINT fk_paiements_caisse FOREIGN KEY (caisse_id) REFERENCES caisses(id) ON DELETE SET NULL,
  CONSTRAINT fk_paiements_operateur FOREIGN KEY (operateur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dépenses : d'un site, ou générales (site_id NULL : salaires du siège, achats groupés…)
CREATE TABLE IF NOT EXISTS depenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  site_id INT NULL,
  date_depense DATE NOT NULL,
  categorie VARCHAR(50) NOT NULL,
  description VARCHAR(255) NOT NULL,
  montant DECIMAL(12,2) NOT NULL,
  mode ENUM('especes','mpesa','airtel','orange','autre') NOT NULL DEFAULT 'especes',
  caisse_id INT NULL,
  operateur_id INT NULL,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_depenses_date (date_depense),
  CONSTRAINT fk_depenses_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_depenses_caisse FOREIGN KEY (caisse_id) REFERENCES caisses(id) ON DELETE SET NULL,
  CONSTRAINT fk_depenses_operateur FOREIGN KEY (operateur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS releves_energie (
  id INT AUTO_INCREMENT PRIMARY KEY,
  site_id INT NOT NULL,
  releve_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  niveau_batterie TINYINT NOT NULL,
  tension DECIMAL(6,2) NULL,
  production_wh INT NULL,
  meteo ENUM('ensoleille','nuageux','pluvieux') NULL,
  notes VARCHAR(255) NULL,
  operateur_id INT NULL,
  KEY idx_releves_date (releve_le),
  CONSTRAINT fk_releves_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_releves_operateur FOREIGN KEY (operateur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Journal d'activité : qui a fait quoi, quand, sur quel site
CREATE TABLE IF NOT EXISTS journal (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  site_id INT NULL,
  utilisateur_id INT NULL,
  utilisateur_nom VARCHAR(100) NULL,
  action VARCHAR(50) NOT NULL,
  entite VARCHAR(30) NOT NULL,
  entite_id INT NULL,
  details VARCHAR(500) NULL,
  ip VARCHAR(45) NULL,
  KEY idx_journal_date (cree_le),
  KEY idx_journal_entite (entite, entite_id),
  KEY idx_journal_utilisateur (utilisateur_id),
  KEY idx_journal_site (site_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Paramètres communs par défaut (ignorés si déjà présents)
INSERT IGNORE INTO parametres (cle, valeur) VALUES
  ('nom_cabine', 'Cabines Solaires'),
  ('devise', 'FC'),
  ('modes_paiement', 'especes,mpesa,airtel,orange'),
  ('caisse_obligatoire', '1'),
  ('derniere_sauvegarde', '');
