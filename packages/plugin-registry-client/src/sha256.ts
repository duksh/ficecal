// ─── SHA-256 Utilities ─────────────────────────────────────────────────────────
//
// Uses the Web Crypto API (available in browsers, Node.js 18+, Deno, Cloudflare
// Workers, and all modern runtimes). Zero dependencies.

/**
 * Computes the SHA-256 digest of an ArrayBuffer and returns the result as a
 * lowercase hex string.
 *
 * @param buffer - Raw bytes to hash
 * @returns Hex-encoded SHA-256 digest (64 characters)
 */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return bufferToHex(digest);
}

/**
 * Verifies that an ArrayBuffer's SHA-256 digest matches the expected hex string.
 *
 * @param buffer   - Raw bytes to hash
 * @param expected - Expected lowercase hex digest (64 characters)
 * @returns true if the digest matches, false otherwise
 */
export async function verifySha256(buffer: ArrayBuffer, expected: string): Promise<boolean> {
  const actual = await sha256Hex(buffer);
  // Constant-time comparison is not critical here (this is a content integrity
  // check, not an authentication MAC), but we normalise case to be safe.
  return actual.toLowerCase() === expected.toLowerCase();
}

/**
 * Converts an ArrayBuffer to a lowercase hexadecimal string.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Returns true if the string looks like a valid lowercase SHA-256 hex digest
 * (exactly 64 hexadecimal characters).
 */
export function isValidSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}
