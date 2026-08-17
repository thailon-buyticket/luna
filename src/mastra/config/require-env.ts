export function requireEnv<K extends string>(
  values: Record<K, string | undefined>,
  serviceName: string,
): Record<K, string> {
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`${serviceName} is not configured. Set ${missing.join(', ')} in .env before using it.`);
  }

  return values as Record<K, string>;
}
