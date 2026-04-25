import CircuitBreaker from 'opossum';
import type { Logger } from '../core/logger.js';
import { CircuitOpenError } from '../types/errors.js';

export interface CircuitBreakerOptions {
  /** Timeout in ms before a request is considered failed (default: 10000) */
  timeout?: number;
  /** Error percentage threshold to trip the breaker (default: 50) */
  errorThresholdPercentage?: number;
  /** Time in ms before attempting a half-open test (default: 30000) */
  resetTimeout?: number;
  /** Minimum number of requests before calculating error threshold */
  volumeThreshold?: number;
}

const DEFAULTS: Required<CircuitBreakerOptions> = {
  timeout: 10_000,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  volumeThreshold: 5,
};

/**
 * Opossum Circuit Breaker wrapper.
 * Wraps any async function with circuit breaker protection.
 */
export class ResilienceBreaker<TArgs extends unknown[], TResult> {
  private readonly breaker: CircuitBreaker<TArgs, TResult>;

  constructor(
    name: string,
    action: (...args: TArgs) => Promise<TResult>,
    options: CircuitBreakerOptions = {},
    private readonly logger: Logger,
    fallback?: (...args: TArgs) => Promise<TResult>,
  ) {
    const opts = { ...DEFAULTS, ...options };

    this.breaker = new CircuitBreaker(action, {
      name,
      timeout: opts.timeout,
      errorThresholdPercentage: opts.errorThresholdPercentage,
      resetTimeout: opts.resetTimeout,
      volumeThreshold: opts.volumeThreshold,
    });

    if (fallback) {
      this.breaker.fallback(fallback);
    }

    // Events
    this.breaker.on('open', () => {
      this.logger.warn({ breaker: name }, 'circuit:open');
    });
    this.breaker.on('close', () => {
      this.logger.info({ breaker: name }, 'circuit:close');
    });
    this.breaker.on('halfOpen', () => {
      this.logger.info({ breaker: name }, 'circuit:halfOpen');
    });
    this.breaker.on('fallback', () => {
      this.logger.info({ breaker: name }, 'circuit:fallback');
    });
    this.breaker.on('reject', () => {
      this.logger.warn({ breaker: name }, 'circuit:reject');
    });
  }

  /**
   * Execute the action through the circuit breaker.
   */
  async fire(...args: TArgs): Promise<TResult> {
    try {
      return await this.breaker.fire(...args);
    } catch (error) {
      if (this.breaker.opened) {
        throw new CircuitOpenError(
          `Circuit breaker "${this.breaker.name}" is open — requests are being rejected`,
        );
      }
      throw error;
    }
  }

  get isOpen(): boolean {
    return this.breaker.opened;
  }

  get isClosed(): boolean {
    return this.breaker.closed;
  }

  get isHalfOpen(): boolean {
    return this.breaker.halfOpen;
  }

  get stats() {
    return this.breaker.stats;
  }

  shutdown(): void {
    this.breaker.shutdown();
  }
}
