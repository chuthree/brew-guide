type FetchWithTimeoutOptions = RequestInit & {
  timeoutMs?: number;
};

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The request was aborted', 'AbortError');
  }

  const error = new Error('The request was aborted');
  error.name = 'AbortError';
  return error;
}

function createTimeoutError(timeoutMs: number): Error {
  const seconds = Math.ceil(timeoutMs / 1000);
  if (typeof DOMException !== 'undefined') {
    return new DOMException(
      `Request timed out after ${seconds}s`,
      'TimeoutError'
    );
  }

  const error = new Error(`Request timed out after ${seconds}s`);
  error.name = 'TimeoutError';
  return error;
}

export function isAbortLikeError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

export function isTimeoutError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'TimeoutError';
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs, signal: upstreamSignal, ...requestInit } = init;
  const requestInitWithSignal = {
    ...requestInit,
    signal: upstreamSignal,
  };

  if (!timeoutMs || timeoutMs <= 0) {
    return fetch(input, requestInitWithSignal);
  }

  if (typeof AbortController === 'undefined') {
    return new Promise<Response>((resolve, reject) => {
      let settled = false;

      const finalize = (callback: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        upstreamSignal?.removeEventListener('abort', handleAbort);
        clearTimeout(timeoutId);
        callback();
      };

      const handleAbort = () => {
        finalize(() => reject(createAbortError()));
      };

      const timeoutId = setTimeout(() => {
        finalize(() => reject(createTimeoutError(timeoutMs)));
      }, timeoutMs);

      if (upstreamSignal?.aborted) {
        handleAbort();
        return;
      }

      upstreamSignal?.addEventListener('abort', handleAbort, { once: true });

      fetch(input, requestInitWithSignal).then(
        response => finalize(() => resolve(response)),
        error => finalize(() => reject(error))
      );
    });
  }

  const controller = new AbortController();
  let didTimeout = false;

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  const forwardAbort = () => controller.abort();

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      clearTimeout(timeoutId);
      controller.abort();
      return fetch(input, { ...requestInit, signal: controller.signal });
    }

    upstreamSignal.addEventListener('abort', forwardAbort, { once: true });
  }

  try {
    return await fetch(input, {
      ...requestInit,
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout && isAbortLikeError(error)) {
      throw createTimeoutError(timeoutMs);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    upstreamSignal?.removeEventListener('abort', forwardAbort);
  }
}
