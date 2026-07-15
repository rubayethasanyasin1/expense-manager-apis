import logger from '../config/logger.js';
import AppError from '../utils/AppError.js';

export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.name = err.name;
  error.statusCode = err.statusCode || 500;

  // Prisma Error Handling
  if (err.name && err.name.startsWith('PrismaClient')) {
    logger.error('Prisma Error intercepted:', { error: err.message, name: err.name, code: err.code });
    
    if (err.code === 'P2002') {
      error = new AppError('Duplicate field value entered', 400);
    } else if (err.code === 'P2025') {
      error = new AppError('Record not found', 404);
    } else {
      error = new AppError('Internal database error. Please try again later.', 500);
    }
  }

  // Log non-operational errors
  if (!error.isOperational) {
    logger.error('Unhandled Error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    });
  }

  // Send response
  res.status(error.statusCode).json({
    error: error.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && !error.isOperational && { stack: err.stack })
  });
};

export default errorHandler;
