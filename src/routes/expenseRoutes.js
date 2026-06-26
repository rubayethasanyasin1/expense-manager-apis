import express from 'express';
import { body } from 'express-validator';
import {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense
} from '../controllers/expenseController.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.post(
  '/',
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('type').optional().isIn(['EXPENSE', 'INCOME', 'TRANSFER']).withMessage('Type must be EXPENSE, INCOME, or TRANSFER'),
    body('categoryId')
      .optional({ nullable: true })
      .isUUID()
      .withMessage('Category ID must be a valid UUID'),
    body('walletId')
      .optional({ nullable: true })
      .isUUID()
      .withMessage('Wallet ID must be a valid UUID'),
    body('toWalletId')
      .optional({ nullable: true })
      .isUUID()
      .withMessage('Destination Wallet ID must be a valid UUID')
  ],
  createExpense
);

router.get('/', getExpenses);

router.get('/:id', getExpenseById);

router.put(
  '/:id',
  [
    body('title').optional().notEmpty().withMessage('Title cannot be empty'),
    body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('type').optional().isIn(['EXPENSE', 'INCOME', 'TRANSFER']).withMessage('Type must be EXPENSE, INCOME, or TRANSFER'),
    body('categoryId')
      .optional({ nullable: true })
      .isUUID()
      .withMessage('Category ID must be a valid UUID'),
    body('walletId')
      .optional({ nullable: true })
      .isUUID()
      .withMessage('Wallet ID must be a valid UUID'),
    body('toWalletId')
      .optional({ nullable: true })
      .isUUID()
      .withMessage('Destination Wallet ID must be a valid UUID')
  ],
  updateExpense
);

router.delete('/:id', deleteExpense);

export default router;
