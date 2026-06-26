import prisma from '../config/database.js';
import logger from '../config/logger.js';
import {
  createDefaultCategories,
  createDefaultWallets,
  assignNoCategoryToOrphanExpenses
} from '../utils/defaultCategories.js';

/**
 * Migrate all existing users to have default categories
 * and assign orphan expenses to "No Category"
 */
const migrateDefaultCategories = async (req, res) => {
  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        categories: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const results = {
      total: users.length,
      usersWithCategories: 0,
      usersWithoutCategories: 0,
      categoriesCreated: 0,
      expensesUpdated: 0,
      errors: []
    };

    for (const user of users) {
      try {
        // Check if user already has categories
        if (user.categories.length === 0) {
          // User has no categories, create default ones
          const { categories } = await createDefaultCategories(user.id);
          results.usersWithoutCategories++;
          results.categoriesCreated += categories.length;

          logger.info(`Created default categories for user ${user.email}`, {
            userId: user.id,
            categoriesCount: categories.length
          });
        } else {
          // Check if user has "No Category"
          const hasNoCategory = user.categories.some(cat => cat.name === 'No Category');

          if (!hasNoCategory) {
            // Create only "No Category" for this user
            await prisma.category.create({
              data: {
                name: 'No Category',
                color: '#9CA3AF',
                icon: '📋',
                userId: user.id
              }
            });
            results.categoriesCreated++;
          }

          results.usersWithCategories++;
        }

        // Assign orphan expenses to "No Category"
        const updatedCount = await assignNoCategoryToOrphanExpenses(user.id);
        results.expensesUpdated += updatedCount;

      } catch (error) {
        logger.logError(error, null, {
          context: 'migrate-user-categories',
          userId: user.id
        });
        results.errors.push({
          userId: user.id,
          email: user.email,
          error: error.message
        });
      }
    }

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

/**
 * Check migration status
 */
const checkMigrationStatus = async (req, res) => {
  try {
    const [totalUsers, usersWithCategories, totalExpenses] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          categories: {
            some: {}
          }
        }
      }),
      prisma.expense.count()
    ]);

    // Get count of users with "No Category"
    const usersWithNoCategory = await prisma.user.count({
      where: {
        categories: {
          some: {
            name: 'No Category'
          }
        }
      }
    });

    // Get count of categories
    const totalCategories = await prisma.category.count();

    res.json({
      users: {
        total: totalUsers,
        withCategories: usersWithCategories,
        withoutCategories: totalUsers - usersWithCategories,
        withNoCategory: usersWithNoCategory
      },
      expenses: {
        total: totalExpenses
      },
      categories: {
        total: totalCategories,
        averagePerUser: totalUsers > 0 ? (totalCategories / totalUsers).toFixed(2) : 0
      }
    });
  } catch (error) {
    logger.logError(error, null, { context: 'check-migration-status' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Fix orphan expenses for all users
 */
const fixOrphanExpenses = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true }
    });

    let totalUpdated = 0;
    const errors = [];

    for (const user of users) {
      try {
        const updatedCount = await assignNoCategoryToOrphanExpenses(user.id);
        totalUpdated += updatedCount;
      } catch (error) {
        logger.logError(error, null, {
          context: 'fix-orphan-expenses',
          userId: user.id
        });
        errors.push({
          userId: user.id,
          email: user.email,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Orphan expenses fixed',
      totalExpensesUpdated: totalUpdated,
      usersProcessed: users.length,
      errors
    });
  } catch (error) {
    logger.logError(error, null, { context: 'fix-orphan-expenses' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Migrate all users to have default Cash & Bkash wallets and type properties, and associate existing expenses to Cash wallet.
 */
const migrateWalletsAndTypes = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        categories: true,
        wallets: true
      }
    });

    const results = {
      totalUsers: users.length,
      usersMigrated: 0,
      walletsCreated: 0,
      expensesLinked: 0,
      categoriesCreated: 0,
      errors: []
    };

    for (const user of users) {
      try {
        let wallets = user.wallets;
        let cashWallet = wallets.find(w => w.name === 'Cash');

        if (wallets.length === 0) {
          const created = await createDefaultWallets(user.id);
          wallets = created;
          cashWallet = created.find(w => w.name === 'Cash');
          results.walletsCreated += created.length;
        }

        // Link existing expenses that have null walletId
        const expensesToLink = await prisma.expense.findMany({
          where: { userId: user.id, walletId: null }
        });

        if (expensesToLink.length > 0 && cashWallet) {
          await prisma.expense.updateMany({
            where: { id: { in: expensesToLink.map(e => e.id) } },
            data: { walletId: cashWallet.id }
          });

          // Recalculate Cash wallet balance: balance = -sum(existing expenses)
          const totalAmount = expensesToLink.reduce((sum, e) => sum + e.amount, 0);
          await prisma.wallet.update({
            where: { id: cashWallet.id },
            data: { balance: -totalAmount }
          });

          results.expensesLinked += expensesToLink.length;
        }

        // Create default income categories if missing
        const incomeCategories = [
          { name: 'Salary', color: '#10B981', icon: '💵', type: 'INCOME' },
          { name: 'Gifts', color: '#EC4899', icon: '🎁', type: 'INCOME' },
          { name: 'Pocket Money', color: '#F59E0B', icon: '💰', type: 'INCOME' },
          { name: 'Other Income', color: '#64748B', icon: '📌', type: 'INCOME' }
        ];

        let createdCount = 0;
        for (const cat of incomeCategories) {
          const exists = user.categories.some(c => c.name === cat.name && c.type === 'INCOME');
          if (!exists) {
            await prisma.category.create({
              data: {
                name: cat.name,
                color: cat.color,
                icon: cat.icon,
                type: cat.type,
                userId: user.id
              }
            });
            createdCount++;
          }
        }
        results.categoriesCreated += createdCount;
        results.usersMigrated++;
      } catch (err) {
        logger.logError(err, null, { context: 'migrate-user-wallets', userId: user.id });
        results.errors.push({ userId: user.id, email: user.email, error: err.message });
      }
    }

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
