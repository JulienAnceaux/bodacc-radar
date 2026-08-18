/**
 * bodacc_fetch.js
 * ----------------
 * Récupère les annonces "Procédures collectives" du BODACC (France entière)
 * via l'API publique opendatasoft, classe le type de procédure
 * (sauvegarde / redressement / liquidation), et exporte un CSV.
 *
 * Usage :
 *   node bodacc_fetch.js                 -> 90 derniers jours, France entière
 *   node bodacc_fetch.js --days=180      -> 180 derniers jours
 *   node bodacc_fetch.js --dep=95,78,60  -> filtre sur des départements précis
 *
 * Sortie : bodacc_procedures_collectives.csv (séparateur point-virgule)
 *
 * Pas de clé API nécessaire, endpoint public :
 * https://bodacc-datadila.opendatasoft.com/api/records/1.0/search/
 */

const fs = require("fs");

// Le endpoint /search/ plafonne à 10 000 résultats (start+rows <= 10000),
// insuffisant pour un mois national de procédures collectives (~18-19k).
// Le endpoint /download/ n'a pas cette limite MAIS ignore le paramètre
// "start" (il renvoie toujours depuis le début) : on l'utilise donc en
// un seul appel par mois avec un "rows" largement dimensionné, plutôt
// qu'en pagination par offset.
const API_BASE =
  "https://bodacc-datadila.opendatasoft.com/api/records/1.0/download/";
const DATASET = "annonces-commerciales";
const MAX_ROWS_PER_MONTH = 30000; // marge au-dessus du record mensuel observé (~19k)

// --- Lecture des arguments CLI ---
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace(/^--/, "").split("=");
  acc[k] = v;
  return acc;
}, {});

const days = parseInt(args.days || "90", 10);
const depFilter = args.dep ? args.dep.split(",").map((d) => d.trim()) : null;

const dateFrom = new Date();
dateFrom.setDate(dateFrom.getDate() - days);
const dateFromStr = dateFrom.toISOString().slice(0, 10);

// --- Classification du type de procédure à partir du champ "jugement" ---
function classifyProcedure(jugementRaw) {
  if (!jugementRaw) return "Inconnu";
  let jugement;
  try {
    jugement = typeof jugementRaw === "string" ? JSON.parse(jugementRaw) : jugementRaw;
  } catch {
    return "Inconnu";
  }
  const texte = `${jugement.famille || ""} ${jugement.nature || ""}`.toLowerCase();

  if (texte.includes("liquidation")) return "Liquidation judiciaire";
  if (texte.includes("redressement")) return "Redressement judiciaire";
  if (texte.includes("sauvegarde")) return "Sauvegarde";
  if (texte.includes("plan de cession")) return "Plan de cession";
  return jugement.nature || jugement.famille || "Autre procédure collective";
}

// Poids d'urgence pour le futur scoring (demi-vie courte = urgent)
const URGENCY_WEIGHT = {
  "Liquidation judiciaire": 3,
  "Plan de cession": 3,
  "Redressement judiciaire": 2,
  Sauvegarde: 1,
};

function extractAdresse(listepersonnesRaw) {
  try {
    const parsed =
      typeof listepersonnesRaw === "string"
        ? JSON.parse(listepersonnesRaw)
        : listepersonnesRaw;
    const personne = parsed.personne || (parsed.personnes && parsed.personnes[0]) || {};
    const a = personne.adresseSiegeSocial || {};
    const adresseParts = [a.numeroVoie, a.typeVoie, a.nomVoie].filter(Boolean);
    return {
      adresse: adresseParts.join(" "),
      codePostal: a.codePostal || "",
      ville: a.ville || "",
      denomination: personne.denomination || "",
      siren: personne.numeroImmatriculation
        ? personne.numeroImmatriculation.numeroIdentification
        : "",
      activite: personne.activite || "",
      formeJuridique: personne.formeJuridique || "",
    };
  } catch {
    return {
      adresse: "",
      codePostal: "",
      ville: "",
      denomination: "",
      siren: "",
      activite: "",
      formeJuridique: "",
    };
  }
}

