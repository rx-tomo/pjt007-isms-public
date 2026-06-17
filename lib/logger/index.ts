/**
 * Structured Logger
 *
 * A simple structured logging utility that can be extended
 * for production use (e.g., integrate with external logging services).
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
}

/**
 * Get current log level from environment
 */
function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL || 'info'
  if (['debug', 'info', 'warn', 'error'].includes(level)) {
    return level as LogLevel
  }
  return 'info'
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

function shouldLog(level: LogLevel): boolean {
  const currentLevel = getLogLevel()
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel]
}

function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`
  if (entry.context && Object.keys(entry.context).length > 0) {
    return `${base} ${JSON.stringify(entry.context)}`
  }
  return base
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context
  }

  const formatted = formatEntry(entry)

  switch (level) {
    case 'debug':
    case 'info':
      console.log(formatted)
      break
    case 'warn':
      console.warn(formatted)
      break
    case 'error':
      console.error(formatted)
      break
  }
}

/**
 * Logger instance
 */
export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context)
}

export type { LogLevel, LogContext, LogEntry }
