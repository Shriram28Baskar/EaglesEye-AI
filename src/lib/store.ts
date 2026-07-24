import { useEffect, useSyncExternalStore } from "react";
import { generatePatients, type Patient, type Status } from "./mockData";
import { triggerTwilioCall } from "./twilioServer";

type Listener = () => void;

export interface Nurse {
  name: string;
  phone: string; // E.164 without +
  ward: string;
  available: boolean;
}

export interface AlertLog {
  id: string;
  patientId: string;
  patientName: string;
  nurse: Nurse;
  risk: number;
  message: string;
  ts: number;
  delivered: boolean;
  reasons?: string[];
}

export interface AuditLogEvent {
  call_sid: string;
  call_status: string;
  answered: boolean;
  person_contacted: string;
  phone: string;
  patient: string;
  timestamp: string;
  bed: string;
  condition: string;
  risk_score: number;
  call_time: string;
  response_time: string;
  log: string;
}

export const NURSES: Nurse[] = [
  { name: "Rupa",       phone: "917539984107", ward: "ICU-A",      available: true },
  { name: "N. Patel",   phone: "917539984107", ward: "ICU-B",      available: true },
  { name: "S. Khan",    phone: "917539984107", ward: "CCU",        available: true },
  { name: "R. Mehta",   phone: "917539984107", ward: "Cardiac",    available: true },
  { name: "A. Singh",   phone: "917539984107", ward: "Pulmonary",  available: true },
  { name: "L. Davis",   phone: "917539984107", ward: "General-1",  available: true },
  { name: "M. Brown",   phone: "917539984107", ward: "General-2",  available: true },
  { name: "K. Iyer",    phone: "917539984107", ward: "Pediatrics", available: true },
];

function statusFromRisk(r: number): Status {
  if (r >= 80) return "Critical";
  if (r >= 60) return "High Risk";
  if (r >= 35) return "Monitor";
  return "Stable";
}

function genReasons(p: Patient): string[] {
  const r: string[] = [];
  if (p.spo2 < 92) r.push(`SpO₂ at ${p.spo2}% — below safe threshold (94%)`);
  else if (p.spo2 < 95) r.push(`SpO₂ trending down (${p.spo2}%) over last 20 min`);
  if (p.heartRate > 110) r.push(`Heart rate elevated to ${p.heartRate} bpm`);
  else if (p.heartRate < 55) r.push(`Bradycardia: HR ${p.heartRate} bpm`);
  if (p.bpSys < 95) r.push(`Systolic BP dropping (${p.bpSys} mmHg)`);
  else if (p.bpSys > 160) r.push(`Hypertensive reading: ${p.bpSys} mmHg`);
  if (p.temperature > 38.5) r.push(`Fever: ${p.temperature.toFixed(1)}°C`);
  if (r.length === 0) r.push("All vitals within stable range");
  return r;
}

function buildWhatsAppMessage(p: Patient, nurse: Nurse): string {
  return [
    `🚨 EaglesEye AI · ${p.status.toUpperCase()} ALERT`,
    ``,
    `Patient: ${p.name} (${p.id})`,
    `Ward: ${p.ward} · Room ${p.room}`,
    `Risk Score: ${p.riskScore}%`,
    ``,
    `Vitals:`,
    `• SpO₂: ${p.spo2}%`,
    `• HR: ${p.heartRate} bpm`,
    `• BP: ${p.bpSys}/${p.bpDia} mmHg`,
    `• Temp: ${p.temperature.toFixed(1)}°C`,
    ``,
    `Action: Please respond immediately. You have been auto-assigned by EaglesEye AI.`,
    `— Nurse ${nurse.name}`,
  ].join("\n");
}

class Store {
  patients: Patient[] = generatePatients();
  totalNurses = NURSES.length;
  alerts: AlertLog[] = [];
  auditLogs: AuditLogEvent[] = [];
  private listeners = new Set<Listener>();

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  private emit() { this.listeners.forEach(l => l()); }

  getSnapshot = () => this.patients;
  getAlertsSnapshot = () => this.alerts;
  getAuditLogsSnapshot = () => this.auditLogs;
  subscribeAlerts = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  subscribeAuditLogs = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  
  addAuditLogs = (logs: AuditLogEvent[]) => {
    this.auditLogs = [...logs, ...this.auditLogs];
    this.emit();
  };

  private pickNurse(ward: string): Nurse | null {
    const assigned = new Set(this.patients.map(p => p.assignedNurse).filter(Boolean));
    const free = NURSES.filter(n => !assigned.has(n.name));
    if (free.length === 0) return null;
    const wardMatch = free.find(n => n.ward === ward);
    return wardMatch ?? free[0];
  }

  private dispatchAlert(p: Patient, nurse: Nurse) {
    const msg = buildWhatsAppMessage(p, nurse);
    const log: AlertLog = {
      id: `A${Date.now()}${Math.floor(Math.random() * 1000)}`,
      patientId: p.id,
      patientName: p.name,
      nurse,
      risk: p.riskScore,
      message: msg,
      ts: Date.now(),
      delivered: true,
      reasons: p.reasons,
    };
    this.alerts = [log, ...this.alerts].slice(0, 50);

    return log;
  }

