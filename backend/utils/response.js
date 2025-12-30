const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const errorResponse = (res, message = 'Error', statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

const validationErrorResponse = (res, errors) => {
  // Support Joi errors (errors.details) and express-validator errors (errors.array())
  const details = Array.isArray(errors?.details)
    ? errors.details.map((d) => ({
        field: Array.isArray(d.path) ? d.path.join('.') : String(d.path || ''),
        message: d.message,
      }))
    : null

  const arrayErrors = typeof errors?.array === 'function'
    ? errors.array().map(error => ({
        field: error.path,
        message: error.msg,
      }))
    : null

  return errorResponse(
    res,
    'Validation failed',
    422,
    details || arrayErrors || [{ field: '', message: 'Validation failed' }]
  );
};

module.exports = {
  successResponse,
  errorResponse,
  validationErrorResponse,
};