import prisma from '../config/database.js';
import { getOrCreateNoCategory } from '../utils/defaultCategories.js';

class ExpenseService {
  async createExpense(userId, data) {
    const { title, amount, categoryId, description, date, currency, type = 'EXPENSE', walletId, toWalletId } = data;

    // 1. Resolve source walletId
    let finalWalletId = walletId;
    if (!finalWalletId) {
      const cashWallet = await prisma.wallet.findFirst({
        where: { userId, name: 'Cash' }
      });
      if (cashWallet) {
        finalWalletId = cashWallet.id;
      } else {
        const firstWallet = await prisma.wallet.findFirst({
          where: { userId }
        });
        if (firstWallet) {
          finalWalletId = firstWallet.id;
        } else {
          const error = new Error('User has no wallets. Please create a wallet first.');
          error.status = 400;
          throw error;
        }
      }
    }

    // Verify source wallet belongs to user
    const wallet = await prisma.wallet.findFirst({
      where: { id: finalWalletId, userId }
    });
    if (!wallet) {
      const error = new Error('Source wallet not found');
      error.status = 404;
      throw error;
    }

    // 2. Perform type-specific validation
    let finalCategoryId = null;

    if (type === 'TRANSFER') {
      if (!toWalletId) {
        const error = new Error('Destination wallet (toWalletId) is required for transfers');
        error.status = 400;
        throw error;
      }
      if (toWalletId === finalWalletId) {
        const error = new Error('Source and destination wallets must be different');
        error.status = 400;
        throw error;
      }
      const toWallet = await prisma.wallet.findFirst({
        where: { id: toWalletId, userId }
      });
      if (!toWallet) {
        const error = new Error('Destination wallet not found');
        error.status = 404;
        throw error;
      }
    } else {
      // EXPENSE or INCOME
      finalCategoryId = categoryId;
      if (!finalCategoryId) {
        finalCategoryId = await getOrCreateNoCategory(userId, type);
      } else {
        const category = await prisma.category.findFirst({
          where: { id: finalCategoryId, userId, type }
        });
        if (!category) {
          const error = new Error(`Category not found or does not match transaction type ${type}`);
          error.status = 404;
          throw error;
        }
      }
    }

    // 3. Atomically create transaction and adjust wallet balances
    const expense = await prisma.$transaction(async (tx) => {
      const createdExpense = await tx.expense.create({
        data: {
          title,
          amount: parseFloat(amount),
          currency: currency || 'USD',
          type,
          categoryId: type === 'TRANSFER' ? null : finalCategoryId,
          walletId: finalWalletId,
          toWalletId: type === 'TRANSFER' ? toWalletId : null,
          description,
          date: date ? new Date(date) : new Date(),
          userId
        },
        include: {
          category: true,
          wallet: true,
          toWallet: true
        }
      });

      // Adjust wallet balances
      if (type === 'EXPENSE') {
        await tx.wallet.update({
          where: { id: finalWalletId },
          data: { balance: { decrement: parseFloat(amount) } }
        });
      } else if (type === 'INCOME') {
        await tx.wallet.update({
          where: { id: finalWalletId },
          data: { balance: { increment: parseFloat(amount) } }
        });
      } else if (type === 'TRANSFER') {
        await tx.wallet.update({
          where: { id: finalWalletId },
          data: { balance: { decrement: parseFloat(amount) } }
        });
        await tx.wallet.update({
          where: { id: toWalletId },
          data: { balance: { increment: parseFloat(amount) } }
        });
      }

      return createdExpense;
    });

    return expense;
  }

