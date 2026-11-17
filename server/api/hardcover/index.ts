import ExternalAPI from '@server/api/externalapi';
import {
  AUTHOR,
  BOOK,
  BOOK_RESULT,
  SERIES,
  VALID_BOOK_HEADERS,
} from '@server/api/hardcover/constants';
import cacheManager from '@server/lib/cache';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import type { AxiosError, AxiosRequestConfig } from 'axios';

import type {
  AuthorByPKResponse,
  BookByPKResponse,
  BookResponse,
  Books,
  BookTrendingResponse,
  HardcoverAuthorDetails,
  HardcoverAuthorResult,
  HardcoverBookDetails,
  HardcoverBookResult,
  HardcoverSearchHit,
  HardcoverSearchMultiResponse,
  HardcoverSearchResponse,
  HardcoverSeries,
  SeriesByPKResponse,
  Tags,
} from './interfaces';

interface DiscoverBookOptions {
  page?: number;
}

interface SearchOptions {
  query?: string;
  page?: number;
}

// Hardcover rate limits per API token, but each `new Hardcover()` gets its own
// axios instance, so throttling has to live at module level to be shared.
const MIN_REQUEST_INTERVAL_MS = 250;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 10000;
const RETRYABLE_STATUSES = [429, 502, 503, 504];

let nextRequestSlot = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Reserves the next free slot synchronously, so concurrent callers queue up
// in order, then waits for it.
const waitForRequestSlot = async (): Promise<void> => {
  const now = Date.now();
  const slot = Math.max(now, nextRequestSlot);
  nextRequestSlot = slot + MIN_REQUEST_INTERVAL_MS;
  if (slot > now) {
    await sleep(slot - now);
  }
};

// Delays every queued request, not just the one that was rejected.
const pauseRequests = (ms: number): void => {
  nextRequestSlot = Math.max(nextRequestSlot, Date.now() + ms);
};

const getRetryDelay = (error: AxiosError, attempt: number): number => {
  const retryAfter = Number(error.response?.headers?.['retry-after']);
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(retryAfter * 1000, MAX_RETRY_DELAY_MS);
  }
  const backoff = RETRY_BASE_DELAY_MS * 2 ** attempt;
  return Math.min(backoff + Math.random() * 250, MAX_RETRY_DELAY_MS);
};

type RetryableRequestConfig = AxiosRequestConfig & {
  hardcoverRetries?: number;
};

export const getHeader = (tags: Tags): string | null => {
  if (!tags.Genre?.length) {
    return null;
  }

  for (const genre of tags.Genre) {
    if (genre.tagSlug && VALID_BOOK_HEADERS.includes(genre.tagSlug)) {
      return genre.tagSlug;
    }
  }

  return null;
};

class Hardcover extends ExternalAPI {
  constructor() {
    const token = getSettings().main.hardcoverapikey;
    super(
      'https://api.hardcover.app/v1/graphql',
      {},
      {
        nodeCache: cacheManager.getCache('hardcover').data,
        headers: {
          authorization: `Bearer ${token}`,
        },
      }
    );

    this.axios.interceptors.request.use(async (config) => {
      await waitForRequestSlot();
      return config;
    });
    this.axios.interceptors.response.use(
      undefined,
      async (error: AxiosError) => {
        const config = error.config as RetryableRequestConfig | undefined;
        const status = error.response?.status;
        if (!config || !status || !RETRYABLE_STATUSES.includes(status)) {
          throw error;
        }

        const attempt = config.hardcoverRetries ?? 0;
        if (attempt >= MAX_RETRIES) {
          logger.warn('Hardcover request failed after retries', {
            label: 'Hardcover',
            status,
            attempts: attempt + 1,
          });
          throw error;
        }

        const delay = getRetryDelay(error, attempt);
        logger.debug('Hardcover request rejected, retrying', {
          label: 'Hardcover',
          status,
          attempt: attempt + 1,
          delayMs: Math.round(delay),
        });
        pauseRequests(delay);
        config.hardcoverRetries = attempt + 1;
        return this.axios.request(config);
      }
    );
  }

  private getTrendingBooks = async (offset = 0): Promise<number[]> => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fromDate = thirtyDaysAgo.toISOString().split('T')[0];
      const toDate = new Date().toISOString().split('T')[0];

      const data = await this.post<BookTrendingResponse>('/', {
        query: `
          query Books_trending($fromDate: date!, $toDate: date!, $offset: Int!) {
            books_trending(from: $fromDate, to: $toDate, offset: $offset, limit: 50) {
              ids
            }
          }
        `,
        variables: {
          fromDate,
          toDate,
          offset,
        },
      });

      if (!data || !data.data || !data.data.books_trending) {
        throw new Error(
          `Invalid API response structure: ${JSON.stringify(data)}`
        );
      }

      const bookIds = data.data.books_trending.ids;

      if (!Array.isArray(bookIds)) {
        throw new Error(
          `Expected books_trending.ids to be an array, got: ${typeof bookIds}`
        );
      }

