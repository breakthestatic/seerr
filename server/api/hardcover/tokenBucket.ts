/**
 * Client-side mirror of Hardcover's rate limit: a bucket that holds `capacity`
 * tokens and refills continuously at `refillPerSecond`. Callers reserve a token
 * synchronously and wait the returned number of milliseconds, so concurrent
 * callers queue up in order instead of racing.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private blockedUntil = 0;

  constructor(
    private capacity: number,
    private refillPerSecond: number,
    private now: () => number = Date.now
  ) {
    this.tokens = capacity;
    this.lastRefill = this.now();
  }

  private refill(now: number): void {
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    this.lastRefill = now;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsedSeconds * this.refillPerSecond
    );
  }

  /** Takes a token and returns how long the caller must wait before using it. */
  public reserve(): number {
    const now = this.now();
    this.refill(now);
    this.tokens -= 1;

    const refillWait =
      this.tokens < 0 ? (-this.tokens / this.refillPerSecond) * 1000 : 0;
    const blockedWait = Math.max(0, this.blockedUntil - now);

    return Math.ceil(Math.max(refillWait, blockedWait));
  }

  /** Holds back every caller for `ms`, e.g. after a 429 with Retry-After. */
  public blockFor(ms: number): void {
    const now = this.now();
    this.refill(now);
    this.blockedUntil = Math.max(this.blockedUntil, now + ms);
    this.tokens = Math.min(this.tokens, 0);
  }

  /**
   * Aligns the bucket with the server's own count, which also reflects other
   * clients using the same token. Only ever lowers the local count.
   */
  public sync(remaining: number, limit?: number): void {
    if (limit !== undefined && Number.isFinite(limit) && limit > 0) {
      this.capacity = limit;
      this.tokens = Math.min(this.tokens, limit);
    }
    if (Number.isFinite(remaining) && this.tokens > remaining) {
      this.tokens = Math.max(remaining, 0);
    }
  }

  public reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = this.now();
    this.blockedUntil = 0;
  }
}
