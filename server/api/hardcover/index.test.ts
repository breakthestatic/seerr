import Hardcover, { hardcoverRateLimiter } from '@server/api/hardcover';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import axios, { AxiosError } from 'axios';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

type Reply = { status: number; headers?: Record<string, string> };

const originalAdapter = axios.defaults.adapter;

// Batched lookups are sent by an internal Hardcover instance, so the stub has
// to sit on the axios defaults that every new instance copies.
const stubHardcover = (replies: Reply[], knownBookIds: number[] = []) => {
  const requests: { bookIds: number[]; at: number }[] = [];
  let i = 0;
  axios.defaults.adapter = (config: InternalAxiosRequestConfig) => {
    const { variables } = JSON.parse(config.data as string);
    requests.push({ bookIds: variables.bookIds, at: Date.now() });

    const reply = replies[Math.min(i++, replies.length - 1)];
    const books = (variables.bookIds as number[])
      .filter((id) => knownBookIds.length === 0 || knownBookIds.includes(id))
      .map((id) => ({ id }));
    const response = {
      data: { data: { books } },
      status: reply.status,
      statusText: '',
      headers: reply.headers ?? {},
      config,
      request: {},
    } as AxiosResponse;

    if (reply.status >= 400) {
      return Promise.reject(
        new AxiosError(
          `Request failed with status code ${reply.status}`,
          'ERR_BAD_REQUEST',
          config,
          {},
          response
        )
      );
    }
    return Promise.resolve(response);
  };
  return requests;
};

describe('Hardcover client', () => {
  beforeEach(() => hardcoverRateLimiter.reset());
  afterEach(() => {
    axios.defaults.adapter = originalAdapter;
  });

  it('retries a 429 and returns the eventual response', async () => {
    const requests = stubHardcover([
      { status: 429, headers: { 'retry-after': '0' } },
      { status: 429, headers: { 'retry-after': '0' } },
      { status: 200 },
    ]);

    const book = await new Hardcover().getBook(900001);

    assert.equal(book.id, 900001);
    assert.equal(requests.length, 3);
  });

  it('gives up after the retry limit and surfaces the 429', async () => {
    const requests = stubHardcover([
      { status: 429, headers: { 'retry-after': '0' } },
    ]);

    await assert.rejects(new Hardcover().getBook(900002), /status code 429/);
    assert.equal(requests.length, 4);
  });

  it('does not retry client errors other than 429', async () => {
    const requests = stubHardcover([{ status: 401 }]);

    await assert.rejects(new Hardcover().getBook(900003), /status code 401/);
    assert.equal(requests.length, 1);
  });

  it('fetches concurrent book lookups in a single request', async () => {
    const requests = stubHardcover([{ status: 200 }]);
    const ids = [900011, 900012, 900013, 900014, 900015];

    const books = await Promise.all(
      ids.map((id) => new Hardcover().getBook(id))
    );

    assert.deepEqual(
      books.map((b) => b.id),
      ids
    );
    assert.equal(requests.length, 1);
    assert.deepEqual([...requests[0].bookIds].sort(), ids);
  });

  it('serves a book from cache after it has been fetched', async () => {
    const requests = stubHardcover([{ status: 200 }]);

    await new Hardcover().getBook(900021);
    await new Hardcover().getBook(900021);

    assert.equal(requests.length, 1);
  });

  it('rejects when Hardcover does not return the requested book', async () => {
    stubHardcover([{ status: 200 }], [900031]);

    const [found, missing] = await Promise.allSettled([
      new Hardcover().getBook(900031),
      new Hardcover().getBook(900032),
    ]);

    assert.equal(found.status, 'fulfilled');
    assert.equal(missing.status, 'rejected');
  });

  it('slows requests once the burst allowance is used up', async () => {
    const requests = stubHardcover([{ status: 200 }]);

    // getBooks is not batched, so each call is its own request.
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        new Hardcover().getBooks([900100 + i])
      )
    );

    const start = requests[0].at;
    assert.ok(requests[9].at - start < 500, 'first 10 should go out together');
    assert.ok(requests[10].at - start >= 900, '11th should wait for a refill');
    assert.ok(requests[11].at - start >= 1900, '12th should wait for two');
  });
});