      return bookIds;
    } catch (error) {
      throw new Error(`Error fetching trending books: ${error.message}`);
    }
  };

  private createMultiSearchResults = (
    hits: HardcoverSearchHit[]
  ): (HardcoverBookResult | HardcoverAuthorResult)[] => {
    const results = [];
    const seenAuthors = new Set();

    for (const hit of hits) {
      for (const contrib of hit.document.contributions || []) {
        if (
          contrib.contribution === null &&
          contrib.author?.id &&
          !seenAuthors.has(contrib.author.id)
        ) {
          results.push({ ...contrib.author, media_type: 'author' });
          seenAuthors.add(contrib.author.id);
        }
      }

      if (!hit.document.compilation) {
        results.push({
          ...hit.document,
          id: +hit.document.id,
          media_type: 'book',
        });
      }
    }

    return results as (HardcoverBookResult | HardcoverAuthorResult)[];
  };

  public search = async ({
    query,
    page = 1,
  }: SearchOptions = {}): Promise<HardcoverSearchMultiResponse> => {
    try {
      const searchData = await this.post<HardcoverSearchResponse>('/', {
        query: `
          query Search($query: String!, $page: Int!) {
            search(
              query: $query
              page: $page
              per_page: 25
              query_type: "book"
              fields: "title,isbns,series_names,author_names,alternative_titles"
              weights: "5,1,3,5,1"
              sort: "ratings_count:desc,_text_match:desc"
            ) {
              results
            }
          }
        `,
        variables: {
          query: query,
          page: page,
        },
      });

      const hits = searchData.data.search.results.hits || [];

      const results = this.createMultiSearchResults(hits);

      const total_results = searchData.data.search.results.found || 0;
      const per_page = 25;

      return {
        results,
        page: page,
        total_results: total_results,
        total_pages: Math.ceil(total_results / per_page),
      };
    } catch (e) {
      throw new Error(
        `[HARDCOVER] Failed to fetch search results: ${e.message}`
      );
    }
  };

  public getDiscoverBooks = async ({
    page = 1,
  }: DiscoverBookOptions = {}): Promise<BookResponse> => {
    try {
      const offset = Math.floor((page - 1) * 50);

      const ids = await this.getTrendingBooks(offset);

      return {
        data: await this.getBooks(ids),
        page: page,
        total_results: 10000,
        total_pages: 200,
      };
    } catch (e) {
      throw new Error(
        `[HARDCOVER] Failed to fetch discover books: ${e.message}`
      );
    }
  };

  public getAuthor = async (
    authorId: number
  ): Promise<HardcoverAuthorDetails> => {
    try {
      const data = await this.post<AuthorByPKResponse>('/', {
        query: `
          query Authors_by_pk($authorId: Int!) {
            authors_by_pk(id: $authorId) {
              ${AUTHOR}
              contributions(
                where: {book: {book_status_id: {_eq: "1"}, compilation: {_eq: false}, default_physical_edition: {language_id: {_eq: 1}}}, _or: [{contribution: {_is_null: true}}, {contribution: {_nin: ["Narrator", "Translator", "Illustrator"]}}]}
                order_by: {book: {users_count: desc}}
              ) {
                id
                book {
                  ${BOOK_RESULT}
                }
              }
            }
          }
        `,
        variables: {
          authorId,
        },
      });

      return data.data.authors_by_pk;
    } catch (e) {
      throw new Error(
        `[HARDCOVER] Failed to fetch author details: ${e.message}`
      );
    }
  };

  public getBooks = async (bookIds: number[]): Promise<Books> => {
    try {
      const data = await this.post<BookResponse>('/', {
        query: `
          query Books($bookIds: [Int!]!) {
              books(where: { id: { _in: $bookIds } }) {
                  ${BOOK_RESULT}
              }
          }
        `,
        variables: {
          bookIds,
        },
      });

      const bookMap = new Map(data.data.books.map((book) => [book.id, book]));

      const orderedBooks = bookIds
        .map((id) => bookMap.get(id))
        .filter((book): book is HardcoverBookResult => book !== undefined);

      return { books: orderedBooks };
    } catch (e) {
      throw new Error(`[HARDCOVER] Failed to fetch book details: ${e.message}`);
    }
  };

  public getBook = async (bookId: number): Promise<HardcoverBookDetails> => {
    try {
      const data = await this.post<BookByPKResponse>('/', {
        query: `
        query Books($bookId: Int!) {
          books_by_pk(id: $bookId ) {
            ${BOOK}
            contributions(order_by: {author: {users_count: desc}}, where: {_or: [{contribution: {_is_null: true}}, {contribution: {_nin: ["Narrator", "Translator", "Illustrator"]}}]}) {
              author {
                ${AUTHOR}
              }
            }
            book_series(order_by: {featured: desc}) {
              position
              series_id
              series {
                ${SERIES}
              }
            }
          }
        }
        `,
        variables: {
          bookId,
        },
      });

      return data.data.books_by_pk;
    } catch (e) {
      throw new Error(`[HARDCOVER] Failed to fetch book details: ${e.message}`);
    }
  };

  public getSeries = async (seriesId: number): Promise<HardcoverSeries> => {
    try {
      const data = await this.post<SeriesByPKResponse>('/', {
        query: `
          query Series($seriesId: Int!) {
            series_by_pk(id: $seriesId) {
              id
              name
              description
              primary_books_count
              books_count
              book_series(
                order_by: [{position: asc}, {book: {users_count: desc}}]
                distinct_on: position
                where: {book: {book_status_id: {_eq: "1"}, compilation: {_eq: false}, release_date: {_is_null: false}}, position: {_gt: "0"}}
              ) {
                series_id
                position
                book {
                  ${BOOK_RESULT}
                }
              }
            }
          }
        `,
        variables: {
          seriesId,
        },
      });

      return data.data.series_by_pk;
    } catch (e) {
      throw new Error(`[HARDCOVER] Failed to fetch book details: ${e.message}`);
    }
  };
}

export default Hardcover;
