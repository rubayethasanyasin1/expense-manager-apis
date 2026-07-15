import prisma from '../config/database.js';

class HealthService {
  getHealth() {
    return {
      status: 'ok',
      message: 'Expenser API is running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    };
  }

  async getHealthDetailed() {
    let databaseStatus = 'connected';
    let databaseMessage = 'Database is operational';

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      databaseStatus = 'disconnected';
      databaseMessage = 'Database connection failed';
    }

    const isHealthy = databaseStatus === 'connected';

    const healthCheck = {
      status: isHealthy ? 'ok' : 'degraded',
      message: 'Expenser API Health Check',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: {
          status: databaseStatus,
          message: databaseMessage
        },
        api: {
          status: 'ok',
          message: 'API is operational'
        }
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        memory: {
          used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
          total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
          unit: 'MB'
        }
      }
    };

    return { healthCheck, isHealthy };
  }
}

export default new HealthService();
