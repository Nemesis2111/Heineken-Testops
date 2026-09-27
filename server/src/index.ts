/**
 * Heineken TestOps — Backend API Server
 * ─────────────────────────────────────
 * Endpoints:
 *   POST   /api/upload              — Upload a file for a project+date
 *   GET    /api/files               — List all uploaded files (optionally ?project=xxx&date=YYYY-MM-DD)
 *   GET    /api/files/latest        — Get the latest upload for a project (?project=xxx)
 *   GET    /api/files/:id           — Download a file by ID
 *   GET    /api/files/:id/meta      — Get metadata for a file by ID
 *   DELETE /api/files/:id           — Delete an uploaded file
 *   GET    /api/reports/daily       — Get all files uploaded today (?project=xxx)
 *   GET    /api/health              — Server health check
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

// ─── Config ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const UPLOADS_DIR = path.resolve(__dirname, "../uploads");
const META_FILE = path.resolve(__dirname, "../uploads/meta.json");
const ALLOWED_EXTENSIONS = new Set([".xlsx", ".xls", ".csv"]);

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadMeta {
  id: string;
  originalName: string;
  storedName: string;
  project: string;
  projectId: string;
  uploadDate: string;        // ISO string
  reportDate: string;        // "YYYY-MM-DD" — the date this file represents
  size: number;              // bytes
  mimeType: string;
  fileType: "merlin" | "executions" | "defects" | "generic";
  notes: string;
}

// ─── Meta store (JSON file on disk) ──────────────────────────────────────────

function readMeta(): UploadMeta[] {
  if (!fs.existsSync(META_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(META_FILE, "utf-8")) as UploadMeta[];
  } catch {
    return [];
  }
}

function writeMeta(records: UploadMeta[]): void {
  fs.writeFileSync(META_FILE, JSON.stringify(records, null, 2), "utf-8");
}

function appendMeta(record: UploadMeta): void {
  const all = readMeta();
  all.push(record);
  writeMeta(all);
}

// ─── Multer storage ───────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Only .xlsx, .xls, .csv are accepted.`));
    }
  },
});

// ─── App ──────────────────────────────────────────────────────────────────────

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, mobile apps, postman, server-to-server)
    if (!origin) return callback(null, true);
    // Allow localhost during development
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    // Allow any configured production domains (or all if wildcard set)
    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin) || allowedOrigins.length === 0) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function inferFileType(originalName: string, projectId: string): UploadMeta["fileType"] {
  const lower = originalName.toLowerCase();
  if (projectId === "merlin-intake-v5") return "merlin";
  if (lower.includes("defect") || lower.includes("bug")) return "defects";
  if (lower.includes("exec") || lower.includes("test") || lower.includes("tc")) return "executions";
  return "generic";
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/** GET /api/health */
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

/** POST /api/upload
 * Body (multipart/form-data):
 *   file        — the Excel / CSV file
 *   projectId   — "merlin-intake-v5" | "dbb-md1-lsit" | ...
 *   project     — human-readable project name
 *   reportDate  — "YYYY-MM-DD" (defaults to today)
 *   notes       — optional free text
 */
app.post("/api/upload", upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded." });
    return;
  }

  const { projectId = "unknown", project = "Unknown", reportDate, notes = "" } = req.body as Record<string, string>;
  const date = reportDate && /^\d{4}-\d{2}-\d{2}$/.test(reportDate) ? reportDate : todayStr();

  const meta: UploadMeta = {
    id:           path.parse(req.file.filename).name, // uuid (without ext)
    originalName: req.file.originalname,
    storedName:   req.file.filename,
    project,
    projectId,
    uploadDate:   new Date().toISOString(),
    reportDate:   date,
    size:         req.file.size,
    mimeType:     req.file.mimetype,
    fileType:     inferFileType(req.file.originalname, projectId),
    notes,
  };

  appendMeta(meta);
  res.status(201).json({ success: true, file: meta });
});

/** GET /api/files
 * Query params: project (optional), date (optional YYYY-MM-DD)
 */
app.get("/api/files", (req: Request, res: Response) => {
  const { project, date } = req.query as Record<string, string>;
  let records = readMeta();
  if (project) records = records.filter((r) => r.projectId === project || r.project === project);
  if (date)    records = records.filter((r) => r.reportDate === date);
  // Sort newest first
  records.sort((a, b) => b.uploadDate.localeCompare(a.uploadDate));
  res.json(records);
});

/** GET /api/files/latest?project=xxx */
app.get("/api/files/latest", (req: Request, res: Response) => {
  const { project } = req.query as { project?: string };
  let records = readMeta();
  if (project) records = records.filter((r) => r.projectId === project || r.project === project);
  records.sort((a, b) => b.uploadDate.localeCompare(a.uploadDate));
  if (records.length === 0) {
    res.status(404).json({ error: "No files found." });
    return;
  }
  res.json(records[0]);
});

/** GET /api/reports/daily?project=xxx — today's files */
app.get("/api/reports/daily", (req: Request, res: Response) => {
  const { project } = req.query as { project?: string };
  let records = readMeta();
  records = records.filter((r) => r.reportDate === todayStr());
  if (project) records = records.filter((r) => r.projectId === project || r.project === project);
  records.sort((a, b) => b.uploadDate.localeCompare(a.uploadDate));
  res.json(records);
});

/** GET /api/files/:id/meta */
app.get("/api/files/:id/meta", (req: Request, res: Response) => {
  const record = readMeta().find((r) => r.id === req.params.id);
  if (!record) {
    res.status(404).json({ error: "File not found." });
    return;
  }
  res.json(record);
});

/** GET /api/files/:id — download raw file */
app.get("/api/files/:id", (req: Request, res: Response) => {
  const record = readMeta().find((r) => r.id === req.params.id);
  if (!record) {
    res.status(404).json({ error: "File not found." });
    return;
  }
  const filePath = path.join(UPLOADS_DIR, record.storedName);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File data not found on disk." });
    return;
  }
  res.setHeader("Content-Disposition", `attachment; filename="${record.originalName}"`);
  res.setHeader("Content-Type", record.mimeType);
  res.sendFile(filePath);
});

/** DELETE /api/files/:id */
app.delete("/api/files/:id", (req: Request, res: Response) => {
  const all = readMeta();
  const idx = all.findIndex((r) => r.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: "File not found." });
    return;
  }
  const [record] = all.splice(idx, 1);
  const filePath = path.join(UPLOADS_DIR, record.storedName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  writeMeta(all);
  res.json({ success: true, deleted: record.id });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[server error]", err.message);
  res.status(400).json({ error: err.message });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`✅  Heineken TestOps API running → http://localhost:${PORT}`);
  console.log(`   Uploads directory: ${UPLOADS_DIR}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌  Port ${PORT} is already in use.`);
    console.error(`   Kill the process with:  netstat -ano | findstr :${PORT}  then  taskkill /PID <pid> /F`);
    console.error(`   Or set a different port: PORT=3002 npm run dev\n`);
    process.exit(1);
  } else {
    throw err;
  }
});

export default app;
