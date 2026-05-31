import { useState, useMemo, useEffect, useRef } from "react";

const APP_STORAGE_KEYS = ["etsy-tracker-data"];
const BACKUP_APP_ID = "etsy-tracker";

const INITIAL_FORM = {
  captureType: "",
  source: "",
  capturedAt: "",
  productUrl: "",
  shopUrl: "",
  shopName: "",
  productName: "",
  price: "",
  currency: "",
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
  stockVisible: "",
  cartCountVisible: "",
  sellerName: "",
  shopLocation: "",
  sellingOnEtsySince: "",
  itemsCountVisible: "",
  responseTime: "",
  favoritesVisible: "",
  publishedAtVisible: "",
  rawVisibleText: "",
  notes: "",
  circuits: "",
};

const EMPTY_CAPTURE_IMPORT = {
  jsonText: "",
  error: "",
  previewType: "",
  preview: null,
};

const PRODUCT_CAPTURE_FIELDS = [
  ["productUrl", "URL del producto"],
  ["productName", "Titulo"],
  ["price", "Precio"],
  ["currency", "Moneda"],
  ["shopName", "Tienda"],
  ["shopUrl", "URL de tienda"],
  ["shopSales", "Ventas visibles de tienda"],
  ["shopReviews", "Reseñas visibles de tienda"],
  ["sellingOnEtsySince", "Tiempo vendiendo en Etsy"],
  ["shopLocation", "Pais/origen de tienda"],
  ["responseTime", "Tiempo de respuesta"],
  ["favoritesVisible", "Favoritos visibles"],
  ["publishedAtVisible", "Fecha de publicacion"],
  ["rating", "Valoracion visible"],
  ["productReviews", "Numero de reseñas visible"],
  ["shipFrom", "Desde donde se envia"],
  ["shipTime", "Tiempo aproximado de envio"],
  ["shipPrice", "Precio de envio"],
  ["stockVisible", "Stock visible"],
  ["cartCountVisible", "Cantidad en carritos"],
  ["notes", "Notas"],
];

const SHOP_CAPTURE_FIELDS = [
  ["shopUrl", "URL de tienda"],
  ["shopName", "Nombre de tienda"],
  ["shopSales", "Ventas totales visibles"],
  ["sellingOnEtsySince", "Tiempo vendiendo en Etsy"],
  ["itemsCountVisible", "Numero de articulos visibles"],
  ["rating", "Valoracion visible"],
  ["shopReviews", "Numero de reseñas visible"],
  ["shopLocation", "Pais/origen de tienda"],
  ["responseTime", "Tiempo de respuesta"],
  ["notes", "Notas"],
];

const textOrEmpty = (value) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const parseAmount = (value) => {
  const match = textOrEmpty(value).match(/\d+(?:[.,]\d{1,2})?/);
  if (!match) return null;
  return parseFloat(match[0].replace(",", "."));
};

const firstRawMatch = (rawText, patterns) => {
  const raw = textOrEmpty(rawText);
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) return textOrEmpty(match[1] || match[0]);
  }
  return "";
};

const fillIfEmpty = (value, fallback) => textOrEmpty(value) || textOrEmpty(fallback);

