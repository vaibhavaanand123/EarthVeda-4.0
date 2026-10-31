const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Minimal structured (JSON-lines) logger. Container platforms and log
 * aggregators parse one JSON object per line without extra configuration.
 */
export function createLogger({ level = 'info', stream = process.stdout, base = {} } = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const write = (lvl, msg, fields) => {
    if (LEVELS[lvl] < threshold) return;
    const entry = { time: new Date().toISOString(), level: lvl, msg, ...base, ...fields };
    if (fields?.err instanceof Error) entry.err = { name: fields.err.name, code: fields.err.code }; // Never print upstream messages, URLs, SQL or payloads.
    stream.write(`${JSON.stringify(entry)}\n`);
  };
  return {
    debug: (msg, fields) => write('debug', msg, fields),
    info: (msg, fields) => write('info', msg, fields),
    warn: (msg, fields) => write('warn', msg, fields),
    error: (msg, fields) => write('error', msg, fields),
    child: (extra) => createLogger({ level, stream, base: { ...base, ...extra } }),
  };
}

export const silentLogger = createLogger({ level: 'error', stream: { write() {} } });
