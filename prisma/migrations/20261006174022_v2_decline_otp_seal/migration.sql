-- CreateTable
CREATE TABLE "AppState" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Agreement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "variables" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "signingMode" TEXT NOT NULL DEFAULT 'parallel',
    "expiresAt" DATETIME,
    "renderedBody" TEXT,
    "docHash" TEXT,
    "sentAt" DATETIME,
    "completedAt" DATETIME,
    "voidedAt" DATETIME,
    "voidReason" TEXT,
    "finalPdf" BLOB,
    "finalPdfHash" TEXT,
    "finalPdfSealed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Agreement" ("body", "completedAt", "createdAt", "docHash", "expiresAt", "finalPdf", "finalPdfHash", "id", "renderedBody", "sentAt", "signingMode", "status", "title", "updatedAt", "variables", "voidReason", "voidedAt") SELECT "body", "completedAt", "createdAt", "docHash", "expiresAt", "finalPdf", "finalPdfHash", "id", "renderedBody", "sentAt", "signingMode", "status", "title", "updatedAt", "variables", "voidReason", "voidedAt" FROM "Agreement";
DROP TABLE "Agreement";
ALTER TABLE "new_Agreement" RENAME TO "Agreement";
CREATE INDEX "Agreement_status_idx" ON "Agreement"("status");
CREATE INDEX "Agreement_createdAt_idx" ON "Agreement"("createdAt");
CREATE TABLE "new_Signer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agreementId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "tokenHash" TEXT,
    "tokenIssuedAt" DATETIME,
    "viewedAt" DATETIME,
    "consentAt" DATETIME,
    "signedAt" DATETIME,
    "signatureType" TEXT,
    "signatureName" TEXT,
    "signatureImg" BLOB,
    "declinedAt" DATETIME,
    "declineReason" TEXT,
    "otpHash" TEXT,
    "otpExpiresAt" DATETIME,
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "otpVerifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Signer_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Signer" ("agreementId", "consentAt", "createdAt", "email", "id", "name", "order", "signatureImg", "signatureName", "signatureType", "signedAt", "tokenHash", "tokenIssuedAt", "viewedAt") SELECT "agreementId", "consentAt", "createdAt", "email", "id", "name", "order", "signatureImg", "signatureName", "signatureType", "signedAt", "tokenHash", "tokenIssuedAt", "viewedAt" FROM "Signer";
DROP TABLE "Signer";
ALTER TABLE "new_Signer" RENAME TO "Signer";
CREATE UNIQUE INDEX "Signer_tokenHash_key" ON "Signer"("tokenHash");
CREATE INDEX "Signer_agreementId_idx" ON "Signer"("agreementId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
