# WinTidy Project Plan

WinTidy is a local-only Windows maintenance API. Its default posture is
read-only: scans report findings, previews estimate impact, and deletion
requires an explicit confirmed request.

## Safety Invariants

1. Bind to `127.0.0.1` by default.
2. Never delete during a scan or preview.
3. Resolve every cleanup root from a fixed allowlist maintained by the
   application, not from a client-supplied path.
4. Before deletion, resolve and revalidate each candidate against its approved
   root. Reject path traversal, symlink/junction escapes, and changed files.
5. Require `confirm: true` for every cleanup run.
6. Treat inaccessible, locked, or changing files as skipped; do not force
   deletion.
7. Write the maintenance audit record even when a run partially fails.
8. Return paths for findings and errors without exposing unrelated filesystem
   contents.
9. Duplicate scanning is read-only and accepts one explicitly supplied root.
10. Startup and process endpoints remain read-only.

## Planned Modules

| Module | Endpoint | Responsibility |
| --- | --- | --- |
| `system` | `GET /api/v1/system/health` | Host, CPU, memory, uptime, and current-volume usage |
| `cleanup` | `GET /api/v1/cleanup/scan` | Enumerate approved temporary/cache roots |
| `cleanup` | `POST /api/v1/cleanup/preview` | Filter the latest safe findings by category |
| `cleanup` | `POST /api/v1/cleanup/run` | Revalidate, delete approved files, and audit the run |
| `files` | `GET /api/v1/files/duplicates?path=` | Group by size, then hash candidate duplicates |
| `startup` | `GET /api/v1/startup/apps` | Read Startup folders and common registry Run keys |
| `processes` | `GET /api/v1/processes` | Read and sort processes by working-set memory |

## Delivery Status

### Session 1: Repository Setup and Plan

- NestJS application and TypeScript toolchain
- Prisma with SQLite and the initial audit models
- Global API prefix, validation policy, and normalized errors
- Working system health endpoint
- Safety invariants and module plan

### Session 2: Cleanup Discovery and Preview - Complete

- Cleanup category enum and strict request DTOs
- Windows known-folder resolver
- Iterative filesystem walker with access-error collection
- Safe roots for user temp, Windows temp, and detected browser caches
- Scan persistence through `CleanupFinding`
- Preview totals derived from fresh or persisted findings
- Unit tests for root allowlisting, traversal, and inaccessible files

### Session 3: Confirmed Cleanup and Audit Logs - Complete

- Mandatory literal `confirm: true`
- Candidate revalidation immediately before deletion
- Junction, symlink, and reparse-point escape protections
- Partial-success result reporting
- Transactional `MaintenanceRun` lifecycle and error persistence
- Integration tests using isolated temporary fixtures only

### Session 4: Duplicate Files - Complete

- Validated absolute path query
- Bounded recursive traversal
- File-size grouping before hashing
- Streaming SHA-256 hashes for candidate groups
- Concurrency and maximum-file-size controls
- Read-only duplicate result contract and tests

### Session 5: Startup Apps and Processes - Complete

- Startup folder enumeration
- Read-only registry Run-key inspection
- Startup entry upsert/snapshot behavior
- Windows process inventory sorted by memory
- Platform-specific fallback and error contracts

### Session 6: Hardening and Documentation - Complete

- Endpoint-level integration coverage
- Request limits, scan timeouts, cancellation, and concurrency guards
- Structured application logging
- Windows installation and operations guide
- Final safety review

## Data Model Intent

- `MaintenanceRun` is the durable audit record for every confirmed cleanup
  attempt, including partial failures.
- `CleanupFinding` stores category-level scan results and may be attached to a
  maintenance run.
- `StartupEntry` stores normalized startup discoveries and their last observed
  time. It does not imply permission to modify startup configuration.

## Non-Goals

- Registry modification
- Service modification
- Driver management
- Automatic or scheduled deletion
- Deleting duplicate files
- Cleaning arbitrary client-provided folders
- Remote network access
