export function basicAuthHeader(credentials: string): string {
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

export async function fetchOrThrow(input: string, init: RequestInit, label: string): Promise<Response> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}: ${await response.text()}`);
  }
  return response;
}
