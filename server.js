import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   CONFIG / ENV
========================= */
const GRAPH_VERSION = process.env.META_GRAPH_VERSION?.trim() || "v23.0";
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID?.trim(); // ej: act_123456789012345
const TOKEN =
  process.env.META_ACCESS_TOKEN?.trim() ||
  process.env.META_SYSTEM_USER_TOKEN?.trim(); // compat
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY?.trim();
const PORT = process.env.PORT || 5000;

const hasEssentialEnv = Boolean(AD_ACCOUNT_ID) && Boolean(TOKEN);

const BASE = (p) => `https://graph.facebook.com/${GRAPH_VERSION}/${p}`;
const authHeader = { Authorization: `Bearer ${TOKEN}` };

/* =========================
   API KEY GUARD
========================= */
// Rutas abiertas (sin API key)
const OPEN_PATHS = new Set(["/api/health", "/healthz"]);

app.use((req, res, next) => {
  if (OPEN_PATHS.has(req.path)) return next();
  if (req.method === "OPTIONS") return next();

  // Si no definiste BRIDGE_API_KEY, no bloquees (útil para pruebas locales)
  if (!BRIDGE_API_KEY) return next();

  const key = req.header("X-API-Key");
  if (key && key === BRIDGE_API_KEY) return next();

  return res.status(401).json({ error: "Unauthorized" });
});

/* =========================
   HEALTH
========================= */
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    version: GRAPH_VERSION,
    hasEnv: {
      AD_ACCOUNT_ID: Boolean(AD_ACCOUNT_ID),
      TOKEN: Boolean(TOKEN),
    },
    timestamp: new Date(),
  });
});

// Alias para health-checks de plataforma
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

/* =========================
   HELPERS
========================= */
function ensureEnv(res) {
  if (!hasEssentialEnv) {
    res.status(500).json({
      error: "Missing required env vars",
      details: {
        META_AD_ACCOUNT_ID: Boolean(AD_ACCOUNT_ID),
        META_ACCESS_TOKEN: Boolean(process.env.META_ACCESS_TOKEN),
        META_SYSTEM_USER_TOKEN: Boolean(process.env.META_SYSTEM_USER_TOKEN),
      },
    });
    return false;
  }
  return true;
}

function toCents(eur) {
  const n = Number(eur);
  if (Number.isNaN(n)) return undefined;
  return Math.round(n * 100);
}

/* =========================
   INSIGHTS
========================= */

// GET rápido: últimos 7 días a nivel campaña
app.get("/api/insights", async (_req, res) => {
  try {
    if (!ensureEnv(res)) return;

    const url = BASE(`${AD_ACCOUNT_ID}/insights`);
    const params = {
      level: "campaign",
      date_preset: "last_7d",
      fields: "campaign_name,impressions,clicks,spend",
    };

    const { data } = await axios.get(url, {
      params,
      headers: authHeader,
    });

    res.json(data);
  } catch (err) {
    console.error("GET /api/insights error:", err?.response?.data || err.message);
    res.status(500).json({ error: "No se pudieron obtener insights" });
  }
});

// POST flexible: fechas / level / breakdowns / fields / time_increment
app.post("/api/insights", async (req, res) => {
  try {
    if (!ensureEnv(res)) return;

    const {
      level = "ad",
      since,
      until,
      time_increment = "1",
      breakdowns,
      fields,
      date_preset, // opcional
    } = req.body || {};

    const url = BASE(`${AD_ACCOUNT_ID}/insights`);
    const params = {
      level,
      time_increment,
      fields:
        fields ||
        "date_start,ad_id,adset_id,campaign_id,spend,clicks,ctr,cpm,actions,action_values,roas",
    };

    if (breakdowns) params.breakdowns = breakdowns;
    if (since && until) {
      params.time_range = JSON.stringify({ since, until });
    } else if (date_preset) {
      params.date_preset = date_preset;
    }

    const { data } = await axios.get(url, {
      params,
      headers: authHeader,
    });

    res.json(data);
  } catch (err) {
    console.error("POST /api/insights error:", err?.response?.data || err.message);
    res.status(400).json({ error: err?.response?.data || err.message });
  }
});

