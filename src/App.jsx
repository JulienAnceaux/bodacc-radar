import React, { useState, useMemo, useCallback } from "react";
import Papa from "papaparse";
import { Upload, AlertTriangle, MapPin, Download, X, ChevronDown } from "lucide-react";

// --- Zone Domus : départements couverts par le pipeline de scoring local ---
const ZONE_DOMUS = new Set(["95", "78", "60"]);

const PROCEDURE_STYLES = {
  "Liquidation judiciaire": { color: "#B4432C", label: "Liquidation" },
  "Plan de cession": { color: "#B4432C", label: "Plan de cession" },
  "Redressement judiciaire": { color: "#9A7B2E", label: "Redressement" },
  Sauvegarde: { color: "#3D6B5C", label: "Sauvegarde" },
};

function styleFor(type) {
  return (
    PROCEDURE_STYLES[type] || { color: "#7A756B", label: type || "Autre" }
  );
}

function urgenceLabel(u) {
  if (u >= 3) return "Urgent";
  if (u === 2) return "À surveiller";
  return "Radar";
}

export default function BodaccExplorer() {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [zoneFilter, setZoneFilter] = useState("domus"); // "domus" | "all"
  const [typeFilters, setTypeFilters] = useState(
    new Set(["Liquidation judiciaire", "Redressement judiciaire", "Sauvegarde", "Plan de cession"])
  );
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(60);

  const handleFile = useCallback((file) => {
    if (!file) return;
    setLoading(true);
    setError("");
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
      complete: (res) => {
        const cleaned = res.data
          .filter((r) => r.id)
          .map((r) => ({ ...r, urgence: Number(r.urgence) || 1 }));
        setRows(cleaned);
        setLoading(false);
        setVisibleCount(60);
      },
      error: (err) => {
        setError("Erreur de lecture du fichier : " + err.message);
        setLoading(false);
      },
    });
  }, []);

  const allTypes = useMemo(() => {
    const s = new Set(rows.map((r) => r.typeProcedure).filter(Boolean));
    return Array.from(s).sort(
      (a, b) => (styleFor(b).color === "#B4432C" ? 1 : 0) - (styleFor(a).color === "#B4432C" ? 1 : 0)
    );
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (zoneFilter === "domus") {
      out = out.filter((r) => ZONE_DOMUS.has(r.departement));
    }
    if (typeFilters.size > 0) {
      out = out.filter((r) => typeFilters.has(r.typeProcedure));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (r) =>
          (r.denomination || "").toLowerCase().includes(q) ||
          (r.activite || "").toLowerCase().includes(q) ||
          (r.ville || "").toLowerCase().includes(q) ||
          (r.codePostal || "").includes(q)
      );
    }
    return [...out].sort((a, b) => {
      if (b.urgence !== a.urgence) return b.urgence - a.urgence;
      return (b.dateParution || "").localeCompare(a.dateParution || "");
    });
  }, [rows, zoneFilter, typeFilters, search]);

  const stats = useMemo(() => {
    const domusCount = rows.filter((r) => ZONE_DOMUS.has(r.departement)).length;
    return { total: rows.length, domus: domusCount, national: rows.length - domusCount };
  }, [rows]);

  const toggleType = (t) => {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  };

  const exportCsv = () => {
    const headers = [
      "typeProcedure",
      "urgence",
      "denomination",
      "siren",
      "activite",
      "adresse",
      "codePostal",
      "ville",
      "departement",
      "dateParution",
      "tribunal",
      "urlComplete",
    ];
    const lines = [headers.join(";")];
    filtered.forEach((r) => {
      lines.push(headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(";"));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bodacc_filtre.csv";
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
        </div>
      </header>

      <main style={styles.main}>
        {rows.length === 0 ? (
          <UploadZone onFile={handleFile} loading={loading} error={error} />
        ) : (
          <>
            <div style={styles.toolbar}>
              <div style={styles.statsRow}>
                <StatBlock label="Annonces chargées" value={stats.total} />
                <StatBlock label="Zone Domus (95·78·60)" value={stats.domus} accent="#3D6B5C" />
                <StatBlock label="Hors zone" value={stats.national} accent="#7A756B" />
                <div style={{ marginLeft: "auto", fontSize: 12, color: "#7A756B", alignSelf: "center" }}>
                  {fileName}
                </div>
              </div>

              <div style={styles.filterRow}>
                <div style={styles.zoneToggle}>
                  <button
                    onClick={() => setZoneFilter("domus")}
                    style={{
                      ...styles.zoneBtn,
                      ...(zoneFilter === "domus" ? styles.zoneBtnActive : {}),
                    }}
                  >
                    <MapPin size={13} style={{ marginRight: 5, verticalAlign: -2 }} />
                    Zone Domus
                  </button>
                  <button
                    onClick={() => setZoneFilter("all")}
                    style={{
                      ...styles.zoneBtn,
                      ...(zoneFilter === "all" ? styles.zoneBtnActive : {}),
                    }}
                  >
                    France entière
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Chercher une enseigne, une activité, une ville…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={styles.search}
                />

                <button onClick={exportCsv} style={styles.exportBtn}>
                  <Download size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
                  Exporter ({filtered.length})
                </button>
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
                        background: active ? `${st.color}14` : "transparent",
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
                <div style={styles.empty}>Aucune annonce ne correspond à ces filtres.</div>
              ) : (
                <>
                  {filtered.slice(0, visibleCount).map((r) => (
                    <Row key={r.id} r={r} />
                  ))}
                  {visibleCount < filtered.length && (
                    <button
                      onClick={() => setVisibleCount((v) => v + 60)}
                      style={styles.loadMore}
                    >
                      Afficher plus ({filtered.length - visibleCount} restantes)
                    </button>
                  )}
                </>
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
          <div style={styles.rowActivite}>{r.activite.slice(0, 140)}{r.activite.length > 140 ? "…" : ""}</div>
        )}
      </div>
      <div style={styles.rowSiren}>{r.siren}</div>
    </a>
  );
}

function StatBlock({ label, value, accent = "#2A2620" }) {
  return (
    <div style={styles.statBlock}>
      <div style={{ ...styles.statValue, color: accent }}>{value.toLocaleString("fr-FR")}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function UploadZone({ onFile, loading, error }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onFile(e.dataTransfer.files?.[0]);
      }}
      style={{
        ...styles.dropzone,
        borderColor: dragOver ? "#3D6B5C" : "#DDD8CC",
        background: dragOver ? "#3D6B5C0A" : "#FBFAF6",
      }}
    >
      <Upload size={28} color="#7A756B" />
      <p style={styles.dropTitle}>Charge le CSV BODACC</p>
      <p style={styles.dropSub}>
        Fichier généré par <code style={styles.code}>bodacc_fetch.js</code> — séparateur point-virgule.
      </p>
      <label style={styles.fileLabel}>
        Choisir un fichier
        <input
          type="file"
          accept=".csv"
          onChange={(e) => onFile(e.target.files?.[0])}
          style={{ display: "none" }}
        />
      </label>
      {loading && <p style={styles.loadingText}>Lecture en cours…</p>}
      {error && (
        <p style={styles.errorText}>
          <AlertTriangle size={13} style={{ marginRight: 5, verticalAlign: -2 }} />
          {error}
        </p>
      )}
    </div>
  );
}

