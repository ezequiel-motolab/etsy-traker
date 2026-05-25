import { useState, useMemo, useEffect, useRef } from "react";

const APP_STORAGE_KEYS = ["etsy-tracker-data"];
const BACKUP_APP_ID = "etsy-tracker";

const INITIAL_FORM = {
  shopName: "",
  productName: "",
  price: "",
  shopSales: "",
  productReviews: "",
  shopReviews: "",
  rating: "",
  isBestseller: false,
  isSpecialized: false,
  searchPosition: "",
  // Nuevos campos
  sizeCount: "",
  sizePrices: "",
  remoteControl: "",
  shipFrom: "",
  shipPrice: "",
  shipTime: "",
  photoReal: false,
  photoAI: false,
  photoVideo: false,
  customization: "",
  notes: "",
  circuits: "",
};

const BADGE = ({ children, color }) => (
  <span style={{
    background: color, color: "#fff", borderRadius: 4,
    padding: "2px 8px", fontSize: 11, fontWeight: 700,
    letterSpacing: 1, textTransform: "uppercase",
  }}>{children}</span>
);

const Section = ({ title }) => (
  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#ff6a20", borderBottom: "1px solid #ff450033", paddingBottom: 6, marginBottom: 14, marginTop: 20 }}>
    {title}
  </div>
);

