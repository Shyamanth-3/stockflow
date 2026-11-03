ALTER TABLE "Organization" ADD COLUMN "nameKey" TEXT;

UPDATE "Organization" SET "nameKey" = lower(regexp_replace(trim("name"), '\s+', ' ', 'g'));

ALTER TABLE "Organization" ALTER COLUMN "nameKey" SET NOT NULL;

CREATE UNIQUE INDEX "Organization_nameKey_key" ON "Organization"("nameKey");
