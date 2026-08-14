# Inks Printer Agent

A professional desktop print station agent for **Inks by Trackify**.  
Connects to the Printa server, fetches print jobs, and sends them silently to your local printer.

---

## Quick Start

### 1. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure `.env`

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:
```env
INKS_SERVER_URL=http://localhost:3000
INKS_AGENT_EMAIL=agent@yourshop.com
INKS_AGENT_PASSWORD=yourpassword
INKS_PRINTER_NAME=Microsoft Print to PDF
```

### 3. Run the agent

```bash
python -m src.main
# or double-click run.bat
```

---

## Features

| Feature | Details |
|---|---|
| **Persistent Session** | JWT stored on disk — stay logged in across restarts |
| **Auto-Print** | Optionally print new jobs automatically with a configurable delay |
| **Manual Print** | Click Print per job, or Print All |
| **PDF Preview** | Opens PDF in system viewer before printing |
| **Multi-Printer** | Select from all installed OS printers |
| **Remote Control** | Admin can pause, resume, change printer, disconnect from web dashboard |
| **Activity Logs** | All actions synced to Supabase for admin visibility |
| **System Tray** | Minimize to tray — runs silently in background |

---

## Pages

| Page | Description |
|---|---|
| 🖨 **Print Queue** | All pending jobs with Print / Preview per card |
| 📊 **Dashboard** | Live stats — printed today, queue depth, uptime |
| ⚙ **Settings** | Printer, mode, poll interval, alerts, save folder |
| 📝 **Activity Log** | Timestamped log with severity filtering and search |

---

## Build .exe

```bash
build.bat
# Output: dist\InksPrinterAgent.exe
```

---

## Testing with Microsoft Print to PDF

Set `INKS_PRINTER_NAME=Microsoft Print to PDF` in `.env`.  
When a job is printed, a **Save As** dialog will appear — this is normal for PDF printers.  
On a real physical printer, printing is completely silent.

---

## Roles

The agent requires a user account with role **`PRINTER_AGENT`** (or `ADMIN`/`PRINTER_ADMIN`).  
Create one via the admin dashboard or directly in the database.

---

## Notes

- **Session timeout**: `PRINTER_AGENT` accounts use **30-day JWT** tokens
- **Auto re-login**: If the token expires, the agent silently re-authenticates using `.env` credentials
- **Save folder**: PDFs are saved to `~/Desktop/PrintQueue/` by default (configurable)
