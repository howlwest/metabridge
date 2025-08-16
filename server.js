import express from "express";
import axios from "axios";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());
// --- API key simple para Acciones del GPT ---
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;

app.use((req, res, next) => {
  // Solo protegemos los endpoints "de negocio" (puedes excluir /api/health si quieres)
  const openPaths = ["/api/health"];
  if (openPaths.includes(req.path)) return next();

  const key = req.header("X-API-Key");
  if (!BRIDGE_API_KEY || key === BRIDGE_API_KEY) return next();
  return res.status(401).json({ error: "Unauthorized" });
});
// ====== CONFIG ======
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;     // ej: act_123456789012345
const TOKEN = process.env.META_SYSTEM_USER_TOKEN;        // System User token
const PORT = process.env.PORT || 5000;
// =====================

const BASE = (p) => `https://graph.facebook.com/${GRAPH_VERSION}/${p}`;

// Salud
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, version: GRAPH_VERSION, timestamp: new Date() });
});

// Insights (GET rápido últimos 7d)
app.get("/api/insights", async (_req, res) => {
  try {
    const url = `${BASE(`${AD_ACCOUNT_ID}/insights`)}?fields=campaign_name,impressions,clicks,spend&level=campaign&date_preset=last_7d&access_token=${TOKEN}`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error("Error insights GET:", err);
    res.status(500).json({ error: "No se pudieron obtener insights" });
  }
});

// Insights (POST flexible con fechas/breakdowns/fields)
app.post("/api/insights", async (req, res) => {
  try {
    const { level="ad", since, until, time_increment="1", breakdowns, fields } = req.body || {};
    const url = BASE(`${AD_ACCOUNT_ID}/insights`);
    const params = {
      level,
      time_range: since && until ? JSON.stringify({ since, until }) : undefined,
      time_increment,
      fields: fields || "date_start,ad_id,adset_id,campaign_id,spend,clicks,ctr,cpm,actions,action_values,roas"
    };
    if (breakdowns) params.breakdowns = breakdowns;

    const { data } = await axios.get(url, { params, headers: { Authorization: `Bearer ${TOKEN}` } });
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e?.response?.data || e.message });
  }
});

// Cambiar presupuesto ad set (EUR → céntimos)
app.post("/api/adset_budget", async (req, res) => {
  try {
    const { adset_id, daily_budget_eur } = req.body || {};
    if (!adset_id || !daily_budget_eur) return res.status(400).json({ error: "adset_id y daily_budget_eur son requeridos" });
    const url = BASE(`${adset_id}`);
    const params = { daily_budget: Math.round(Number(daily_budget_eur) * 100) };
    const { data } = await axios.post(url, null, { params, headers: { Authorization: `Bearer ${TOKEN}` } });
    res.json({ updated: true, meta: data });
  } catch (e) {
    res.status(400).json({ error: e?.response?.data || e.message });
  }
});

// Cambiar estado anuncio
app.post("/api/ad_status", async (req, res) => {
  try {
    const { ad_id, status } = req.body || {};
    if (!ad_id || !status) return res.status(400).json({ error: "ad_id y status son requeridos" });
    const url = BASE(`${ad_id}`);
    const { data } = await axios.post(url, null, { params: { status }, headers: { Authorization: `Bearer ${TOKEN}` } });
    res.json({ updated: true, meta: data });
  } catch (e) {
    res.status(400).json({ error: e?.response?.data || e.message });
  }
});

// Start server listening on all interfaces
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Meta Marketing API Bridge running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Public URL: https://${process.env.REPLIT_DOMAINS}`);
});
