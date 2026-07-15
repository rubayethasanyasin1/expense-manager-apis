import { validationResult } from 'express-validator';
import categoryService from '../services/categoryService.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

export const getCategories = catchAsync(async (req, res) => {
  const result = await categoryService.getCategories(req.userId);
  res.json(result);
});

export const getCategoryById = catchAsync(async (req, res) => {
  const category = await categoryService.getCategoryById(req.userId, req.params.id);
  res.json({ category });
});

export const getCategoryStats = catchAsync(async (req, res) => {
  const result = await categoryService.getCategoryStats(req.userId);
  res.json(result);
});

export const createCategory = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const category = await categoryService.createCategory(req.userId, req.body);

  res.status(201).json({
    message: 'Category created successfully',
    category
  });
});

export const updateCategory = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const category = await categoryService.updateCategory(req.userId, req.params.id, req.body);

  res.json({
    message: 'Category updated successfully',
    category
  });
});

export const deleteCategory = catchAsync(async (req, res) => {
  await categoryService.deleteCategory(req.userId, req.params.id);
  res.json({ message: 'Category deleted successfully' });
});
