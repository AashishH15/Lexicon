import JSZip from "jszip";

const MIMETYPE = "application/epub+zip";

const DEFAULT_CSS = `body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.6; margin: 5%; }
h1, h2, h3, h4 { font-family: inherit; line-height: 1.25; page-break-after: avoid; }
blockquote { margin: 1em 2em; font-style: italic; }
code, pre { font-family: 'Courier New', Courier, monospace; font-size: 0.9em; }
pre { white-space: pre-wrap; }
table { border-collapse: collapse; width: 100%; }
td, th { border: 1px solid #999; padding: 4px 8px; text-align: left; }
hr { border: none; border-top: 1px solid #999; margin: 1.5em 0; }
img { max-width: 100%; }
ul[class~="task-list"], ol[class~="task-list"] { list-style: none; margin-left: 0; padding-left: 1.5em; }
.math-block { text-align: center; margin: 1em 0; font-style: italic; }`;

// Serializes the editor's HTML body fragment into well-formed XHTML markup
// (self-closing void tags, escaped text) via DOMParser + XMLSerializer.
function htmlBodyToXhtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;

  // Replace KaTeX math nodes with their LaTeX source so nothing is lost in
  // readers that cannot render KaTeX. Inline math stays inline; block math
  // becomes a centered block.
  body.querySelectorAll('[data-type="inline-math"]').forEach((el) => {
    const latex = el.getAttribute("data-latex") || "";
    const span = doc.createElement("span");
    span.setAttribute("class", "math-inline");
    span.textContent = `\\(${latex}\\)`;
    el.replaceWith(span);
  });
  body.querySelectorAll('[data-type="block-math"]').forEach((el) => {
    const latex = el.getAttribute("data-latex") || "";
    const div = doc.createElement("div");
    div.setAttribute("class", "math-block");
    div.textContent = `\\[${latex}\\]`;
    el.replaceWith(div);
  });

  // Drop TipTap-specific data-* attributes (they are meaningless to readers);
  // classes and inline styles are preserved as-is.
  body.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (attr.name.startsWith("data-")) el.removeAttribute(attr.name);
    });
  });

  // Serialize the whole <body> subtree (children inherit its single xmlns
  // declaration, so no per-element xmlns noise) and drop the wrapper tags —
  // serializing child nodes individually would emit redundant xmlns on each,
  // and keeping the <body> wrapper would nest a second body in the chapter.
  return new XMLSerializer()
    .serializeToString(body)
    .replace(/^<body[^>]*>/, "")
    .replace(/<\/body>$/, "");
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function xmlEscapeCss(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function buildContainerXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`;
}

function buildContentOpf({
  title,
  author,
  language,
  publisher,
  uuid,
  modified,
}) {
  const metadata = [
    `<dc:identifier id="pub-id">urn:uuid:${xmlEscape(uuid)}</dc:identifier>`,
    `<dc:title>${xmlEscape(title)}</dc:title>`,
    `<meta property="dcterms:modified">${xmlEscape(modified)}</meta>`,
  ];
  if (author) metadata.push(`<dc:creator>${xmlEscape(author)}</dc:creator>`);
  if (language)
    metadata.push(`<dc:language>${xmlEscape(language)}</dc:language>`);
  if (publisher)
    metadata.push(`<dc:publisher>${xmlEscape(publisher)}</dc:publisher>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="${xmlEscape(language || "en-US")}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    ${metadata.join("\n    ")}
  </metadata>
  <manifest>
    <item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>
`;
}

function buildTocXhtml({ title, chapterTitle, language }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${xmlEscape(language || "en-US")}" lang="${xmlEscape(language || "en-US")}">
  <head>
    <title>${xmlEscape(title)}</title>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>${xmlEscape(title)}</h1>
      <ol>
        <li><a href="chapter1.xhtml">${xmlEscape(chapterTitle)}</a></li>
      </ol>
    </nav>
  </body>
</html>
`;
}

function buildChapterXhtml({ title, html, css, language }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${xmlEscape(language || "en-US")}" lang="${xmlEscape(language || "en-US")}">
  <head>
    <title>${xmlEscape(title)}</title>
    <style type="text/css">${xmlEscapeCss(css)}</style>
  </head>
  <body>${htmlBodyToXhtml(html)}</body>
</html>
`;
}

// Builds a standard EPUB 3 archive as a downloadable Blob.
export async function buildEpub({
  title = "Untitled Document",
  author = "",
  language = "en-US",
  publisher = "",
  html = "",
  chapterTitle,
  css = DEFAULT_CSS,
} = {}) {
  const chapterHeading = chapterTitle || title;
  const uuid = buildUuid();
  // EPUBCheck requires an exact ISO-8601 UTC timestamp with no fractional
  // seconds: CCYY-MM-DDThh:mm:ssZ.
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  const zip = new JSZip();
  // The mimetype entry must be first and uncompressed per the EPUB spec.
  zip.file("mimetype", MIMETYPE, { compression: "STORE" });
  zip.file("META-INF/container.xml", buildContainerXml());
  zip.file(
    "OEBPS/content.opf",
    buildContentOpf({ title, author, language, publisher, uuid, modified })
  );
  zip.file(
    "OEBPS/toc.xhtml",
    buildTocXhtml({ title, chapterTitle: chapterHeading, language })
  );
  zip.file(
    "OEBPS/chapter1.xhtml",
    buildChapterXhtml({ title: chapterHeading, html, css, language })
  );

  return zip.generateAsync({
    type: "blob",
    mimeType: MIMETYPE,
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

// Converts a book title into a safe .epub filename.
export function epubFileName(title) {
  const slug = String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "document"}.epub`;
}
