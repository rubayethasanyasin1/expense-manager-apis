import express from 'express';
import { getHealth, getHealthDetailed } from '../controllers/healthController.js';

const router = express.Router();

// Basic health check (no auth required)
router.get('/', getHealth);

// Detailed health check with database connectivity (no auth required)
router.get('/detailed', getHealthDetailed);

export default router;
