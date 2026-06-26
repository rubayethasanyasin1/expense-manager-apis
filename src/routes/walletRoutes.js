import express from 'express';
import { body } from 'express-validator';
import {
  getWallets,
  createWallet,
  updateWallet,
  deleteWallet
} from '../controllers/walletController.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getWallets);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Wallet name is required'),
    body('balance').optional().isFloat().withMessage('Balance must be a number')
  ],
  createWallet
);

router.put(
  '/:id',
  [
    body('name').optional().trim().notEmpty().withMessage('Wallet name cannot be empty'),
    body('balance').optional().isFloat().withMessage('Balance must be a number')
  ],
  updateWallet
);

router.delete('/:id', deleteWallet);

export default router;
