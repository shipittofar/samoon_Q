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
    // Console output suppressed in production — use Sentry / log aggregator for observability.
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

// ── P4.9.1 — Context injection helpers ───────────────────────────────────────

/**
 * Returns a child logger that merges the given base context into every log
 * entry. Call sites supply per-call overrides; base context is never leaked
 * to unrelated log lines.
 *
 * Usage:
 *   const log = withContext(createLogger('api'), { requestId: req.id })
 *   log.info('request received')  // → { requestId, ...entry }
 */
export function withContext(base: Logger, ctx: LogContext): Logger {
  const merge = (extra?: LogContext): LogContext => ({ ...ctx, ...extra })
  return {
    debug: (msg, extra) => base.debug(msg, merge(extra)),
    info:  (msg, extra) => base.info(msg,  merge(extra)),
    warn:  (msg, extra) => base.warn(msg,  merge(extra)),
    error: (msg, extra) => base.error(msg, merge(extra)),
  }
}

/**
 * Inject a requestId into a logger for the duration of a request.
 * Convenience wrapper around withContext.
 */
export function withRequestId(base: Logger, requestId: string): Logger {
  return withContext(base, { requestId })
}

/**
 * Inject userId into a logger (e.g. after authentication).
 * Convenience wrapper around withContext.
 */
export function withUserId(base: Logger, userId: string): Logger {
  return withContext(base, { userId })
}

/**
 * Inject tenant context into a logger.
 * Convenience wrapper around withContext.
 */
export function withTenant(base: Logger, tenant: string): Logger {
  return withContext(base, { tenant })
}

/**
 * API-safe logger: strips PII fields (email, password, token, authorization)
 * from context before emitting. Safe to use in route handlers where context
 * may originate from untrusted request data.
 */
export function createApiLogger(scope: string): Logger {
  const base = createLogger(scope)
  const sanitize = (ctx?: LogContext): LogContext | undefined => {
    if (!ctx) return undefined
    const safe: LogContext = {}
    const PII_KEYS = new Set(['email', 'password', 'token', 'authorization', 'access_token', 'refresh_token'])
    for (const [k, v] of Object.entries(ctx)) {
      if (!PII_KEYS.has(k.toLowerCase())) safe[k] = v
    }
    return Object.keys(safe).length > 0 ? safe : undefined
  }
  return {
    debug: (msg, ctx) => base.debug(msg, sanitize(ctx)),
    info:  (msg, ctx) => base.info(msg,  sanitize(ctx)),
    warn:  (msg, ctx) => base.warn(msg,  sanitize(ctx)),
    error: (msg, ctx) => base.error(msg, sanitize(ctx)),
  }
}
