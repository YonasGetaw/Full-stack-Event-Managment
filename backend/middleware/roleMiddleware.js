const { errorResponse } = require('../utils/response');

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401);
    }

    if (!Array.isArray(roles)) {
      roles = [roles];
    }

    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 'Insufficient permissions', 403);
    }

    next();
  };
};

const requireAdmin = requireRole('admin');
const requireUser = requireRole('user');

module.exports = {
  requireRole,
  requireAdmin,
  requireUser,
};