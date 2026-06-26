import { validationResult } from 'express-validator';
import prisma from '../config/database.js';
import logger from '../config/logger.js';

/**
 * Get all wallets of the authenticated user
 */
export const getWallets = async (req, res) => {
  try {
    const wallets = await prisma.wallet.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ wallets });
  } catch (error) {
    logger.logError(error, null, { context: 'get-wallets', userId: req.userId });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Create a new wallet
 */
export const createWallet = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, color, icon, balance } = req.body;

    // Check if wallet name already exists for the user
    const existingWallet = await prisma.wallet.findFirst({
      where: {
        userId: req.userId,
        name: { equals: name, mode: 'insensitive' }
      }
    });

    if (existingWallet) {
      return res.status(400).json({ error: 'A wallet with this name already exists' });
    }

    const wallet = await prisma.wallet.create({
      data: {
        name,
        color,
        icon,
        balance: balance !== undefined ? parseFloat(balance) : 0.0,
        userId: req.userId
      }
    });

    res.status(201).json({
      message: 'Wallet created successfully',
      wallet
    });
  } catch (error) {
    logger.logError(error, null, { context: 'create-wallet', userId: req.userId });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update an existing wallet
 */
export const updateWallet = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, color, icon, balance } = req.body;

    const existingWallet = await prisma.wallet.findFirst({
      where: { id, userId: req.userId }
    });

    if (!existingWallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    if (name && name.toLowerCase() !== existingWallet.name.toLowerCase()) {
      // Check if wallet name already exists
      const duplicateWallet = await prisma.wallet.findFirst({
        where: {
          userId: req.userId,
          name: { equals: name, mode: 'insensitive' }
        }
      });
      if (duplicateWallet) {
        return res.status(400).json({ error: 'A wallet with this name already exists' });
      }
    }

    const updatedWallet = await prisma.wallet.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
        ...(balance !== undefined && { balance: parseFloat(balance) })
      }
    });

    res.json({
      message: 'Wallet updated successfully',
      wallet: updatedWallet
    });
  } catch (error) {
    logger.logError(error, null, { context: 'update-wallet', userId: req.userId, walletId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete a wallet
 */
export const deleteWallet = async (req, res) => {
  try {
    const { id } = req.params;

    const wallet = await prisma.wallet.findFirst({
      where: { id, userId: req.userId },
      include: {
        _count: {
          select: {
            expenses: true,
            incomingTransfers: true
          }
        }
      }
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Check if wallet is linked to any transactions
    if (wallet._count.expenses > 0 || wallet._count.incomingTransfers > 0) {
      return res.status(400).json({
        error: 'Cannot delete wallet because it has associated transactions'
      });
    }

    await prisma.wallet.delete({
      where: { id }
    });

    res.json({ message: 'Wallet deleted successfully' });
  } catch (error) {
    logger.logError(error, null, { context: 'delete-wallet', userId: req.userId, walletId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
};
