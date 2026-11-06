/**
 * Accept only the JSON media type, optionally followed by parameters.
 * Substring checks would incorrectly accept values such as application/jsonp.
 */
export function isJsonContentType(value: string | null): boolean {
  if (!value) return false;
  const mediaType = value.split(";", 1)[0].trim().toLowerCase();
  return mediaType === "application/json";
}
