type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

export type Logger = {
  debug: (message: string, fields?: LogFields) => void;
  info: (message: string, fields?: LogFields) => void;
  warn: (message: string, fields?: LogFields) => void;
  error: (message: string, fields?: LogFields) => void;
};

function emitLog(level: LogLevel, message: string, service: string, fields: LogFields) {
  const { timestamp: _timestamp, level: _level, message: _message, service: _service, ...safeFields } =
    fields;
  const payload = {
    ...safeFields,
    timestamp: new Date().toISOString(),
    level,
    message,
    service,
  };
  console.log(JSON.stringify(payload));
}

export function createLogger(service: string): Logger {
  return {
    debug(message, fields = {}) {
      emitLog("debug", message, service, fields);
    },
    info(message, fields = {}) {
      emitLog("info", message, service, fields);
    },
    warn(message, fields = {}) {
      emitLog("warn", message, service, fields);
    },
    error(message, fields = {}) {
      emitLog("error", message, service, fields);
    },
  };
}