  tick() {
    const autoAssignments: { patient: Patient; nurse: Nurse }[] = [];

    this.patients = this.patients.map(p => {
      const driftSpo2 = (Math.random() - 0.5) * 2;
      const driftHr = (Math.random() - 0.5) * 6;
      const driftBp = (Math.random() - 0.5) * 4;
      const driftTemp = (Math.random() - 0.5) * 0.3;

      const spo2 = Math.round(Math.max(80, Math.min(100, p.spo2 + driftSpo2)));
      const heartRate = Math.round(Math.max(45, Math.min(160, p.heartRate + driftHr)));
      const bpSys = Math.round(Math.max(75, Math.min(180, p.bpSys + driftBp)));
      const temperature = Number(Math.max(35, Math.min(40.5, p.temperature + driftTemp)).toFixed(1));

      let risk = 10;
      if (spo2 < 92) risk += (92 - spo2) * 8;
      else if (spo2 < 95) risk += (95 - spo2) * 4;
      if (heartRate > 110) risk += (heartRate - 110) * 1.5;
      if (heartRate < 55) risk += (55 - heartRate) * 2;
      if (bpSys < 95) risk += (95 - bpSys) * 1.8;
      if (temperature > 38.5) risk += (temperature - 38.5) * 12;
      if (p.assignedNurse) risk -= 8;
      risk = Math.round(Math.max(5, Math.min(99, risk * 0.55 + p.riskScore * 0.45)));

      const updated: Patient = {
        ...p,
        spo2, heartRate, bpSys, temperature,
        riskScore: risk,
        status: statusFromRisk(risk),
        alert: risk >= 80 || (risk >= 60 && Math.random() > 0.5),
      };
      updated.reasons = genReasons(updated);
      updated.history = [...p.history.slice(1), { t: "now", spo2, hr: heartRate, risk }];
      updated.history = updated.history.map((h, i, arr) => i === arr.length - 1 ? h : { ...h, t: `-${(arr.length - 1 - i) * 5}m` });
      const trend = (risk - p.riskScore);
      updated.predictions = [15, 30, 45, 60].map((t, i) => ({
        t,
        risk: Math.round(Math.max(5, Math.min(99, risk + trend * (i + 1) * 0.6 + (Math.random() - 0.5) * 4))),
      }));
      return updated;
    });

    // Auto-assign nurses to any high-risk / critical patient without one
    this.patients = this.patients.map(p => {
      if (!p.assignedNurse && p.riskScore >= 60) {
        const nurse = this.pickNurse(p.ward);
        if (nurse) {
          autoAssignments.push({ patient: p, nurse });
          return { ...p, assignedNurse: nurse.name };
        }
      }
      return p;
    });

    // Force highest risk first for batched Twilio calls
    autoAssignments.sort((a, b) => b.patient.riskScore - a.patient.riskScore);

    const newAlerts: AlertLog[] = [];
    autoAssignments.forEach(({ patient, nurse }) => {
      newAlerts.push(this.dispatchAlert(patient, nurse));
    });

    if (newAlerts.length > 0) {
      triggerTwilioCall({ data: newAlerts })
        .then(res => {
          if (res && res.auditLogs) {
            this.addAuditLogs(res.auditLogs);
          }
        })
        .catch(err => console.error("Twilio server fn failed:", err));
    }

    this.patients.sort((a, b) => b.riskScore - a.riskScore);
    this.emit();
  }

  assignNurse(id: string) {
    let assignedNurse: Nurse | null = null;
    this.patients = this.patients.map(p => {
      if (p.id !== id) return p;
      const nurse = p.assignedNurse
        ? NURSES.find(n => n.name === p.assignedNurse) ?? this.pickNurse(p.ward)
        : this.pickNurse(p.ward);
      if (!nurse) return p;
      assignedNurse = nurse;
      const newRisk = Math.max(15, p.riskScore - 25);
      const updated: Patient = {
        ...p,
        assignedNurse: nurse.name,
        riskScore: newRisk,
        status: statusFromRisk(newRisk),
        alert: false,
        spo2: Math.min(100, p.spo2 + 3),
        heartRate: p.heartRate > 100 ? p.heartRate - 10 : p.heartRate + 2,
      };
      updated.reasons = ["Nurse intervention in progress — vitals stabilizing", ...genReasons(updated).slice(0, 2)];
      updated.history = [...p.history.slice(1), { t: "now", spo2: updated.spo2, hr: updated.heartRate, risk: newRisk }];
      updated.predictions = [15, 30, 45, 60].map((t, i) => ({
        t, risk: Math.round(Math.max(5, newRisk - i * 3 + (Math.random() - 0.5) * 4)),
      }));
      return updated;
    });
    if (assignedNurse) {
      const p = this.patients.find(x => x.id === id);
      if (p) {
        const log = this.dispatchAlert(p, assignedNurse);
        triggerTwilioCall({ data: [log] })
          .then(res => {
            if (res && res.auditLogs) {
              this.addAuditLogs(res.auditLogs);
            }
          })
          .catch(err => console.error("Twilio server fn failed:", err));
      }
    }
    this.patients.sort((a, b) => b.riskScore - a.riskScore);
    this.emit();
  }
}

export const store = new Store();

export function usePatients() {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function useAlerts() {
  return useSyncExternalStore(store.subscribeAlerts, store.getAlertsSnapshot, store.getAlertsSnapshot);
}

export function useAuditLogs() {
  return useSyncExternalStore(store.subscribeAuditLogs, store.getAuditLogsSnapshot, store.getAuditLogsSnapshot);
}

export function useRealtime(intervalMs = 3500) {
  useEffect(() => {
    const id = setInterval(() => store.tick(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

export function whatsappLink(phone: string, message: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
