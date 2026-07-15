import { validationResult } from 'express-validator';
import logger from '../config/logger.js';
import expenseService from '../services/expenseService.js';

const createExpense = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const expense = await expenseService.createExpense(req.userId, req.body);

    res.status(201).json({
      message: 'Transaction created successfully',
      expense
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.logError(error, null, { context: 'create-expense', userId: req.userId });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getExpenses = async (req, res) => {
  try {
    const result = await expenseService.getExpenses(req.userId, req.query);
    res.json(result);
  } catch (error) {
    logger.logError(error, null, { context: 'get-expenses', userId: req.userId });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getExpenseById = async (req, res) => {
  try {
    const expense = await expenseService.getExpenseById(req.userId, req.params.id);
    res.json({ expense });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
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

    const expense = await expenseService.updateExpense(req.userId, req.params.id, req.body);

    res.json({
      message: 'Transaction updated successfully',
      expense
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.logError(error, null, { context: 'update-expense', userId: req.userId, expenseId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteExpense = async (req, res) => {
  try {
    await expenseService.deleteExpense(req.userId, req.params.id);
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.logError(error, null, { context: 'delete-expense', userId: req.userId, expenseId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export { createExpense, getExpenses, getExpenseById, updateExpense, deleteExpense };
