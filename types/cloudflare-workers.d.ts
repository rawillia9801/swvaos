declare module "cloudflare:workers" {
  export const env: {
    DB: {
      prepare: (query: string) => {
        bind: (...values: unknown[]) => {
          all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
          first: <T = Record<string, unknown>>() => Promise<T | null>;
          run: () => Promise<unknown>;
        };
        all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
        first: <T = Record<string, unknown>>() => Promise<T | null>;
        run: () => Promise<unknown>;
      };
      batch: (statements: unknown[]) => Promise<unknown>;
    };
    DOCUMENTS: {
      put: (key: string, value: ReadableStream, options?: unknown) => Promise<unknown>;
      delete: (key: string) => Promise<unknown>;
      get: (key: string) => Promise<{
        body: ReadableStream;
        writeHttpMetadata: (headers: Headers) => void;
      } | null>;
    };
  };
}

type D1Database = unknown;
type R2Bucket = unknown;
type Fetcher = { fetch: typeof fetch };
