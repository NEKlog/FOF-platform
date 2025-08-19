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
    "customerId" INTEGER,
    "carrierId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "requiresActivation" BOOLEAN NOT NULL DEFAULT true,
    "activationToken" TEXT,
    "activationExpires" DATETIME,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "visibleAfter" DATETIME,
    CONSTRAINT "Task_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("carrierId", "commissionPct", "createdAt", "customerId", "dropoff", "id", "paid", "pickup", "price", "scheduledAt", "status", "title", "updatedAt") SELECT "carrierId", "commissionPct", "createdAt", "customerId", "dropoff", "id", "paid", "pickup", "price", "scheduledAt", "status", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE UNIQUE INDEX "Task_activationToken_key" ON "Task"("activationToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
