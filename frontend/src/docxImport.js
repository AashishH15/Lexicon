import mammoth from "mammoth";

// Lazy-loaded DOCX → HTML conversion (mammoth, BSD-2-Clause).
// Policy: w:ins content is kept, w:del content is dropped (mammoth default),
// so tracked suggestions import as their final accepted text.

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIG = [0xff, 0xd8, 0xff];
const GIF_SIG = [0x47, 0x49, 0x46, 0x38];
const BMP_SIG = [0x42, 0x4d];
const WEBP_SIG = [0x52, 0x49, 0x46, 0x46]; // "RIFF" ... "WEBP"

function hasSignature(bytes, offset, sig) {
  for (let i = 0; i < sig.length; i += 1) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

// Browsers cannot render EMF/WMF (Word's vector fallback pair) and mammoth
// resolves unknown extensions to a null content type, so trust the bytes,
// not the docx's declared content types.
function sniffImageMime(bytes) {
  if (bytes.length >= 8 && hasSignature(bytes, 0, PNG_SIG)) return "image/png";
  if (bytes.length >= 3 && hasSignature(bytes, 0, JPEG_SIG))
    return "image/jpeg";
  if (
    bytes.length >= 6 &&
    hasSignature(bytes, 0, GIF_SIG) &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    hasSignature(bytes, 0, WEBP_SIG) &&
    hasSignature(bytes, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }
  if (bytes.length >= 2 && hasSignature(bytes, 0, BMP_SIG)) return "image/bmp";
  return null;
}

function sniffImageMimeFromBase64(base64) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return sniffImageMime(bytes);
}

// Drop <img> elements without a src (e.g. EMF/WMF blips we chose not to
// embed) so the HTML is directly feedable to the editor schema.
function stripSrcLessImages(html) {
  return html.replace(/<img(?![^>]*\bsrc=)[^>]*\/?>/gi, "");
}

export async function docxToHtml(arrayBuffer) {
  const result = await mammoth.convertToHtml(
    // browser build reads `arrayBuffer`; the node build reads `buffer`
    { arrayBuffer, buffer: arrayBuffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        // "base64" is the only read mode supported by both mammoth builds
        const base64 = await image.read("base64");
        const mime = sniffImageMimeFromBase64(base64);
        if (!mime) return {};
        return { src: `data:${mime};base64,${base64}` };
      }),
      ignoreEmptyParagraphs: false,
    }
  );
  return { html: stripSrcLessImages(result.value) };
}
