import dashboardService from '../services/dashboardService.js';
import catchAsync from '../utils/catchAsync.js';

export const getDashboardSummary = catchAsync(async (req, res) => {
  const { month, year } = req.query;
  const result = await dashboardService.getDashboardSummary(req.userId, month, year);
  res.json(result);
});

export const getCategoryAnalytics = catchAsync(async (req, res) => {
  const { month, year } = req.query;
  const result = await dashboardService.getCategoryAnalytics(req.userId, month, year);
  res.json(result);
});

export const getMonthlyTrends = catchAsync(async (req, res) => {
  const { months } = req.query;
  const result = await dashboardService.getMonthlyTrends(req.userId, months ? parseInt(months) : 6);
  res.json(result);
});

export const getRecentExpenses = catchAsync(async (req, res) => {
  const { limit } = req.query;
  const result = await dashboardService.getRecentExpenses(req.userId, limit ? parseInt(limit) : 10);
  res.json(result);
});
