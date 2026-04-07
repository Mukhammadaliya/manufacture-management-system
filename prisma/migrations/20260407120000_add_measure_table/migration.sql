-- 1. Create measures table
CREATE TABLE "measures" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "measures_pkey" PRIMARY KEY ("id")
);

-- 2. Seed measure data
INSERT INTO "measures" ("id", "name", "short_name") VALUES
(1, 'Dona', 'dona'),
(2, 'Kilogramm', 'kg');

-- 3. Add measureId column (nullable first)
ALTER TABLE "products" ADD COLUMN "measure_id" INTEGER;

-- 4. Set measureId based on product codes
-- DONA products (measureId = 1)
UPDATE "products" SET "measure_id" = 1 WHERE "code" IN (
  'BAZARSKI-05', 'BAZARSKI-06', 'BAZARSKI-NEW-05', 'BAZARSKI-NEW-06',
  'BAVARSKI-05', 'BAVARSKI-06', 'YANGI-TOSHKENT-06',
  'SER-AZ-03', 'SER-AZ-04', 'SER-AZ-05-ING', 'SER-AZ-05-QAL',
  'SER-AZ-06-ING', 'SER-AZ-06-QAL', 'SER-AZ-07-ING', 'SER-AZ-07-QAL',
  'SER-AZ-08', 'RAMAZON-08'
);

-- KG products (measureId = 2)
UPDATE "products" SET "measure_id" = 2 WHERE "code" IN (
  'DOKTOR', 'ZAFTRK', 'DOKTOR-ARZON', 'ZAFTRK-ARZON',
  'SASISKA', 'TIGR', 'SASISKA-ARZON', 'TIGR-ARZON',
  'TALLIN', 'JORJ', 'MAHKAMOV-BOMBA', 'ARQON-BOMBA',
  'MAHKAMOV-BREND', 'SERVELAT-BOMBA',
  'INDEYKA', 'YANGILIK-GOSHT', 'POKON', 'POKON-ARZON',
  'SALYAMI-05', 'SALYAMI-06', 'SETKA-03', 'SETKA-04',
  'BATON-BOMBA', 'GARADSKOY', 'CHIMKENT', 'ESTON', 'PRIMA'
);

-- Fallback: any remaining products default to dona
UPDATE "products" SET "measure_id" = 1 WHERE "measure_id" IS NULL;

-- 5. Make measureId NOT NULL and add FK
ALTER TABLE "products" ALTER COLUMN "measure_id" SET NOT NULL;
ALTER TABLE "products" ADD CONSTRAINT "products_measure_id_fkey" FOREIGN KEY ("measure_id") REFERENCES "measures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Drop old unit column and enum
ALTER TABLE "products" DROP COLUMN "unit";
DROP TYPE "ProductUnit";
