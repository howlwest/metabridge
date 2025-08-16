import type { Express } from "express";
import { createServer, type Server } from "http";
import axios from "axios";

export async function registerRoutes(app: Express): Promise<Server> {
  // Environment variables
  const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";
  const META_TOKEN = process.env.META_SYSTEM_USER_TOKEN;
  const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;

  const BASE = (path: string) => `https://graph.facebook.com/${GRAPH_VERSION}/${path}`;

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      ok: true, 
      version: GRAPH_VERSION,
      timestamp: new Date().toISOString()
    });
  });

  // 1) Insights endpoint
  app.post("/api/insights", async (req, res) => {
    try {
      const { level = "ad", since, until, time_increment = "1", breakdowns, fields } = req.body || {};
      
      if (!since || !until) {
        return res.status(400).json({ error: "since and until dates are required" });
      }

      if (!META_TOKEN) {
        return res.status(500).json({ error: "META_SYSTEM_USER_TOKEN not configured" });
      }

      if (!AD_ACCOUNT_ID) {
        return res.status(500).json({ error: "META_AD_ACCOUNT_ID not configured" });
      }

      const url = BASE(`${AD_ACCOUNT_ID}/insights`);
      const params = {
        level,
        time_range: JSON.stringify({ since, until }),
        time_increment,
        fields: fields || "date_start,ad_id,adset_id,campaign_id,spend,clicks,ctr,cpm,actions,action_values,roas",
      };
      
      if (breakdowns) params.breakdowns = breakdowns;

      const { data } = await axios.get(url, { 
        params, 
        headers: { Authorization: `Bearer ${META_TOKEN}` } 
      });

      res.json(data);
    } catch (e: any) {
      console.error("Insights API error:", e?.response?.data || e.message);
      res.status(400).json({ 
        error: e?.response?.data || e.message,
        endpoint: "insights"
      });
    }
  });

  // 2) Update ad set budget endpoint (EUR → cents)
  app.post("/api/adset_budget", async (req, res) => {
    try {
      const { adset_id, daily_budget_eur } = req.body || {};
      
      if (!adset_id || !daily_budget_eur) {
        return res.status(400).json({ error: "adset_id and daily_budget_eur are required" });
      }

      if (!META_TOKEN) {
        return res.status(500).json({ error: "META_SYSTEM_USER_TOKEN not configured" });
      }

      const url = BASE(`${adset_id}`);
      const params = { 
        daily_budget: Math.round(Number(daily_budget_eur) * 100) 
      };

      const { data } = await axios.post(url, null, { 
        params, 
        headers: { Authorization: `Bearer ${META_TOKEN}` } 
      });

      res.json({ 
        updated: true, 
        meta: data,
        converted_budget_cents: params.daily_budget
      });
    } catch (e: any) {
      console.error("Budget update API error:", e?.response?.data || e.message);
      res.status(400).json({ 
        error: e?.response?.data || e.message,
        endpoint: "adset_budget"
      });
    }
  });

  // 3) Update ad status endpoint
  app.post("/api/ad_status", async (req, res) => {
    try {
      const { ad_id, status } = req.body || {};
      
      if (!ad_id || !status) {
        return res.status(400).json({ error: "ad_id and status are required" });
      }

      if (!["ACTIVE", "PAUSED", "ARCHIVED"].includes(status)) {
        return res.status(400).json({ error: "status must be ACTIVE, PAUSED, or ARCHIVED" });
      }

      if (!META_TOKEN) {
        return res.status(500).json({ error: "META_SYSTEM_USER_TOKEN not configured" });
      }

      const url = BASE(`${ad_id}`);
      const params = { status };

      const { data } = await axios.post(url, null, { 
        params, 
        headers: { Authorization: `Bearer ${META_TOKEN}` } 
      });

      res.json({ 
        updated: true, 
        meta: data,
        new_status: status
      });
    } catch (e: any) {
      console.error("Ad status API error:", e?.response?.data || e.message);
      res.status(400).json({ 
        error: e?.response?.data || e.message,
        endpoint: "ad_status"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
