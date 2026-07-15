import logger from '../config/logger.js';
import migrationService from '../services/migrationService.js';

const migrateDefaultCategories = async (req, res) => {
  try {
    const results = await migrationService.migrateDefaultCategories();
    res.json({
      success: true,
      message: 'Migration completed',
      results
    });
  } catch (error) {
    logger.logError(error, null, { context: 'migrate-default-categories' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const checkMigrationStatus = async (req, res) => {
  try {
    const status = await migrationService.checkMigrationStatus();
    res.json(status);
  } catch (error) {
    logger.logError(error, null, { context: 'check-migration-status' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const fixOrphanExpenses = async (req, res) => {
  try {
    const results = await migrationService.fixOrphanExpenses();
    res.json({
      success: true,
      message: 'Orphan expenses fixed',
      ...results
    });
  } catch (error) {
    logger.logError(error, null, { context: 'fix-orphan-expenses' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const migrateWalletsAndTypes = async (req, res) => {
  try {
    const results = await migrationService.migrateWalletsAndTypes();
    res.json({
      success: true,
      message: 'Wallets and types migration completed',
      results
    });
  } catch (error) {
    logger.logError(error, null, { context: 'migrate-wallets-and-types' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export { migrateDefaultCategories, checkMigrationStatus, fixOrphanExpenses, migrateWalletsAndTypes };
