import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from './config/passport.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import migrationRoutes from './routes/migrationRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import { requestLogger, errorLogger } from './middleware/logging.js';
import logger from './config/logger.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Vercel serves your app behind a proxy. This ensures 'secure' cookies work.
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Session middleware (required for passport)
app.use(
  session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true, // Required for Vercel
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Request logging middleware
app.use(requestLogger);

// Routes
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/migration', migrationRoutes);
app.use('/api/v1/wallets', walletRoutes);

// 404 handler
app.use((req, res) => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.url,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress
  });
  res.status(404).json({ error: 'Route not found' });
});

// Error logging middleware
app.use(errorLogger);

// Error handler
app.use((err, req, res, _next) => {
  res.status(err.status || 500).json({
    error: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

if (!process.env.VERCEL) {
  logger.info('Port debug', {
    portEnv: process.env.PORT,
    finalPort: PORT
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info('Server started successfully', {
      port: PORT,
      nodeEnv: process.env.NODE_ENV || 'development'
    });
  });

  server.on('error', (err) => {
    logger.error('SERVER LISTEN ERROR', {
      message: err.message,
      code: err.code,
      errno: err.errno,
      syscall: err.syscall,
      address: err.address,
      port: err.port,
      stack: err.stack
    });
  });
}

export default app;
