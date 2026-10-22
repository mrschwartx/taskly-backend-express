const UNIQUE_VIOLATION_CODE = '23505';

export const isUniqueViolationError = (error) =>
  error?.code === UNIQUE_VIOLATION_CODE;
