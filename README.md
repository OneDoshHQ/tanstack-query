# @smithkit/tanstack-query

Thin wrapper around [`@tanstack/react-query`](https://tanstack.com/query) for typed GET/POST/PATCH/PUT/DELETE requests with global middleware, headers, pagination, and query-key tracking. Works in React and React Native.

## Install

```bash
yarn add @smithkit/tanstack-query @tanstack/react-query axios
# or
npm install @smithkit/tanstack-query @tanstack/react-query axios
# or
bun add @smithkit/tanstack-query @tanstack/react-query axios
```

Peer deps: `@tanstack/react-query` `^4.26.1`, `axios` `^1.3.4`, `react` `^16.8 || ^17 || ^18`. `react-native` is optional.

## Bootstrap

Configure once at app startup, before mounting `<QueryClientProvider>`:

```ts
import { QueryClient } from '@tanstack/react-query';
import { bootstrapQueryRequest } from '@smithkit/tanstack-query';

export const queryClient = new QueryClient();

// React web — reads REACT_APP_API_URL / NEXT_PUBLIC_API_URL from process.env
bootstrapQueryRequest(queryClient);

// React Native — explicit config (env-var pickup doesn't work in RN)
bootstrapQueryRequest(queryClient, {
  context: 'app',
  environments: {
    appBaseUrl: 'https://api.example.com',
    appTimeout: 30000,
  },
  modelConfig: {
    idColumn: 'id',
  },
  middleware: [authMiddleware], // optional — runs for every request, every method
});
```

Then:

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* your app */}
    </QueryClientProvider>
  );
}
```

## Response contract

Hooks assume the API returns:

```ts
interface IRequestSuccess<T> {
  statusCode: number;
  message: string;
  timeStamp: Date;
  status: boolean;
  data: T;
}

interface IRequestError {
  statusCode: number;
  message: string;
  timeStamp: Date;
  status: boolean;
  data?: any;
}
```

The hooks treat `status: false` as a rejection so it surfaces via tanstack-query's `error` channel.

## Headers

Set headers globally from any component (e.g. after login):

```ts
import { useQueryHeaders } from '@smithkit/tanstack-query';

const { headers, setQueryHeaders } = useQueryHeaders();

setQueryHeaders({ Authorization: `Bearer ${token}` });
```

Headers persist across requests until cleared with `setQueryHeaders(undefined)`.

## Hooks

### `useGetRequest({ path, load?, queryOptions?, keyTracker?, baseUrl?, headers?, paginationConfig? })`

```tsx
import { useGetRequest } from '@smithkit/tanstack-query';

const { data, isLoading, error, refetch, nextPage, prevPage, gotoPage } = useGetRequest({
  path: '/api/items',
  load: true,                          // false skips the initial fetch
  keyTracker: 'items',                 // optional — looked up by useKeyTrackerModel
  queryOptions: { staleTime: 10_000 }, // forwarded to tanstack useQuery
});
```

Returns the full tanstack-query result plus:

| Property | Type | What it does |
|---|---|---|
| `refetch` | `() => Promise` | **Stable reference** — safe to put in `useEffect` / `useFocusEffect` dep arrays. |
| `setRequestPath` | `(path: string) => void` | Change the path without recreating the hook. |
| `get` | `(path, opts?) => Promise` | One-shot fetch (`fetchQuery`) without subscribing. |
| `nextPage` / `prevPage` / `gotoPage` | `() => void` | Pagination navigation. |
| `page` | `number` | Current page. |
| `getPaginationData` | `() => pagination \| undefined` | Pull the `pagination` object from the last response. |
| `queryKey` | `[path, {}]` | The internal query key. |

### `useGetInfiniteRequest({ path, ... })`

Infinite-scroll variant. Same shape as `useGetRequest` but adds `fetchNextPage` / `fetchPreviousPage` / `hasNextPage` / `hasPreviousPage` from `useInfiniteQuery`. `refetch` is also reference-stable.

### `usePostRequest({ path, isFormData? })`

```tsx
import { usePostRequest } from '@smithkit/tanstack-query';

const { post, isPending, error } = usePostRequest({ path: '/api/items' });

const onSubmit = async (body: ItemInput) => {
  const res = await post(body);
};
```

Set `isFormData: true` to wrap the body in `FormData`. Returns the full tanstack `useMutation` result plus a typed `post(body)` function.

### `usePatchRequest({ path })` / `usePutRequest({ path })` / `useDeleteRequest()`

Same shape as `usePostRequest`. `useDeleteRequest` takes no params and exposes `destroy(path)` so the path is given per-call:

```tsx
const { destroy, isPending } = useDeleteRequest();
await destroy('/api/items/42');
```

### `useRefetchQuery(queryKey)`

Thin wrapper around `queryClient.refetchQueries` that returns a typed `refetchQuery<T>()`:

```ts
const { refetchQuery } = useRefetchQuery(['my-key']);
const result = await refetchQuery<MyData>();
```

### `useKeyTrackerModel<T>(keyTracker)`

Resolves the internal query key tracked by a string `keyTracker` (the same one passed to `useGetRequest`). Useful when one component needs to read or refetch a query owned by another:

```ts
const { queryKey, data, refetchQuery } = useKeyTrackerModel<Item[]>('items');
```

## Middleware

Pass an array of middleware functions to `bootstrapQueryRequest` to run logic around every request. Useful for auth, retry-on-401, telemetry.

```ts
import type { MiddlewareFunction } from '@smithkit/tanstack-query';

const authMiddleware: MiddlewareFunction = async (context, next) => {
  const token = getAuthToken();
  const headers = {
    ...(context.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let res = await next({ headers });

  if (res?.statusCode === 401) {
    await refreshTokenInline();
    res = await next({
      headers: { ...headers, Authorization: `Bearer ${getAuthToken()}` },
    });
  }

  return res;
};

bootstrapQueryRequest(queryClient, {
  context: 'app',
  environments: { appBaseUrl, appTimeout: 30_000 },
  middleware: [authMiddleware],
});
```

Middleware runs for **every** HTTP method (GET, POST, PATCH, PUT, DELETE).

## Development

```bash
yarn install
yarn build      # rollup → dist/
yarn test       # jest
```

`yarn build` produces both ESM (`dist/index.mjs`) and per-module CJS (`dist/src/...`) outputs.

## Releasing a new version

Releases are driven by GitHub Releases. The `release.yml` workflow runs on every published release, verifies the tag matches `package.json`, builds, tests, and publishes to npm.

1. **Bump the version** in `package.json`:
   - patch (`0.1.0` → `0.1.1`) for bug fixes
   - minor (`0.1.0` → `0.2.0`) for backward-compatible features
   - major (`0.1.0` → `1.0.0`) for breaking changes
2. **Commit and push** to `main`:
   ```bash
   git commit -am "chore: bump 0.1.1"
   git push origin main
   ```
3. **Create a release** with a tag of the form `vX.Y.Z` (the leading `v` is stripped before the version-match check):
   - Via the GitHub UI: *Releases → Draft a new release → tag* `v0.1.1` *→ Publish release*
   - Via CLI:
     ```bash
     gh release create v0.1.1 --target main --title v0.1.1 --notes "..."
     ```

The workflow takes ~30s. If the tag doesn't match `package.json`, the *Verify package.json version matches tag* step fails before any publish runs, so you can fix and retry.

## License

[MIT](LICENSE).
