const logger = require('../utils/logger');
const { errorResponse } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors.map(error => ({
      field: error.path,
      message: error.message,
    }));
    return errorResponse(res, 'Validation error', 400, messages);
  }

  // Sequelize unique constraint error
  if (err.name === 'SequelizeUniqueConstraintError') {
    const messages = err.errors.map(error => ({
      field: error.path,
      message: `${error.path} already exists`,
    }));
    return errorResponse(res, 'Duplicate field value', 409, messages);
  }

  // Sequelize foreign key constraint error
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return errorResponse(res, 'Related resource not found', 404);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 'Token expired', 401);
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return errorResponse(res, 'File too large', 413);
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return errorResponse(res, 'Too many files', 413);
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return errorResponse(res, 'Invalid file type', 415);
  }

  // Default error
  return errorResponse(
    res,
    error.message || 'Internal server error',
    error.statusCode || 500
  );
};

const notFound = (req, res, next) => {
  const error = new Error(`Not found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = {
  errorHandler,
  notFound,
};