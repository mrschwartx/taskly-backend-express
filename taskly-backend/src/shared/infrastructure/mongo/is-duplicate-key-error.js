const DUPLICATE_KEY_CODE = 11000;

export const isDuplicateKeyError = (error) =>
  error?.code === DUPLICATE_KEY_CODE;
