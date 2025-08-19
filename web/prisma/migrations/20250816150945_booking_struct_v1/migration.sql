-- CreateTable
CREATE TABLE "TaskItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "taskId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "lengthCm" INTEGER,
    "widthCm" INTEGER,
    "heightCm" INTEGER,
    "weightKg" INTEGER,
    "count" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "TaskItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskCarrierWhitelist" (
    "taskId" INTEGER NOT NULL,
    "carrierId" INTEGER NOT NULL,

    PRIMARY KEY ("taskId", "carrierId"),
    CONSTRAINT "TaskCarrierWhitelist_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskCarrierWhitelist_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "price" REAL,
    "commissionPct" REAL,
    "pickup" TEXT,
    "dropoff" TEXT,
    "scheduledAt" DATETIME,
    "category" TEXT,
    "service" TEXT,
    "pickupLabel" TEXT,
    "pickupLat" REAL,
    "pickupLon" REAL,
    "pickupFrom" DATETIME,
    "pickupTo" DATETIME,
    "pickupFloor" INTEGER,
    "pickupElevator" BOOLEAN NOT NULL DEFAULT false,
    "pickupParking" TEXT,
    "pickupAreaM2" INTEGER,
    "pickupStorage" BOOLEAN NOT NULL DEFAULT false,
    "contactAName" TEXT,
    "contactAPhone" TEXT,
    "dropoffLabel" TEXT,
    "dropoffLat" REAL,
    "dropoffLon" REAL,
    "dropoffFrom" DATETIME,
    "dropoffTo" DATETIME,
    "dropoffFloor" INTEGER,
    "dropoffElevator" BOOLEAN NOT NULL DEFAULT false,
    "dropoffParking" TEXT,
    "dropoffAreaM2" INTEGER,
    "dropoffStorage" BOOLEAN NOT NULL DEFAULT false,
    "contactBName" TEXT,
    "contactBPhone" TEXT,
    "heavyOver70" BOOLEAN NOT NULL DEFAULT false,
    "bigItems" TEXT,
    "boxes" TEXT,
    "requiresActivation" BOOLEAN NOT NULL DEFAULT true,
    "activationToken" TEXT,
    "activationExpires" DATETIME,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "visibleAfter" DATETIME,
    "publishedAt" DATETIME,
    "publishedById" INTEGER,
    "customerId" INTEGER,
    "carrierId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("activationExpires", "activationToken", "carrierId", "commissionPct", "createdAt", "customerId", "dropoff", "id", "isPublished", "paid", "pickup", "price", "requiresActivation", "scheduledAt", "status", "title", "updatedAt", "visibleAfter") SELECT "activationExpires", "activationToken", "carrierId", "commissionPct", "createdAt", "customerId", "dropoff", "id", "isPublished", "paid", "pickup", "price", "requiresActivation", "scheduledAt", "status", "title", "updatedAt", "visibleAfter" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE UNIQUE INDEX "Task_activationToken_key" ON "Task"("activationToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TaskItem_taskId_idx" ON "TaskItem"("taskId");

-- CreateIndex
CREATE INDEX "TaskCarrierWhitelist_carrierId_idx" ON "TaskCarrierWhitelist"("carrierId");
