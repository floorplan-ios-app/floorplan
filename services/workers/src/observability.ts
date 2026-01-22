type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

export type Logger = {
  debug: (message: string, fields?: LogFields) => void;
  info: (message: string, fields?: LogFields) => void;
  warn: (message: string, fields?: LogFields) => void;
  error: (message: string, fields?: LogFields) => void;
};

function emitLog(level: LogLevel, message: string, fields: LogFields) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  console.log(JSON.stringify(payload));
}

export function createLogger(service: string): Logger {
  const base = { service };
  return {
    debug(message, fields = {}) {
      emitLog("debug", message, { ...base, ...fields });
    },
    info(message, fields = {}) {
      emitLog("info", message, { ...base, ...fields });
    },
    warn(message, fields = {}) {
      emitLog("warn", message, { ...base, ...fields });
    },
    error(message, fields = {}) {
      emitLog("error", message, { ...base, ...fields });
    },
  };
}
