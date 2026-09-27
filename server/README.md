# Heineken TestOps — Backend Server

Express API that persists daily Excel/CSV uploads and serves them back to the frontend.

## Quick Start

```bash
# 1. Install dependencies
cd server
npm install

# 2. Start the server (development — auto-restarts on changes)
npm run dev:watch

# Or start once
npm run dev
```

The server starts on **http://localhost:3001**.

---

## REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server health check |
| `POST` | `/api/upload` | Upload a file (multipart/form-data) |
| `GET` | `/api/files` | List all stored files (`?project=xxx&date=YYYY-MM-DD`) |
| `GET` | `/api/files/latest` | Latest file for a project (`?project=xxx`) |
| `GET` | `/api/files/:id` | Download a file by ID |
| `GET` | `/api/files/:id/meta` | File metadata by ID |
| `DELETE` | `/api/files/:id` | Delete a file |
| `GET` | `/api/reports/daily` | Today's uploads (`?project=xxx`) |

### Upload body fields (multipart)

| Field | Required | Description |
|-------|----------|-------------|
| `file` | ✅ | The `.xlsx`, `.xls`, or `.csv` file |
| `projectId` | ✅ | e.g. `merlin-intake-v5`, `dbb-md1-lsit` |
| `project` | ✅ | Human-readable name, e.g. `Merlin Intake V5` |
| `reportDate` | ❌ | `YYYY-MM-DD` — defaults to today |
| `notes` | ❌ | Free-text annotation |

---

## Storage

Files are stored in `server/uploads/` as UUID-named files.  
Metadata is persisted in `server/uploads/meta.json`.

---

## How it connects to the frontend

1. **Excel Import Center** — When you import a file, it is parsed locally (client-side, via XLSX Web Worker) **and** POSTed to the backend for persistence. A server status indicator shows whether the backend is online.

2. **Daily Reports** — On page load, the frontend:
   - Checks backend health
   - Lists all stored files for the active project
   - If no local data is loaded yet, **auto-downloads and re-parses the latest stored file** — so data is always available without re-uploading each session
   - Shows today's uploaded files in a status bar

3. **File History** — The Excel Import Center shows a table of all server-stored files with a Remove button per row.

---

## Daily Workflow

```
Morning:
  1. Open the app
  2. Go to Excel Import Center
  3. Select project → Browse & Import your latest Excel
  → File is parsed instantly AND saved to the server

Next day / new browser session:
  1. Open the app
  2. Go to Daily Reports
  → Last uploaded file loads automatically from the server
  → No need to re-upload
```
