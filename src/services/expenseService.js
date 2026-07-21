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
          wallet: { select: { id: true, name: true, icon: true, color: true } },
          toWallet: { select: { id: true, name: true, icon: true, color: true } }
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
        wallet: { select: { id: true, name: true, icon: true, color: true } },
        toWallet: { select: { id: true, name: true, icon: true, color: true } }
      }
    });

    if (!expense) {
      throw new AppError('Expense not found', 404);
    }

    return expense;
  }

  async createExpense(userId, data) {
    const { title, amount, categoryId, date, description, type, walletId, currency, toWalletId } = data;

    let category = null;
    if (categoryId) {
      category = await prisma.category.findFirst({
        where: { id: categoryId, userId }
      });

      if (!category) {
        throw new AppError('Category not found or does not belong to you', 404);
      }
    }

    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId }
    });

    if (!wallet) {
      throw new AppError('Wallet not found or does not belong to you', 404);
    }

    const expenseType = type || (category ? category.type : 'EXPENSE');

    if (expenseType === 'TRANSFER' && !toWalletId) {
      throw new AppError('Destination wallet (toWalletId) is required for transfers', 400);
    }

    if (toWalletId) {
      const toWallet = await prisma.wallet.findFirst({
        where: { id: toWalletId, userId }
      });
      if (!toWallet) {
        throw new AppError('Destination wallet not found or does not belong to you', 404);
      }
    }

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
          toWalletId,
          userId,
          currency,
        },
        include: {
          category: { select: { id: true, name: true, color: true, icon: true } },
          wallet: { select: { id: true, name: true, icon: true, color: true } },
          toWallet: { select: { id: true, name: true, icon: true, color: true } }
        }
      });

      if (expenseType === 'TRANSFER') {
        await tx.wallet.update({
          where: { id: walletId },
          data: { balance: { decrement: parseFloat(amount) } }
        });
        await tx.wallet.update({
          where: { id: toWalletId },
          data: { balance: { increment: parseFloat(amount) } }
        });
      } else {
        const balanceChange = expenseType === 'INCOME' ? parseFloat(amount) : -parseFloat(amount);
        await tx.wallet.update({
          where: { id: walletId },
          data: { balance: { increment: balanceChange } }
        });
      }

      return expense;
    });
  }

  async updateExpense(userId, id, data) {
    const { title, amount, categoryId, date, description, type, walletId, currency, toWalletId } = data;

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

    if (expenseType === 'TRANSFER' && !toWalletId && !existingExpense.toWalletId) {
      throw new AppError('Destination wallet is required for transfers', 400);
    }

    if (toWalletId && toWalletId !== existingExpense.toWalletId) {
      const toWallet = await prisma.wallet.findFirst({
        where: { id: toWalletId, userId }
      });
      if (!toWallet) {
        throw new AppError('Destination wallet not found or does not belong to you', 404);
      }
    }

    return await prisma.$transaction(async (tx) => {
      const oldAmount = parseFloat(existingExpense.amount);
      const newAmount = amount !== undefined ? parseFloat(amount) : oldAmount;
      const oldType = existingExpense.type;
      const newType = expenseType;
      const oldWalletId = existingExpense.walletId;
      const newWalletId = walletId || oldWalletId;
      const oldToWalletId = existingExpense.toWalletId;
      const newToWalletId = toWalletId || oldToWalletId;

      // Reverse old transaction
      if (oldType === 'TRANSFER') {
        await tx.wallet.update({
          where: { id: oldWalletId },
          data: { balance: { increment: oldAmount } }
        });
        if (oldToWalletId) {
          await tx.wallet.update({
            where: { id: oldToWalletId },
            data: { balance: { decrement: oldAmount } }
          });
        }
      } else {
        const reverseBalance = oldType === 'INCOME' ? -oldAmount : oldAmount;
        await tx.wallet.update({
          where: { id: oldWalletId },
          data: { balance: { increment: reverseBalance } }
        });
      }

      // Apply new transaction
      if (newType === 'TRANSFER') {
        await tx.wallet.update({
          where: { id: newWalletId },
          data: { balance: { decrement: newAmount } }
        });
        if (newToWalletId) {
          await tx.wallet.update({
            where: { id: newToWalletId },
            data: { balance: { increment: newAmount } }
          });
        }
      } else {
        const applyBalance = newType === 'INCOME' ? newAmount : -newAmount;
        await tx.wallet.update({
          where: { id: newWalletId },
          data: { balance: { increment: applyBalance } }
        });
      }

      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(amount !== undefined && { amount: parseFloat(amount) }),
          ...(categoryId !== undefined && { categoryId }),
          ...(date && { date: new Date(date) }),
          ...(description !== undefined && { description }),
          ...(type && { type }),
          ...(walletId && { walletId }),
          ...(toWalletId !== undefined && { toWalletId }),
          ...(currency && { currency })
        },
        include: {
          category: { select: { id: true, name: true, color: true, icon: true } },
          wallet: { select: { id: true, name: true, icon: true, color: true } },
          toWallet: { select: { id: true, name: true, icon: true, color: true } }
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
      if (existingExpense.type === 'TRANSFER') {
        await tx.wallet.update({
          where: { id: existingExpense.walletId },
          data: { balance: { increment: parseFloat(existingExpense.amount) } }
        });
        if (existingExpense.toWalletId) {
          await tx.wallet.update({
            where: { id: existingExpense.toWalletId },
            data: { balance: { decrement: parseFloat(existingExpense.amount) } }
          });
        }
      } else {
        const balanceChange = existingExpense.type === 'INCOME' 
          ? -parseFloat(existingExpense.amount) 
          : parseFloat(existingExpense.amount);

        await tx.wallet.update({
          where: { id: existingExpense.walletId },
          data: { balance: { increment: balanceChange } }
        });
      }

      await tx.expense.delete({
        where: { id }
      });
    });

    return true;
  }
}

export default new ExpenseService();
