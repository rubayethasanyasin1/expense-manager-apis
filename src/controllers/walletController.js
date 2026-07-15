import { validationResult } from 'express-validator';
import logger from '../config/logger.js';
import walletService from '../services/walletService.js';

export const getWallets = async (req, res) => {
  try {
    const result = await walletService.getWallets(req.userId);
    res.json(result);
  } catch (error) {
    logger.logError(error, null, { context: 'get-wallets', userId: req.userId });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createWallet = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const wallet = await walletService.createWallet(req.userId, req.body);

    res.status(201).json({
      message: 'Wallet created successfully',
      wallet
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.logError(error, null, { context: 'create-wallet', userId: req.userId });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateWallet = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const wallet = await walletService.updateWallet(req.userId, req.params.id, req.body);

    res.json({
      message: 'Wallet updated successfully',
      wallet
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.logError(error, null, { context: 'update-wallet', userId: req.userId, walletId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteWallet = async (req, res) => {
  try {
    await walletService.deleteWallet(req.userId, req.params.id);
    res.json({ message: 'Wallet deleted successfully' });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.logError(error, null, { context: 'delete-wallet', userId: req.userId, walletId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
};
