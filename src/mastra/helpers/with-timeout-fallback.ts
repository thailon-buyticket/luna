/**
 * Runs `task`, falling back to `fallback()` if it rejects or doesn't settle within `timeoutMs`.
 * On timeout the underlying `task` keeps running in the background (it isn't aborted) — its
 * result/error is simply ignored once the fallback has already been returned.
 */
export async function withTimeoutFallback<T>(task: () => Promise<T>, fallback: () => T, timeoutMs: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([task(), timeout]);
  } catch {
    return fallback();
  }
}
