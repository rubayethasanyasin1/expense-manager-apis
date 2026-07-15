import healthService from '../services/healthService.js';

export const getHealth = async (req, res) => {
  try {
    const healthCheck = healthService.getHealth();
    res.json(healthCheck);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Service unavailable',
      timestamp: new Date().toISOString()
    });
  }
};

export const getHealthDetailed = async (req, res) => {
  try {
    const { healthCheck, isHealthy } = await healthService.getHealthDetailed();
    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(healthCheck);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Service unavailable',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
};
