import logger from '../config/logger.js';
import dashboardService from '../services/dashboardService.js';

const getDashboardSummary = async (req, res) => {
  try {
    const summary = await dashboardService.getDashboardSummary(req.userId, req.query);
    res.json(summary);
  } catch (error) {
    logger.logError(error, null, { context: 'dashboard-summary' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getCategoryAnalytics = async (req, res) => {
  try {
    const analytics = await dashboardService.getCategoryAnalytics(req.userId, req.query);
    res.json(analytics);
  } catch (error) {
    logger.logError(error, null, { context: 'category-analytics' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getMonthlyTrends = async (req, res) => {
  try {
    const trends = await dashboardService.getMonthlyTrends(req.userId, req.query);
    res.json(trends);
  } catch (error) {
    logger.logError(error, null, { context: 'monthly-trends' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getRecentExpenses = async (req, res) => {
  try {
    const expenses = await dashboardService.getRecentExpenses(req.userId, req.query);
    res.json(expenses);
  } catch (error) {
    logger.logError(error, null, { context: 'recent-expenses' });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export { getDashboardSummary, getCategoryAnalytics, getMonthlyTrends, getRecentExpenses };
