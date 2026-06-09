# WinTidy Operations Guide

WinTidy is intended to run locally on Windows. It binds to `127.0.0.1` by
default and should not be exposed directly to a network.

## Install

```powershell
Copy-Item .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
```

## Start

```powershell
npm run start:dev
```

Verify the service:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/v1/system/health
```

## Safe Cleanup Workflow

Always scan and preview before running cleanup:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/v1/cleanup/scan
```

```powershell
$body = @{
  categories = @("user-temp", "browser-cache")
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:3000/api/v1/cleanup/preview `
  -ContentType application/json `
  -Body $body
```

Cleanup is the only destructive endpoint. It requires the literal JSON value
`true`:

```powershell
$body = @{
  categories = @("user-temp")
  confirm = $true
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:3000/api/v1/cleanup/run `
  -ContentType application/json `
  -Body $body
```

Do not run cleanup while applications are actively writing to temporary files.
WinTidy skips changed, locked, linked, inaccessible, or escaped files and
reports them in the response.

## Database

The SQLite database defaults to `prisma/wintidy.db`. Confirmed cleanup attempts
are stored in `MaintenanceRun`; scans are summarized in `CleanupFinding`;
startup observations are stored in `StartupEntry`.

Inspect records locally:

```powershell
npm run prisma:studio
```

## Troubleshooting

- `400 Bad Request`: inspect the validation message and category values.
- `413 Payload Too Large`: duplicate scanning exceeded the 100,000-file limit.
- `501 Not Implemented`: a Windows-only endpoint was invoked on another OS.
- Locked files: close the application using the cache and retry only after a
  new preview.
- Access errors: run with the normal user account first. Administrator access
  is not required for user temp or browser caches.

## Production Build

```powershell
npm run build
npm run start:prod
```

Keep `HOST=127.0.0.1` unless a separate authenticated gateway protects the API.

## Targeted Registry Maintenance

Registry maintenance is limited to common user and machine startup `Run` keys.
Start with the read-only scan:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/v1/registry/scan
```

Preview exact values before removal. Confirmed removal requires
`confirm = $true`, creates an exact `.reg` backup under
`data/registry-backups`, and records the run in SQLite. Do not submit ambiguous
entries, and inspect the preview response before confirming. Machine-level
entries can require an elevated WinTidy process.
