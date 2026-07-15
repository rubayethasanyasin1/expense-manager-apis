import { validationResult } from 'express-validator';
import expenseService from '../services/expenseService.js';
import catchAsync from '../utils/catchAsync.js';

export const getExpenses = catchAsync(async (req, res) => {
  const result = await expenseService.getExpenses(req.userId, req.query);
  res.json(result);
});

export const getExpenseById = catchAsync(async (req, res) => {
  const expense = await expenseService.getExpenseById(req.userId, req.params.id);
  res.json({ expense });
});

export const createExpense = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const expense = await expenseService.createExpense(req.userId, req.body);

  res.status(201).json({
    message: 'Expense created successfully',
    expense
  });
});

export const updateExpense = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const expense = await expenseService.updateExpense(req.userId, req.params.id, req.body);

  res.json({
    message: 'Expense updated successfully',
    expense
  });
});

export const deleteExpense = catchAsync(async (req, res) => {
  await expenseService.deleteExpense(req.userId, req.params.id);
  res.json({ message: 'Expense deleted successfully' });
});
