/**
 * Returns a safe error message for API responses.
 * In production, returns a generic message to avoid leaking internals.
 * In development, returns the original error message for debugging.
 */
export function safeErrorMessage(error: unknown, fallback = "Ocorreu um erro inesperado."): string {
  if (process.env.NODE_ENV !== "production") {
    return error instanceof Error ? error.message : fallback;
  }
  return fallback;
}
