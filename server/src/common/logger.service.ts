import { ConsoleLogger, Injectable } from '@nestjs/common';

type LogLevel = 'log' | 'warn' | 'error' | 'debug' | 'verbose';

interface LogPayload {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: unknown;
  trace?: string;
}

@Injectable()
export class AppLogger extends ConsoleLogger {
  private readonly defaultContext = 'CybaWorldServer';

  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string, trace?: string): void {
    const payload: LogPayload = {
      timestamp: new Date().toISOString(),
      level,
      context: context ?? this.defaultContext,
      message,
      trace,
    };

    const serialized = JSON.stringify(payload);
    switch (level) {
      case 'log':
        super.log(serialized);
        return;
      case 'warn':
        super.warn(serialized);
        return;
      case 'error':
        super.error(serialized);
        return;
      case 'debug':
        super.debug(serialized);
        return;
      case 'verbose':
        super.verbose(serialized);
        return;
      default:
        super.log(serialized);
    }
  }
}
