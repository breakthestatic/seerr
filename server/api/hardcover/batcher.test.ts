import { Batcher } from '@server/api/hardcover/batcher';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const makeBatcher = (
  known: number[] = [],
  options = { windowMs: 10, maxBatchSize: 5 }
) => {
  const calls: number[][] = [];
  const batcher = new Batcher<number, string>(async (keys) => {
    calls.push(keys);
    return new Map(
      keys
        .filter((k) => !known.length || known.includes(k))
        .map((k) => [k, `v${k}`])
    );
  }, options);
  return { batcher, calls };
};

describe('Batcher', () => {
  it('combines loads made within the window into one fetch', async () => {
    const { batcher, calls } = makeBatcher();

    const results = await Promise.all([1, 2, 3].map((k) => batcher.load(k)));

    assert.deepEqual(results, ['v1', 'v2', 'v3']);
    assert.deepEqual(calls, [[1, 2, 3]]);
  });

  it('shares one result between duplicate keys', async () => {
    const { batcher, calls } = makeBatcher();

    const results = await Promise.all([batcher.load(1), batcher.load(1)]);

    assert.deepEqual(results, ['v1', 'v1']);
    assert.deepEqual(calls, [[1]]);
  });

  it('flushes immediately once the batch is full', async () => {
    const { batcher, calls } = makeBatcher([], {
      windowMs: 10000,
      maxBatchSize: 3,
    });

    await Promise.all([1, 2, 3].map((k) => batcher.load(k)));

    assert.deepEqual(calls, [[1, 2, 3]]);
  });

  it('rejects only the keys missing from the result', async () => {
    const { batcher } = makeBatcher([1]);

    const [ok, missing] = await Promise.allSettled([
      batcher.load(1),
      batcher.load(2),
    ]);

    assert.equal(ok.status, 'fulfilled');
    assert.equal(missing.status, 'rejected');
  });

  it('rejects every waiter when the fetch fails', async () => {
    const batcher = new Batcher<number, string>(
      () => Promise.reject(new Error('boom')),
      { windowMs: 5, maxBatchSize: 5 }
    );

    const results = await Promise.allSettled([
      batcher.load(1),
      batcher.load(2),
    ]);

    assert.ok(results.every((r) => r.status === 'rejected'));
  });

  it('starts a new batch for loads after a flush', async () => {
    const { batcher, calls } = makeBatcher();

    await batcher.load(1);
    await batcher.load(2);

    assert.deepEqual(calls, [[1], [2]]);
  });
});
