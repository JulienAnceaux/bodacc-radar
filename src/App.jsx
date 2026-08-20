import React, { useState, useMemo } from "react";
import { Search, AlertTriangle, Download, Loader2 } from "lucide-react";

const PROCEDURE_STYLES = {
  "Liquidation judiciaire": { color: "#B4432C", label: "Liquidation" },
  "Plan de cession": { color: "#B4432C", label: "Plan de cession" },
  "Redressement judiciaire": { color: "#9A7B2E", label: "Redressement" },
  Sauvegarde: { color: "#3D6B5C", label: "Sauvegarde" },
};

function styleFor(type) {
  return PROCEDURE_STYLES[type] || { color: "#7A756B", label: type || "Autre" };
}

function urgenceLabel(u) {
  if (u >= 3) return "Urgent";
  if (u === 2) return "À surveiller";
  return "Radar";
}

export default function BodaccExplorer() {
  const [villeInput, setVilleInput] = useState("");
  const [searchedVille, setSearchedVille] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [typeFilters, setTypeFilters] = useState(
    new Set(["Liquidation judiciaire", "Redressement judiciaire", "Sauvegarde", "Plan de cession"])
  );
  const [search, setSearch] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    const ville = villeInput.trim();
    if (ville.length < 2) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/bodacc-search?ville=" + encodeURIComponent(ville));
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setResults(null);
      } else {
        setResults(data.results);
        setSearchedVille(data.ville);
        setSearch("");
      }
    } catch {
      setError("Impossible de contacter le serveur. Réessaie dans un instant.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const newSearch = () => {
    setResults(null);
    setSearchedVille("");
    setVilleInput("");
    setError("");
  };

  const allTypes = useMemo(() => {
    if (!results) return [];
    const s = new Set(results.map((r) => r.typeProcedure).filter(Boolean));
    return Array.from(s);
  }, [results]);

  const filtered = useMemo(() => {
    if (!results) return [];
    let out = results;
    if (typeFilters.size > 0) {
      out = out.filter((r) => typeFilters.has(r.typeProcedure));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (r) =>
          (r.denomination || "").toLowerCase().includes(q) ||
          (r.activite || "").toLowerCase().includes(q)
      );
    }
    return out;
  }, [results, typeFilters, search]);

  const toggleType = (t) => {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  };

  const exportCsv = () => {
    const headers = [
      "typeProcedure", "urgence", "denomination", "siren", "activite",
      "adresse", "codePostal", "ville", "departement", "dateParution", "tribunal", "urlComplete",
    ];
    const lines = [headers.join(";")];
    filtered.forEach((r) => {
      lines.push(headers.map((h) => '"' + String(r[h] ?? "").replace(/"/g, '""') + '"').join(";"));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bodacc_" + searchedVille.toLowerCase().replace(/\s+/g, "-") + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.eyebrow}>BULLETIN DE VEILLE</div>
          <h1 style={styles.title}>Radar BODACC</h1>
          <p style={styles.subtitle}>
            Procédures collectives — repérage des locaux commerciaux susceptibles de se
            libérer, avant publication sur les portails.
          </p>

          <form onSubmit={handleSearch} style={styles.searchForm}>
            <input
              type="text"
              value={villeInput}
              onChange={(e) => setVilleInput(e.target.value)}
              placeholder="Nom d'une ville (ex : Pontoise)"
              style={styles.searchInput}
              autoFocus
            />
            <button type="submit" style={styles.searchBtn} disabled={loading}>
              {loading ? (
                <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Search size={15} />
              )}
              Rechercher
            </button>
          </form>
          {error && (
            <p style={styles.headerError}>
              <AlertTriangle size={13} style={{ marginRight: 5, verticalAlign: -2 }} />
              {error}
            </p>
          )}
        </div>
      </header>

      <main style={styles.main}>
        {results === null ? (
          <div style={styles.empty}>
            {loading ? "Recherche en cours…" : "Tape le nom d'une ville pour lancer la recherche."}
          </div>
        ) : (
          <>
            <div style={styles.toolbar}>
              <div style={styles.statsRow}>
                <StatBlock label={'Résultats pour "' + searchedVille + '"'} value={results.length} />
                <button onClick={newSearch} style={styles.newSearchBtn}>
                  ← Nouvelle recherche
                </button>
                <div style={{ marginLeft: "auto" }}>
                  <button onClick={exportCsv} style={styles.exportBtn}>
                    <Download size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
                    Exporter ({filtered.length})
                  </button>
                </div>
              </div>

              <div style={styles.filterRow}>
                <input
                  type="text"
                  placeholder="Filtrer par enseigne ou activité…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={styles.search}
                />
              </div>

              <div style={styles.typeRow}>
                {allTypes.map((t) => {
                  const st = styleFor(t);
                  const active = typeFilters.has(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleType(t)}
                      style={{
                        ...styles.typeChip,
                        borderColor: active ? st.color : "#DDD8CC",
                        color: active ? st.color : "#A8A296",
                        background: active ? st.color + "14" : "transparent",
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={styles.tableWrap}>
              {filtered.length === 0 ? (
                <div style={styles.empty}>
                  {results.length === 0
                    ? "Aucune procédure collective trouvée pour cette ville."
                    : "Aucune annonce ne correspond à ces filtres."}
                </div>
              ) : (
                filtered.map((r) => <Row key={r.id} r={r} />)
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Row({ r }) {
  const st = styleFor(r.typeProcedure);
  return (
    <a
      href={r.urlComplete}
      target="_blank"
      rel="noopener noreferrer"
      style={{ ...styles.row, borderLeftColor: st.color }}
    >
      <div style={styles.rowMain}>
        <div style={styles.rowTop}>
          <span style={styles.denomination}>{r.denomination || "Dénomination inconnue"}</span>
          <span style={{ ...styles.urgenceBadge, color: st.color, borderColor: st.color }}>
            {urgenceLabel(Number(r.urgence))}
          </span>
        </div>
        <div style={styles.rowMeta}>
          {r.typeProcedure} · {r.ville} ({r.codePostal}) · {r.dateParution}
        </div>
        {r.activite && r.activite !== "Non précisé" && (
          <div style={styles.rowActivite}>
            {r.activite.slice(0, 140)}
            {r.activite.length > 140 ? "…" : ""}
          </div>
        )}
      </div>
      <div style={styles.rowSiren}>{r.siren}</div>
    </a>
  );
}

function StatBlock({ label, value, accent = "#F6F4EE" }) {
  return (
    <div style={styles.statBlock}>
      <div style={{ ...styles.statValue, color: "#2A2620" }}>{value.toLocaleString("fr-FR")}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const FONT_DISPLAY = "'Iowan Old Style', 'Georgia', 'Times New Roman', serif";
const FONT_MONO = "'IBM Plex Mono', 'SF Mono', 'Menlo', monospace";
const FONT_BODY = "'Inter', -apple-system, 'Segoe UI', sans-serif";

const styles = {
  page: { minHeight: "100vh", background: "#F6F4EE", fontFamily: FONT_BODY, color: "#2A2620" },
  header: { background: "#1E2A26", color: "#F6F4EE", padding: "28px 20px 32px" },
  headerInner: { maxWidth: 880, margin: "0 auto" },
  eyebrow: { fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.12em", color: "#8FAFA0", marginBottom: 8 },
  title: { fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" },
  subtitle: { fontSize: 14, color: "#C9CFC9", marginTop: 8, maxWidth: 520, lineHeight: 1.5 },
  searchForm: { display: "flex", gap: 10, marginTop: 22, maxWidth: 480 },
  searchInput: {
    flex: 1, padding: "12px 14px", border: "1px solid #3D4A45", borderRadius: 4,
    fontSize: 15, background: "#28352F", color: "#F6F4EE", fontFamily: FONT_BODY,
  },
  searchBtn: {
    display: "flex", alignItems: "center", gap: 7, padding: "12px 18px",
    background: "#F6F4EE", color: "#1E2A26", border: "none", borderRadius: 4,
    fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: FONT_BODY,
  },
  headerError: { fontSize: 13, color: "#E8A99A", marginTop: 12, marginBottom: 0 },
  main: { maxWidth: 880, margin: "0 auto", padding: "20px 16px 60px" },
  empty: { padding: "64px 0", textAlign: "center", color: "#7A756B", fontSize: 15 },
  toolbar: { marginTop: 8, marginBottom: 6 },
  statsRow: { display: "flex", gap: 20, alignItems: "center", marginBottom: 18, flexWrap: "wrap" },
  statBlock: {},
  statValue: { fontFamily: FONT_DISPLAY, fontSize: 26, lineHeight: 1 },
  statLabel: { fontSize: 11, color: "#7A756B", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.04em" },
  newSearchBtn: {
    padding: "6px 12px", fontSize: 12.5, border: "1px solid #DDD8CC", borderRadius: 3,
    background: "transparent", color: "#7A756B", cursor: "pointer", fontFamily: FONT_BODY,
  },
  exportBtn: {
    padding: "8px 14px", fontSize: 12.5, border: "1px solid #1E2A26", borderRadius: 3,
    background: "transparent", color: "#1E2A26", cursor: "pointer", fontFamily: FONT_BODY, whiteSpace: "nowrap",
  },
  filterRow: { display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" },
  search: {
    flex: 1, minWidth: 200, padding: "8px 12px", border: "1px solid #DDD8CC", borderRadius: 3,
    fontSize: 13, fontFamily: FONT_BODY, background: "#FBFAF6",
  },
  typeRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 },
  typeChip: {
    padding: "5px 10px", fontSize: 11.5, borderRadius: 20, border: "1px solid",
    cursor: "pointer", fontFamily: FONT_BODY, fontWeight: 500,
  },
  tableWrap: { borderTop: "1px solid #DDD8CC" },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
    padding: "13px 4px 13px 14px", borderBottom: "1px solid #EAE7DC", borderLeft: "3px solid",
    textDecoration: "none", color: "inherit",
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTop: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  denomination: { fontFamily: FONT_DISPLAY, fontSize: 15.5, fontWeight: 600 },
  urgenceBadge: {
    fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: "0.05em", border: "1px solid",
    borderRadius: 3, padding: "1px 5px",
  },
  rowMeta: { fontSize: 12, color: "#7A756B", marginTop: 3 },
  rowActivite: { fontSize: 11.5, color: "#A8A296", marginTop: 3, fontStyle: "italic" },
  rowSiren: { fontFamily: FONT_MONO, fontSize: 11, color: "#C9C4B8", flexShrink: 0 },
};
import React, { useState, useMemo } from "react";
import { Search, AlertTriangle, MapPin, Download, Loader2 } from "lucide-react";

const ZONE_DOMUS = new Set(["95", "78", "60"]);

const PROCEDURE_STYLES = {
  "Liquidation judiciaire": { color: "#B4432C", label: "Liquidation" },
  "Plan de cession": { color: "#B4432C", label: "Plan de cession" },
  "Redressement judiciaire": { color: "#9A7B2E", label: "Redressement" },
  Sauvegarde: { color: "#3D6B5C", label: "Sauvegarde" },
};

function styleFor(type) {
  return PROCEDURE_STYLES[type] || { color: "#7A756B", label: type || "Autre" };
}

function urgenceLabel(u) {
  if (u >= 3) return "Urgent";
  if (u === 2) return "À surveiller";
  return "Radar";
}

export default function BodaccExplorer() {
  const [villeInput, setVilleInput] = useState("");
  const [searchedVille, setSearchedVille] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [typeFilters, setTypeFilters] = useState(
    new Set(["Liquidation judiciaire", "Redressement judiciaire", "Sauvegarde", "Plan de cession"])
  );
  const [search, setSearch] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    const ville = villeInput.trim();
    if (ville.length < 2) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/bodacc-search?ville=" + encodeURIComponent(ville));
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setResults(null);
      } else {
        setResults(data.results);
        setSearchedVille(data.ville);
        setSearch("");
      }
    } catch {
      setError("Impossible de contacter le serveur. Réessaie dans un instant.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const newSearch = () => {
    setResults(null);
    setSearchedVille("");
    setVilleInput("");
    setError("");
  };

  const allTypes = useMemo(() => {
    if (!results) return [];
    const s = new Set(results.map((r) => r.typeProcedure).filter(Boolean));
    return Array.from(s);
  }, [results]);

  const filtered = useMemo(() => {
    if (!results) return [];
    let out = results;
    if (typeFilters.size > 0) {
      out = out.filter((r) => typeFilters.has(r.typeProcedure));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (r) =>
          (r.denomination || "").toLowerCase().includes(q) ||
          (r.activite || "").toLowerCase().includes(q)
      );
    }
    return out;
  }, [results, typeFilters, search]);

  const toggleType = (t) => {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  };

  const exportCsv = () => {
    const headers = [
      "typeProcedure", "urgence", "denomination", "siren", "activite",
      "adresse", "codePostal", "ville", "departement", "dateParution", "tribunal", "urlComplete",
    ];
    const lines = [headers.join(";")];
    filtered.forEach((r) => {
      lines.push(headers.map((h) => '"' + String(r[h] ?? "").replace(/"/g, '""') + '"').join(";"));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bodacc_" + searchedVille.toLowerCase().replace(/\s+/g, "-") + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.eyebrow}>DOMUS VIRTUALIMMO · BULLETIN DE VEILLE</div>
          <h1 style={styles.title}>Radar BODACC</h1>
          <p style={styles.subtitle}>
            Procédures collectives — repérage des locaux commerciaux susceptibles de se
            libérer, avant publication sur les portails.
          </p>

          <form onSubmit={handleSearch} style={styles.searchForm}>
            <input
              type="text"
              value={villeInput}
              onChange={(e) => setVilleInput(e.target.value)}
              placeholder="Nom d'une ville (ex : Pontoise)"
              style={styles.searchInput}
              autoFocus
            />
            <button type="submit" style={styles.searchBtn} disabled={loading}>
              {loading ? (
                <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Search size={15} />
              )}
              Rechercher
            </button>
          </form>
          {error && (
            <p style={styles.headerError}>
              <AlertTriangle size={13} style={{ marginRight: 5, verticalAlign: -2 }} />
              {error}
            </p>
          )}
        </div>
      </header>

      <main style={styles.main}>
        {results === null ? (
          <div style={styles.empty}>
            {loading ? "Recherche en cours…" : "Tape le nom d'une ville pour lancer la recherche."}
          </div>
        ) : (
          <>
            <div style={styles.toolbar}>
              <div style={styles.statsRow}>
                <StatBlock label={'Résultats pour "' + searchedVille + '"'} value={results.length} />
                <button onClick={newSearch} style={styles.newSearchBtn}>
                  ← Nouvelle recherche
                </button>
                <div style={{ marginLeft: "auto" }}>
                  <button onClick={exportCsv} style={styles.exportBtn}>
                    <Download size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
                    Exporter ({filtered.length})
                  </button>
                </div>
              </div>

              <div style={styles.filterRow}>
                <input
                  type="text"
                  placeholder="Filtrer par enseigne ou activité…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={styles.search}
                />
              </div>

              <div style={styles.typeRow}>
                {allTypes.map((t) => {
                  const st = styleFor(t);
                  const active = typeFilters.has(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleType(t)}
                      style={{
                        ...styles.typeChip,
                        borderColor: active ? st.color : "#DDD8CC",
                        color: active ? st.color : "#A8A296",
                        background: active ? st.color + "14" : "transparent",
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={styles.tableWrap}>
              {filtered.length === 0 ? (
                <div style={styles.empty}>
                  {results.length === 0
                    ? "Aucune procédure collective trouvée pour cette ville."
                    : "Aucune annonce ne correspond à ces filtres."}
                </div>
              ) : (
                filtered.map((r) => <Row key={r.id} r={r} />)
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Row({ r }) {
  const st = styleFor(r.typeProcedure);
  const inZone = ZONE_DOMUS.has(r.departement);
  return (
    <a
      href={r.urlComplete}
      target="_blank"
      rel="noopener noreferrer"
      style={{ ...styles.row, borderLeftColor: st.color }}
    >
      <div style={styles.rowMain}>
        <div style={styles.rowTop}>
          <span style={styles.denomination}>{r.denomination || "Dénomination inconnue"}</span>
          {inZone && <span style={styles.zoneBadge}>ZONE DOMUS</span>}
          <span style={{ ...styles.urgenceBadge, color: st.color, borderColor: st.color }}>
            {urgenceLabel(Number(r.urgence))}
          </span>
        </div>
        <div style={styles.rowMeta}>
          {r.typeProcedure} · {r.ville} ({r.codePostal}) · {r.dateParution}
        </div>
        {r.activite && r.activite !== "Non précisé" && (
          <div style={styles.rowActivite}>
            {r.activite.slice(0, 140)}
            {r.activite.length > 140 ? "…" : ""}
          </div>
        )}
      </div>
      <div style={styles.rowSiren}>{r.siren}</div>
    </a>
  );
}

function StatBlock({ label, value, accent = "#F6F4EE" }) {
  return (
    <div style={styles.statBlock}>
      <div style={{ ...styles.statValue, color: "#2A2620" }}>{value.toLocaleString("fr-FR")}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const FONT_DISPLAY = "'Iowan Old Style', 'Georgia', 'Times New Roman', serif";
const FONT_MONO = "'IBM Plex Mono', 'SF Mono', 'Menlo', monospace";
const FONT_BODY = "'Inter', -apple-system, 'Segoe UI', sans-serif";

const styles = {
  page: { minHeight: "100vh", background: "#F6F4EE", fontFamily: FONT_BODY, color: "#2A2620" },
  header: { background: "#1E2A26", color: "#F6F4EE", padding: "28px 20px 32px" },
  headerInner: { maxWidth: 880, margin: "0 auto" },
  eyebrow: { fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.12em", color: "#8FAFA0", marginBottom: 8 },
  title: { fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" },
  subtitle: { fontSize: 14, color: "#C9CFC9", marginTop: 8, maxWidth: 520, lineHeight: 1.5 },
  searchForm: { display: "flex", gap: 10, marginTop: 22, maxWidth: 480 },
  searchInput: {
    flex: 1, padding: "12px 14px", border: "1px solid #3D4A45", borderRadius: 4,
    fontSize: 15, background: "#28352F", color: "#F6F4EE", fontFamily: FONT_BODY,
  },
  searchBtn: {
    display: "flex", alignItems: "center", gap: 7, padding: "12px 18px",
    background: "#F6F4EE", color: "#1E2A26", border: "none", borderRadius: 4,
    fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: FONT_BODY,
  },
  headerError: { fontSize: 13, color: "#E8A99A", marginTop: 12, marginBottom: 0 },
  main: { maxWidth: 880, margin: "0 auto", padding: "20px 16px 60px" },
  empty: { padding: "64px 0", textAlign: "center", color: "#7A756B", fontSize: 15 },
  toolbar: { marginTop: 8, marginBottom: 6 },
  statsRow: { display: "flex", gap: 20, alignItems: "center", marginBottom: 18, flexWrap: "wrap" },
  statBlock: {},
  statValue: { fontFamily: FONT_DISPLAY, fontSize: 26, lineHeight: 1 },
  statLabel: { fontSize: 11, color: "#7A756B", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.04em" },
  newSearchBtn: {
    padding: "6px 12px", fontSize: 12.5, border: "1px solid #DDD8CC", borderRadius: 3,
    background: "transparent", color: "#7A756B", cursor: "pointer", fontFamily: FONT_BODY,
  },
  exportBtn: {
    padding: "8px 14px", fontSize: 12.5, border: "1px solid #1E2A26", borderRadius: 3,
    background: "transparent", color: "#1E2A26", cursor: "pointer", fontFamily: FONT_BODY, whiteSpace: "nowrap",
  },
  filterRow: { display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" },
  search: {
    flex: 1, minWidth: 200, padding: "8px 12px", border: "1px solid #DDD8CC", borderRadius: 3,
    fontSize: 13, fontFamily: FONT_BODY, background: "#FBFAF6",
  },
  typeRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 },
  typeChip: {
    padding: "5px 10px", fontSize: 11.5, borderRadius: 20, border: "1px solid",
    cursor: "pointer", fontFamily: FONT_BODY, fontWeight: 500,
  },
  tableWrap: { borderTop: "1px solid #DDD8CC" },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
    padding: "13px 4px 13px 14px", borderBottom: "1px solid #EAE7DC", borderLeft: "3px solid",
    textDecoration: "none", color: "inherit",
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTop: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  denomination: { fontFamily: FONT_DISPLAY, fontSize: 15.5, fontWeight: 600 },
  zoneBadge: {
    fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: "0.05em", color: "#3D6B5C",
    border: "1px solid #3D6B5C55", borderRadius: 3, padding: "1px 5px",
  },
  urgenceBadge: {
    fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: "0.05em", border: "1px solid",
    borderRadius: 3, padding: "1px 5px",
  },
  rowMeta: { fontSize: 12, color: "#7A756B", marginTop: 3 },
  rowActivite: { fontSize: 11.5, color: "#A8A296", marginTop: 3, fontStyle: "italic" },
  rowSiren: { fontFamily: FONT_MONO, fontSize: 11, color: "#C9C4B8", flexShrink: 0 },
};
