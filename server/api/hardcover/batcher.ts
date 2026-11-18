type Waiter<V> = {
  resolve: (value: V) => void;
  reject: (reason: Error) => void;
};

/**
 * Collects `load()` calls made within `windowMs` of each other and resolves
 * them all from a single `fetchMany` call. Duplicate keys share one result.
 */
export class Batcher<K, V> {
  private pending = new Map<K, Waiter<V>[]>();
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private fetchMany: (keys: K[]) => Promise<Map<K, V>>,
    private options: { windowMs: number; maxBatchSize: number }
  ) {}

  public load(key: K): Promise<V> {
    return new Promise<V>((resolve, reject) => {
      const waiters = this.pending.get(key);
      if (waiters) {
        waiters.push({ resolve, reject });
      } else {
        this.pending.set(key, [{ resolve, reject }]);
      }

      if (this.pending.size >= this.options.maxBatchSize) {
        void this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => void this.flush(), this.options.windowMs);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    const batch = this.pending;
    this.pending = new Map();

    try {
      const results = await this.fetchMany([...batch.keys()]);
      for (const [key, waiters] of batch) {
        if (results.has(key)) {
          waiters.forEach((w) => w.resolve(results.get(key) as V));
        } else {
          waiters.forEach((w) => w.reject(new Error('Not found')));
        }
      }
    } catch (e) {
      for (const waiters of batch.values()) {
        waiters.forEach((w) => w.reject(e));
      }
    }
  }
}
