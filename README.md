# BODACC Radar

Radar de veille des procédures collectives (BODACC) pour repérer les locaux commerciaux susceptibles de se libérer, avant publication sur les portails immobiliers.

**Démo en ligne :** https://bodacc-radar.vercel.app

## Fonctionnement

Le client tape le nom d'une ville dans l'interface. L'application interroge le BODACC en direct (aucun fichier à générer en amont), classe les résultats par type de procédure et poids d'urgence, et permet de filtrer par enseigne, activité ou type de procédure. Les résultats peuvent être exportés en CSV.

## Structure

```
api/bodacc-search.js  → fonction serverless : interroge l'API BODACC (opendatasoft)
                         en direct pour une ville donnée, classe par type de
                         procédure et urgence
api/login.js           → vérifie le mot de passe et pose un cookie de session signé
middleware.js           → protège l'ensemble du site par mot de passe (Edge Runtime)
public/login.html       → page de connexion
src/App.jsx             → interface React (recherche par ville, filtres, export CSV)
src/main.jsx             → point d'entrée React
scripts/bodacc_fetch.js → script Node.js optionnel : export en masse des procédures
                          collectives sur une période donnée, hors flux applicatif
```

## Lancer en local

```bash
npm install
npm run dev
```

Variables d'environnement nécessaires (`.env` en local, Environment Variables sur Vercel) :
- `PASSWORD` — mot de passe d'accès à l'application
- `APP_SESSION_SECRET` — clé aléatoire pour signer les cookies de session

## Stack

React · Vite · Fonctions serverless Node.js (Vercel) · Middleware Edge · API publique BODACC (DILA / opendatasoft)

---
Radar BODACC — veille des procédures collectives
