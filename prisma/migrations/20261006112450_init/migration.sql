-- CreateTable
CREATE TABLE "Agreement" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Signer" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Signer_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agreementId" TEXT NOT NULL,
    "signerId" TEXT,
    "type" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "Signer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL,
    "resetAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Agreement_status_idx" ON "Agreement"("status");

-- CreateIndex
CREATE INDEX "Agreement_createdAt_idx" ON "Agreement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Signer_tokenHash_key" ON "Signer"("tokenHash");

-- CreateIndex
CREATE INDEX "Signer_agreementId_idx" ON "Signer"("agreementId");

-- CreateIndex
CREATE INDEX "AuditEvent_agreementId_createdAt_idx" ON "AuditEvent"("agreementId", "createdAt");
