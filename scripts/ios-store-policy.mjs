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

export function isRasterImageHeader(header) {
  if (header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return true;
  }
  if (
    header.length >= 3 &&
    header[0] === 0xff &&
    header[1] === 0xd8 &&
    header[2] === 0xff
  ) {
    return true;
  }
  if (
    header.length >= 6 &&
    ["GIF87a", "GIF89a"].includes(header.subarray(0, 6).toString("ascii"))
  ) {
    return true;
  }
  if (
    header.length >= 12 &&
    header.subarray(0, 4).toString("ascii") === "RIFF" &&
    header.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return true;
  }
  if (header.length >= 2 && header[0] === 0x42 && header[1] === 0x4d) return true;
  if (
    header.length >= 4 &&
    (header.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) ||
      header.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a])))
  ) {
    return true;
  }
  if (
    header.length >= 12 &&
    header.subarray(4, 8).toString("ascii") === "ftyp" &&
    /^(?:avif|avis|heic|heix|hevc|mif1)$/.test(header.subarray(8, 12).toString("ascii"))
  ) {
    return true;
  }
  return false;
}

export class RasterImageReviewScanner {
  header = Buffer.alloc(0);
  found = false;

  push(chunk) {
    if (this.found || chunk.length === 0) return;
    const remaining = 16 - this.header.length;
    if (remaining <= 0) return;
    this.header = Buffer.concat([this.header, chunk.subarray(0, remaining)]);
    this.found = isRasterImageHeader(this.header);
  }
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