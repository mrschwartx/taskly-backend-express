const DEFAULT_MESSAGE =
  "We're having technical issues. Please try again later.";

const STATUS_BY_CODE = Object.freeze({
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  ALREADY_EXISTS: 422,
  AUTHENTICATION_FAILED: 401,
  FORBIDDEN: 403,
});

const resolveClientError = (error) => {
  const status = STATUS_BY_CODE[error.code];
  if (status) {
    return { status, message: error.message };
  }
  if (error.type === 'entity.parse.failed') {
    return { status: 400, message: 'Malformed JSON body' };
  }
  if (error.type === 'entity.too.large') {
    return { status: 413, message: 'Request body is too large' };
  }
  return null;
};

export const createErrorHandler =
  ({ logger }) =>
  (error, req, res, _next) => {
    const clientError = resolveClientError(error);

    if (clientError) {
      logger.warn('Request rejected', {
        status: clientError.status,
        message: clientError.message,
      });
      return res.status(clientError.status).json({
        status: clientError.status,
        message: clientError.message,
      });
    }

    logger.error('Unhandled error', {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ status: 500, message: DEFAULT_MESSAGE });
  };
