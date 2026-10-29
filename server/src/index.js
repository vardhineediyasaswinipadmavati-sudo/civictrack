import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getDb } from './db/connection.js';
import { initSchema } from './db/schema.js';

import authRoutes from './routes/auth.js';
import reportRoutes from './routes/reports.js';
import issueRoutes from './routes/issues.js';
import infrastructureRoutes from './routes/infrastructure.js';
import analyticsRoutes from './routes/analytics.js';
import notificationRoutes from './routes/notifications.js';
import departmentRoutes from './routes/departments.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads serving
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));

// Serve client production build
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/infrastructure', infrastructureRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/departments', departmentRoutes);

// Root healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'CivicTrack — Infrastructure Lifecycle Management System',
    timestamp: new Date().toISOString()
  });
});

// Single Page Application (SPA) fallback to index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  const indexPath = path.join(clientDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) next();
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error occurred.'
  });
});

// Initialize database schema and start server
export async function startServer(port = PORT) {
  try {
    const db = await getDb();
    await initSchema(db);
    console.log('✓ Database schema verified and ready');

    return app.listen(port, () => {
      console.log(`✓ CivicTrack API Server running on http://localhost:${port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Auto-start when executed directly
const isDirectRun = process.argv[1] && (
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ||
  process.argv[1].endsWith('index.js')
);

if (isDirectRun) {
  startServer();
}

export { app };
