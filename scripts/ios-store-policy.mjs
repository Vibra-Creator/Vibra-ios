export const playStoreAssetName = /(?:google[\s._-]*play|play[\s._-]*store)/i;
export const googleSiteVerificationAssetName = /^google[a-f0-9]{16,}\.html$/i;
export const googleSiteVerificationMetaTag =
  /<meta\b(?=[^>]*\bname\s*=\s*["']google-site-verification["'])[^>]*\/?>/gi;
export const forbiddenReference =
  /(?:google[\s._-]*play|play\.google\.com|play[\s._-]*store|google-site-verification)/i;

export function getAssetNameViolation(relativePath) {
  if (playStoreAssetName.test(relativePath)) {
    return "Google Play-specific asset name";
  }
  if (googleSiteVerificationAssetName.test(relativePath.split(/[\\/]/).at(-1) ?? "")) {
    return "non-user-facing Google site-verification asset";
  }
  return null;
}

export class StreamingReferenceScanner {
  asciiTail = Buffer.alloc(0);
  utf16Tail = Buffer.alloc(0);
  bytesRead = 0;
  found = false;

  push(chunk) {
    if (this.found || chunk.length === 0) return;

    const asciiBytes = Buffer.concat([this.asciiTail, chunk]);
    if (forbiddenReference.test(asciiBytes.toString("latin1"))) {
      this.found = true;
      return;
    }
    this.asciiTail = asciiBytes.subarray(-Math.min(1024, asciiBytes.length));

    const utf16Bytes = Buffer.concat([this.utf16Tail, chunk]);
    if (
      forbiddenReference.test(utf16Bytes.toString("utf16le")) ||
      forbiddenReference.test(decodeUtf16Be(utf16Bytes))
    ) {
      this.found = true;
      return;
    }

    let tailLength = Math.min(1024, utf16Bytes.length);
    const endOffset = this.bytesRead + chunk.length;
    if ((endOffset - tailLength) % 2 !== 0) tailLength -= 1;
    this.utf16Tail = utf16Bytes.subarray(-tailLength);
    this.bytesRead = endOffset;
  }
}

function decodeUtf16Be(buffer) {
  const evenLength = buffer.length - (buffer.length % 2);
  const swapped = Buffer.allocUnsafe(evenLength);
  for (let index = 0; index < evenLength; index += 2) {
    swapped[index] = buffer[index + 1];
    swapped[index + 1] = buffer[index];
  }
  return swapped.toString("utf16le");
}