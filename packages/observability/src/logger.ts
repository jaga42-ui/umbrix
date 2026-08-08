/**
 * Structured logging.
 *
 * CLAUDE.md bans `console.log` in production API routes and asks for structured
 * logging instead, but no logger existed — the ingest prints free-form strings,
 * so a run's output can be read by a human and by nothing else. Emitting JSON
 * makes runs queryable (which connector, which slug, how long, what failed)
 * without changing what a person sees in CI, since each line still carries a
 * readable message.
 *
 * Output goes to stderr so that a command's real result on stdout stays
 * machine-parseable even while logging is on.
 */

import type { Logger } from '@umbrix/core';

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LoggerOptions {
  /** Minimum level to emit. Defaults to LOG_LEVEL env var, else "info". */
  level?: LogLevel;
  /** Fields attached to every line from this logger. */
  context?: Record<string, unknown>;
  /** Human-readable lines instead of JSON. Defaults on when stderr is a TTY. */
  pretty?: boolean;
  /** Sink, injectable for tests. */
  write?: (line: string) => void;
}

function resolveLevel(explicit?: LogLevel): LogLevel {
  const fromEnv = process.env.LOG_LEVEL as LogLevel | undefined;
  if (explicit && LEVEL_RANK[explicit]) return explicit;
  if (fromEnv && LEVEL_RANK[fromEnv]) return fromEnv;
  return 'info';
}

export interface StructuredLogger extends Logger {
  /** Derive a logger carrying additional permanent context. */
  child(context: Record<string, unknown>): StructuredLogger;
}

export function createLogger(options: LoggerOptions = {}): StructuredLogger {
  const level = resolveLevel(options.level);
  const context = options.context ?? {};
  const pretty = options.pretty ?? Boolean(process.stderr.isTTY);
  const write = options.write ?? ((line: string) => process.stderr.write(line + '\n'));

  const emit = (lvl: LogLevel, msg: string, fields?: Record<string, unknown>) => {
    if (LEVEL_RANK[lvl] < LEVEL_RANK[level]) return;
    const merged = { ...context, ...fields };
    if (pretty) {
      const suffix = Object.keys(merged).length ? ' ' + JSON.stringify(merged) : '';
      write(`${lvl.toUpperCase().padEnd(5)} ${msg}${suffix}`);
      return;
    }
    write(JSON.stringify({ level: lvl, msg, ...merged, ts: new Date().toISOString() }));
  };

  return {
    debug: (msg, fields) => emit('debug', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
    child: (extra) => createLogger({ ...options, level, context: { ...context, ...extra } }),
  };
}

/** A logger that discards everything. For tests. */
export const silentLogger: StructuredLogger = {
  debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
  child: () => silentLogger,
};
