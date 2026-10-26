import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import prisma from './config/prisma.js';
import authRoutes from './modules/auth/auth.routes.js';
import donationRoutes from './modules/donations/donation.routes.js';
import organizationRoutes from './modules/organizations/organization.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFound.js';

const app = express();

// Security & Parsing Middlewares
app.use(
  cors({
    origin: config.clientUrl || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Health Check Endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Verify DB connectivity
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ok',
      service: 'MealRelay API',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      service: 'MealRelay API',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'disconnected',
      error: 'Database connection check failed'
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Fallback handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
