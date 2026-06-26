/*
  Warnings:

  - You are about to drop the column `category` on the `expenses` table. All the data in the column will be lost.
  - Added the required column `categoryId` to the `expenses` table without a default value. This is not possible if the table is not empty.

*/

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_userId_idx" ON "categories"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_userId_name_key" ON "categories"("userId", "name");

-- Migrate existing category data to new categories table
INSERT INTO "categories" (id, name, "userId", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid(),
    category,
    "userId",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "expenses"
GROUP BY category, "userId";

-- Add categoryId column as nullable first
ALTER TABLE "expenses" ADD COLUMN "categoryId" TEXT;

-- Update expenses with categoryId from new categories table
UPDATE "expenses" e
SET "categoryId" = c.id
FROM "categories" c
WHERE c.name = e.category AND c."userId" = e."userId";

-- Now make categoryId NOT NULL
ALTER TABLE "expenses" ALTER COLUMN "categoryId" SET NOT NULL;

-- DropIndex
DROP INDEX "expenses_category_idx";

-- Drop the old category column
ALTER TABLE "expenses" DROP COLUMN "category";

-- CreateIndex
CREATE INDEX "expenses_categoryId_idx" ON "expenses"("categoryId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
