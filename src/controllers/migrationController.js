import migrationService from '../services/migrationService.js';
import catchAsync from '../utils/catchAsync.js';

export const migrateDefaultCategories = catchAsync(async (req, res) => {
  const results = await migrationService.migrateDefaultCategories();
  res.json({
    success: true,
    message: 'Migration completed',
    results
  });
});

export const checkMigrationStatus = catchAsync(async (req, res) => {
  const status = await migrationService.checkMigrationStatus();
  res.json(status);
});

export const fixOrphanExpenses = catchAsync(async (req, res) => {
  const results = await migrationService.fixOrphanExpenses();
  res.json({
    success: true,
    message: 'Orphan expenses fixed',
    ...results
  });
});

export const migrateWalletsAndTypes = catchAsync(async (req, res) => {
  const results = await migrationService.migrateWalletsAndTypes();
  res.json({
    success: true,
    message: 'Wallets and types migration completed',
    results
  });
});
