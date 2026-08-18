# Domus BODACC Radar

Radar de veille des procédures collectives (BODACC) pour repérer les locaux commerciaux susceptibles de se libérer, avant publication sur les portails immobiliers.

**Démo en ligne :** https://domus-bodacc-radar-jac-digital.vercel.app

## Structure

```
scripts/bodacc_fetch.js   → script Node.js : récupère les procédures collectives
                             (sauvegarde / redressement / liquidation) via l'API
                             publique BODACC (opendatasoft), classe par urgence,
                             exporte un CSV
src/App.jsx                → l'explorateur React (upload CSV, filtres, zone Domus)
src/main.jsx                → point d'entrée React
```

## Utiliser le script de collecte

```bash
node scripts/bodacc_fetch.js --days=365              # France entière, 1 an
node scripts/bodacc_fetch.js --days=180 --dep=95,78,60  # zone Domus uniquement
```

Génère `bodacc_procedures_collectives.csv`, à uploader ensuite dans l'explorateur.

## Lancer l'explorateur en local

```bash
npm install
npm run dev
```

## Stack

React · Vite · PapaParse · Lucide React · API publique BODACC (DILA / opendatasoft)

---
Domus VirtualImmo — pipeline de détection vendeurs
