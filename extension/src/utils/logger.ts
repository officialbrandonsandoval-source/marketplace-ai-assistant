/**
 * Structured logger utility for extension
 * Provides consistent logging format across content script and background
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  debug(contextOrMessage: LogContext | string, message?: string): void {
    if (!this.isDevelopment) return;
    this.log('debug', contextOrMessage, message);
  }

  info(contextOrMessage: LogContext | string, message?: string): void {
    this.log('info', contextOrMessage, message);
  }

  warn(contextOrMessage: LogContext | string, message?: string): void {
    this.log('warn', contextOrMessage, message);
  }

  error(contextOrMessage: LogContext | string, message?: string): void {
    this.log('error', contextOrMessage, message);
  }

  private log(
    level: LogLevel,
    contextOrMessage: LogContext | string,
    message?: string
  ): void {
    const timestamp = new Date().toISOString();
    const context = typeof contextOrMessage === 'string' ? {} : contextOrMessage;
    const msg = typeof contextOrMessage === 'string' ? contextOrMessage : message || '';

    const consoleMethod = level === 'debug' || level === 'info' ? 'log' : level;
    console[consoleMethod](`[${timestamp}] [${level.toUpperCase()}]`, msg, context);
  }
}

export const logger = new Logger();
