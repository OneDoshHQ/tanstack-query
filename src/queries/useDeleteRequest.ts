import type { MutateOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useStore } from '@tanstack/react-store';
import { useEffect, useMemo, useState } from 'react';
import { useEnvironmentVariables } from '../config';
import { bootStore } from '../config/bootStore';
import type { IMakeRequest, IRequestError, IRequestSuccess } from '../request';
import { HttpMethod, makeRequest } from '../request';
import { executeMiddlewareChain } from '../request/make-request';
import { useHeaderStore, usePauseFutureRequests } from '../stores';
import type { MiddlewareContext, MiddlewareNext } from '../types';
import type { DefaultRequestOptions } from './queries.interface';

export const useDeleteRequest = <TResponse>(deleteOptions?: DefaultRequestOptions) => {
  const { baseUrl, headers } = deleteOptions ?? {};

  const { middleware, headerProvider } = useStore(bootStore);
  const [requestPayload, setRequestPayload] = useState<{ path: string; options?: any }>();

  const isFutureMutationsPaused = usePauseFutureRequests((state) => state.isFutureMutationsPaused);

  const { API_URL, TIMEOUT } = useEnvironmentVariables();

  const storeHeaders = useHeaderStore((state) => state.headers);

  const globalHeaders = useMemo(() => {
    const providerHeaders = headerProvider ? headerProvider() : undefined;
    return { ...providerHeaders, ...storeHeaders };
  }, [storeHeaders, headerProvider]);

  const sendRequest = async (
    path: string,
    requestConfig?: Partial<IMakeRequest>
  ): Promise<IRequestSuccess<TResponse>> => {
    delete requestConfig?.body;

    const requestOptions = {
      path,
      headers: { ...globalHeaders, ...headers },
      baseURL: baseUrl ?? API_URL,
      method: HttpMethod.DELETE,
      timeout: TIMEOUT,
      ...requestConfig,
    };

    const finalHandler: MiddlewareNext<TResponse> = async (options) => {
      const finalOptions = options ? { ...requestOptions, ...options } : requestOptions;
      return await makeRequest<TResponse>(finalOptions);
    };

    let deleteResponse: IRequestError | IRequestSuccess<TResponse>;

    if (middleware && Array.isArray(middleware) && middleware.length > 0) {
      const context: MiddlewareContext<TResponse> = {
        baseUrl: baseUrl ?? API_URL,
        path,
        method: HttpMethod.DELETE,
        headers: requestOptions.headers,
        options: requestOptions,
      };
      deleteResponse = await executeMiddlewareChain<TResponse>(middleware, context, finalHandler);
    } else {
      deleteResponse = await makeRequest<TResponse>(requestOptions);
    }

    if (deleteResponse.status) {
      return deleteResponse as IRequestSuccess<TResponse>;
    } else {
      throw deleteResponse;
    }
  };

  const mutation = useMutation<
    IRequestSuccess<TResponse>,
    IRequestError,
    { path: string; requestConfig?: Partial<Omit<IMakeRequest, 'body'>> }
  >({
    mutationFn: async ({ path, requestConfig }) => sendRequest(path, requestConfig),
  });

  const destroy = async (
    path: string,
    options?: (
      | MutateOptions<
          IRequestSuccess<TResponse>,
          IRequestError,
          { path: string; requestConfig?: Partial<Omit<IMakeRequest, 'body'>> },
          unknown
        >
      | { requestConfig?: Partial<Omit<IMakeRequest, 'body'>> }
      | undefined
    ) & { requestConfig?: Partial<Omit<IMakeRequest, 'body'>> }
  ): Promise<IRequestSuccess<TResponse> | undefined> => {
    if (!isFutureMutationsPaused) {
      const { requestConfig, ...otherOptions } = options ?? {};
      return mutation.mutateAsync({ path, requestConfig }, otherOptions);
    } else {
      setRequestPayload({ path, options });
      return undefined;
    }
  };

  useEffect(() => {
    if (!isFutureMutationsPaused && requestPayload) {
      destroy(requestPayload.path, requestPayload.options);
      setRequestPayload(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFutureMutationsPaused]);

  return {
    destroy,
    ...mutation,
    isLoading: mutation.isPending || isFutureMutationsPaused,
    isInitialLoading: false,
    //@deprecated
    isFetching: mutation.isPending,
  };
};
