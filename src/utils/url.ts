const SAFE_PROTOCOLS = ['https:', 'http:'];

export function isSafeUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return SAFE_PROTOCOLS.includes(new URL(url).protocol);
  } catch {
    return false;
  }
}
