/**
 * Races a promise against a timeout. Use for external calls (AI SDKs, etc.)
 * that don't expose their own AbortSignal/timeout option, so a stalled
 * upstream call can't hang the request indefinitely.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
