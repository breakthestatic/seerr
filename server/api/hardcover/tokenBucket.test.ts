import { TokenBucket } from '@server/api/hardcover/tokenBucket';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const setup = (capacity = 10, refillPerSecond = 1) => {
  let now = 0;
  const bucket = new TokenBucket(capacity, refillPerSecond, () => now);
  return {
    bucket,
    advance: (ms: number) => {
      now += ms;
    },
  };
};

describe('TokenBucket', () => {
  it('allows a full burst without waiting', () => {
    const { bucket } = setup();
    for (let i = 0; i < 10; i++) {
      assert.equal(bucket.reserve(), 0);
    }
  });

  it('queues callers past the burst at the refill rate', () => {
    const { bucket } = setup();
    for (let i = 0; i < 10; i++) bucket.reserve();

    assert.equal(bucket.reserve(), 1000);
    assert.equal(bucket.reserve(), 2000);
    assert.equal(bucket.reserve(), 3000);
  });

  it('refills over time but never beyond capacity', () => {
    const { bucket, advance } = setup();
    for (let i = 0; i < 10; i++) bucket.reserve();

    advance(3000);
    assert.equal(bucket.reserve(), 0);
    assert.equal(bucket.reserve(), 0);
    assert.equal(bucket.reserve(), 0);
    assert.equal(bucket.reserve(), 1000);

    advance(60000);
    for (let i = 0; i < 10; i++) {
      assert.equal(bucket.reserve(), 0);
    }
    assert.equal(bucket.reserve(), 1000);
  });

  it('holds everyone back after blockFor', () => {
    const { bucket } = setup();

    bucket.blockFor(5000);

    assert.equal(bucket.reserve(), 5000);
  });

  it('lowers its count to match the server but never raises it', () => {
    const { bucket } = setup();

    bucket.sync(2);
    assert.equal(bucket.reserve(), 0);
    assert.equal(bucket.reserve(), 0);
    assert.equal(bucket.reserve(), 1000);

    bucket.sync(10);
    assert.equal(bucket.reserve(), 2000);
  });

  it('adopts the capacity the server reports', () => {
    const { bucket, advance } = setup();

    bucket.sync(15, 15);
    advance(60000);

    for (let i = 0; i < 15; i++) {
      assert.equal(bucket.reserve(), 0);
    }
    assert.equal(bucket.reserve(), 1000);
  });
});
