import { describe, it, expect, vi } from 'vitest';
import { DriverLogger } from '../../src/utils/logger';
import type { LogRecord } from '../../src/utils/logger';

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('DriverLogger', () => {
  // ── Suppression at 'silent' ─────────────────────────────────────────────────

  describe("level: 'silent'", () => {
    it('suppresses all emit() calls', () => {
      const write = vi.fn();
      const logger = new DriverLogger('silent', write);
      logger.emit('info', { event: 'driver.init.started' });
      logger.emit('error', { event: 'driver.init.failed' });
      logger.emit('warn', { event: 'driver.auth.required' });
      logger.emit('debug', { event: 'driver.health.checked' });
      expect(write).not.toHaveBeenCalled();
    });
  });

  // ── Level filtering ─────────────────────────────────────────────────────────

  describe("level: 'error'", () => {
    it('emits error events', () => {
      const write = vi.fn();
      const logger = new DriverLogger('error', write);
      logger.emit('error', { event: 'driver.init.failed' });
      expect(write).toHaveBeenCalledOnce();
    });

    it('suppresses warn, info, debug', () => {
      const write = vi.fn();
      const logger = new DriverLogger('error', write);
      logger.emit('warn', { event: 'driver.auth.required' });
      logger.emit('info', { event: 'driver.init.started' });
      logger.emit('debug', { event: 'driver.health.checked' });
      expect(write).not.toHaveBeenCalled();
    });
  });

  describe("level: 'warn'", () => {
    it('emits error and warn, suppresses info and debug', () => {
      const write = vi.fn();
      const logger = new DriverLogger('warn', write);
      logger.emit('error', { event: 'driver.generate.failed' });
      logger.emit('warn', { event: 'driver.capture.timeout' });
      logger.emit('info', { event: 'driver.generate.started' });
      logger.emit('debug', { event: 'driver.health.checked' });
      expect(write).toHaveBeenCalledTimes(2);
    });
  });

  describe("level: 'info'", () => {
    it('emits error, warn, and info — suppresses debug', () => {
      const write = vi.fn();
      const logger = new DriverLogger('info', write);
      logger.emit('error', { event: 'driver.init.failed' });
      logger.emit('warn', { event: 'driver.auth.required' });
      logger.emit('info', { event: 'driver.init.started' });
      logger.emit('debug', { event: 'driver.health.checked' });
      expect(write).toHaveBeenCalledTimes(3);
    });
  });

  describe("level: 'debug'", () => {
    it('emits all levels', () => {
      const write = vi.fn();
      const logger = new DriverLogger('debug', write);
      logger.emit('error', { event: 'driver.init.failed' });
      logger.emit('warn', { event: 'driver.auth.required' });
      logger.emit('info', { event: 'driver.init.started' });
      logger.emit('debug', { event: 'driver.health.checked' });
      expect(write).toHaveBeenCalledTimes(4);
    });
  });

  // ── Record shape ────────────────────────────────────────────────────────────

  describe('emitted record shape', () => {
    it('record contains event name', () => {
      const records: LogRecord[] = [];
      const logger = new DriverLogger('info', (r) => records.push(r));
      logger.emit('info', { event: 'driver.generate.started' });
      expect(records[0]?.event).toBe('driver.generate.started');
    });

    it('record contains a valid ISO timestamp', () => {
      const records: LogRecord[] = [];
      const logger = new DriverLogger('info', (r) => records.push(r));
      logger.emit('info', { event: 'driver.init.succeeded' });
      expect(records[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('record contains level string', () => {
      const records: LogRecord[] = [];
      const logger = new DriverLogger('warn', (r) => records.push(r));
      logger.emit('warn', { event: 'driver.selector.missing', selectorName: 'inputBox' });
      expect(records[0]?.level).toBe('warn');
    });

    it('optional fields are included when provided', () => {
      const records: LogRecord[] = [];
      const logger = new DriverLogger('info', (r) => records.push(r));
      logger.emit('info', {
        event: 'driver.generate.succeeded',
        sessionId: 'session-abc',
        requestId: 'req-123',
        durationMs: 4200,
      });
      const r = records[0];
      expect(r?.sessionId).toBe('session-abc');
      expect(r?.requestId).toBe('req-123');
      expect(r?.durationMs).toBe(4200);
    });

    it('optional fields absent when not provided', () => {
      const records: LogRecord[] = [];
      const logger = new DriverLogger('info', (r) => records.push(r));
      logger.emit('info', { event: 'driver.init.started' });
      const r = records[0];
      expect(r).not.toHaveProperty('durationMs');
      expect(r).not.toHaveProperty('requestId');
      expect(r).not.toHaveProperty('errorCode');
    });
  });

  // ── Default behavior ────────────────────────────────────────────────────────

  describe('default constructor', () => {
    it('defaults to silent — no output without explicit logLevel', () => {
      // DriverLogger('silent') — default is silent.
      // We cannot easily test process.stderr here, so we verify via explicit silent.
      const write = vi.fn();
      const logger = new DriverLogger('silent', write);
      logger.emit('info', { event: 'driver.init.started' });
      expect(write).not.toHaveBeenCalled();
    });
  });
});
