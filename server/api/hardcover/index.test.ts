import Hardcover from '@server/api/hardcover';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { AxiosError } from 'axios';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

type Reply = { status: number; headers?: Record<string, string> };

class TestHardcover extends Hardcover {
  public calls: number[] = [];

  public stub(replies: Reply[]) {
    let i = 0;
    this.axios.defaults.adapter = (config: InternalAxiosRequestConfig) => {
      this.calls.push(Date.now());
      const reply = replies[Math.min(i++, replies.length - 1)];
      const response = {
        data: { data: { books_by_pk: { id: 1 } } },
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
  }
}

describe('Hardcover client', () => {
  it('retries a 429 and returns the eventual response', async () => {
    const api = new TestHardcover();
    api.stub([
      { status: 429, headers: { 'retry-after': '0' } },
      { status: 429, headers: { 'retry-after': '0' } },
      { status: 200 },
    ]);

    const book = await api.getBook(900001);

    assert.equal(book.id, 1);
    assert.equal(api.calls.length, 3);
  });

  it('gives up after the retry limit and surfaces the 429', async () => {
    const api = new TestHardcover();
    api.stub([{ status: 429, headers: { 'retry-after': '0' } }]);

    await assert.rejects(api.getBook(900002), /status code 429/);
    assert.equal(api.calls.length, 4);
  });

  it('does not retry client errors other than 429', async () => {
    const api = new TestHardcover();
    api.stub([{ status: 401 }]);

    await assert.rejects(api.getBook(900003), /status code 401/);
    assert.equal(api.calls.length, 1);
  });

  it('spaces out concurrent requests across separate instances', async () => {
    const apis = Array.from({ length: 4 }, () => new TestHardcover());
    apis.forEach((api) => api.stub([{ status: 200 }]));

    await Promise.all(apis.map((api, i) => api.getBook(900010 + i)));

    const starts = apis.map((api) => api.calls[0]).sort((a, b) => a - b);
    for (let i = 1; i < starts.length; i++) {
      assert.ok(
        starts[i] - starts[i - 1] >= 200,
        `request ${i} started ${starts[i] - starts[i - 1]}ms after the previous one`
      );
    }
  });
});