/* =========================
   CAMBIAR PRESUPUESTO AD SET
========================= */
app.post("/api/adset_budget", async (req, res) => {
  try {
    if (!ensureEnv(res)) return;

    const { adset_id, daily_budget_eur } = req.body || {};
    if (!adset_id || daily_budget_eur === undefined) {
      return res
        .status(400)
        .json({ error: "adset_id y daily_budget_eur son requeridos" });
    }

    const daily_budget = toCents(daily_budget_eur);
    if (daily_budget === undefined)
      return res.status(400).json({ error: "daily_budget_eur inválido" });

    const url = BASE(`${adset_id}`);
    const params = { daily_budget };

    const { data } = await axios.post(url, null, {
      params,
      headers: authHeader,
    });

    res.json({ updated: true, meta: data });
  } catch (err) {
    console.error("POST /api/adset_budget error:", err?.response?.data || err.message);
    res.status(400).json({ error: err?.response?.data || err.message });
  }
});

/* =========================
   CAMBIAR ESTADO ANUNCIO
========================= */
app.post("/api/ad_status", async (req, res) => {
  try {
    if (!ensureEnv(res)) return;

    const { ad_id, status } = req.body || {};
    if (!ad_id || !status)
      return res.status(400).json({ error: "ad_id y status son requeridos" });

    const url = BASE(`${ad_id}`);
    const params = { status };

    const { data } = await axios.post(url, null, {
      params,
      headers: authHeader,
    });

    res.json({ updated: true, meta: data });
  } catch (err) {
    console.error("POST /api/ad_status error:", err?.response?.data || err.message);
    res.status(400).json({ error: err?.response?.data || err.message });
  }
});

/* =========================
   SIMULACIÓN DE DECISIONES
   (Acepta tanto proposals[] como action+payload)
========================= */
const DEFAULT_POLICY = {
  maxIncreasePct: 30,
  maxDecreasePct: 30,
  minDailyBudgetEur: 1,
  allowStatuses: new Set(["PAUSED", "ACTIVE", "ARCHIVED"]),
};

app.post("/api/simulate", async (req, res) => {
  try {
    const { context = {}, proposals, action, payload } = req.body || {};
    let results = [];

    if (Array.isArray(proposals)) {
      // --- modo "array de propuestas"
      results = proposals.map((p) => {
        const outcome = { id: p.id, type: p.type, approved: false, reason: "" };

        if (p.type === "budget_change") {
          const { delta_pct, new_daily_budget_eur } = p;
          if (typeof new_daily_budget_eur === "number") {
            if (new_daily_budget_eur < DEFAULT_POLICY.minDailyBudgetEur) {
              outcome.reason = `Presupuesto < mínimo (${DEFAULT_POLICY.minDailyBudgetEur} EUR)`;
              return outcome;
            }
          }
          if (typeof delta_pct === "number") {
            if (
              delta_pct > DEFAULT_POLICY.maxIncreasePct ||
              delta_pct < -DEFAULT_POLICY.maxDecreasePct
            ) {
              outcome.reason = `delta_pct fuera de umbral (+${DEFAULT_POLICY.maxIncreasePct}/-${DEFAULT_POLICY.maxDecreasePct})`;
              return outcome;
            }
          }
          outcome.approved = true;
          outcome.reason = "OK";
          return outcome;
        }

        if (p.type === "status_change") {
          if (!DEFAULT_POLICY.allowStatuses.has(p.new_status)) {
            outcome.reason = "Estado no permitido";
            return outcome;
          }
          outcome.approved = true;
          outcome.reason = "OK";
          return outcome;
        }

        outcome.reason = "Tipo no soportado";
        return outcome;
      });
    } else if (action && payload) {
      // --- modo "action + payload"
      if (action === "ad_status") {
        const outcome = {
          type: "status_change",
          payload,
          approved: false,
          reason: "",
        };
        if (DEFAULT_POLICY.allowStatuses.has(payload.status)) {
          outcome.approved = true;
          outcome.reason = `Status change to ${payload.status} is allowed.`;
        } else {
          outcome.reason = `Status ${payload.status} not allowed.`;
        }
        results.push(outcome);
      } else {
        results.push({ type: action, approved: false, reason: "Acción no soportada" });
      }
    } else {
      return res.status(400).json({ error: "Falta proposals[] o action+payload" });
    }

    res.json({
      mode: "simulation",
      contextEcho: context,
      policy: {
        maxIncreasePct: DEFAULT_POLICY.maxIncreasePct,
        maxDecreasePct: DEFAULT_POLICY.maxDecreasePct,
        minDailyBudgetEur: DEFAULT_POLICY.minDailyBudgetEur,
        allowStatuses: Array.from(DEFAULT_POLICY.allowStatuses),
      },
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("POST /api/simulate error:", err.message);
    res.status(500).json({ error: "Error simulando propuestas" });
  }
});

/* =========================
   404 + ERROR HANDLER
========================= */
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

/* =========================
   START
========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Meta Marketing API Bridge running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
});