export default function App() {
  const [competitors, setCompetitors] = useState(() => {
    try {
      const saved = localStorage.getItem(APP_STORAGE_KEYS[0]);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [form, setForm] = useState(INITIAL_FORM);
  const [editIndex, setEditIndex] = useState(null);
  const [activeTab, setActiveTab] = useState("list");
  const importInputRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(APP_STORAGE_KEYS[0], JSON.stringify(competitors)); }
    catch {}
  }, [competitors]);

  const stats = useMemo(() => {
    if (!competitors.length) return null;
    const prices = competitors.map(c => parseFloat(c.price)).filter(Boolean);
    const reviews = competitors.map(c => parseFloat(c.productReviews || c.shopReviews)).filter(Boolean);
    const avgPrice = prices.length ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : null;
    const minPrice = prices.length ? Math.min(...prices).toFixed(2) : null;
    const maxPrice = prices.length ? Math.max(...prices).toFixed(2) : null;
    const avgReviews = reviews.length ? Math.round(reviews.reduce((a, b) => a + b, 0) / reviews.length) : null;
    const bestsellers = competitors.filter(c => c.isBestseller).length;
    const specialized = competitors.filter(c => c.isSpecialized).length;
    const uniqueShops = new Set(competitors.map(c => c.shopName.trim().toLowerCase())).size;
    const withRemote = competitors.filter(c => c.remoteControl && c.remoteControl !== "ninguno").length;
    const withVideo = competitors.filter(c => c.photoVideo).length;
    const withCustom = competitors.filter(c => c.customization).length;
    const shipPrices = competitors.map(c => parseFloat(c.shipPrice)).filter(v => !isNaN(v) && v >= 0);
    const avgShip = shipPrices.length ? (shipPrices.reduce((a, b) => a + b, 0) / shipPrices.length).toFixed(2) : null;
    return { avgPrice, minPrice, maxPrice, avgReviews, bestsellers, specialized, uniqueShops, withRemote, withVideo, withCustom, avgShip, total: competitors.length };
  }, [competitors]);

  const groupedCompetitors = useMemo(() => {
    const groups = {};
    competitors.forEach((c, i) => {
      const key = c.shopName.trim().toLowerCase();
      if (!groups[key]) groups[key] = { shopName: c.shopName, products: [] };
      groups[key].products.push({ ...c, originalIndex: i });
    });
    return Object.values(groups);
  }, [competitors]);

  const myPriceSuggestion = useMemo(() => {
    if (!stats || !stats.avgPrice) return null;
    const avg = parseFloat(stats.avgPrice);
    return { low: (avg * 0.9).toFixed(2), avg: avg.toFixed(2), high: (avg * 1.15).toFixed(2) };
  }, [stats]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = () => {
    if (!form.shopName || !form.price) return;
    if (editIndex !== null) {
      setCompetitors(c => c.map((item, i) => i === editIndex ? form : item));
      setEditIndex(null);
    } else {
      setCompetitors(c => [...c, form]);
    }
    setForm(INITIAL_FORM);
    setActiveTab("list");
  };

  const handleEdit = (i) => {
    setForm({ ...INITIAL_FORM, ...competitors[i] });
    setEditIndex(i);
    setActiveTab("add");
  };

  const handleDelete = (i) => {
    setCompetitors(c => c.filter((_, idx) => idx !== i));
  };

  const getAppLocalStorageData = () => {
    return APP_STORAGE_KEYS.reduce((data, key) => {
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
      return data;
    }, {});
  };

  const handleExportBackup = () => {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const backup = {
      app: BACKUP_APP_ID,
      exportedAt: now.toISOString(),
      origin: window.location.origin,
      storage: getAppLocalStorageData(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `etsy-tracker-backup-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportBackupClick = () => {
    if (importInputRef.current) importInputRef.current.click();
  };

  const handleImportBackup = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result);
        const isValidBackup =
          backup &&
          backup.app === BACKUP_APP_ID &&
          backup.storage &&
          typeof backup.storage === "object" &&
          APP_STORAGE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(backup.storage, key));

        if (!isValidBackup) {
          alert("El archivo seleccionado no parece un backup valido de Etsy Tracker.");
          return;
        }

        const shouldRestore = window.confirm("Esto sobrescribir\u00e1 los datos actuales de la app. \u00bfQuieres continuar?");
        if (!shouldRestore) return;

        APP_STORAGE_KEYS.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(backup.storage, key)) {
            localStorage.setItem(key, String(backup.storage[key]));
          }
        });
        window.location.reload();
      } catch {
        alert("No se pudo leer el archivo JSON del backup.");
      }
    };
    reader.readAsText(file);
  };

  const handleClearLocalData = () => {
    const firstConfirm = window.confirm("Esto borrar\u00e1 solo los datos locales de esta app en este navegador. Antes de continuar, aseg\u00farate de haber exportado un backup. \u00bfQuieres seguir?");
    if (!firstConfirm) return;

    const secondConfirm = window.confirm("Confirmaci\u00f3n final: se borrar\u00e1n los datos locales de Etsy Tracker y se recargar\u00e1 la app. \u00bfBorrar ahora?");
    if (!secondConfirm) return;

    APP_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0a0f; }
    .app { min-height: 100vh; background: #0a0a0f; color: #e8e0d0; font-family: 'Barlow', sans-serif; max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #1a0a00 0%, #0a0a0f 60%); border-bottom: 2px solid #ff4500; padding: 20px 16px 16px; }
    .header-title { font-family: 'Barlow Condensed', sans-serif; font-size: 28px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #ff6a20; line-height: 1; }
    .header-sub { font-size: 12px; color: #888; letter-spacing: 3px; text-transform: uppercase; margin-top: 4px; }
    .saved-badge { font-size: 11px; color: #2ecc71; letter-spacing: 1px; float: right; margin-top: 2px; }
    .tabs { display: flex; border-bottom: 1px solid #222; background: #0d0d14; position: sticky; top: 0; z-index: 10; }
    .tab { flex: 1; padding: 14px 8px; text-align: center; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; color: #555; cursor: pointer; border: none; background: none; transition: all 0.2s; }
    .tab.active { color: #ff6a20; border-bottom: 2px solid #ff6a20; }
    .content { padding: 16px; }
    .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
    .stat-card { background: #12121a; border: 1px solid #222; border-radius: 8px; padding: 14px 12px; }
    .stat-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #666; margin-bottom: 4px; }
    .stat-value { font-family: 'Barlow Condensed', sans-serif; font-size: 26px; font-weight: 900; color: #ff6a20; }
    .stat-sub { font-size: 11px; color: #555; margin-top: 2px; }
    .shop-group { margin-bottom: 16px; }
    .shop-header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #1a0a00; border: 1px solid #ff450033; border-radius: 8px 8px 0 0; }
    .shop-header-name { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 900; letter-spacing: 1px; color: #ff6a20; text-transform: uppercase; flex: 1; }
    .shop-header-count { font-size: 11px; color: #666; background: #0a0a0f; border-radius: 10px; padding: 2px 8px; white-space: nowrap; }
    .competitor-card { background: #12121a; border-left: 1px solid #1e1e2e; border-right: 1px solid #1e1e2e; border-bottom: 1px solid #1e1e2e; padding: 14px; }
    .competitor-card:last-child { border-radius: 0 0 8px 8px; }
    .comp-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .comp-name { font-size: 14px; font-weight: 600; color: #ccc; }
    .comp-price { font-family: 'Barlow Condensed', sans-serif; font-size: 22px; font-weight: 900; color: #ff6a20; white-space: nowrap; }
    .comp-stats { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px; margin: 10px 0; }
    .comp-stat { text-align: center; background: #0a0a0f; border-radius: 6px; padding: 6px 4px; }
    .comp-stat-label { font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #555; }
    .comp-stat-value { font-size: 12px; font-weight: 600; color: #ccc; margin-top: 2px; }
    .comp-extra { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin: 6px 0; }
    .comp-extra-item { background: #0d0d14; border-radius: 6px; padding: 6px 8px; }
    .comp-extra-label { font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #555; }
    .comp-extra-value { font-size: 12px; color: #aaa; margin-top: 2px; }
    .badges { display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0; }
    .comp-notes { font-size: 12px; color: #666; font-style: italic; margin-top: 6px; border-top: 1px solid #1a1a26; padding-top: 6px; }
    .comp-actions { display: flex; gap: 8px; margin-top: 10px; }
    .pos-tag { display: inline-block; font-size: 11px; color: #666; background: #1a1a2e; border: 1px solid #333; border-radius: 4px; padding: 1px 7px; margin-top: 4px; }
    .btn { padding: 8px 16px; border-radius: 6px; border: none; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
    .btn-primary { background: #ff4500; color: #fff; }
    .btn-primary:hover { background: #ff6a20; }
    .btn-outline { background: transparent; color: #888; border: 1px solid #333; }
    .btn-outline:hover { border-color: #ff4500; color: #ff4500; }
    .btn-danger { background: transparent; color: #c0392b; border: 1px solid #c0392b; }
    .btn-danger:hover { background: #c0392b; color: #fff; }
    .btn-full { width: 100%; padding: 14px; font-size: 15px; }
    .form-card { background: #12121a; border: 1px solid #222; border-radius: 10px; padding: 16px; }
    .form-title { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #ff6a20; margin-bottom: 4px; }
    .field { margin-bottom: 14px; }
    .label { display: block; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #666; margin-bottom: 6px; }
    .input { width: 100%; background: #0a0a0f; border: 1px solid #2a2a3a; border-radius: 6px; padding: 10px 12px; color: #e8e0d0; font-family: 'Barlow', sans-serif; font-size: 14px; outline: none; transition: border 0.2s; }
    .input:focus { border-color: #ff4500; }
    .select { width: 100%; background: #0a0a0f; border: 1px solid #2a2a3a; border-radius: 6px; padding: 10px 12px; color: #e8e0d0; font-family: 'Barlow', sans-serif; font-size: 14px; outline: none; appearance: none; }
    .select:focus { border-color: #ff4500; }
    .input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .input-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .checkbox-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #0a0a0f; border: 1px solid #2a2a3a; border-radius: 6px; cursor: pointer; margin-bottom: 8px; }
    .checkbox-row input { width: 16px; height: 16px; accent-color: #ff4500; flex-shrink: 0; }
    .checkbox-label { font-size: 13px; color: #aaa; }
    .checkbox-group { display: flex; flex-direction: column; gap: 0; }
    .strategy-card { background: #12121a; border: 1px solid #ff450033; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
    .strategy-title { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #ff6a20; margin-bottom: 10px; }
    .strategy-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #1a1a26; }
    .strategy-row:last-child { border-bottom: none; }
    .strategy-key { font-size: 12px; color: #888; }
    .strategy-val { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 700; color: #fff; }
    .tip { background: #0d1a0d; border-left: 3px solid #2ecc71; border-radius: 0 6px 6px 0; padding: 10px 12px; margin-bottom: 10px; font-size: 13px; color: #aaa; line-height: 1.6; }
    .tip strong { color: #2ecc71; }
    .tip.warning { background: #1a0d00; border-left-color: #f39c12; }
    .tip.warning strong { color: #f39c12; }
    .empty { text-align: center; padding: 48px 16px; color: #444; }
    .empty-icon { font-size: 48px; margin-bottom: 12px; }
    .empty-text { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; letter-spacing: 2px; text-transform: uppercase; color: #444; }
    .section-title { font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #555; margin-bottom: 12px; }
    .backup-tools { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 18px; }
    .backup-tools .btn-danger { grid-column: 1 / -1; }
    .hidden-file-input { display: none; }
  `;

  const remoteLabel = (v) => {
    if (!v || v === "ninguno") return "â€”";
    if (v === "app") return "ðŸ“± App";
    if (v === "mando") return "ðŸŽ® Mando";
    if (v === "ambos") return "ðŸ“±ðŸŽ® Ambos";
    return v;
  };

  return (
    <div className="app">
      <style>{css}</style>
      <div className="header">
        <div className="header-title">ðŸ Etsy Tracker <span className="saved-badge">â— Auto-guardado</span></div>
        <div className="header-sub">AnÃ¡lisis de competencia Â· Circuitos LED</div>
      </div>

      <div className="tabs">
        {[["list", "ðŸ“‹ Lista"], ["add", editIndex !== null ? "âœï¸ Editar" : "âž• AÃ±adir"], ["strategy", "ðŸŽ¯ Estrategia"]].map(([id, label]) => (
          <button key={id} className={`tab ${activeTab === id ? "active" : ""}`}
            onClick={() => { setActiveTab(id); if (id !== "add") { setEditIndex(null); setForm(INITIAL_FORM); } }}>
            {label}
          </button>
        ))}
      </div>

      <div className="content">
        <div className="section-title">Backup local</div>
        <div className="backup-tools">
          <button className="btn btn-outline" onClick={handleExportBackup}>Exportar backup</button>
          <button className="btn btn-outline" onClick={handleImportBackupClick}>Importar backup</button>
          <button className="btn btn-danger" onClick={handleClearLocalData}>Vaciar datos locales</button>
          <input
            ref={importInputRef}
            className="hidden-file-input"
            type="file"
            accept="application/json,.json"
            onChange={handleImportBackup}
          />
        </div>

        {/* LIST TAB */}
        {activeTab === "list" && (
          <>
            {stats && (
              <>
                <div className="section-title">Resumen del mercado</div>
                <div className="stat-grid">
                  <div className="stat-card">
                    <div className="stat-label">Precio medio</div>
                    <div className="stat-value">{stats.avgPrice}â‚¬</div>
                    <div className="stat-sub">{stats.minPrice}â‚¬ â€“ {stats.maxPrice}â‚¬</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">EnvÃ­o medio</div>
                    <div className="stat-value">{stats.avgShip !== null ? `${stats.avgShip}â‚¬` : "â€”"}</div>
                    <div className="stat-sub">por producto</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Tiendas</div>
                    <div className="stat-value">{stats.uniqueShops}</div>
                    <div className="stat-sub">{stats.total} productos</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Con mando/app</div>
                    <div className="stat-value">{stats.withRemote}</div>
                    <div className="stat-sub">de {stats.total} productos</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Con vÃ­deo</div>
                    <div className="stat-value">{stats.withVideo}</div>
                    <div className="stat-sub">de {stats.total} productos</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Con personaliz.</div>
                    <div className="stat-value">{stats.withCustom}</div>
                    <div className="stat-sub">de {stats.total} productos</div>
                  </div>
                </div>
              </>
            )}

            <div className="section-title">
              {stats ? `${stats.uniqueShops} tiendas Â· ${stats.total} productos` : "0 competidores"}
            </div>

            {competitors.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">ðŸŽï¸</div>
                <div className="empty-text">AÃ±ade tu primer competidor</div>
                <div style={{ color: "#555", fontSize: 13, marginTop: 8 }}>Ve a la pestaÃ±a AÃ±adir</div>
              </div>
            ) : (
              groupedCompetitors.map((group) => (
                <div className="shop-group" key={group.shopName}>
                  <div className="shop-header">
                    <span className="shop-header-name">ðŸª {group.shopName}</span>
                    <span className="shop-header-count">{group.products.length} producto{group.products.length > 1 ? "s" : ""}</span>
                  </div>
                  {group.products.map((c) => (
                    <div className="competitor-card" key={c.originalIndex}>
                      <div className="comp-header">
                        <div style={{ flex: 1, marginRight: 12 }}>
                          <div className="comp-name">{c.productName || "Sin nombre de producto"}</div>
                          {c.searchPosition && <span className="pos-tag">PosiciÃ³n #{c.searchPosition}</span>}
                        </div>
                        <div className="comp-price">{c.price}â‚¬</div>
                      </div>

                      <div className="badges">
                        {c.isBestseller && <BADGE color="#e67e22">Bestseller</BADGE>}
                        {c.isSpecialized && <BADGE color="#2980b9">Especializada</BADGE>}
                        {c.circuits && <BADGE color="#555">{c.circuits}</BADGE>}
                        {c.photoVideo && <BADGE color="#8e44ad">VÃ­deo</BADGE>}
                        {c.remoteControl && c.remoteControl !== "ninguno" && <BADGE color="#16a085">{remoteLabel(c.remoteControl)}</BADGE>}
                      </div>

                      <div className="comp-stats">
                        <div className="comp-stat">
                          <div className="comp-stat-label">Ventas tienda</div>
                          <div className="comp-stat-value">{c.shopSales || "â€”"}</div>
                        </div>
                        <div className="comp-stat">
                          <div className="comp-stat-label">ReseÃ±as prod.</div>
                          <div className="comp-stat-value">{c.productReviews || "â€”"}</div>
                        </div>
                        <div className="comp-stat">
                          <div className="comp-stat-label">ReseÃ±as tienda</div>
                          <div className="comp-stat-value">{c.shopReviews || "â€”"}</div>
                        </div>
                        <div className="comp-stat">
                          <div className="comp-stat-label">ValoraciÃ³n</div>
                          <div className="comp-stat-value">{c.rating ? `${c.rating}â˜…` : "â€”"}</div>
                        </div>
                      </div>

                      <div className="comp-extra">
                        <div className="comp-extra-item">
                          <div className="comp-extra-label">TamaÃ±os</div>
                          <div className="comp-extra-value">{c.sizeCount || "â€”"}</div>
                        </div>
                        <div className="comp-extra-item">
                          <div className="comp-extra-label">EnvÃ­o</div>
                          <div className="comp-extra-value">{c.shipPrice !== "" ? `${c.shipPrice}â‚¬` : "â€”"}</div>
                        </div>
                        <div className="comp-extra-item">
                          <div className="comp-extra-label">Desde</div>
                          <div className="comp-extra-value">{c.shipFrom || "â€”"}</div>
                        </div>
                        <div className="comp-extra-item">
                          <div className="comp-extra-label">Entrega</div>
                          <div className="comp-extra-value">{c.shipTime || "â€”"}</div>
                        </div>
                        <div className="comp-extra-item">
                          <div className="comp-extra-label">Fotos</div>
                          <div className="comp-extra-value">{[c.photoReal && "Reales", c.photoAI && "IA"].filter(Boolean).join(" Â· ") || "â€”"}</div>
                        </div>
                        <div className="comp-extra-item">
                          <div className="comp-extra-label">Personaliz.</div>
                          <div className="comp-extra-value" style={{fontSize:11}}>{c.customization || "â€”"}</div>
                        </div>
                      </div>

                      {c.sizePrices && (
                        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>ðŸ’° Precios por tamaÃ±o: {c.sizePrices}</div>
                      )}

                      {c.notes && <div className="comp-notes">ðŸ“ {c.notes}</div>}

                      <div className="comp-actions">
                        <button className="btn btn-outline" onClick={() => handleEdit(c.originalIndex)}>Editar</button>
                        <button className="btn btn-danger" onClick={() => handleDelete(c.originalIndex)}>Eliminar</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </>
        )}

        {/* ADD TAB */}
        {activeTab === "add" && (
          <div className="form-card">
            <div className="form-title">{editIndex !== null ? "Editar producto" : "Nuevo producto"}</div>

            <Section title="Tienda y producto" />
            <div className="field">
              <label className="label">Nombre de la tienda *</label>
              <input className="input" name="shopName" value={form.shopName} onChange={handleChange} placeholder="ej. CircuitLightsShop" />
            </div>
            <div className="field">
              <label className="label">Nombre del producto</label>
              <input className="input" name="productName" value={form.productName} onChange={handleChange} placeholder="ej. LED Circuit F1 Monaco" />
            </div>
            <div className="input-row field">
              <div>
                <label className="label">Precio (â‚¬) *</label>
                <input className="input" name="price" type="number" value={form.price} onChange={handleChange} placeholder="45" />
              </div>
              <div>
                <label className="label">PosiciÃ³n en bÃºsq.</label>
                <input className="input" name="searchPosition" type="number" value={form.searchPosition} onChange={handleChange} placeholder="3" />
              </div>
            </div>
            <div className="input-row field">
              <div>
                <label className="label">Cantidad de tamaÃ±os</label>
                <input className="input" name="sizeCount" type="number" value={form.sizeCount} onChange={handleChange} placeholder="3" />
              </div>
              <div>
                <label className="label">ValoraciÃ³n (1-5)</label>
                <input className="input" name="rating" type="number" step="0.1" min="1" max="5" value={form.rating} onChange={handleChange} placeholder="4.8" />
              </div>
            </div>
            <div className="field">
              <label className="label">Precios por tamaÃ±o</label>
              <input className="input" name="sizePrices" value={form.sizePrices} onChange={handleChange} placeholder="ej. S:25â‚¬ / M:45â‚¬ / L:65â‚¬" />
            </div>
            <div className="field">
              <label className="label">Circuitos que vende</label>
              <input className="input" name="circuits" value={form.circuits} onChange={handleChange} placeholder="F1, MotoGP, NASCAR..." />
            </div>

            <Section title="ReseÃ±as y ventas" />
            <div className="field">
              <label className="label">Ventas totales tienda</label>
              <input className="input" name="shopSales" type="number" value={form.shopSales} onChange={handleChange} placeholder="850" />
            </div>
            <div className="input-row field">
              <div>
                <label className="label">ReseÃ±as del producto</label>
                <input className="input" name="productReviews" type="number" value={form.productReviews} onChange={handleChange} placeholder="34" />
              </div>
              <div>
                <label className="label">ReseÃ±as de la tienda</label>
                <input className="input" name="shopReviews" type="number" value={form.shopReviews} onChange={handleChange} placeholder="11" />
              </div>
            </div>

            <Section title="Control de luces" />
            <div className="field">
              <label className="label">App o mando a distancia</label>
              <select className="select" name="remoteControl" value={form.remoteControl} onChange={handleChange}>
                <option value="ninguno">Sin control</option>
                <option value="app">App mÃ³vil</option>
                <option value="mando">Mando a distancia</option>
                <option value="ambos">App + Mando</option>
              </select>
            </div>

            <Section title="EnvÃ­o" />
            <div className="input-row-3 field">
              <div>
                <label className="label">Desde</label>
                <input className="input" name="shipFrom" value={form.shipFrom} onChange={handleChange} placeholder="EspaÃ±a" />
              </div>
              <div>
                <label className="label">Precio envÃ­o (â‚¬)</label>
                <input className="input" name="shipPrice" type="number" value={form.shipPrice} onChange={handleChange} placeholder="0" />
              </div>
              <div>
                <label className="label">Tiempo estimado</label>
                <input className="input" name="shipTime" value={form.shipTime} onChange={handleChange} placeholder="5-10 dÃ­as" />
              </div>
            </div>

            <Section title="Fotos y presentaciÃ³n" />
            <div className="checkbox-group field">
              <label className="checkbox-row">
                <input type="checkbox" name="photoReal" checked={form.photoReal} onChange={handleChange} />
                <span className="checkbox-label">ðŸ“· Fotos reales / caseras</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" name="photoAI" checked={form.photoAI} onChange={handleChange} />
                <span className="checkbox-label">ðŸ¤– Fotos con IA o Photoshop</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" name="photoVideo" checked={form.photoVideo} onChange={handleChange} />
                <span className="checkbox-label">ðŸŽ¥ Tiene vÃ­deo</span>
              </label>
            </div>

            <Section title="Extras" />
            <div className="field">
              <label className="label">PersonalizaciÃ³n disponible</label>
              <input className="input" name="customization" value={form.customization} onChange={handleChange} placeholder="ej. colores, tamaÃ±os, nombre grabado" />
            </div>
            <div className="checkbox-group field">
              <label className="checkbox-row">
                <input type="checkbox" name="isBestseller" checked={form.isBestseller} onChange={handleChange} />
                <span className="checkbox-label">ðŸ† Tiene badge Bestseller</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" name="isSpecialized" checked={form.isSpecialized} onChange={handleChange} />
                <span className="checkbox-label">ðŸŽ¯ Tienda especializada (solo circuitos)</span>
              </label>
            </div>
            <div className="field">
              <label className="label">Notas / observaciones</label>
              <textarea className="input" name="notes" value={form.notes} onChange={handleChange}
                placeholder="Cualquier cosa que quieras recordar..." rows={3} style={{ resize: "vertical" }} />
            </div>

            <button className="btn btn-primary btn-full" onClick={handleSubmit}>
              {editIndex !== null ? "Guardar cambios" : "AÃ±adir producto"}
            </button>
            {editIndex !== null && (
              <button className="btn btn-outline btn-full" style={{ marginTop: 8 }}
                onClick={() => { setEditIndex(null); setForm(INITIAL_FORM); setActiveTab("list"); }}>
                Cancelar
              </button>
            )}
          </div>
        )}

        {/* STRATEGY TAB */}
        {activeTab === "strategy" && (
          <>
            {!stats ? (
              <div className="empty">
                <div className="empty-icon">ðŸŽ¯</div>
                <div className="empty-text">AÃ±ade competidores primero</div>
                <div style={{ color: "#555", fontSize: 13, marginTop: 8 }}>La estrategia se genera automÃ¡ticamente</div>
              </div>
            ) : (
              <>
                <div className="section-title">Tu precio recomendado</div>
                <div className="strategy-card">
                  <div className="strategy-title">ðŸ’° Rangos de precio</div>
                  <div className="strategy-row">
                    <span className="strategy-key">Entrada al mercado</span>
                    <span className="strategy-val" style={{ color: "#e74c3c" }}>{myPriceSuggestion.low}â‚¬</span>
                  </div>
                  <div className="strategy-row">
                    <span className="strategy-key">Precio medio del mercado</span>
                    <span className="strategy-val" style={{ color: "#f39c12" }}>{myPriceSuggestion.avg}â‚¬</span>
                  </div>
                  <div className="strategy-row">
                    <span className="strategy-key">Precio premium (+diferenciaciÃ³n)</span>
                    <span className="strategy-val" style={{ color: "#2ecc71" }}>{myPriceSuggestion.high}â‚¬</span>
                  </div>
                </div>

                <div className="section-title">AnÃ¡lisis del mercado</div>
                <div className="strategy-card">
                  <div className="strategy-title">ðŸ“Š Lo que viste</div>
                  <div className="strategy-row">
                    <span className="strategy-key">Tiendas analizadas</span>
                    <span className="strategy-val">{stats.uniqueShops}</span>
                  </div>
                  <div className="strategy-row">
                    <span className="strategy-key">Productos analizados</span>
                    <span className="strategy-val">{stats.total}</span>
                  </div>
                  <div className="strategy-row">
                    <span className="strategy-key">Con badge Bestseller</span>
                    <span className="strategy-val">{stats.bestsellers}</span>
                  </div>
                  <div className="strategy-row">
                    <span className="strategy-key">Tiendas especializadas</span>
                    <span className="strategy-val">{stats.specialized}</span>
                  </div>
                  <div className="strategy-row">
                    <span className="strategy-key">Con app o mando</span>
                    <span className="strategy-val">{stats.withRemote} de {stats.total}</span>
                  </div>
                  <div className="strategy-row">
                    <span className="strategy-key">Con vÃ­deo</span>
                    <span className="strategy-val">{stats.withVideo} de {stats.total}</span>
                  </div>
                  <div className="strategy-row">
                    <span className="strategy-key">Con personalizaciÃ³n</span>
                    <span className="strategy-val">{stats.withCustom} de {stats.total}</span>
                  </div>
                  <div className="strategy-row">
                    <span className="strategy-key">EnvÃ­o medio</span>
                    <span className="strategy-val">{stats.avgShip !== null ? `${stats.avgShip}â‚¬` : "â€”"}</span>
                  </div>
                  <div className="strategy-row">
                    <span className="strategy-key">Rango de precios</span>
                    <span className="strategy-val">{stats.minPrice}â‚¬ â€“ {stats.maxPrice}â‚¬</span>
                  </div>
                </div>

                <div className="section-title">Consejos para tu tienda</div>

                {parseFloat(stats.avgPrice) < 30 && (
                  <div className="tip warning">âš ï¸ El mercado tiene precios bajos. DiferÃ©nciate con <strong>efectos LED personalizables</strong> y control por app para justificar un precio mayor.</div>
                )}
                {stats.withRemote < stats.total / 2 && (
                  <div className="tip">ðŸ“± Menos de la mitad de competidores ofrece control por app o mando. <strong>Destaca tu control ESP32</strong> como una ventaja clara en el tÃ­tulo.</div>
                )}
                {stats.withVideo < stats.total / 2 && (
                  <div className="tip">ðŸŽ¥ Pocos competidores tienen vÃ­deo. <strong>AÃ±adir un vÃ­deo corto</strong> de los efectos LED en oscuridad puede darte una ventaja enorme.</div>
                )}
                {stats.withCustom < stats.total / 2 && (
                  <div className="tip">ðŸŽ¨ Pocos ofrecen personalizaciÃ³n. <strong>Ofrecer circuitos a medida o colores personalizados</strong> puede diferenciarte mucho.</div>
                )}
                {stats.specialized > stats.bestsellers && (
                  <div className="tip">ðŸŽ¯ Hay mÃ¡s tiendas especializadas que bestsellers. <strong>Oportunidad de ser el referente</strong> en un nicho concreto como F1 o RGB.</div>
                )}
                {stats.avgReviews && stats.avgReviews < 20 && (
                  <div className="tip">ðŸ“ˆ Pocas reseÃ±as de media por producto. <strong>El mercado es joven</strong>, hay sitio para entrar y posicionarte rÃ¡pido.</div>
                )}
                <div className="tip">ðŸŽï¸ Tu ventaja: el <strong>ESP32 con efectos programables</strong> es Ãºnico. Menciona "control por app", "efectos personalizados" y "mÃ¡s de X animaciones" en el tÃ­tulo.</div>
                <div className="tip">ðŸ“¸ En Etsy la foto lo es todo. <strong>Haz fotos en habitaciÃ³n oscura</strong> para que los LEDs brillen al mÃ¡ximo.</div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
