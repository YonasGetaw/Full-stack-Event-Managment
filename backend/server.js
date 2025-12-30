const http = require('http');
const socketIo = require('socket.io');
const { sequelize } = require('./config/database');
const config = require('./config/env');
const logger = require('./utils/logger');
const app = require('./app');
const { authenticateSocket } = require('./config/socket');

const ensureEventPaymentSchema = async () => {
  const qi = sequelize.getQueryInterface();
  try {
    // Make payments.bookingId nullable (event payments don't have bookingId)
    await qi.changeColumn('payments', 'bookingId', {
      type: require('sequelize').DataTypes.UUID,
      allowNull: true,
    });
  } catch (e) {
    logger.warn(`Schema patch skipped (payments.bookingId): ${e?.message || e}`);
  }

  try {
    await qi.addColumn('payments', 'eventId', {
      type: require('sequelize').DataTypes.UUID,
      allowNull: true,
    });
  } catch (e) {
    logger.warn(`Schema patch skipped (payments.eventId): ${e?.message || e}`);
  }

  try {
    await qi.addColumn('payments', 'userId', {
      type: require('sequelize').DataTypes.UUID,
      allowNull: true,
    });
  } catch (e) {
    logger.warn(`Schema patch skipped (payments.userId): ${e?.message || e}`);
  }
};

const ensureEventLocationSchema = async () => {
  const qi = sequelize.getQueryInterface();
  try {
    await qi.addColumn('events', 'latitude', {
      type: require('sequelize').DataTypes.FLOAT,
      allowNull: true,
    });
  } catch (e) {
    logger.warn(`Schema patch skipped (events.latitude): ${e?.message || e}`);
  }

  try {
    await qi.addColumn('events', 'longitude', {
      type: require('sequelize').DataTypes.FLOAT,
      allowNull: true,
    });
  } catch (e) {
    logger.warn(`Schema patch skipped (events.longitude): ${e?.message || e}`);
  }
};

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.IO authentication and connection handling
io.use(authenticateSocket);

io.on('connection', (socket) => {
  logger.info(`User ${socket.userId} connected to socket`);

  // Join user to their per
  // sonal room
  socket.join(`user_${socket.userId}`);

  // Join admin room if user is admin
  if (socket.userRole === 'admin') {
    socket.join('admin_room');
  }

  // Handle disconnection
  socket.on('disconnect', () => {
    logger.info(`User ${socket.userId} disconnected from socket`);
  });

  // Handle custom events
  socket.on('join_booking', (bookingId) => {
    socket.join(`booking_${bookingId}`);
  });

  socket.on('leave_booking', (bookingId) => {
    socket.leave(`booking_${bookingId}`);
  });
});

// Make io accessible to our router
app.set('io', io);

// Test database connection and start server
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Sync database (use with caution in production)
    if (config.nodeEnv === 'development') {
      await ensureEventPaymentSchema();
      await ensureEventLocationSchema();
      await sequelize.sync();
      logger.info('Database synced successfully');
    }

    // Start server
    const PORT = config.port || 4000;
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${config.nodeEnv} mode`);
    });
  } catch (error) {
    logger.error('Unable to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

startServer();