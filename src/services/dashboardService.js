import prisma from '../config/database.js';
import AppError from '../utils/AppError.js';

class DashboardService {
  async getDashboardSummary(userId, month, year) {
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const [totalExpenses, expensesByCategory, recentExpenses, totalIncome, wallets] = await Promise.all([
      // Total expenses for the month
      prisma.expense.aggregate({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
          type: 'EXPENSE'
        },
        _sum: { amount: true }
      }),

      // Expenses grouped by category
      prisma.expense.groupBy({
        by: ['categoryId'],
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
          type: 'EXPENSE'
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } }
      }),

      // Recent transactions (both income and expense)
      prisma.expense.findMany({
        where: { userId },
        include: {
          category: { select: { id: true, name: true, color: true, icon: true } },
          wallet: { select: { id: true, name: true, icon: true, color: true } }
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 5
      }),

      // Total income for the month
      prisma.expense.aggregate({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
          type: 'INCOME'
        },
        _sum: { amount: true }
      }),

      // Get all wallets for current balance
      prisma.wallet.findMany({
        where: { userId },
        select: { id: true, name: true, balance: true, icon: true, color: true },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    // Enhance category data
    let enhancedCategories = [];
    if (expensesByCategory.length > 0) {
      const categoryIds = expensesByCategory.map(item => item.categoryId);
      const categories = await prisma.category.findMany({
        where: { id: { in: categoryIds } }
      });

      enhancedCategories = expensesByCategory.map(item => {
        const category = categories.find(c => c.id === item.categoryId);
        return {
          id: category?.id,
          name: category?.name || 'Uncategorized',
          color: category?.color || '#9CA3AF',
          icon: category?.icon || '📋',
          amount: item._sum.amount
        };
      });
    }

    const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
    const expenseSum = totalExpenses._sum.amount || 0;
    const incomeSum = totalIncome._sum.amount || 0;

    return {
      summary: {
        totalBalance,
        totalExpenses: expenseSum,
        totalIncome: incomeSum,
        savings: incomeSum - expenseSum
      },
      wallets,
      expensesByCategory: enhancedCategories,
      recentExpenses
    };
  }

  async getCategoryAnalytics(userId, month, year) {
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const expensesByCategory = await prisma.expense.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
        type: 'EXPENSE'
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } }
    });

    let enhancedCategories = [];
    if (expensesByCategory.length > 0) {
      const categoryIds = expensesByCategory.map(item => item.categoryId);
      const categories = await prisma.category.findMany({
        where: { id: { in: categoryIds } }
      });

      enhancedCategories = expensesByCategory.map(item => {
        const category = categories.find(c => c.id === item.categoryId);
        return {
          id: category?.id,
          name: category?.name || 'Uncategorized',
          color: category?.color || '#9CA3AF',
          icon: category?.icon || '📋',
          amount: item._sum.amount
        };
      });
    }

    return { categoryAnalytics: enhancedCategories };
  }

  async getMonthlyTrends(userId, months = 6) {
    const currentDate = new Date();
    const trends = [];

    for (let i = months - 1; i >= 0; i--) {
      const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const [expenseResult, incomeResult] = await Promise.all([
        prisma.expense.aggregate({
          where: {
            userId,
            date: { gte: startOfMonth, lte: endOfMonth },
            type: 'EXPENSE'
          },
          _sum: { amount: true }
        }),
        prisma.expense.aggregate({
          where: {
            userId,
            date: { gte: startOfMonth, lte: endOfMonth },
            type: 'INCOME'
          },
          _sum: { amount: true }
        })
      ]);

      const monthName = targetDate.toLocaleString('default', { month: 'short' });
      
      trends.push({
        month: monthName,
        year: targetDate.getFullYear(),
        expense: expenseResult._sum.amount || 0,
        income: incomeResult._sum.amount || 0
      });
    }

    return { trends };
  }

  async getRecentExpenses(userId, limit = 10) {
    const expenses = await prisma.expense.findMany({
      where: { userId },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        wallet: { select: { id: true, name: true, icon: true, color: true } }
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: parseInt(limit)
    });

    return { expenses };
  }
}

export default new DashboardService();
