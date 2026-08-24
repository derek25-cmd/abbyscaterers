import type { ZodSchema, ZodError } from 'zod';

/**
 * Thrown by service functions when data fails runtime Zod validation.
 * Callers can catch this to surface field-level errors without crashing.
 */
export class ServiceValidationError extends Error {
  public readonly issues: ZodError['issues'];

  constructor(issues: ZodError['issues']) {
    const summary = issues
      .map(i => `[${i.path.join('.') || 'root'}] ${i.message}`)
      .join(' | ');
    super(`Service validation failed: ${summary}`);
    this.name = 'ServiceValidationError';
    this.issues = issues;
  }
}

/**
 * Parse `data` through `schema` at runtime.
 * Throws ServiceValidationError with detailed field issues on failure.
 * Returns the fully-typed, coerced value on success.
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ServiceValidationError(result.error.issues);
  }
  return result.data;
}

/**
 * Converts any thrown error into a human-readable string safe to show in a toast.
 * ServiceValidationError messages are flattened to plain English field errors.
 */
export function getErrorDescription(err: unknown): string {
  if (err instanceof ServiceValidationError) {
    return err.issues.map(i => i.message).join('. ');
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred. Please try again.';
}
