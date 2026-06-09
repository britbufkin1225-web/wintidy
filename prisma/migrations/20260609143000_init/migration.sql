-- CreateTable
CREATE TABLE "MaintenanceRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "status" TEXT NOT NULL,
    "requestedCategories" JSONB NOT NULL,
    "confirmationReceived" BOOLEAN NOT NULL DEFAULT false,
    "filesDeleted" INTEGER NOT NULL DEFAULT 0,
    "bytesFreed" BIGINT NOT NULL DEFAULT 0,
    "skippedFiles" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB
);

-- CreateTable
CREATE TABLE "CleanupFinding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "fileCount" INTEGER NOT NULL,
    "totalBytes" BIGINT NOT NULL,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maintenanceRunId" INTEGER,
    CONSTRAINT "CleanupFinding_maintenanceRunId_fkey"
        FOREIGN KEY ("maintenanceRunId")
        REFERENCES "MaintenanceRun" ("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StartupEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "enabled" BOOLEAN,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "MaintenanceRun_startedAt_idx" ON "MaintenanceRun"("startedAt");

-- CreateIndex
CREATE INDEX "MaintenanceRun_status_idx" ON "MaintenanceRun"("status");

-- CreateIndex
CREATE INDEX "CleanupFinding_category_idx" ON "CleanupFinding"("category");

-- CreateIndex
CREATE INDEX "CleanupFinding_discoveredAt_idx" ON "CleanupFinding"("discoveredAt");

-- CreateIndex
CREATE INDEX "CleanupFinding_maintenanceRunId_idx" ON "CleanupFinding"("maintenanceRunId");

-- CreateIndex
CREATE UNIQUE INDEX "StartupEntry_source_location_name_key"
ON "StartupEntry"("source", "location", "name");

-- CreateIndex
CREATE INDEX "StartupEntry_source_idx" ON "StartupEntry"("source");
