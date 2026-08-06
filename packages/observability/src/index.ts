export type LogContext = Readonly<
  Record<string, boolean | number | string | null | undefined>
>;

export interface Logger {
  error(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
}

function write(
  level: 'error' | 'info' | 'warn',
  message: string,
  context: LogContext = {},
): void {
  const entry = JSON.stringify({
    context,
    level,
    message,
    timestamp: new Date().toISOString(),
  });

  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.info(entry);
}

export const logger: Logger = {
  error: (message, context) => write('error', message, context),
  info: (message, context) => write('info', message, context),
  warn: (message, context) => write('warn', message, context),
};
