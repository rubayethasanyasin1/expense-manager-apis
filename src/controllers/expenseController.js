import { validationResult } from 'express-validator';
import prisma from '../config/database.js';
import logger from '../config/logger.js';
import { getOrCreateNoCategory } from '../utils/defaultCategories.js';

const createExpense = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, amount, categoryId, description, date, currency, type = 'EXPENSE', walletId, toWalletId } = req.body;

    // 1. Resolve source walletId
    let finalWalletId = walletId;
    if (!finalWalletId) {
      const cashWallet = await prisma.wallet.findFirst({
        where: { userId: req.userId, name: 'Cash' }
      });
      if (cashWallet) {
        finalWalletId = cashWallet.id;
      } else {
        const firstWallet = await prisma.wallet.findFirst({
          where: { userId: req.userId }
        });
        if (firstWallet) {
          finalWalletId = firstWallet.id;
        } else {
          return res.status(400).json({ error: 'User has no wallets. Please create a wallet first.' });
        }
      }
    }

    // Verify source wallet belongs to user
    const wallet = await prisma.wallet.findFirst({
      where: { id: finalWalletId, userId: req.userId }
    });
    if (!wallet) {
      return res.status(404).json({ error: 'Source wallet not found' });
    }

    // 2. Perform type-specific validation
    let finalCategoryId = null;

    if (type === 'TRANSFER') {
      if (!toWalletId) {
        return res.status(400).json({ error: 'Destination wallet (toWalletId) is required for transfers' });
      }
      if (toWalletId === finalWalletId) {
        return res.status(400).json({ error: 'Source and destination wallets must be different' });
      }
      const toWallet = await prisma.wallet.findFirst({
        where: { id: toWalletId, userId: req.userId }
      });
      if (!toWallet) {
        return res.status(404).json({ error: 'Destination wallet not found' });
      }
    } else {
      // EXPENSE or INCOME
      finalCategoryId = categoryId;
      if (!finalCategoryId) {
        finalCategoryId = await getOrCreateNoCategory(req.userId, type);
      } else {
        const category = await prisma.category.findFirst({
          where: { id: finalCategoryId, userId: req.userId, type }
        });
        if (!category) {
          return res.status(404).json({ error: `Category not found or does not match transaction type ${type}` });
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
          userId: req.userId
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

    res.status(201).json({
      message: 'Transaction created successfully',
      expense
    });
  } catch (error) {
    logger.logError(error, null, { context: 'create-expense', userId: req.userId });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getExpenses = async (req, res) => {
  try {
    const { page = 1, limit = 10, categoryId, startDate, endDate, search, type, walletId } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      userId: req.userId,
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

    res.json({
      expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.logError(error, null, { context: 'get-expenses', userId: req.userId });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await prisma.expense.findFirst({
      where: {
        id,
        userId: req.userId
      },
      include: {
        category: true,
        wallet: true,
        toWallet: true
      }
    });

    if (!expense) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ expense });
  } catch (error) {
    logger.logError(error, null, { context: 'get-expense-by-id', userId: req.userId });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateExpense = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { title, amount, categoryId, description, date, currency, type, walletId, toWalletId } = req.body;

    const existingExpense = await prisma.expense.findFirst({
      where: {
        id,
        userId: req.userId
      }
    });

    if (!existingExpense) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const newType = type || existingExpense.type;
    const newAmount = amount !== undefined ? parseFloat(amount) : existingExpense.amount;
    let newWalletId = walletId || existingExpense.walletId;
    let newToWalletId = toWalletId !== undefined ? toWalletId : existingExpense.toWalletId;

    // Validate new wallet(s)
    if (newWalletId) {
      const walletExists = await prisma.wallet.findFirst({
        where: { id: newWalletId, userId: req.userId }
      });
      if (!walletExists) {
        return res.status(404).json({ error: 'Source wallet not found' });
      }
    }

    if (newType === 'TRANSFER') {
      if (!newToWalletId) {
        return res.status(400).json({ error: 'Destination wallet (toWalletId) is required for transfers' });
      }
      if (newToWalletId === newWalletId) {
        return res.status(400).json({ error: 'Source and destination wallets must be different' });
      }
      const toWalletExists = await prisma.wallet.findFirst({
        where: { id: newToWalletId, userId: req.userId }
      });
      if (!toWalletExists) {
        return res.status(404).json({ error: 'Destination wallet not found' });
      }
    }

    // Validate category if updating and not transfer
    let finalCategoryId = categoryId || existingExpense.categoryId;
    if (newType !== 'TRANSFER' && finalCategoryId) {
      const category = await prisma.category.findFirst({
        where: { id: finalCategoryId, userId: req.userId, type: newType }
      });
      if (!category) {
        return res.status(404).json({ error: `Category not found or does not match type ${newType}` });
      }
    } else if (newType !== 'TRANSFER' && !finalCategoryId) {
      finalCategoryId = await getOrCreateNoCategory(req.userId, newType);
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

    res.json({
      message: 'Transaction updated successfully',
      expense
    });
  } catch (error) {
    logger.logError(error, null, { context: 'update-expense', userId: req.userId, expenseId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const existingExpense = await prisma.expense.findFirst({
      where: {
        id,
        userId: req.userId
      }
    });

    if (!existingExpense) {
      return res.status(404).json({ error: 'Transaction not found' });
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

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    logger.logError(error, null, { context: 'delete-expense', userId: req.userId, expenseId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export { createExpense, getExpenses, getExpenseById, updateExpense, deleteExpense };
