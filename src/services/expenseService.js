import prisma from '../config/database.js';
import AppError from '../utils/AppError.js';

class ExpenseService {
  async getExpenses(userId, query) {
    const { 
      page = 1, 
      limit = 10, 
      month, 
      year, 
      categoryId, 
      type,
      search 
    } = query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = { userId };

    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      where.date = { gte: startDate, lte: endDate };
    }

    if (categoryId) where.categoryId = categoryId;
    if (type) where.type = type;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, color: true, icon: true } },
          wallet: { select: { id: true, name: true, icon: true, color: true } }
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take
      }),
      prisma.expense.count({ where })
    ]);

    return {
      expenses,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / take)
      }
    };
  }

  async getExpenseById(userId, id) {
    const expense = await prisma.expense.findFirst({
      where: { id, userId },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        wallet: { select: { id: true, name: true, icon: true, color: true } }
      }
    });

    if (!expense) {
      throw new AppError('Expense not found', 404);
    }

    return expense;
  }

  async createExpense(userId, data) {
    const { title, amount, categoryId, date, description, type, walletId } = data;

    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId }
    });

    if (!category) {
      throw new AppError('Category not found or does not belong to you', 404);
    }

    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId }
    });

    if (!wallet) {
      throw new AppError('Wallet not found or does not belong to you', 404);
    }

    const expenseType = type || category.type;

    return await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          title,
          amount: parseFloat(amount),
          date: new Date(date),
          description,
          type: expenseType,
          categoryId,
          walletId,
          userId
        },
        include: {
          category: { select: { id: true, name: true, color: true, icon: true } },
          wallet: { select: { id: true, name: true, icon: true, color: true } }
        }
      });

      const balanceChange = expenseType === 'INCOME' ? parseFloat(amount) : -parseFloat(amount);

      await tx.wallet.update({
        where: { id: walletId },
        data: { balance: { increment: balanceChange } }
      });

      return expense;
    });
  }

  async updateExpense(userId, id, data) {
    const { title, amount, categoryId, date, description, type, walletId } = data;

    const existingExpense = await prisma.expense.findFirst({
      where: { id, userId }
    });

    if (!existingExpense) {
      throw new AppError('Expense not found', 404);
    }

    let expenseType = type || existingExpense.type;
    
    if (categoryId && categoryId !== existingExpense.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, userId }
      });
      
      if (!category) {
        throw new AppError('Category not found or does not belong to you', 404);
      }
      if (!type) expenseType = category.type;
    }

    if (walletId && walletId !== existingExpense.walletId) {
      const wallet = await prisma.wallet.findFirst({
        where: { id: walletId, userId }
      });
      
      if (!wallet) {
        throw new AppError('New wallet not found or does not belong to you', 404);
      }
    }

    const currentWalletId = existingExpense.walletId;
    const newWalletId = walletId || currentWalletId;

    return await prisma.$transaction(async (tx) => {
      const oldAmount = parseFloat(existingExpense.amount);
      const newAmount = amount !== undefined ? parseFloat(amount) : oldAmount;
      const oldType = existingExpense.type;
      const newType = expenseType;

      if (currentWalletId === newWalletId) {
        let balanceChange = 0;
        
        if (oldType === 'INCOME') balanceChange -= oldAmount;
        else balanceChange += oldAmount;

        if (newType === 'INCOME') balanceChange += newAmount;
        else balanceChange -= newAmount;

        if (balanceChange !== 0) {
          await tx.wallet.update({
            where: { id: currentWalletId },
            data: { balance: { increment: balanceChange } }
          });
        }
      } else {
        const oldBalanceReversal = oldType === 'INCOME' ? -oldAmount : oldAmount;
        await tx.wallet.update({
          where: { id: currentWalletId },
          data: { balance: { increment: oldBalanceReversal } }
        });

        const newBalanceApplication = newType === 'INCOME' ? newAmount : -newAmount;
        await tx.wallet.update({
          where: { id: newWalletId },
          data: { balance: { increment: newBalanceApplication } }
        });
      }

      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(amount !== undefined && { amount: parseFloat(amount) }),
          ...(categoryId && { categoryId }),
          ...(date && { date: new Date(date) }),
          ...(description !== undefined && { description }),
          ...(type && { type }),
          ...(walletId && { walletId })
        },
        include: {
          category: { select: { id: true, name: true, color: true, icon: true } },
          wallet: { select: { id: true, name: true, icon: true, color: true } }
        }
      });

      return updatedExpense;
    });
  }

  async deleteExpense(userId, id) {
    const existingExpense = await prisma.expense.findFirst({
      where: { id, userId }
    });

    if (!existingExpense) {
      throw new AppError('Expense not found', 404);
    }

    await prisma.$transaction(async (tx) => {
      const balanceChange = existingExpense.type === 'INCOME' 
        ? -parseFloat(existingExpense.amount) 
        : parseFloat(existingExpense.amount);

      await tx.wallet.update({
        where: { id: existingExpense.walletId },
        data: { balance: { increment: balanceChange } }
      });

      await tx.expense.delete({
        where: { id }
      });
    });

    return true;
  }
}

export default new ExpenseService();
