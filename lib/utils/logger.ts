// Structured logging utility for better debugging and error tracking

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: Error;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatMessage(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    const errorStr = error ? ` Error: ${error.message}${error.stack ? `\n${error.stack}` : ''}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}${errorStr}`;
  }

  debug(message: string, context?: Record<string, any>): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: Record<string, any>): void {
    console.log(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: Record<string, any>, error?: Error): void {
    console.warn(this.formatMessage('warn', message, context, error));
  }

  error(message: string, context?: Record<string, any>, error?: Error): void {
    console.error(this.formatMessage('error', message, context, error));
  }
}

export const logger = new Logger();
