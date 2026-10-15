# Cabines Solaires : gestion de points de recharge de téléphones

Application web full-stack (Next.js 15 + MySQL via `mysql2`, front en React avec `axios`, React Query et Tailwind CSS) pour gérer une cabine de recharge alimentée par panneaux solaires et batteries lithium.

## Nouveautés de la version 4 : plusieurs sites

L'application gère maintenant **plusieurs points de recharge** depuis un serveur central.

- **Sites** (menu *Gestion › Sites*) : chaque site a son code (S01, S02…), son nom, son adresse, son téléphone, son alerte batterie et son message de ticket. Ses emplacements, sa caisse, ses relevés d'énergie et ses dépôts lui sont propres.
- **Choix du site** en haut du menu. L'administrateur (et un gérant de plusieurs sites) peut choisir **« Tous les sites »** : tableau de bord comparatif, caisse de chaque site, rapports consolidés avec comparaison des sites. Les opérations (dépôt, ouverture de caisse, relevé) se font toujours sur un site précis.
- **Rôles** :
  - *Administrateur* : tous les sites, création des sites, utilisateurs, tarifs communs, paramètres, sauvegardes ;
  - *Gérant* : ses sites (emplacements, prix de son site, coordonnées, dépenses, rapports, journal) ;
  - *Opérateur* : dépôts, retraits, caisse, relevés et dépenses sur le ou les sites qui lui sont attribués.
- **Tarifs communs, prix ajustable par site** : un site peut avoir son propre prix ou désactiver un tarif (*Tarifs › Prix sur ce site*).
- **Clients communs** à tous les sites ; un téléphone se retire **sur le site où il a été déposé** (indiqué sur le ticket).
- **Une caisse par site** ; l'argent d'un retrait va dans la caisse du site du téléphone.
- **Dépenses générales** : en vue « Tous les sites », l'administrateur peut saisir une dépense du siège (salaires, achats groupés), comptée dans les rapports mais dans aucun site.
- **Journal d'activité** : chaque action indique son site.
- Mise en page : le contenu occupe toute la largeur à droite du menu, avec 2 rem de marge (1 rem sur téléphone).

### Passer de la version 3 à la 4

```bash
npm install
npm run db:init      # ou simplement redémarrer : la base est mise à jour au démarrage
npm run build && npm start
```

Vos données sont reprises dans un premier site **S01**, qui prend le nom, l'adresse, le téléphone, l'alerte batterie et le message de ticket de votre cabine. Les opérateurs existants y sont rattachés. Ensuite :

