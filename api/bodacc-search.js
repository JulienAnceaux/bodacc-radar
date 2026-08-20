// Interroge l'API publique BODACC en direct pour une ville donnée.
// Appelé à chaque recherche depuis le frontend (pas de fichier à générer en amont).

function classifyProcedure(jugementRaw) {
  if (!jugementRaw) return "Inconnu";
  let jugement;
  try {
    jugement = typeof jugementRaw === "string" ? JSON.parse(jugementRaw) : jugementRaw;
  } catch {
    return "Inconnu";
  }
  const texte = (jugement.famille || "") + " " + (jugement.nature || "");
  const texteLower = texte.toLowerCase();

  if (texteLower.includes("liquidation")) return "Liquidation judiciaire";
  if (texteLower.includes("redressement")) return "Redressement judiciaire";
  if (texteLower.includes("sauvegarde")) return "Sauvegarde";
  if (texteLower.includes("plan de cession")) return "Plan de cession";
  return jugement.nature || jugement.famille || "Autre procédure collective";
}

const URGENCY_WEIGHT = {
  "Liquidation judiciaire": 3,
  "Plan de cession": 3,
  "Redressement judiciaire": 2,
  Sauvegarde: 1,
};

function extractAdresse(listepersonnesRaw) {
  try {
    const parsed =
      typeof listepersonnesRaw === "string" ? JSON.parse(listepersonnesRaw) : listepersonnesRaw;
    const personne = parsed.personne || (parsed.personnes && parsed.personnes[0]) || {};
    const a = personne.adresseSiegeSocial || {};
    const adresseParts = [a.numeroVoie, a.typeVoie, a.nomVoie].filter(Boolean);
    return {
      adresse: adresseParts.join(" "),
      codePostal: a.codePostal || "",
      denomination: personne.denomination || "",
      siren: personne.numeroImmatriculation ? personne.numeroImmatriculation.numeroIdentification : "",
      activite: personne.activite || "",
      formeJuridique: personne.formeJuridique || "",
    };
  } catch {
    return { adresse: "", codePostal: "", denomination: "", siren: "", activite: "", formeJuridique: "" };
  }
}

function normalize(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1)
    .join(" ")
    .trim();
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Méthode non autorisée" });
    return;
  }

  const ville = (req.query.ville || "").toString().trim();
  if (ville.length < 2) {
    res.status(400).json({ error: "Renseigne une ville (2 caractères minimum)." });
    return;
  }

  const params = new URLSearchParams();
  params.set("dataset", "annonces-commerciales");
  params.set("rows", "300");
  params.set("refine.familleavis_lib", "Procédures collectives");
  params.set("q", 'ville:"' + ville.replace(/"/g, "") + '"');

  const apiUrl = "https://bodacc-datadila.opendatasoft.com/api/records/1.0/search/?" + params.toString();

  let data;
  try {
    const apiRes = await fetch(apiUrl);
    if (!apiRes.ok) throw new Error("BODACC API " + apiRes.status);
    data = await apiRes.json();
  } catch {
    res.status(502).json({ error: "Le BODACC est indisponible pour le moment, réessaie dans un instant." });
    return;
  }

  const target = normalize(ville);

  const results = (data.records || [])
    .filter((record) => {
      const v = normalize(record.fields.ville);
      return v === target || v.startsWith(target) || target.startsWith(v);
    })
    .map((record) => {
      const f = record.fields;
      const adresseInfo = extractAdresse(f.listepersonnes);
      const typeProcedure = classifyProcedure(f.jugement);
      return {
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
        ville: f.ville,
        departement: f.numerodepartement,
        tribunal: f.tribunal,
        urlComplete: f.url_complete,
      };
    });

  results.sort((a, b) => {
    if (b.urgence !== a.urgence) return b.urgence - a.urgence;
    return (b.dateParution || "").localeCompare(a.dateParution || "");
  });

  res.status(200).json({
    ville,
    total: results.length,
    results: results.slice(0, 200),
  });
}
