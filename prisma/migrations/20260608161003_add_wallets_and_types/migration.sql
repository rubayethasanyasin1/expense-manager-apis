-- CreateIndex
CREATE INDEX "expenses_walletId_idx" ON "expenses"("walletId");

-- CreateIndex
CREATE INDEX "expenses_toWalletId_idx" ON "expenses"("toWalletId");
