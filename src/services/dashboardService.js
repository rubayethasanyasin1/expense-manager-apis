import prisma from '../config/database.js';

class DashboardService {
  async getDashboardSummary(userId, { startDate, endDate }) {
    const where = {
      userId,
      ...(startDate &&
        endDate && {
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        })
    };

    const [incomeAggregate, expenseAggregate, totalWalletsBalance, expenseCount, expenses] = await Promise.all([
      prisma.expense.aggregate({
        where: { ...where, type: 'INCOME' },
        _sum: { amount: true }
      }),
      prisma.expense.aggregate({
        where: { ...where, type: 'EXPENSE' },
        _sum: { amount: true }
      }),
      prisma.wallet.aggregate({
        where: { userId },
        _sum: { balance: true }
      }),
      prisma.expense.count({ where: { ...where, type: 'EXPENSE' } }),
      prisma.expense.findMany({
        where: { ...where, type: { in: ['EXPENSE', 'INCOME'] } },
        orderBy: { date: 'desc' },
        include: {
          category: true
        }
      })
    ]);

    const categoryBreakdown = expenses.reduce((acc, expense) => {
      const categoryName = expense.category?.name || 'No Category';
      const type = expense.type;
      if (!acc[type]) {
        acc[type] = {};
      }
      acc[type][categoryName] = (acc[type][categoryName] || 0) + expense.amount;
      return acc;
    }, { EXPENSE: {}, INCOME: {} });

    const averageExpense = expenseCount > 0 ? (expenseAggregate._sum.amount || 0) / expenseCount : 0;

    return {
      summary: {
        totalAmount: expenseAggregate._sum.amount || 0,
        totalIncome: incomeAggregate._sum.amount || 0,
        netBalance: totalWalletsBalance._sum.balance || 0,
        totalCount: expenseCount,
        averageExpense: parseFloat(averageExpense.toFixed(2)),
        categoryBreakdown
      }
    };
  }

  async getCategoryAnalytics(userId, { startDate, endDate, type = 'EXPENSE' }) {
    const where = {
      userId,
      type,
      ...(startDate &&
        endDate && {
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        })
    };

    const expenses = await prisma.expense.findMany({
      where,
      select: {
        amount: true,
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true
          }
        }
      }
    });

    const analytics = expenses.reduce((acc, expense) => {
      const categoryId = expense.category?.id || 'no-category';
      if (!acc[categoryId]) {
        acc[categoryId] = {
          categoryId,
          categoryName: expense.category?.name || 'No Category',
          color: expense.category?.color || '#9CA3AF',
          icon: expense.category?.icon || '📋',
          totalAmount: 0,
          count: 0
        };
      }
      acc[categoryId].totalAmount += expense.amount;
      acc[categoryId].count += 1;
      return acc;
    }, {});

    const categoryAnalytics = Object.values(analytics).map(item => ({
      ...item,
      averageAmount: parseFloat((item.totalAmount / item.count).toFixed(2))
    }));

    return { categoryAnalytics };
  }

  async getMonthlyTrends(userId, { year = new Date().getFullYear() }) {
    const transactions = await prisma.expense.findMany({
      where: {
        userId,
        type: { in: ['EXPENSE', 'INCOME'] },
        date: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`)
        }
      },
      orderBy: { date: 'asc' }
    });

    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: new Date(year, i).toLocaleString('default', { month: 'long' }),
      totalAmount: 0,
      totalExpenses: 0,
      totalIncome: 0,
      count: 0,
      expenseCount: 0,
      incomeCount: 0
    }));

    transactions.forEach(tx => {
      const month = new Date(tx.date).getMonth();
      monthlyData[month].count += 1;
      if (tx.type === 'INCOME') {
        monthlyData[month].totalIncome += tx.amount;
        monthlyData[month].incomeCount += 1;
      } else {
        monthlyData[month].totalExpenses += tx.amount;
        monthlyData[month].totalAmount += tx.amount;
        monthlyData[month].expenseCount += 1;
      }
    });

    return { trends: monthlyData };
  }

  async getRecentExpenses(userId, { limit = 5 }) {
    const expenses = await prisma.expense.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: parseInt(limit),
      include: {
        category: true
      }
    });

    return { expenses };
  }
}

export default new DashboardService();
