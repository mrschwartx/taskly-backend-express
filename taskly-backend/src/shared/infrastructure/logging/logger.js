import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export const createLogger = ({ app, logging }) => {
  const transports = [
    new winston.transports.Console({
      format: app.isProduction
        ? winston.format.combine(
            winston.format.timestamp(),
            winston.format.simple()
          )
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
    }),
  ];

  if (logging.toFile && !logging.silent) {
    transports.push(
      new DailyRotateFile({
        dirname: logging.dir,
        filename: `${app.name}-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
      })
    );
  }

  return winston.createLogger({
    level: logging.level,
    silent: logging.silent,
    defaultMeta: { service: app.name },
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports,
  });
};