  async getExpenses(userId, { page = 1, limit = 10, categoryId, startDate, endDate, search, type, walletId }) {
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(categoryId && { categoryId }),
      ...(type && { type }),
      ...(walletId && {
        OR: [
          { walletId },
          { toWalletId: walletId }
        ]
      }),
      ...(startDate &&
        endDate && {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: parseInt(skip),
        take: parseInt(limit),
        include: {
          category: true,
          wallet: true,
          toWallet: true
        }
      }),
      prisma.expense.count({ where })
    ]);

    return {
      expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getExpenseById(userId, id) {
    const expense = await prisma.expense.findFirst({
      where: {
        id,
        userId
      },
      include: {
        category: true,
        wallet: true,
        toWallet: true
      }
    });

    if (!expense) {
      const error = new Error('Transaction not found');
      error.status = 404;
      throw error;
    }

    return expense;
  }

  async updateExpense(userId, id, data) {
    const { title, amount, categoryId, description, date, currency, type, walletId, toWalletId } = data;

    const existingExpense = await prisma.expense.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!existingExpense) {
      const error = new Error('Transaction not found');
      error.status = 404;
      throw error;
    }

    const newType = type || existingExpense.type;
    const newAmount = amount !== undefined ? parseFloat(amount) : existingExpense.amount;
    let newWalletId = walletId || existingExpense.walletId;
    let newToWalletId = toWalletId !== undefined ? toWalletId : existingExpense.toWalletId;

    // Validate new wallet(s)
    if (newWalletId) {
      const walletExists = await prisma.wallet.findFirst({
        where: { id: newWalletId, userId }
      });
      if (!walletExists) {
        const error = new Error('Source wallet not found');
        error.status = 404;
        throw error;
      }
    }

    if (newType === 'TRANSFER') {
      if (!newToWalletId) {
        const error = new Error('Destination wallet (toWalletId) is required for transfers');
        error.status = 400;
        throw error;
      }
      if (newToWalletId === newWalletId) {
        const error = new Error('Source and destination wallets must be different');
        error.status = 400;
        throw error;
      }
      const toWalletExists = await prisma.wallet.findFirst({
        where: { id: newToWalletId, userId }
      });
      if (!toWalletExists) {
        const error = new Error('Destination wallet not found');
        error.status = 404;
        throw error;
      }
    }

    // Validate category if updating and not transfer
    let finalCategoryId = categoryId || existingExpense.categoryId;
    if (newType !== 'TRANSFER' && finalCategoryId) {
      const category = await prisma.category.findFirst({
        where: { id: finalCategoryId, userId, type: newType }
      });
      if (!category) {
        const error = new Error(`Category not found or does not match type ${newType}`);
        error.status = 404;
        throw error;
      }
    } else if (newType !== 'TRANSFER' && !finalCategoryId) {
      finalCategoryId = await getOrCreateNoCategory(userId, newType);
    }

    // Atomically revert old balances and apply new ones
    const expense = await prisma.$transaction(async (tx) => {
      // 1. Revert old transaction balances
      if (existingExpense.type === 'EXPENSE') {
        if (existingExpense.walletId) {
          await tx.wallet.update({
            where: { id: existingExpense.walletId },
            data: { balance: { increment: existingExpense.amount } }
          });
        }
      } else if (existingExpense.type === 'INCOME') {
        if (existingExpense.walletId) {
          await tx.wallet.update({
            where: { id: existingExpense.walletId },
            data: { balance: { decrement: existingExpense.amount } }
          });
        }
      } else if (existingExpense.type === 'TRANSFER') {
        if (existingExpense.walletId) {
          await tx.wallet.update({
            where: { id: existingExpense.walletId },
            data: { balance: { increment: existingExpense.amount } }
          });
        }
        if (existingExpense.toWalletId) {
          await tx.wallet.update({
            where: { id: existingExpense.toWalletId },
            data: { balance: { decrement: existingExpense.amount } }
          });
        }
      }

      // 2. Update the transaction
      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          ...(title && { title }),
          amount: newAmount,
          currency: currency || existingExpense.currency,
          type: newType,
          categoryId: newType === 'TRANSFER' ? null : finalCategoryId,
          walletId: newWalletId,
          toWalletId: newType === 'TRANSFER' ? newToWalletId : null,
          ...(description !== undefined && { description }),
          ...(date && { date: new Date(date) })
        },
        include: {
          category: true,
          wallet: true,
          toWallet: true
        }
      });

      // 3. Apply new transaction balances
      if (newType === 'EXPENSE') {
        if (newWalletId) {
          await tx.wallet.update({
            where: { id: newWalletId },
            data: { balance: { decrement: newAmount } }
          });
        }
      } else if (newType === 'INCOME') {
        if (newWalletId) {
          await tx.wallet.update({
            where: { id: newWalletId },
            data: { balance: { increment: newAmount } }
          });
        }
      } else if (newType === 'TRANSFER') {
        if (newWalletId) {
          await tx.wallet.update({
            where: { id: newWalletId },
            data: { balance: { decrement: newAmount } }
          });
        }
        if (newToWalletId) {
          await tx.wallet.update({
            where: { id: newToWalletId },
            data: { balance: { increment: newAmount } }
          });
        }
      }

      return updatedExpense;
    });

    return expense;
  }

  async deleteExpense(userId, id) {
    const existingExpense = await prisma.expense.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!existingExpense) {
      const error = new Error('Transaction not found');
      error.status = 404;
      throw error;
    }

    // Atomically revert wallet balance and delete expense
    await prisma.$transaction(async (tx) => {
      if (existingExpense.type === 'EXPENSE') {
        if (existingExpense.walletId) {
          await tx.wallet.update({
            where: { id: existingExpense.walletId },
            data: { balance: { increment: existingExpense.amount } }
          });
        }
      } else if (existingExpense.type === 'INCOME') {
        if (existingExpense.walletId) {
          await tx.wallet.update({
            where: { id: existingExpense.walletId },
            data: { balance: { decrement: existingExpense.amount } }
          });
        }
      } else if (existingExpense.type === 'TRANSFER') {
        if (existingExpense.walletId) {
          await tx.wallet.update({
            where: { id: existingExpense.walletId },
            data: { balance: { increment: existingExpense.amount } }
          });
        }
        if (existingExpense.toWalletId) {
          await tx.wallet.update({
            where: { id: existingExpense.toWalletId },
            data: { balance: { decrement: existingExpense.amount } }
          });
        }
      }

      await tx.expense.delete({
        where: { id }
      });
    });

    return true;
  }
}

export default new ExpenseService();