const cleanSellerName = (value) => {
  const text = textOrEmpty(value).trim();
  if (!text) return "";
  const blocked = /ver en el idioma|fotos de|reseñas|artículo|articulo|etsy categor|todo\.|traducir|comprador|respuesta/i;
  const looksLikeName = /^[A-ZÀ-ÿ][A-Za-zÀ-ÿ' -]{1,40}$/.test(text) && text.split(/\s+/).length <= 3;
  return !blocked.test(text) && looksLikeName ? text : "";
};

const extractRawSignals = (item) => {
  const raw = textOrEmpty(item.rawVisibleText);
  if (!raw) return {};

  const genericShopSummary = raw.match(/([A-ZÀ-ÿ][^·]{1,60})\s+([A-Za-z0-9][A-Za-z0-9_-]{2,})\s+·\s+([^·]+?)\s+([0-5][.,]\d)\s*\(([^)]+)\)\s+·\s+(\d+[.,]?\d*\s+ventas?)\s+·\s+([^·.]+?en Etsy)/i);
  const knownShopSummary = item.shopName
    ? raw.match(new RegExp(`([^·]{0,80})${item.shopName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+·\\s+([^·]+?)\\s+([0-5][.,]\\d)\\s*\\(([^)]+)\\)\\s+·\\s+(\\d+[.,]?\\d*\\s+ventas?)\\s+·\\s+([^·.]+?en Etsy)`, "i"))
    : null;

  return {
    sellerName: cleanSellerName(knownShopSummary?.[1]) || cleanSellerName(genericShopSummary?.[1]),
    shopName: item.shopName || genericShopSummary?.[2],
    shopLocation: knownShopSummary?.[2] || genericShopSummary?.[3],
    shopRating: knownShopSummary?.[3] || genericShopSummary?.[4],
    shopReviews: knownShopSummary?.[4] || genericShopSummary?.[5],
    shopSales: knownShopSummary?.[5] || genericShopSummary?.[6] || firstRawMatch(raw, [/(\d+[.,]?\d*\s+ventas?)/i]),
    sellingOnEtsySince: knownShopSummary?.[6] || genericShopSummary?.[7] || firstRawMatch(raw, [/(\d+\s+año[s]?\s+en Etsy)/i, /(\d+\s+meses?\s+en Etsy)/i, /(En Etsy desde\s+\d{4})/i]),
    itemsCountVisible: firstRawMatch(raw, [/Buscar entre los\s+(\d+[.,]?\d*\s+artículos?)/i, /Buscar entre los\s+(\d+[.,]?\d*\s+articulos?)/i, /Todos\s+(\d+[.,]?\d*)/i]),
    responseTime: firstRawMatch(raw, [/(Normalmente responde en [^.]+?)(?=\s+Respuestas|\s+Tiene|\s+Más artículos|$)/i, /(Normalmente responde en \d+\s+\w+)/i]),
    favoritesVisible: firstRawMatch(raw, [/(\d+[.,]?\d*\s+favoritos?)/i]),
    publishedAtVisible: firstRawMatch(raw, [/(Fecha de publicación:\s*[^.]+?)(?=\s+\d+\s+favoritos|\s+Página de inicio|$)/i]),
  };
};

const enrichCaptureWithRawSignals = (item) => {
  const rawSignals = extractRawSignals(item);
  return {
    ...item,
    sellerName: fillIfEmpty(item.sellerName, rawSignals.sellerName),
    shopName: fillIfEmpty(item.shopName, rawSignals.shopName),
    shopLocation: fillIfEmpty(item.shopLocation, rawSignals.shopLocation),
    shopSales: fillIfEmpty(item.shopSales, rawSignals.shopSales),
    sellingOnEtsySince: fillIfEmpty(item.sellingOnEtsySince, rawSignals.sellingOnEtsySince),
    itemsCountVisible: fillIfEmpty(item.itemsCountVisible, rawSignals.itemsCountVisible),
    responseTime: fillIfEmpty(item.responseTime, rawSignals.responseTime),
    favoritesVisible: fillIfEmpty(item.favoritesVisible, rawSignals.favoritesVisible),
    publishedAtVisible: fillIfEmpty(item.publishedAtVisible, rawSignals.publishedAtVisible),
    shopReviews: fillIfEmpty(item.shopReviews, rawSignals.shopReviews),
    rating: fillIfEmpty(item.rating, item.captureType === "shop" ? rawSignals.shopRating : ""),
  };
};

