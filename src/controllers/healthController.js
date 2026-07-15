import healthService from '../services/healthService.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

export const getHealth = catchAsync(async (req, res) => {
  const healthCheck = healthService.getHealth();
  res.json(healthCheck);
});

export const getHealthDetailed = catchAsync(async (req, res) => {
  const { healthCheck, isHealthy } = await healthService.getHealthDetailed();
  const statusCode = isHealthy ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});
