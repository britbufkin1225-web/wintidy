-- CreateTable
CREATE TABLE "RegistryMaintenanceRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "status" TEXT NOT NULL,
    "requestedTargets" JSONB NOT NULL,
    "confirmationReceived" BOOLEAN NOT NULL DEFAULT false,
    "entriesRemoved" INTEGER NOT NULL DEFAULT 0,
    "skippedEntries" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "backupPaths" JSONB,
    "results" JSONB
);

-- CreateIndex
CREATE INDEX "RegistryMaintenanceRun_startedAt_idx"
ON "RegistryMaintenanceRun"("startedAt");

-- CreateIndex
CREATE INDEX "RegistryMaintenanceRun_status_idx"
ON "RegistryMaintenanceRun"("status");
