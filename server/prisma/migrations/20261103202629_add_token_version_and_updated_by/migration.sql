ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

UPDATE "Product" SET "lastUpdatedBy" = NULL
WHERE "lastUpdatedBy" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "User" WHERE "User"."id" = "Product"."lastUpdatedBy");

ALTER TABLE "Product" ADD CONSTRAINT "Product_lastUpdatedBy_fkey" FOREIGN KEY ("lastUpdatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
