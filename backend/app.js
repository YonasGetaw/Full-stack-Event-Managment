const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const xss = require('xss-clean');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config/env');
const logger = require('./utils/logger');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { generalLimiter } = require('./middleware/rateLimitMiddleware');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const eventRoutes = require('./routes/eventRoutes');
const adminConfigRoutes = require('./routes/adminConfigRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

// Trust proxy for production
if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

app.use(xss());

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
app.use(generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Logging
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev', {
  stream: { write: message => logger.info(message.trim()) }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/uploads/profile', express.static(path.join(__dirname, 'uploads/profile')));
app.use('/api/bookings', bookingRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin-config', adminConfigRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);

// Serve uploaded files
app.get('/uploads/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  const filePath = path.join(__dirname, 'uploads', folder, filename);
  
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).json({ error: 'File not found' });
    }
  });
});

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;