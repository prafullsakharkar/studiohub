export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
}

class CentralizedLogger {
  private isDevelopment = true;
  private logHistory: LogEntry[] = [];
  private maxHistorySize = 200;

  constructor() {
    // In dev mode logger is active
    try {
      this.isDevelopment = (import.meta as any).env?.MODE !== 'production';
    } catch {
      this.isDevelopment = true;
    }
  }

  private format(entry: LogEntry): string {
    return `[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}`;
  }

  private pushEntry(level: LogLevel, category: string, message: string, data?: unknown) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }
    return entry;
  }

  public debug(category: string, message: string, data?: unknown): void {
    const entry = this.pushEntry('DEBUG', category, message, data);
    if (this.isDevelopment) {
      console.debug(`%c${this.format(entry)}`, 'color: #94a3b8;', data ?? '');
    }
  }

  public info(category: string, message: string, data?: unknown): void {
    const entry = this.pushEntry('INFO', category, message, data);
    if (this.isDevelopment) {
      console.info(`%c${this.format(entry)}`, 'color: #38bdf8;', data ?? '');
    }
  }

  public warn(category: string, message: string, data?: unknown): void {
    const entry = this.pushEntry('WARN', category, message, data);
    console.warn(`%c${this.format(entry)}`, 'color: #fbbf24;', data ?? '');
  }

  public error(category: string, message: string, error?: unknown): void {
    const entry = this.pushEntry('ERROR', category, message, error);
    console.error(`%c${this.format(entry)}`, 'color: #f87171; font-weight: bold;', error ?? '');
  }

  public getHistory(): readonly LogEntry[] {
    return [...this.logHistory];
  }
}

export const logger = new CentralizedLogger();