const FONT_DISPLAY = "'Iowan Old Style', 'Georgia', 'Times New Roman', serif";
const FONT_MONO = "'IBM Plex Mono', 'SF Mono', 'Menlo', monospace";
const FONT_BODY = "'Inter', -apple-system, 'Segoe UI', sans-serif";

const styles = {
  page: {
    minHeight: "100vh",
    background: "#F6F4EE",
    fontFamily: FONT_BODY,
    color: "#2A2620",
  },
  header: {
    background: "#1E2A26",
    color: "#F6F4EE",
    padding: "28px 20px 24px",
  },
  headerInner: { maxWidth: 880, margin: "0 auto" },
  eyebrow: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    letterSpacing: "0.12em",
    color: "#8FAFA0",
    marginBottom: 8,
  },
  title: {
    fontFamily: FONT_DISPLAY,
    fontSize: 34,
    fontWeight: 600,
    margin: 0,
    letterSpacing: "-0.01em",
  },
  subtitle: {
    fontSize: 14,
    color: "#C9CFC9",
    marginTop: 8,
    maxWidth: 520,
    lineHeight: 1.5,
  },
  main: { maxWidth: 880, margin: "0 auto", padding: "20px 16px 60px" },
  dropzone: {
    border: "1.5px dashed #DDD8CC",
    borderRadius: 4,
    padding: "48px 24px",
    textAlign: "center",
    marginTop: 24,
    transition: "all 0.15s ease",
  },
  dropTitle: { fontFamily: FONT_DISPLAY, fontSize: 18, margin: "14px 0 4px" },
  dropSub: { fontSize: 13, color: "#7A756B", margin: 0 },
  code: {
    fontFamily: FONT_MONO,
    background: "#EDEAE0",
    padding: "1px 5px",
    borderRadius: 3,
    fontSize: 12,
  },
  fileLabel: {
    display: "inline-block",
    marginTop: 18,
    padding: "9px 18px",
    background: "#1E2A26",
    color: "#F6F4EE",
    borderRadius: 3,
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 500,
  },
  loadingText: { marginTop: 12, fontSize: 13, color: "#7A756B" },
  errorText: { marginTop: 12, fontSize: 13, color: "#B4432C" },
  toolbar: { marginTop: 22, marginBottom: 6 },
  statsRow: { display: "flex", gap: 24, alignItems: "flex-end", marginBottom: 18 },
  statBlock: {},
  statValue: { fontFamily: FONT_DISPLAY, fontSize: 26, lineHeight: 1 },
  statLabel: { fontSize: 11, color: "#7A756B", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.04em" },
  filterRow: { display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" },
  zoneToggle: {
    display: "flex",
    border: "1px solid #DDD8CC",
    borderRadius: 3,
    overflow: "hidden",
    flexShrink: 0,
  },
  zoneBtn: {
    padding: "7px 12px",
    fontSize: 12.5,
    background: "#FBFAF6",
    border: "none",
    cursor: "pointer",
    color: "#7A756B",
    fontFamily: FONT_BODY,
  },
  zoneBtnActive: { background: "#1E2A26", color: "#F6F4EE" },
  search: {
    flex: 1,
    minWidth: 200,
    padding: "8px 12px",
    border: "1px solid #DDD8CC",
    borderRadius: 3,
    fontSize: 13,
    fontFamily: FONT_BODY,
    background: "#FBFAF6",
  },
  exportBtn: {
    padding: "8px 14px",
    fontSize: 12.5,
    border: "1px solid #1E2A26",
    borderRadius: 3,
    background: "transparent",
    color: "#1E2A26",
    cursor: "pointer",
    fontFamily: FONT_BODY,
    whiteSpace: "nowrap",
  },
  typeRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 },
  typeChip: {
    padding: "5px 10px",
    fontSize: 11.5,
    borderRadius: 20,
    border: "1px solid",
    cursor: "pointer",
    fontFamily: FONT_BODY,
    fontWeight: 500,
  },
  tableWrap: { borderTop: "1px solid #DDD8CC" },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "13px 4px 13px 14px",
    borderBottom: "1px solid #EAE7DC",
    borderLeft: "3px solid",
    textDecoration: "none",
    color: "inherit",
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTop: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  denomination: { fontFamily: FONT_DISPLAY, fontSize: 15.5, fontWeight: 600 },
  zoneBadge: {
    fontFamily: FONT_MONO,
    fontSize: 9.5,
    letterSpacing: "0.05em",
    color: "#3D6B5C",
    border: "1px solid #3D6B5C55",
    borderRadius: 3,
    padding: "1px 5px",
  },
  urgenceBadge: {
    fontFamily: FONT_MONO,
    fontSize: 9.5,
    letterSpacing: "0.05em",
    border: "1px solid",
    borderRadius: 3,
    padding: "1px 5px",
  },
  rowMeta: { fontSize: 12, color: "#7A756B", marginTop: 3 },
  rowActivite: { fontSize: 11.5, color: "#A8A296", marginTop: 3, fontStyle: "italic" },
  rowSiren: { fontFamily: FONT_MONO, fontSize: 11, color: "#C9C4B8", flexShrink: 0 },
  empty: { padding: "48px 0", textAlign: "center", color: "#7A756B", fontSize: 14 },
  loadMore: {
    display: "block",
    width: "100%",
    padding: "14px",
    textAlign: "center",
    background: "transparent",
    border: "none",
    borderTop: "1px solid #EAE7DC",
    color: "#1E2A26",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: FONT_BODY,
  },
};
