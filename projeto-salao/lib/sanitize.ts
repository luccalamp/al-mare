/* eslint-disable @typescript-eslint/no-explicit-any */
import DOMPurify from 'dompurify';

/**
 * Sanitizes a string input to prevent XSS attacks.
 * It is safe to use in a browser context (Next.js client components).
 */
export function sanitize(input: string | undefined | null): string {
  if (typeof input !== 'string') return '';
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // Strip all HTML tags
    ALLOWED_ATTR: [],
  });
}

/**
 * Recursively sanitizes strings inside an object or array.
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitize(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const sanitizedObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitizedObj[key] = sanitizeObject((obj as any)[key]);
      }
    }
    return sanitizedObj as T;
  }

  return obj;
}
