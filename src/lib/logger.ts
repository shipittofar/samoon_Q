/**
 * Structured Logger — Phase 4 (P4.3.1)
 *
 * Produces structured log entries with consistent shape.
 * Development: human-readable colorized console output.
 * Production:  newline-delimited JSON for log aggregators.
 *
 * No external dependencies. Edge-safe (no Node.js stream APIs).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  correlationId?: string
  tenant?: string
  userId?: string
  [key: string]: unknown
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  scope: string
  context?: LogContext
}

export interface Logger {
  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, context?: LogContext): void
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info:  '\x1b[32m', // green
  warn:  '\x1b[33m', // yellow
  error: '\x1b[31m', // red
}
const RESET = '\x1b[0m'

function buildEntry(scope: string, level: LogLevel, message: string, context?: LogContext): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    scope,
  }
  if (context && Object.keys(context).length > 0) {
    entry.context = context
  }
  return entry
}

function emit(entry: LogEntry): void {
  if (IS_PRODUCTION) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry))
    return
  }

  const color = LEVEL_COLORS[entry.level]
  const prefix = `${color}[${entry.level.toUpperCase()}]${RESET} ${entry.timestamp} [${entry.scope}]`
  const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
  const fn = entry.level === 'error'
    ? console.error       // eslint-disable-line no-console
    : entry.level === 'warn'
      ? console.warn      // eslint-disable-line no-console
      : console.log       // eslint-disable-line no-console
  fn(`${prefix} ${entry.message}${contextStr}`)
}

export function createLogger(scope: string): Logger {
  const log = (level: LogLevel, message: string, context?: LogContext) =>
    emit(buildEntry(scope, level, message, context))

  return {
    debug: (message, context) => log('debug', message, context),
    info:  (message, context) => log('info',  message, context),
    warn:  (message, context) => log('warn',  message, context),
    error: (message, context) => log('error', message, context),
  }
}

/** Default application-level logger. */
export const logger = createLogger('app')
