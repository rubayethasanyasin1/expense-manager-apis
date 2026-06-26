import express from 'express';
import {
  migrateDefaultCategories,
  checkMigrationStatus,
  fixOrphanExpenses,
  migrateWalletsAndTypes
} from '../controllers/migrationController.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /api/v1/migration/default-categories
 * @desc    Migrate all users to have default categories
 * @access  Private (should be restricted to admin in production)
 */
router.post('/default-categories', authMiddleware, migrateDefaultCategories);

/**
 * @route   GET /api/v1/migration/status
 * @desc    Check migration status
 * @access  Private
 */
router.get('/status', authMiddleware, checkMigrationStatus);

/**
 * @route   POST /api/v1/migration/fix-orphan-expenses
 * @desc    Fix expenses without categories
 * @access  Private (should be restricted to admin in production)
 */
router.post('/fix-orphan-expenses', authMiddleware, fixOrphanExpenses);

/**
 * @route   POST /api/v1/migration/wallets-and-types
 * @desc    Migrate users to default wallets & types, link existing expenses
 * @access  Private
 */
router.post('/wallets-and-types', authMiddleware, migrateWalletsAndTypes);

export default router;