1. *Sites* : vérifiez S01, puis **Nouveau site** pour chaque autre point de recharge (ses emplacements P01, P02… peuvent être créés d'un coup).
2. *Utilisateurs* : attribuez à chaque opérateur ou gérant son ou ses sites.
3. Choisissez un site en haut du menu, puis **ouvrez sa caisse**.

Pour que les sites se connectent au serveur central, celui-ci doit être joignable depuis chaque site : un petit serveur ou un PC avec une connexion Internet (box 4G par exemple) et une adresse fixe, ou un hébergement en ligne. Les téléphones des opérateurs s'y connectent avec les données mobiles. Dans ce cas, servez l'application en **HTTPS** et mettez `COOKIE_SECURE=true`.

## Nouveautés de la version 3

- **Tailwind CSS** (v4) remplace le CSS écrit à la main : tout le style est en classes Tailwind dans les composants. `src/app/globals.css` ne contient plus que les couleurs du thème et le style de base des champs.
- **Nouveau thème** : couleur principale **rouge clair**, textes et icônes d'accent en **bleu**, **menu latéral blanc**, page de connexion, icône de l'application et tickets en clair.
- **Icônes dessinées** (au lieu des émojis) pour le menu et les boutons, en bleu.
- Petites corrections : en-têtes de colonnes alignés, indicateurs sur deux colonnes sur téléphone, rapport « Par jour » en pleine largeur, impression des rapports sans le menu.

Les couleurs se changent en un seul endroit : les variables `--primaire`, `--bleu`… en haut de `src/app/globals.css` (thème clair, puis thème sombre).

Pour passer de la version 2 à la 3 : remplacez les fichiers, puis `npm install` (installe Tailwind) et `npm run build && npm start`. Pas de changement de base de données.

## Nouveautés de la version 2

- **Mobile Money** : chaque paiement indique son mode (Espèces, M-Pesa, Airtel Money, Orange Money, Autre) et, si besoin, le n° de transaction du SMS. Totaux par mode au tableau de bord, à la caisse et dans les rapports. Les modes proposés se règlent dans *Paramètres*.
- **Clôture de caisse** : ouverture le matin avec le fond de caisse, clôture le soir en comptant les espèces. L'application calcule les espèces attendues (fond + espèces reçues − dépenses prises dans la caisse) et l'**écart** (manque ou surplus), avec un rapport de clôture imprimable. Option « caisse obligatoire » : aucun encaissement possible tant que la caisse n'est pas ouverte.
- **Remboursements** : l'annulation d'un dépôt déjà payé propose de rembourser le client ; le remboursement sort de la caisse.
- **Journal d'activité** (administrateur) : connexions, échecs de connexion, dépôts, paiements, retraits, codes ticket erronés, annulations, suppressions, changements de prix, clôtures… avec qui, quand et depuis quel appareil. Filtre « actions sensibles » pour repérer les fraudes.
- **Sauvegardes intégrées** (administrateur) : une copie automatique chaque jour sur le PC (30 gardées), téléchargement d'une sauvegarde en un clic, **restauration depuis l'interface** (avec copie de sécurité automatique juste avant). Rappel au tableau de bord si aucune copie n'a été téléchargée depuis 7 jours.
- **Mode sombre** : suit le réglage du téléphone, ou bouton *Mode sombre / Mode clair* dans le menu.
- **Application installable** (PWA) : icône sur l'écran d'accueil, ouverture plein écran, raccourcis « Nouveau dépôt » et « Caisse », page claire si le serveur de la cabine est injoignable.

## Mise à jour depuis la version 1

Vos données sont conservées.

```bash
# 1. Remplacez les fichiers du projet par ceux de cette version (gardez votre .env.local)
npm install
npm run db:init      # ajoute les nouvelles tables ; peut être relancé sans risque
npm run build && npm start
```

La base est aussi mise à jour automatiquement au démarrage du serveur. Les paiements enregistrés avant la mise à jour sont repris en « Espèces ».

**Après la mise à jour, ouvrez la caisse** (menu *Caisse*) : par défaut, l'option « caisse obligatoire » bloque les encaissements tant que la caisse est fermée. Vous pouvez la désactiver dans *Paramètres*.

## Fonctionnalités

- **Dépôts & retraits** : enregistrement d'un téléphone (client, appareil, % batterie, tarif, emplacement), génération d'un **code ticket** unique (ex. `K7M2Q`), ticket imprimable (format imprimante thermique 58 mm). Le téléphone n'est remis **que contre le bon code**, ce qui protège contre les vols et les confusions.
- **Suivi de charge** : en charge → prêt → retiré (ou annulé), durée écoulée, paiement au dépôt ou au retrait, paiements partiels, impayés.
- **Caisse et Mobile Money** : voir plus haut.
- **Emplacements** : grille des ports de charge (USB-C, Micro-USB, Lightning…), occupé/libre automatiquement, signalement de panne.
- **Clients** : créés automatiquement au premier dépôt (reconnus par leur numéro), historique, total payé, dettes, clients fidèles ★.
- **Énergie solaire** : relevés du niveau des batteries, tension, production, météo ; courbe et **alerte de batterie faible** (seuil réglable).
- **Dépenses** : par catégorie, mode de paiement et mois ; une dépense en espèces peut être « prise dans la caisse ».
- **Tableau de bord** : encaissements du jour (dont Mobile Money), espèces en caisse, bénéfice du mois, téléphones prêts à remettre, état des emplacements, graphique 7 jours.
- **Rapports** sur une période : recettes, dépenses, bénéfice, par jour / mode de paiement / tarif / opérateur, clôtures et écarts de caisse, **export CSV (Excel)** et impression.
- **Utilisateurs** : rôle *administrateur* (tout) et *opérateur* (dépôts, retraits, caisse, relevés, dépenses). Mots de passe chiffrés (bcrypt), session sécurisée (cookie httpOnly + JWT).
- Interface **en français**, adaptée au téléphone, **sans dépendance à Internet** (aucune ressource externe) : fonctionne sur un réseau Wi-Fi local.

## Installation (nouvelle cabine)

Prérequis : **Node.js 18.18+** (20 ou 22 recommandé) et **MySQL 8** (ou MariaDB 10.5+).

```bash
npm install
cp .env.example .env.local     # renseignez DB_USER / DB_PASSWORD et une longue AUTH_SECRET
npm run db:init                # crée la base, les tables, des tarifs, 10 emplacements et le compte admin
npm run dev                    # développement : http://localhost:3000
# ou en production :
npm run build && npm start
```

Connexion initiale : `admin` / `admin123`. **Changez le mot de passe** dans *Paramètres*, puis réglez le nom de la cabine, la devise (FC par défaut), les modes de paiement, le seuil batterie et les tarifs.

## Utilisation sur place (sans Internet)

1. Installez l'application sur un petit PC portable ou mini-PC alimenté par vos batteries.
2. Lancez `npm run build && npm start` (écoute sur toutes les interfaces, port 3000).
3. Partagez un Wi-Fi local (routeur ou point d'accès du PC) et ouvrez `http://ADRESSE-IP-DU-PC:3000` depuis le téléphone de l'opérateur.
4. Laissez `COOKIE_SECURE` vide tant que vous n'utilisez pas HTTPS.

### Installer l'application sur le téléphone

Les navigateurs n'autorisent l'installation complète (plein écran, page hors ligne) que sur une adresse **sécurisée** (`https://` ou `localhost`). Sur le Wi-Fi de la cabine (`http://192.168.x.x:3000`), il faut donc, **une seule fois par téléphone**, déclarer l'adresse comme sûre dans Chrome (Android) :

1. Dans Chrome, ouvrez `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
2. Saisissez l'adresse de la cabine, par exemple `http://192.168.1.10:3000`, et passez l'option sur **Enabled**.
3. Appuyez sur **Relaunch** (Relancer), rouvrez l'application et connectez-vous.
4. Le bouton **⤓ Installer l'application** apparaît dans le menu (ou menu ⋮ de Chrome → *Installer l'application*).

Sans cette étape, Chrome propose seulement *Ajouter à l'écran d'accueil*, qui crée un raccourci ouvrant l'application dans le navigateur. Tout le reste fonctionne normalement.

Conseil : donnez une **adresse IP fixe** au PC de la cabine (réglage du routeur), sinon l'adresse peut changer et l'icône installée ne fonctionnera plus.

## Déroulement type d'une journée

1. **Matin** : *Caisse* → saisir le fond de caisse → *Ouvrir la caisse*. Noter le % des batteries dans *Énergie solaire*.
2. **Dépôt** : *Nouveau dépôt* → numéro du client (le nom se remplit s'il est déjà venu) → appareil → tarif → emplacement libre → mode de paiement (et n° de transaction si Mobile Money) → *Enregistrer*. Donnez/imprimez le **code ticket**.
3. **Charge terminée** : bouton *✓ Chargé* (le téléphone passe dans « Prêts »).
4. **Retrait** : *Remettre* → saisir le code présenté par le client → encaisser le reste éventuel. L'emplacement se libère.
5. **Soir** : *Caisse* → compter les billets → saisir le total → *Clôturer*. Expliquer l'écart s'il y en a un, imprimer le rapport.
6. **Chaque semaine** (administrateur) : *Sauvegardes* → *Télécharger une sauvegarde* → garder le fichier sur une clé USB ou un téléphone. Jeter un œil au *Journal d'activité* (filtre « actions sensibles »).
7. **Fin de mois** : *Rapports* → *Ce mois* → exporter.

## Sauvegarde et restauration

- Les copies automatiques et manuelles sont dans le dossier `sauvegardes/` du projet (modifiable avec `BACKUP_DIR` dans `.env.local`).
- Pour **déménager sur un nouveau PC** : installez l'application, lancez `npm run db:init`, connectez-vous en `admin`, puis *Sauvegardes* → *Choisir un fichier de sauvegarde…*. Après la restauration, les comptes et mots de passe sont ceux de la sauvegarde.
- La restauration n'accepte que les fichiers produits par cette application. Pour un très gros fichier (plusieurs dizaines de Mo), la commande `mysql -u root -p cabine_recharge < fichier.sql` fonctionne aussi.

## Structure

```
database/schema.sql          Tables MySQL
scripts/init-db.mjs          Initialisation / mise à jour (npm run db:init)
src/instrumentation.ts       Mise à jour automatique de la base au démarrage
src/middleware.ts            Protection des pages et de l'API
src/lib/                     db, session (JWT), api (validation), journal, caisse, modes de paiement,
                             sauvegarde, migrations, http (axios), hooks (React Query), thème
src/app/api/…                Routes API REST
src/app/(app)/…              Pages : tableau de bord, recharges, caisse, emplacements, clients, énergie, dépenses,
                             rapports, tarifs, utilisateurs, journal, sauvegardes, paramètres
src/app/ticket/[id]          Ticket de dépôt imprimable
src/app/cloture/[id]         Rapport de clôture de caisse imprimable
src/app/manifest.ts          Manifeste de l'application installable
public/sw.js                 Service worker (cache, page hors ligne)
src/components/              Interface : ui (briques Tailwind : boutons, cartes, tableaux…), icônes, menu, paiement, impression
src/app/globals.css          Couleurs du thème (clair / sombre) pour Tailwind
```

## API (résumé)

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/auth/login`, `/api/auth/logout` | Connexion / déconnexion |
| GET/PUT | `/api/auth/me` | Utilisateur courant / changer son mot de passe |
| GET/POST | `/api/recharges` | Liste (`statut`, `q`, `date`, `client_id`) / nouveau dépôt (`mode_paiement`, `reference_paiement`) |
| GET/PATCH/DELETE | `/api/recharges/:id` | Détail + paiements / actions `pret`, `payer`, `retirer`, `annuler` (`rembourser`), `notes` / suppression (admin) |
| GET/POST | `/api/caisse` | État + historique / `ouvrir` (`fond_initial`), `fermer` (`especes_comptees`, `notes`) |
| GET | `/api/caisse/:id` | Détail d'une session de caisse |
| GET/POST, PUT/DELETE | `/api/clients`, `/api/emplacements`, `/api/tarifs`, `/api/depenses`, `/api/energie`, `/api/utilisateurs` (+ `/:id`) | Gestion |
| GET/PUT | `/api/parametres` | Paramètres de la cabine |
| GET | `/api/stats` | Tableau de bord |
| GET | `/api/rapports?du=&au=` | Rapport de période |
| GET | `/api/journal` | Journal d'activité (admin, gérant) |
| GET/POST, PUT/DELETE | `/api/sites` (+ `/:id`) | Sites (création : admin ; modification : admin ou gérant du site) |
| POST | `/api/sites/actif` | Choisir le site de travail (`{ site: id }` ou `{ site: 'tous' }`) |
| PUT | `/api/tarifs/:id/site` | Prix ou désactivation d'un tarif sur le site choisi (admin, gérant) |
| GET/POST | `/api/sauvegarde` | Liste des copies / créer une copie (admin) |
| GET | `/api/sauvegarde/telecharger[?fichier=]` | Télécharger une sauvegarde (admin) |
| POST | `/api/sauvegarde/restaurer[?fichier=]` | Restaurer (admin, en-tête `X-Confirmation: RESTAURER`) |
