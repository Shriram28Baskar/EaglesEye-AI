/**
 * EaglesEye-AI Backend API Client
 * Connects the React frontend to the FastAPI backend at http://localhost:8001
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8001";
const WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:8001";

// ── Types ─────────────────────────────────────────────────────────────────

export interface PatientSummary {
  id: string;
  name: string;
  age: number;
  gender: string;
  ward: string;
  room: string;
  diagnosis: string;
  assigned_nurse: string | null;
  admitted_days: number;
  risk_score: number;
  confidence: number;
  severity: "low" | "moderate" | "high" | "critical";
  trend: "improving" | "stable" | "deteriorating" | "rapidly_deteriorating";
  reasoning: string;
  top_factors: string[];
  ai_degraded: boolean;
  active_alerts: number;
}

export interface VitalReading {
  hr: number;
  bp_sys: number;
  bp_dia: number;
  spo2: number;
  temp: number;
  rr: number;
  time?: string;
}

export interface RiskAssessment {
  risk_score: number;
  confidence: number;
  severity: string;
  trend: string;
  reasoning: string;
  top_factors: string[];
  abnormalities: Array<{ type: string; severity: string; value: number; message: string }>;
  model_version: string;
  ai_degraded: boolean;
  ts?: string;
}

export interface AlertEvent {
  id: string;
  patient_id: string;
  alert_type: "single_vital" | "correlated";
  abnormality_type: string;
  severity: "low" | "moderate" | "high" | "critical";
  status: "generated" | "acknowledged" | "viewed" | "resolved" | "escalated";
  message: string;
  created_at: string;
}

export interface DashboardSummary {
  total_patients: number;
  critical_count: number;
  high_risk_count: number;
  monitor_count: number;
  stable_count: number;
  active_alerts: number;
  avg_risk: number;
  nurses_available: number;
}

export interface TriageSummary {
  condition: string;
  clinical_concern: string;
  predicted_outcome: string;
  key_contributors: string[];
  recommended_actions: string[];
  ai_degraded: boolean;
}

export interface ExplainabilityFactor {
  factor: string;
  weight: number;
  direction: string;
  value: number;
  threshold: number;
  contribution_pct: number;
}

export interface SystemHealth {
  overall: "ok" | "degraded" | "down";
  services: Record<string, { status: string; [key: string]: unknown }>;
}

export interface StageStats {
  avg_ms: number;
  p95_ms: number;
  p99_ms: number;
  min_ms: number;
  max_ms: number;
}

export interface PipelineLatency {
  sample_count: number;
  stages: {
    db_write_ms?: StageStats;
    risk_engine_ms?: StageStats;
    ml_inference_ms?: StageStats;
    explainability_ms?: StageStats;
    prediction_ms?: StageStats;
    alert_correlation_ms?: StageStats;
    ws_broadcast_ms?: StageStats;
    total_pipeline_ms?: StageStats;
  };
  recent: Array<{ patient_id: string; ts: number; total_pipeline_ms: number; [key: string]: unknown }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export const api = {
  // Dashboard
  getDashboardSummary: () =>
    apiFetch<DashboardSummary>("/api/dashboard/summary"),

  getDashboardPatients: () =>
    apiFetch<PatientSummary[]>("/api/dashboard/patients"),

  // Patients
  getPatients: () =>
    apiFetch<PatientSummary[]>("/api/patients"),

  getPatient: (id: string) =>
    apiFetch<Record<string, unknown>>(`/api/patients/${id}`),

  postVitals: (id: string, vitals: Omit<VitalReading, "time">) =>
    apiFetch<{ status: string; message: string }>(`/api/patients/${id}/vitals`, {
      method: "POST",
      body: JSON.stringify(vitals),
    }),

  getLatestVitals: (id: string) =>
    apiFetch<VitalReading>(`/api/patients/${id}/vitals/latest`),

  getVitalsHistory: (id: string, limit = 60) =>
    apiFetch<VitalReading[]>(`/api/patients/${id}/vitals/history?limit=${limit}`),

  getCurrentRisk: (id: string) =>
    apiFetch<RiskAssessment>(`/api/patients/${id}/risk/current`),

  getRiskHistory: (id: string) =>
    apiFetch<RiskAssessment[]>(`/api/patients/${id}/risk/history`),

  getExplainability: (id: string) =>
    apiFetch<{ factors: ExplainabilityFactor[]; reasoning_trace: string }>(`/api/patients/${id}/explainability`),

  getPrediction: (id: string) =>
    apiFetch<{ likelihood_pct: number; time_to_critical_min: number | null; trajectory: unknown[]; trend: string }>(
      `/api/patients/${id}/prediction`
    ),

  generateTriage: (id: string) =>
    apiFetch<TriageSummary>(`/api/patients/${id}/triage`, { method: "POST", body: "{}" }),

  getTimeline: (id: string) =>
    apiFetch<Array<{ id: string; event_type: string; payload: unknown; ts: string }>>(
      `/api/patients/${id}/timeline`
    ),

  comparePatients: (ids: string[]) =>
    apiFetch<unknown[]>(`/api/patients/compare?ids=${ids.join(",")}`),

  // Alerts
  getAlerts: (params?: { status?: string; severity?: string; patient_id?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch<AlertEvent[]>(`/api/alerts${q ? "?" + q : ""}`);
  },

  acknowledgeAlert: (id: string) =>
    apiFetch<{ status: string }>(`/api/alerts/${id}/acknowledge`, { method: "POST", body: "{}" }),

  resolveAlert: (id: string) =>
    apiFetch<{ status: string }>(`/api/alerts/${id}/resolve`, { method: "POST", body: "{}" }),

  escalateAlert: (id: string) =>
    apiFetch<{ status: string }>(`/api/alerts/${id}/escalate`, { method: "POST", body: "{}" }),

  // Priority Queue
  getPriorityQueue: () =>
    apiFetch<Array<{ patient_id: string; score: number }>>("/api/priority/queue"),

  // Notifications
  getNotifications: () =>
    apiFetch<unknown[]>("/api/notifications"),

  markNotificationRead: (id: string) =>
    apiFetch<{ status: string }>(`/api/notifications/${id}/read`, { method: "POST", body: "{}" }),

  markAllNotificationsRead: () =>
    apiFetch<{ status: string; count: number }>("/api/notifications/read-all", { method: "POST", body: "{}" }),

  // Simulator
  startSimulation: (patient_id: string, mode: "stable" | "gradual_decline" | "severe_deterioration", duration_seconds = 120) =>
    apiFetch<{ status: string; run_id: string }>("/api/simulator/start", {
      method: "POST",
      body: JSON.stringify({ patient_id, mode, duration_seconds }),
    }),

  stopSimulation: (patient_id: string) =>
    apiFetch<{ status: string }>("/api/simulator/stop", {
      method: "POST",
      body: JSON.stringify({ patient_id }),
    }),

  // Search
  search: (q: string) =>
    apiFetch<{ patients: PatientSummary[]; alerts: AlertEvent[] }>(`/api/search?q=${encodeURIComponent(q)}`),

  // System
  getSystemHealth: () =>
    apiFetch<SystemHealth>("/api/system/health"),

  // Ward analytics
  getWardAnalytics: (ward_id: string) =>
    apiFetch<unknown>(`/api/ward/${encodeURIComponent(ward_id)}/analytics`),
};

// ── WebSocket Helpers ─────────────────────────────────────────────────────

export function createDashboardWebSocket(onMessage: (data: unknown) => void): WebSocket {
  const ws = new WebSocket(`${WS_BASE}/ws/dashboard`);
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch {}
  };
  ws.onerror = (e) => console.error("Dashboard WS error:", e);
  return ws;
}

export function createPatientVitalsWebSocket(
  patientId: string,
  onMessage: (data: unknown) => void
): WebSocket {
  const ws = new WebSocket(`${WS_BASE}/ws/patients/${patientId}/vitals`);
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch {}
  };
  ws.onerror = (e) => console.error("Vitals WS error:", e);
  return ws;
}

export function createAlertsWebSocket(onMessage: (data: unknown) => void): WebSocket {
  const ws = new WebSocket(`${WS_BASE}/ws/alerts`);
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch {}
  };
  ws.onerror = (e) => console.error("Alerts WS error:", e);
  return ws;
}

// ── Latency API ───────────────────────────────────────────────────────────

export const latencyApi = {
  getStats: (): Promise<PipelineLatency> =>
    apiFetch<PipelineLatency>("/api/system/latency"),
};
