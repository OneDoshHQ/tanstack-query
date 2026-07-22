import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import type { ReactNode } from 'react';
import React from 'react';
import { useDeleteRequest, usePatchRequest, usePostRequest, usePutRequest } from '../../queries';

const mockAxios = new MockAdapter(axios);

/**
 * Per-request options (`requestConfig`) must reach the outgoing request for
 * every mutation verb — e.g. attaching one-off auth headers to a single call.
 * usePostRequest supported this from the start; usePatchRequest/usePutRequest/
 * useDeleteRequest silently dropped it (headers never sent), which is the
 * regression these tests pin down.
 */
describe('requestConfig forwarding', () => {
  const path = '/test';
  const body = { name: 'John Doe' };
  const response = { id: 123 };
  const perRequestHeaders = { 'X-Custom-Factor': 'abc123' };

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    mockAxios.reset();
  });

  it('forwards requestConfig headers on post', async () => {
    mockAxios.onPost(path).reply(200, response);
    const { result } = renderHook(() => usePostRequest<typeof response>({ path }), { wrapper });

    await act(async () => {
      await result.current.post(body, { requestConfig: { headers: perRequestHeaders } });
    });

    expect(mockAxios.history.post).toHaveLength(1);
    expect(mockAxios.history.post[0].headers).toMatchObject(perRequestHeaders);
    expect(JSON.parse(mockAxios.history.post[0].data)).toEqual(body);
  });

  it('forwards requestConfig headers on patch', async () => {
    mockAxios.onPatch(path).reply(200, response);
    const { result } = renderHook(() => usePatchRequest<typeof response>({ path }), { wrapper });

    await act(async () => {
      await result.current.patch(body, { requestConfig: { headers: perRequestHeaders } });
    });

    expect(mockAxios.history.patch).toHaveLength(1);
    expect(mockAxios.history.patch[0].headers).toMatchObject(perRequestHeaders);
    expect(JSON.parse(mockAxios.history.patch[0].data)).toEqual(body);
  });

  it('forwards requestConfig headers on put', async () => {
    mockAxios.onPut(path).reply(200, response);
    const { result } = renderHook(() => usePutRequest<typeof response>({ path }), { wrapper });

    await act(async () => {
      await result.current.put(body, { requestConfig: { headers: perRequestHeaders } });
    });

    expect(mockAxios.history.put).toHaveLength(1);
    expect(mockAxios.history.put[0].headers).toMatchObject(perRequestHeaders);
    expect(JSON.parse(mockAxios.history.put[0].data)).toEqual(body);
  });

  it('forwards requestConfig headers on delete', async () => {
    mockAxios.onDelete(path).reply(200, response);
    const { result } = renderHook(() => useDeleteRequest<typeof response>(), { wrapper });

    await act(async () => {
      await result.current.destroy(path, { requestConfig: { headers: perRequestHeaders } });
    });

    expect(mockAxios.history.delete).toHaveLength(1);
    expect(mockAxios.history.delete[0].headers).toMatchObject(perRequestHeaders);
  });

  it('never lets requestConfig override the request body', async () => {
    mockAxios.onPatch(path).reply(200, response);
    const { result } = renderHook(() => usePatchRequest<typeof response>({ path }), { wrapper });

    await act(async () => {
      await result.current.patch(body, {
        requestConfig: { body: { hijacked: true }, headers: perRequestHeaders } as any,
      });
    });

    expect(JSON.parse(mockAxios.history.patch[0].data)).toEqual(body);
  });

  it('still sends requests without requestConfig (backward compatible)', async () => {
    mockAxios.onPatch(path).reply(200, response);
    const { result } = renderHook(() => usePatchRequest<typeof response>({ path }), { wrapper });

    await act(async () => {
      await result.current.patch(body);
    });

    expect(mockAxios.history.patch).toHaveLength(1);
    expect(JSON.parse(mockAxios.history.patch[0].data)).toEqual(body);
  });
});
