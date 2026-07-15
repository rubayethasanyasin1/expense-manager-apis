import express from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import expenseRoutes from './expenseRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import migrationRoutes from './migrationRoutes.js';
import walletRoutes from './walletRoutes.js';

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/expenses', expenseRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/categories', categoryRoutes);
router.use('/migration', migrationRoutes);
router.use('/wallets', walletRoutes);

export default router;