function csvEscape(value) {
  const str = String(value ?? "").replace(/"/g, '""');
  return /[;"\n]/.test(str) ? `"${str}"` : str;
}

// Génère la liste des mois (format "YYYY/MM") entre dateFrom et aujourd'hui
function monthsBetween(from) {
  const months = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const now = new Date();
  while (cursor <= now) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    months.push(`${y}/${m}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

async function fetchMonth(monthStr) {
  const rows = [];

  const params = new URLSearchParams();
  params.append("dataset", DATASET);
  params.append("rows", String(MAX_ROWS_PER_MONTH));
  params.append("format", "json");
  params.append("refine.familleavis_lib", "Procédures collectives");
  params.append("refine.dateparution", monthStr);
  // Note : refine.numerodepartement avec plusieurs valeurs fonctionne en ET
  // (pas en OU) sur cette API — le filtre département est donc appliqué
  // côté client après récupération, pas dans la requête.

  const url = `${API_BASE}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Erreur API BODACC (${monthStr}): ${res.status} ${res.statusText} — ${body.slice(0, 200)}`
    );
  }
  const page = await res.json(); // tableau brut d'enregistrements pour le mois entier
  if (page.length >= MAX_ROWS_PER_MONTH) {
    console.warn(
      `  ⚠️  ${monthStr} a atteint le plafond de ${MAX_ROWS_PER_MONTH} lignes — des données ont peut-être été tronquées, augmentez MAX_ROWS_PER_MONTH.`
    );
  }

  for (const record of page) {
    const f = record.fields;
    if (depFilter && !depFilter.includes(f.numerodepartement)) continue;

    const adresseInfo = extractAdresse(f.listepersonnes);
    const typeProcedure = classifyProcedure(f.jugement);

    rows.push({
      id: f.id,
      dateParution: f.dateparution,
      typeProcedure,
      urgence: URGENCY_WEIGHT[typeProcedure] || 1,
      denomination: adresseInfo.denomination || f.commercant || "",
      siren: adresseInfo.siren,
      activite: adresseInfo.activite,
      formeJuridique: adresseInfo.formeJuridique,
      adresse: adresseInfo.adresse,
      codePostal: adresseInfo.codePostal || f.cp || "",
      ville: adresseInfo.ville || f.ville || "",
      departement: f.numerodepartement,
      tribunal: f.tribunal,
      urlComplete: f.url_complete,
    });
  }

  await new Promise((r) => setTimeout(r, 150)); // ménage l'API publique
  return rows;
}

async function fetchAllRecords() {
  const months = monthsBetween(dateFrom);
  let rows = [];
  for (const monthStr of months) {
    const monthRows = await fetchMonth(monthStr);
    rows = rows.concat(monthRows);
    console.log(`  ${monthStr} : ${monthRows.length} annonces (cumulé : ${rows.length})`);
  }
  return rows;
}

async function main() {
  console.log(
    `Récupération BODACC — Procédures collectives depuis ${dateFromStr}${
      depFilter ? ` — départements : ${depFilter.join(", ")}` : " — France entière"
    }`
  );

  const rows = await fetchAllRecords();

  const headers = [
    "id",
    "dateParution",
    "typeProcedure",
    "urgence",
    "denomination",
    "siren",
    "activite",
    "formeJuridique",
    "adresse",
    "codePostal",
    "ville",
    "departement",
    "tribunal",
    "urlComplete",
  ];

  const csvLines = [headers.join(";")];
  for (const row of rows) {
    csvLines.push(headers.map((h) => csvEscape(row[h])).join(";"));
  }

  const outPath = "bodacc_procedures_collectives.csv";
  fs.writeFileSync(outPath, csvLines.join("\n"), "utf8");
  console.log(`\n✅ ${rows.length} annonces exportées dans ${outPath}`);
}

main().catch((err) => {
  console.error("Erreur:", err.message);
  process.exit(1);
});
