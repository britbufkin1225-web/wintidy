# WinTidy

WinTidy is a local Windows maintenance API built with NestJS, Prisma, and
SQLite. It scans for maintenance issues, previews cleanup impact, inventories
startup applications and processes, and finds duplicate files.

Safety is the primary design constraint: scans never delete files, cleanup
targets come from an internal allowlist, deletion requires `confirm: true`, and
every cleanup attempt is audited in SQLite.

## Features

- System health with CPU, memory, uptime, and disk usage
- Read-only scans of user temp, Windows temp, and detected browser caches
- Cleanup preview by category
- Confirmed cleanup with partial-failure reporting and audit logs
- Duplicate detection using file-size grouping before SHA-256 hashing
- Read-only Windows Startup folder and registry inventory
- Targeted orphaned startup registry maintenance with exact-value backups
- Running processes sorted by working-set memory
- Strict request validation and normalized error responses
- Local-only binding by default

## Requirements

- Windows 10 or later
- Node.js 22 or later
- npm 10 or later

## Setup

```powershell
Copy-Item .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run start:dev
```

The API starts at `http://127.0.0.1:3000/api/v1`.

Default configuration:

```dotenv
DATABASE_URL="file:./wintidy.db"
PORT=3000
HOST=127.0.0.1
```

## Dashboard

WinTidy includes a small optional local dashboard at
`http://127.0.0.1:3000/`. It shows system health and session-level cleanup
estimates with a dark crimson interface. **Run Scan** and **Dry Run Cleanup**
use only the read-only scan and preview endpoints; the dashboard never invokes
the destructive cleanup or registry removal endpoints.

## API

### `GET /api/v1/system/health`

Returns hostname, platform, uptime, sampled CPU load, memory usage, and usage
for the disk containing the WinTidy working directory.

### `GET /api/v1/cleanup/scan`

Scans approved cleanup locations without deleting anything. Results include
total file count, total bytes, grouped categories, per-root totals, truncation
state, and access errors. Category summaries are stored as `CleanupFinding`
records.

Approved categories:

- `user-temp`
- `windows-temp`
- `browser-cache`

Browser cleanup is restricted to exact Chromium `Cache`, `Code Cache`, and
`GPUCache` directories and Firefox `cache2` directories. Browser profiles,
cookies, history, saved credentials, and extensions are never cleanup roots.

### `POST /api/v1/cleanup/preview`

Performs a fresh read-only scan for selected categories:

```json
{
  "categories": ["user-temp", "browser-cache"]
}
```

### `POST /api/v1/cleanup/run`

Performs a fresh scan and deletes files only from approved roots:

```json
{
  "categories": ["user-temp"],
  "confirm": true
}
```

The response includes the maintenance run ID, status, files deleted, bytes
freed, skipped files, errors, and completion time. Files that changed after
discovery, links, junction escapes, locked files, and inaccessible files are
skipped.

### `GET /api/v1/files/duplicates?path=C:\Users\me\Documents`

Recursively scans one absolute directory. Files are grouped by size first;
only possible duplicates are streamed through SHA-256. The endpoint is
read-only and stops at a 100,000-file safety limit.

PowerShell URL example:

```powershell
$path = [uri]::EscapeDataString("C:\Users\me\Documents")
Invoke-RestMethod "http://127.0.0.1:3000/api/v1/files/duplicates?path=$path"
```

### `GET /api/v1/startup/apps`

Returns entries from user and machine Startup folders plus common `Run`
registry keys. Entries are observed and stored in `StartupEntry`; no registry
or Startup folder values are changed. `enabled` is `null` because WinTidy does
not currently interpret Windows `StartupApproved` state.

### `GET /api/v1/registry/scan`

Reads only the three approved Windows startup `Run` keys. An entry is marked
`orphaned` only when WinTidy can confidently extract an absolute executable
path and verify that it does not exist. PATH commands, shell URIs, relative
commands, and ambiguous command lines are never removal candidates.

### `POST /api/v1/registry/preview`

Re-queries and previews exact startup values without changing the registry:

```json
{
  "targets": [
    {
      "key": "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
      "valueName": "Missing App"
    }
  ]
}
```

### `POST /api/v1/registry/run`

Requires the same exact targets plus `"confirm": true`. Each value is
re-queried and must still be orphaned. WinTidy writes an exact `.reg` backup to
`data/registry-backups/` before deleting only the named value. Every attempt is
recorded in `RegistryMaintenanceRun`. Machine-level keys may require an
administrator session; permission failures are reported and audited.

### `GET /api/v1/processes`

Returns running Windows processes sorted by working-set memory. This endpoint
uses a fixed PowerShell command and accepts no command input.

## Audit Models

- `MaintenanceRun`: every confirmed cleanup attempt, including partial failure
- `CleanupFinding`: category-level scan summaries
- `StartupEntry`: normalized startup entries and last-seen timestamps
- `RegistryMaintenanceRun`: confirmed registry attempts, backups, and outcomes

## Safety Guarantees

- The API binds to `127.0.0.1` by default.
- Scan and preview operations are read-only.
- Clients cannot submit cleanup filesystem paths.
- Cleanup requires the literal boolean `confirm: true`.
- Symbolic links and non-file entries are never deleted.
- Every file is restated and real-path checked immediately before deletion.
- Cleanup deletes files only; it does not remove directories.
- Duplicate, startup, process, and health endpoints are read-only.
- Filesystem access failures are reported instead of bypassed.
- Registry keys are fixed by the application; arbitrary keys are rejected.
- Registry values are revalidated and backed up immediately before removal.

## Validation

```powershell
npm run prisma:generate
npx prisma validate
npm run lint
npm test
npm run test:e2e
npm run build
```

See [OPERATIONS.md](OPERATIONS.md) for PowerShell usage and
[docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) for architecture decisions.
