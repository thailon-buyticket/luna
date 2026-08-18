import type { ContextWithMastra } from '@mastra/core/server';
import type { z, ZodType } from 'zod';

/**
 * Validates `data` against `schema`; returns the ready-to-send 400 response on failure,
 * or the parsed data on success. Callers must check `instanceof Response` before using the result.
 */
export function parseOrBadRequest<S extends ZodType>(schema: S, data: unknown, c: ContextWithMastra): z.infer<S> | Response {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400);
  }
  return parsed.data;
}