const normalizeUrl = (value) => textOrEmpty(value).split("?")[0].replace(/\/$/, "").toLowerCase();

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
  const [captureImport, setCaptureImport] = useState(EMPTY_CAPTURE_IMPORT);
  const importInputRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(APP_STORAGE_KEYS[0], JSON.stringify(competitors)); }
    catch {}
  }, [competitors]);

  const stats = useMemo(() => {
    if (!competitors.length) return null;
    const prices = competitors.map(c => parseAmount(c.price)).filter(v => v !== null);
    const reviews = competitors.map(c => parseAmount(c.productReviews || c.shopReviews)).filter(v => v !== null);
    const avgPrice = prices.length ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : null;
    const minPrice = prices.length ? Math.min(...prices).toFixed(2) : null;
    const maxPrice = prices.length ? Math.max(...prices).toFixed(2) : null;
    const avgReviews = reviews.length ? Math.round(reviews.reduce((a, b) => a + b, 0) / reviews.length) : null;
    const bestsellers = competitors.filter(c => c.isBestseller).length;
    const specialized = competitors.filter(c => c.isSpecialized).length;
    const uniqueShops = new Set(competitors.map(c => textOrEmpty(c.shopName).trim().toLowerCase())).size;
    const withRemote = competitors.filter(c => c.remoteControl && c.remoteControl !== "ninguno").length;
    const withVideo = competitors.filter(c => c.photoVideo).length;
    const withCustom = competitors.filter(c => c.customization).length;
    const shipPrices = competitors.map(c => parseAmount(c.shipPrice)).filter(v => v !== null && v >= 0);
    const avgShip = shipPrices.length ? (shipPrices.reduce((a, b) => a + b, 0) / shipPrices.length).toFixed(2) : null;
    return { avgPrice, minPrice, maxPrice, avgReviews, bestsellers, specialized, uniqueShops, withRemote, withVideo, withCustom, avgShip, total: competitors.length };
  }, [competitors]);

  const groupedCompetitors = useMemo(() => {
    const groups = {};
    competitors.forEach((c, i) => {
      const key = textOrEmpty(c.shopName).trim().toLowerCase();
      if (!groups[key]) groups[key] = { shopName: c.shopName || "Sin nombre de tienda", products: [] };
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
    if (!form.shopName || (!form.price && form.captureType !== "shop")) return;
    const duplicateWarning = getDuplicateWarning(form, editIndex);
    if (duplicateWarning && !window.confirm(duplicateWarning)) return;

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

  const getDuplicateWarning = (item, ignoreIndex = null) => {
    const productUrl = normalizeUrl(item.productUrl);
    const shopUrl = normalizeUrl(item.shopUrl);
    const duplicate = competitors.find((existing, index) => {
      if (index === ignoreIndex) return false;
      if (item.captureType === "product" && productUrl) return normalizeUrl(existing.productUrl) === productUrl;
      if (item.captureType === "shop" && shopUrl) return normalizeUrl(existing.shopUrl) === shopUrl;
      return false;
    });

    if (!duplicate) return "";
    return item.captureType === "shop"
      ? "Esta tienda ya existe en la app. ¿Quieres guardar una copia igualmente?"
      : "Este producto ya existe en la app. ¿Quieres guardar una copia igualmente?";
  };

  const buildProductCapturePreview = (capture) => enrichCaptureWithRawSignals({
    ...INITIAL_FORM,
    captureType: "product",
    source: textOrEmpty(capture.source),
    capturedAt: textOrEmpty(capture.capturedAt),
    productUrl: textOrEmpty(capture.productUrl),
    productName: textOrEmpty(capture.productTitle),
    price: textOrEmpty(capture.productPrice),
    currency: textOrEmpty(capture.currency),
    shopName: textOrEmpty(capture.shopName),
    shopUrl: textOrEmpty(capture.shopUrl),
    rating: textOrEmpty(capture.ratingVisible),
    productReviews: textOrEmpty(capture.reviewsCountVisible),
    shipFrom: textOrEmpty(capture.shipsFrom),
    shipTime: textOrEmpty(capture.estimatedDeliveryTime),
    shipPrice: textOrEmpty(capture.shippingPrice),
    stockVisible: textOrEmpty(capture.stockVisible),
    cartCountVisible: textOrEmpty(capture.cartCountVisible),
    rawVisibleText: textOrEmpty(capture.rawVisibleText),
    notes: textOrEmpty(capture.notes),
  });

  const buildShopCapturePreview = (capture) => enrichCaptureWithRawSignals({
    ...INITIAL_FORM,
    captureType: "shop",
    source: textOrEmpty(capture.source),
    capturedAt: textOrEmpty(capture.capturedAt),
    shopUrl: textOrEmpty(capture.shopUrl),
    shopName: textOrEmpty(capture.shopName),
    shopSales: textOrEmpty(capture.totalSalesVisible),
    sellingOnEtsySince: textOrEmpty(capture.sellingOnEtsySince),
    itemsCountVisible: textOrEmpty(capture.itemsCountVisible),
    rating: textOrEmpty(capture.ratingVisible),
    shopReviews: textOrEmpty(capture.reviewsCountVisible),
    rawVisibleText: textOrEmpty(capture.rawVisibleText),
    notes: textOrEmpty(capture.notes),
  });

  const handleCaptureTextChange = (e) => {
    setCaptureImport(current => ({ ...current, jsonText: e.target.value, error: "" }));
  };

  const handleProcessCapture = () => {
    try {
      const parsed = JSON.parse(captureImport.jsonText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setCaptureImport(current => ({ ...current, error: "El JSON debe ser un objeto de captura." }));
        return;
      }

      if (parsed.captureType === "product") {
        setCaptureImport(current => ({
          ...current,
          error: "",
          previewType: "product",
          preview: buildProductCapturePreview(parsed),
        }));
        return;
      }

      if (parsed.captureType === "shop") {
        setCaptureImport(current => ({
          ...current,
          error: "",
          previewType: "shop",
          preview: buildShopCapturePreview(parsed),
        }));
        return;
      }

      setCaptureImport(current => ({ ...current, error: "captureType debe ser product o shop." }));
    } catch {
      setCaptureImport(current => ({ ...current, error: "El texto pegado no es un JSON valido." }));
    }
  };

  const handleCapturePreviewChange = (e) => {
    const { name, value } = e.target;
    setCaptureImport(current => ({
      ...current,
      preview: { ...current.preview, [name]: value },
    }));
  };

  const handleSaveCapture = () => {
    if (!captureImport.preview) return;
    const duplicateWarning = getDuplicateWarning(captureImport.preview);
    if (duplicateWarning && !window.confirm(duplicateWarning)) return;

    setCompetitors(current => [...current, captureImport.preview]);
    setCaptureImport(EMPTY_CAPTURE_IMPORT);
    setActiveTab("list");
  };

  const handleCancelCapture = () => {
    setCaptureImport(EMPTY_CAPTURE_IMPORT);
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
    .textarea { min-height: 180px; resize: vertical; line-height: 1.5; }
    .capture-preview { margin-top: 16px; }
    .capture-actions { display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 12px; }
    .capture-error { background: #1a0d00; border: 1px solid #c0392b; border-radius: 6px; color: #ff9b8f; font-size: 13px; padding: 10px 12px; margin-top: 10px; }
    .capture-meta { color: #777; font-size: 12px; line-height: 1.5; margin-top: 4px; }
  `;

  const remoteLabel = (v) => {
    if (!v || v === "ninguno") return "—";
    if (v === "app") return "📱 App";
    if (v === "mando") return "🎮 Mando";
    if (v === "ambos") return "📱🎮 Ambos";
    return v;
  };

  const moneyLabel = (value, currency = "€") => {
    if (value === null || value === undefined || value === "") return "—";
    const text = String(value);
    return /[a-zA-Z]/.test(text) ? text : `${text}${currency}`;
  };

  return (
    <div className="app">
      <style>{css}</style>
      <div className="header">
        <div className="header-title">🏁 Etsy Tracker <span className="saved-badge">● Auto-guardado</span></div>
        <div className="header-sub">Análisis de competencia · Circuitos LED</div>
      </div>

      <div className="tabs">
        {[["list", "📋 Lista"], ["add", editIndex !== null ? "✏️ Editar" : "➕ Añadir"], ["capture", "📥 Captura"], ["strategy", "🎯 Estrategia"]].map(([id, label]) => (
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
                    <div className="stat-value">{stats.avgPrice}€</div>
                    <div className="stat-sub">{stats.minPrice}€ – {stats.maxPrice}€</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Envío medio</div>
                    <div className="stat-value">{stats.avgShip !== null ? `${stats.avgShip}€` : "—"}</div>
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
                    <div className="stat-label">Con vídeo</div>
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
              {stats ? `${stats.uniqueShops} tiendas · ${stats.total} productos` : "0 competidores"}
            </div>

            {competitors.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">🏎️</div>
                <div className="empty-text">Añade tu primer competidor</div>
                <div style={{ color: "#555", fontSize: 13, marginTop: 8 }}>Ve a la pestaña Añadir</div>
              </div>
            ) : (
              groupedCompetitors.map((group) => (
                <div className="shop-group" key={group.shopName}>
                  <div className="shop-header">
                    <span className="shop-header-name">🏪 {group.shopName}</span>
                    <span className="shop-header-count">{group.products.length} producto{group.products.length > 1 ? "s" : ""}</span>
                  </div>
                  {group.products.map((c) => (
                    <div className="competitor-card" key={c.originalIndex}>
                      <div className="comp-header">
                        <div style={{ flex: 1, marginRight: 12 }}>
                          <div className="comp-name">{c.captureType === "shop" ? "Ficha de tienda" : (c.productName || "Sin nombre de producto")}</div>
                          {c.searchPosition && <span className="pos-tag">Posición #{c.searchPosition}</span>}
                        </div>
                        <div className="comp-price">{moneyLabel(c.price)}</div>
                      </div>

                      <div className="badges">
                        {c.captureType === "product" && <BADGE color="#16a085">Captura producto</BADGE>}
                        {c.captureType === "shop" && <BADGE color="#8e44ad">Captura tienda</BADGE>}
                        {c.isBestseller && <BADGE color="#e67e22">Bestseller</BADGE>}
                        {c.isSpecialized && <BADGE color="#2980b9">Especializada</BADGE>}
                        {c.circuits && <BADGE color="#555">{c.circuits}</BADGE>}
                        {c.photoVideo && <BADGE color="#8e44ad">Vídeo</BADGE>}
                        {c.remoteControl && c.remoteControl !== "ninguno" && <BADGE color="#16a085">{remoteLabel(c.remoteControl)}</BADGE>}
                      </div>

                      <div className="comp-stats">
                        <div className="comp-stat">
                          <div className="comp-stat-label">Ventas tienda</div>
                          <div className="comp-stat-value">{c.shopSales || "—"}</div>
                        </div>
                        <div className="comp-stat">
                          <div className="comp-stat-label">Reseñas prod.</div>
                          <div className="comp-stat-value">{c.productReviews || "—"}</div>
                        </div>
                        <div className="comp-stat">
                          <div className="comp-stat-label">Reseñas tienda</div>
                          <div className="comp-stat-value">{c.shopReviews || "—"}</div>
                        </div>
                        <div className="comp-stat">
                          <div className="comp-stat-label">Valoración</div>
                          <div className="comp-stat-value">{c.rating ? `${c.rating}★` : "—"}</div>
                        </div>
                      </div>

                      <div className="comp-extra">
                        <div className="comp-extra-item">
                          <div className="comp-extra-label">Tamaños</div>
                          <div className="comp-extra-value">{c.sizeCount || "—"}</div>
                        </div>
                        <div className="comp-extra-item">
                          <div className="comp-extra-label">Envío</div>
                          <div className="comp-extra-value">{moneyLabel(c.shipPrice)}</div>
                        </div>
                        <div className="comp-extra-item">
                          <div className="comp-extra-label">Desde</div>
                          <div className="comp-extra-value">{c.shipFrom || "—"}</div>
                        </div>
                        <div className="comp-extra-item">
                          <div className="comp-extra-label">Entrega</div>
                          <div className="comp-extra-value">{c.shipTime || "—"}</div>
                        </div>
                        <div className="comp-extra-item">
                          <div className="comp-extra-label">Fotos</div>
                          <div className="comp-extra-value">{[c.photoReal && "Reales", c.photoAI && "IA"].filter(Boolean).join(" · ") || "—"}</div>
                        </div>
                        <div className="comp-extra-item">
                          <div className="comp-extra-label">Personaliz.</div>
                          <div className="comp-extra-value" style={{fontSize:11}}>{c.customization || "—"}</div>
                        </div>
                      </div>

                      {c.sizePrices && (
                        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>💰 Precios por tamaño: {c.sizePrices}</div>
                      )}

                      {c.notes && <div className="comp-notes">📝 {c.notes}</div>}

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
                <label className="label">Precio (€) *</label>
                <input className="input" name="price" value={form.price} onChange={handleChange} placeholder="45" />
              </div>
              <div>
                <label className="label">Posición en búsq.</label>
                <input className="input" name="searchPosition" type="number" value={form.searchPosition} onChange={handleChange} placeholder="3" />
              </div>
            </div>
            <div className="input-row field">
              <div>
                <label className="label">Cantidad de tamaños</label>
                <input className="input" name="sizeCount" type="number" value={form.sizeCount} onChange={handleChange} placeholder="3" />
              </div>
              <div>
                <label className="label">Valoración (1-5)</label>
                <input className="input" name="rating" value={form.rating} onChange={handleChange} placeholder="4.8" />
              </div>
            </div>
            <div className="field">
              <label className="label">Precios por tamaño</label>
              <input className="input" name="sizePrices" value={form.sizePrices} onChange={handleChange} placeholder="ej. S:25€ / M:45€ / L:65€" />
            </div>
            <div className="field">
              <label className="label">Circuitos que vende</label>
              <input className="input" name="circuits" value={form.circuits} onChange={handleChange} placeholder="F1, MotoGP, NASCAR..." />
            </div>

            <Section title="Reseñas y ventas" />
            <div className="field">
              <label className="label">Ventas totales tienda</label>
              <input className="input" name="shopSales" value={form.shopSales} onChange={handleChange} placeholder="850" />
            </div>
            <div className="input-row field">
              <div>
                <label className="label">Reseñas del producto</label>
                <input className="input" name="productReviews" value={form.productReviews} onChange={handleChange} placeholder="34" />
              </div>
              <div>
                <label className="label">Reseñas de la tienda</label>
                <input className="input" name="shopReviews" value={form.shopReviews} onChange={handleChange} placeholder="11" />
              </div>
            </div>

            <Section title="Control de luces" />
            <div className="field">
              <label className="label">App o mando a distancia</label>
              <select className="select" name="remoteControl" value={form.remoteControl} onChange={handleChange}>
                <option value="ninguno">Sin control</option>
                <option value="app">App móvil</option>
                <option value="mando">Mando a distancia</option>
                <option value="ambos">App + Mando</option>
              </select>
            </div>

            <Section title="Envío" />
            <div className="input-row-3 field">
              <div>
                <label className="label">Desde</label>
                <input className="input" name="shipFrom" value={form.shipFrom} onChange={handleChange} placeholder="España" />
              </div>
              <div>
                <label className="label">Precio envío (€)</label>
                <input className="input" name="shipPrice" value={form.shipPrice} onChange={handleChange} placeholder="0" />
              </div>
              <div>
                <label className="label">Tiempo estimado</label>
                <input className="input" name="shipTime" value={form.shipTime} onChange={handleChange} placeholder="5-10 días" />
              </div>
            </div>

            <Section title="Fotos y presentación" />
            <div className="checkbox-group field">
              <label className="checkbox-row">
                <input type="checkbox" name="photoReal" checked={form.photoReal} onChange={handleChange} />
                <span className="checkbox-label">📷 Fotos reales / caseras</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" name="photoAI" checked={form.photoAI} onChange={handleChange} />
                <span className="checkbox-label">🤖 Fotos con IA o Photoshop</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" name="photoVideo" checked={form.photoVideo} onChange={handleChange} />
                <span className="checkbox-label">🎥 Tiene vídeo</span>
              </label>
            </div>

            <Section title="Extras" />
            <div className="field">
              <label className="label">Personalización disponible</label>
              <input className="input" name="customization" value={form.customization} onChange={handleChange} placeholder="ej. colores, tamaños, nombre grabado" />
            </div>
            <div className="checkbox-group field">
              <label className="checkbox-row">
                <input type="checkbox" name="isBestseller" checked={form.isBestseller} onChange={handleChange} />
                <span className="checkbox-label">🏆 Tiene badge Bestseller</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" name="isSpecialized" checked={form.isSpecialized} onChange={handleChange} />
                <span className="checkbox-label">🎯 Tienda especializada (solo circuitos)</span>
              </label>
            </div>
            <div className="field">
              <label className="label">Notas / observaciones</label>
              <textarea className="input" name="notes" value={form.notes} onChange={handleChange}
                placeholder="Cualquier cosa que quieras recordar..." rows={3} style={{ resize: "vertical" }} />
            </div>

            {form.captureType && (
              <>
                <Section title="Datos capturados de Etsy" />
                <div className="input-row field">
                  <div>
                    <label className="label">Tipo de captura</label>
                    <input className="input" name="captureType" value={form.captureType} onChange={handleChange} />
                  </div>
                  <div>
                    <label className="label">Capturado el</label>
                    <input className="input" name="capturedAt" value={form.capturedAt} onChange={handleChange} />
                  </div>
                </div>
                <div className="field">
                  <label className="label">URL del producto</label>
                  <input className="input" name="productUrl" value={form.productUrl} onChange={handleChange} />
                </div>
                <div className="field">
                  <label className="label">URL de tienda</label>
                  <input className="input" name="shopUrl" value={form.shopUrl} onChange={handleChange} />
                </div>
                <div className="input-row field">
                  <div>
                    <label className="label">Moneda</label>
                    <input className="input" name="currency" value={form.currency} onChange={handleChange} />
                  </div>
                  <div>
                    <label className="label">Stock visible</label>
                    <input className="input" name="stockVisible" value={form.stockVisible} onChange={handleChange} />
                  </div>
                </div>
                <div className="input-row field">
                  <div>
                    <label className="label">Vendedor visible</label>
                    <input className="input" name="sellerName" value={form.sellerName} onChange={handleChange} />
                  </div>
                  <div>
                    <label className="label">Pais/origen tienda</label>
                    <input className="input" name="shopLocation" value={form.shopLocation} onChange={handleChange} />
                  </div>
                </div>
                <div className="input-row field">
                  <div>
                    <label className="label">Cantidad en carritos</label>
                    <input className="input" name="cartCountVisible" value={form.cartCountVisible} onChange={handleChange} />
                  </div>
                  <div>
                    <label className="label">Articulos visibles</label>
                    <input className="input" name="itemsCountVisible" value={form.itemsCountVisible} onChange={handleChange} />
                  </div>
                </div>
                <div className="field">
                  <label className="label">Tiempo vendiendo en Etsy</label>
                  <input className="input" name="sellingOnEtsySince" value={form.sellingOnEtsySince} onChange={handleChange} />
                </div>
                <div className="field">
                  <label className="label">Tiempo de respuesta</label>
                  <input className="input" name="responseTime" value={form.responseTime} onChange={handleChange} />
                </div>
                <div className="input-row field">
                  <div>
                    <label className="label">Favoritos visibles</label>
                    <input className="input" name="favoritesVisible" value={form.favoritesVisible} onChange={handleChange} />
                  </div>
                  <div>
                    <label className="label">Fecha de publicacion</label>
                    <input className="input" name="publishedAtVisible" value={form.publishedAtVisible} onChange={handleChange} />
                  </div>
                </div>
                <div className="field">
                  <label className="label">Texto visible bruto</label>
                  <textarea className="input" name="rawVisibleText" value={form.rawVisibleText} onChange={handleChange}
                    rows={4} style={{ resize: "vertical" }} />
                </div>
              </>
            )}

            <button className="btn btn-primary btn-full" onClick={handleSubmit}>
              {editIndex !== null ? "Guardar cambios" : "Añadir producto"}
            </button>
            {editIndex !== null && (
              <button className="btn btn-outline btn-full" style={{ marginTop: 8 }}
                onClick={() => { setEditIndex(null); setForm(INITIAL_FORM); setActiveTab("list"); }}>
                Cancelar
              </button>
            )}
          </div>
        )}

        {/* CAPTURE IMPORT TAB */}
        {activeTab === "capture" && (
          <div className="form-card">
            <div className="form-title">Importar captura Etsy</div>
            <div className="capture-meta">Pega aqui el JSON generado manualmente desde Etsy. La app no visita URLs ni captura datos por si sola.</div>

            <Section title="JSON de captura" />
            <div className="field">
              <textarea
                className="input textarea"
                value={captureImport.jsonText}
                onChange={handleCaptureTextChange}
                placeholder={`{\n  "captureType": "product",\n  "source": "etsy"\n}`}
              />
            </div>
            <button className="btn btn-primary btn-full" onClick={handleProcessCapture}>Procesar captura</button>
            {captureImport.error && <div className="capture-error">{captureImport.error}</div>}

            {captureImport.preview && (
              <div className="capture-preview">
                <Section title={captureImport.previewType === "product" ? "Vista previa de producto" : "Vista previa de tienda"} />
                {(captureImport.previewType === "product" ? PRODUCT_CAPTURE_FIELDS : SHOP_CAPTURE_FIELDS).map(([name, label]) => (
                  <div className="field" key={name}>
                    <label className="label">{label}</label>
                    {name === "notes" ? (
                      <textarea
                        className="input"
                        name={name}
                        value={captureImport.preview[name] || ""}
                        onChange={handleCapturePreviewChange}
                        rows={3}
                        style={{ resize: "vertical" }}
                      />
                    ) : (
                      <input
                        className="input"
                        name={name}
                        value={captureImport.preview[name] || ""}
                        onChange={handleCapturePreviewChange}
                      />
                    )}
                  </div>
                ))}
                <div className="capture-meta">
                  Raw visible text guardado: {captureImport.preview.rawVisibleText ? "si" : "vacio"}.
                </div>
                <div className="capture-actions">
                  <button className="btn btn-primary" onClick={handleSaveCapture}>
                    {captureImport.previewType === "product" ? "Guardar producto competidor" : "Guardar tienda competidora"}
                  </button>
                  <button className="btn btn-outline" onClick={handleCancelCapture}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STRATEGY TAB */}
        {activeTab === "strategy" && (
          <>
            {!stats ? (
              <div className="empty">
                <div className="empty-icon">🎯</div>
                <div className="empty-text">Añade competidores primero</div>
                <div style={{ color: "#555", fontSize: 13, marginTop: 8 }}>La estrategia se genera automáticamente</div>
              </div>
            ) : (
              <>
                <div className="section-title">Tu precio recomendado</div>
                <div className="strategy-card">
                  <div className="strategy-title">💰 Rangos de precio</div>
                  <div className="strategy-row">
                    <span className="strategy-key">Entrada al mercado</span>
                    <span className="strategy-val" style={{ color: "#e74c3c" }}>{myPriceSuggestion.low}€</span>
                  </div>
                  <div className="strategy-row">
                    <span className="strategy-key">Precio medio del mercado</span>
                    <span className="strategy-val" style={{ color: "#f39c12" }}>{myPriceSuggestion.avg}€</span>
                  </div>
                  <div className="strategy-row">
                    <span className="strategy-key">Precio premium (+diferenciación)</span>
                    <span className="strategy-val" style={{ color: "#2ecc71" }}>{myPriceSuggestion.high}€</span>
                  </div>
                </div>

                <div className="section-title">Análisis del mercado</div>
                <div className="strategy-card">
                  <div className="strategy-title">📊 Lo que viste</div>
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
                    <span className="strategy-key">Con vídeo</span>
                    <span className="strategy-val">{stats.withVideo} de {stats.total}</span>
                  </div>
                  <div className="strategy-row">
                    <span className="strategy-key">Con personalización</span>
                    <span className="strategy-val">{stats.withCustom} de {stats.total}</span>
                  </div>
                  <div className="strategy-row">
                    <span className="strategy-key">Envío medio</span>
                    <span className="strategy-val">{stats.avgShip !== null ? `${stats.avgShip}€` : "—"}</span>
                  </div>
                  <div className="strategy-row">
                    <span className="strategy-key">Rango de precios</span>
                    <span className="strategy-val">{stats.minPrice}€ – {stats.maxPrice}€</span>
                  </div>
                </div>

                <div className="section-title">Consejos para tu tienda</div>

                {parseFloat(stats.avgPrice) < 30 && (
                  <div className="tip warning">⚠️ El mercado tiene precios bajos. Diferénciate con <strong>efectos LED personalizables</strong> y control por app para justificar un precio mayor.</div>
                )}
                {stats.withRemote < stats.total / 2 && (
                  <div className="tip">📱 Menos de la mitad de competidores ofrece control por app o mando. <strong>Destaca tu control ESP32</strong> como una ventaja clara en el título.</div>
                )}
                {stats.withVideo < stats.total / 2 && (
                  <div className="tip">🎥 Pocos competidores tienen vídeo. <strong>Añadir un vídeo corto</strong> de los efectos LED en oscuridad puede darte una ventaja enorme.</div>
                )}
                {stats.withCustom < stats.total / 2 && (
                  <div className="tip">🎨 Pocos ofrecen personalización. <strong>Ofrecer circuitos a medida o colores personalizados</strong> puede diferenciarte mucho.</div>
                )}
                {stats.specialized > stats.bestsellers && (
                  <div className="tip">🎯 Hay más tiendas especializadas que bestsellers. <strong>Oportunidad de ser el referente</strong> en un nicho concreto como F1 o RGB.</div>
                )}
                {stats.avgReviews && stats.avgReviews < 20 && (
                  <div className="tip">📈 Pocas reseñas de media por producto. <strong>El mercado es joven</strong>, hay sitio para entrar y posicionarte rápido.</div>
                )}
                <div className="tip">🏎️ Tu ventaja: el <strong>ESP32 con efectos programables</strong> es único. Menciona "control por app", "efectos personalizados" y "más de X animaciones" en el título.</div>
                <div className="tip">📸 En Etsy la foto lo es todo. <strong>Haz fotos en habitación oscura</strong> para que los LEDs brillen al máximo.</div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
