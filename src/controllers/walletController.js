import { validationResult } from 'express-validator';
import walletService from '../services/walletService.js';
import catchAsync from '../utils/catchAsync.js';

export const getWallets = catchAsync(async (req, res) => {
  const result = await walletService.getWallets(req.userId);
  res.json(result);
});

export const createWallet = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const wallet = await walletService.createWallet(req.userId, req.body);

  res.status(201).json({
    message: 'Wallet created successfully',
    wallet
  });
});

export const updateWallet = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const wallet = await walletService.updateWallet(req.userId, req.params.id, req.body);

  res.json({
    message: 'Wallet updated successfully',
    wallet
  });
});

export const deleteWallet = catchAsync(async (req, res) => {
  await walletService.deleteWallet(req.userId, req.params.id);
  res.json({ message: 'Wallet deleted successfully' });
});
