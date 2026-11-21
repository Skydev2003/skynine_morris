export function googleAvatarUrl(photo: unknown) {
  if (typeof photo !== "string") return undefined;
  try {
    const url = new URL(photo);
    if (url.protocol === "https:" && /(^|\.)googleusercontent\.com$/.test(url.hostname) &&
      !url.username && !url.password && !url.port) return url.href;
  } catch {
    return undefined;
  }
}
