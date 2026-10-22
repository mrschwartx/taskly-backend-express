import crypto from 'node:crypto';
import multer from 'multer';
import { ValidationError } from '../../../../shared/domain/errors.js';

const EXTENSION_BY_MIME_TYPE = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
});

const FIELD_NAME = 'avatar';

export const createAvatarUpload = ({ avatarsDir, maxBytes }) => {
  const upload = multer({
    storage: multer.diskStorage({
      destination: avatarsDir,
      filename: (req, file, callback) => {
        const suffix = `${Date.now()}-${crypto.randomInt(1_000_000_000)}`;
        callback(
          null,
          `avatar-${suffix}${EXTENSION_BY_MIME_TYPE[file.mimetype]}`
        );
      },
    }),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (req, file, callback) => {
      if (Object.hasOwn(EXTENSION_BY_MIME_TYPE, file.mimetype)) {
        return callback(null, true);
      }
      return callback(
        new ValidationError('Only JPEG, PNG, WEBP and GIF images are allowed')
      );
    },
  });

  const sizeLimitMessage = `File size exceeds ${maxBytes / (1024 * 1024)}MB`;

  return (req, res, next) =>
    upload.single(FIELD_NAME)(req, res, (error) => {
      if (!error) {
        return next();
      }
      if (error instanceof multer.MulterError) {
        const message =
          error.code === 'LIMIT_FILE_SIZE' ? sizeLimitMessage : error.message;
        return next(new ValidationError(message));
      }
      return next(error);
    });
};
