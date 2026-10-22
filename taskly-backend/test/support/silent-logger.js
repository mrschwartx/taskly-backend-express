export const createSpyLogger = () => {
  const entries = [];
  const record = (level) => (message, meta) =>
    entries.push({ level, message, meta });
  return {
    entries,
    debug: record('debug'),
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
  };
};
