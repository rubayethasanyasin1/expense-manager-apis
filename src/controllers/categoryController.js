import { validationResult } from 'express-validator';
import logger from '../config/logger.js';
import categoryService from '../services/categoryService.js';

const createCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const category = await categoryService.createCategory(req.userId, req.body);

    res.status(201).json({
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.logError(error, null, { context: 'create-category' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getCategories = async (req, res) => {
  try {
    const result = await categoryService.getCategories(req.userId, req.query);
    res.json(result);
  } catch (error) {
    logger.logError(error, null, { context: 'get-categories' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const category = await categoryService.getCategoryById(req.userId, req.params.id);
    res.json({ category });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.logError(error, null, { context: 'get-category-by-id' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const category = await categoryService.updateCategory(req.userId, req.params.id, req.body);

    res.json({
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.logError(error, null, { context: 'update-category' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteCategory = async (req, res) => {
  try {
    await categoryService.deleteCategory(req.userId, req.params.id);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    if (error.status) {
      const errorResponse = { error: error.message };
      if (error.expenseCount !== undefined) {
        errorResponse.expenseCount = error.expenseCount;
      }
      return res.status(error.status).json(errorResponse);
    }
    logger.logError(error, null, { context: 'delete-category' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory
};
