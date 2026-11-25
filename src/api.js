const unavailable =
  "The museum server is unavailable. Please retry in a moment. If this keeps happening, open the live museum server URL, not a static site preview.";

// Hosts and proxies can return a plain-text/HTML error page, even for /api URLs.
// Never pass those pages straight to response.json() or expose their contents.
export async function requestJson(url, options = {}, expected = "museum") {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: { Accept: "application/json", ...options.headers },
    });
  } catch {
    throw new Error(
      "Could not connect to the museum server. Check your connection and try again.",
    );
  }
  if (response.status === 413)
    throw new Error(
      "The upload is too large for this host. Try smaller files (up to 50 MB each).",
    );
  let data;
  try {
    const text = await response.text();
    data = JSON.parse(text);
  } catch {
    throw new Error(unavailable);
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error(unavailable);
  if (!response.ok)
    throw new Error(typeof data.error === "string" ? data.error : unavailable);
  const valid =
    expected === "upload"
      ? Array.isArray(data.files) &&
        data.files.every((file) => typeof file?.url === "string")
      : typeof data.id === "string" &&
        typeof data.title === "string" &&
        Array.isArray(data.photos) &&
        data.photos.length >= 6 &&
        data.photos.every((photo) => typeof photo === "string");
  if (!valid) throw new Error(unavailable);
  return data;
}
