/**
 * Minimal, dependency-free request validation helpers. Each throws
 * ValidationError on bad input; call sites catch it and return HTTP 400.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Required non-empty string, trimmed, with a max length. */
export function reqString(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") throw new ValidationError(`${field} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new ValidationError(`${field} is required`);
  if (trimmed.length > max) throw new ValidationError(`${field} must be at most ${max} characters`);
  return trimmed;
}

/** Optional string → trimmed value, or undefined when absent/empty. */
export function optString(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return reqString(value, field, max);
}

/** Optional array of strings with item-count and per-item length caps. */
export function optStringArray(
  value: unknown,
  field: string,
  maxItems: number,
  maxItemLen: number
): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ValidationError(`${field} must be an array`);
  if (value.length > maxItems) throw new ValidationError(`${field} may contain at most ${maxItems} items`);
  return value.map((item, i) => reqString(item, `${field}[${i}]`, maxItemLen));
}

/** Required value that must be one of `allowed`. */
export function reqEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

/** A plausibly-valid email address (also length-capped). */
export function reqEmail(value: unknown, field: string): string {
  const email = reqString(value, field, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError(`${field} must be a valid email address`);
  }
  return email.toLowerCase();
}
