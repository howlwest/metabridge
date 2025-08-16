import { queryClient } from "./queryClient";

export const api = {
  // Health check
  async health() {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error("Health check failed");
    return response.json();
  },

  // Get insights
  async insights(data: {
    since: string;
    until: string;
    level?: string;
    time_increment?: string;
    breakdowns?: string;
    fields?: string;
  }) {
    const response = await fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get insights");
    }
    
    return response.json();
  },

  // Update ad set budget
  async updateBudget(data: {
    adset_id: string;
    daily_budget_eur: number;
  }) {
    const response = await fetch("/api/adset_budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update budget");
    }
    
    return response.json();
  },

  // Update ad status
  async updateAdStatus(data: {
    ad_id: string;
    status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  }) {
    const response = await fetch("/api/ad_status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update ad status");
    }
    
    return response.json();
  },
};

// Helper to invalidate cache after mutations
export const invalidateQueries = (queryKey: string[]) => {
  queryClient.invalidateQueries({ queryKey });
};
