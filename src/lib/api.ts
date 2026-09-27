/**
 * api.ts — Frontend API client for the Heineken TestOps backend
 * ─────────────────────────────────────────────────────────────
 * All calls go to http://localhost:3001/api
 * The client degrades gracefully when the server is unreachable.
 */

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export interface ServerFileMeta {
  id: string;
  originalName: string;
  storedName: string;
  project: string;
  projectId: string;
  uploadDate: string;
  reportDate: string;
  size: number;
  mimeType: string;
  fileType: "merlin" | "executions" | "defects" | "generic";
  notes: string;
}

// ─── Health check ─────────────────────────────────────────────────────────────

export async function checkServerHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Upload a file ────────────────────────────────────────────────────────────

export interface UploadOptions {
  file: File;
  projectId: string;
  project: string;
  reportDate?: string;   // "YYYY-MM-DD" — defaults to today on the server
  notes?: string;
}

export async function uploadFile(opts: UploadOptions): Promise<ServerFileMeta> {
  const form = new FormData();
  form.append("file", opts.file);
  form.append("projectId", opts.projectId);
  form.append("project", opts.project);
  if (opts.reportDate) form.append("reportDate", opts.reportDate);
  if (opts.notes)      form.append("notes", opts.notes);

  const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error((err as { error: string }).error ?? "Upload failed");
  }
  const data = await res.json() as { success: boolean; file: ServerFileMeta };
  return data.file;
}

// ─── List files ───────────────────────────────────────────────────────────────

export async function listFiles(opts: { projectId?: string; date?: string } = {}): Promise<ServerFileMeta[]> {
  const params = new URLSearchParams();
  if (opts.projectId) params.set("project", opts.projectId);
  if (opts.date)      params.set("date", opts.date);

  const res = await fetch(`${API_BASE}/files?${params}`);
  if (!res.ok) return [];
  return res.json() as Promise<ServerFileMeta[]>;
}

// ─── Get latest file for a project ───────────────────────────────────────────

export async function getLatestFile(projectId: string): Promise<ServerFileMeta | null> {
  try {
    const res = await fetch(`${API_BASE}/files/latest?project=${encodeURIComponent(projectId)}`);
    if (!res.ok) return null;
    return res.json() as Promise<ServerFileMeta>;
  } catch {
    return null;
  }
}

// ─── Get today's reports ──────────────────────────────────────────────────────

export async function getDailyReports(projectId?: string): Promise<ServerFileMeta[]> {
  try {
    const params = projectId ? `?project=${encodeURIComponent(projectId)}` : "";
    const res = await fetch(`${API_BASE}/reports/daily${params}`);
    if (!res.ok) return [];
    return res.json() as Promise<ServerFileMeta[]>;
  } catch {
    return [];
  }
}

// ─── Download a file as ArrayBuffer (for re-parsing on the client) ────────────

export async function downloadFileBuffer(id: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(`${API_BASE}/files/${id}`);
    if (!res.ok) return null;
    return res.arrayBuffer();
  } catch {
    return null;
  }
}

// ─── Delete a file ────────────────────────────────────────────────────────────

export async function deleteFile(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/files/${id}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}
