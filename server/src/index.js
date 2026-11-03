import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure environment immediately before other imports
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectMongo } from './db/connection.js';
import { initDefaultData } from './db/mongoInit.js';

import authRoutes from './routes/auth.js';
import reportRoutes from './routes/reports.js';
import issueRoutes from './routes/issues.js';
import infrastructureRoutes from './routes/infrastructure.js';
import analyticsRoutes from './routes/analytics.js';
import notificationRoutes from './routes/notifications.js';
import departmentRoutes from './routes/departments.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Security: Helmet HTTP Headers with CSP accommodating Leaflet maps, Cloudinary, and fonts
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://*.tile.openstreetmap.org',
          'https://*.openstreetmap.org',
          'https://res.cloudinary.com',
          'https://images.unsplash.com'
        ],
        connectSrc: [
          "'self'",
          'https://*.tile.openstreetmap.org',
          'https://*.openstreetmap.org',
          'https://res.cloudinary.com'
        ]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// Security: CORS Origin Restrictions with safe normalization
const rawAppUrl = process.env.APP_URL;
const cleanAppUrl = rawAppUrl ? rawAppUrl.replace(/\/+$/, '') : null;
const allowedOrigins = [
  cleanAppUrl,
  cleanAppUrl ? `${cleanAppUrl}/` : null,
  'https://civictrack-7gf8.onrender.com',
  'http://localhost:5173',
  'http://localhost:5000',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5000'
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.replace(/\/+$/, '');
      if (
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes(normalizedOrigin) ||
        process.env.NODE_ENV !== 'production' ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      // Pass false to disallow cleanly without throwing an unhandled Error that causes HTTP 500
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Rate Limiting
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: { error: 'Too many requests from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: { error: 'Image upload rate limit reached. Please wait before uploading more files.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', globalApiLimiter);
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);
app.use('/api/auth/forgot-password', authRateLimiter);
app.use('/api/reports/upload-image', uploadRateLimiter);

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads serving (local fallback)
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
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
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
  console.error('Unhandled error:', err.message || err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error occurred.'
  });
});

// Initialize MongoDB connection, verify default data, and start server
export async function startServer(port = PORT) {
  try {
    await connectMongo();
    await initDefaultData();
    console.log('✓ MongoDB Atlas connection verified and default data initialized');
  } catch (err) {
    console.warn('⚠ Initial MongoDB Atlas connection failed. Server starting in degraded mode; endpoints will return 503 until connection is established.');
  }

  return app.listen(port, () => {
    console.log(`✓ CivicTrack API Server running on http://localhost:${port}`);
  });
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
