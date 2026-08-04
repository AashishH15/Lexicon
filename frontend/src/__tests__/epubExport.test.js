// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { buildEpub, epubFileName } from "../epubExport.js";

const SAMPLE_HTML = `
<h1>Chapter One</h1>
<p>Hello <strong>world</strong>.<br>A second line with <em>emphasis</em>.</p>
<hr>
<p>Formula: <span data-type="inline-math" data-latex="E = mc^2">E&nbsp;=&nbsp;mc<sup>2</sup></span> in text.</p>
<div data-type="block-math" data-latex="\\sum_{i=1}^{n} i = n(n+1)/2"></div>
<blockquote><p>A quote.</p></blockquote>
<p><img src="data:image/png;base64,ABC" alt="pic"></p>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div>Done task</div></li>
  <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div>Pending task</div></li>
</ul>
`;

async function loadEpub(blob) {
  const zip = await JSZip.loadAsync(blob);
  const files = {};
  for (const name of Object.keys(zip.files)) {
    if (zip.files[name].dir) continue;
    files[name] = await zip.file(name).async("string");
  }
  return { zip, files };
}

function assertWellFormedXml(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  expect(doc.getElementsByTagName("parsererror").length).toBe(0);
}

describe("buildEpub", () => {
  it("returns a Blob with the EPUB mime type", async () => {
    const blob = await buildEpub({ title: "Test Book", html: "<p>Hi</p>" });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/epub+zip");
  });

  it("places mimetype first, uncompressed, with the correct content", async () => {
    const blob = await buildEpub({ title: "Test Book", html: "<p>Hi</p>" });
    const { zip, files } = await loadEpub(blob);
    expect(Object.keys(zip.files)[0]).toBe("mimetype");
    expect(files["mimetype"]).toBe("application/epub+zip");

    // Verify the raw archive: first local header is mimetype with
    // compression method 0 (STORED); content entries use method 8 (DEFLATE).
    const buf = new Uint8Array(await blob.arrayBuffer());
    const sig = (i) =>
      String.fromCharCode(buf[i], buf[i + 1], buf[i + 2], buf[i + 3]);
    expect(sig(0)).toBe("PK\u0003\u0004");
    const method = buf[8] | (buf[9] << 8);
    expect(method).toBe(0);
    const nlen = buf[26] | (buf[27] << 8);
    const name = new TextDecoder().decode(buf.subarray(30, 30 + nlen));
    expect(name).toBe("mimetype");
  });

  it("contains a valid container.xml pointing at the package", async () => {
    const blob = await buildEpub({ title: "Test Book", html: "<p>Hi</p>" });
    const { files } = await loadEpub(blob);
    assertWellFormedXml(files["META-INF/container.xml"]);
    expect(files["META-INF/container.xml"]).toContain(
      'rootfile full-path="OEBPS/content.opf"'
    );
  });

  it("writes all required metadata into content.opf", async () => {
    const blob = await buildEpub({
      title: "Test & Book",
      author: "Jane <Writer>",
      language: "en-GB",
      publisher: "Lex Press",
      html: "<p>Hi</p>",
    });
    const { files } = await loadEpub(blob);
    const opf = files["OEBPS/content.opf"];
    assertWellFormedXml(opf);
    expect(opf).toContain("<dc:title>Test &amp; Book</dc:title>");
    expect(opf).toContain("<dc:creator>Jane &lt;Writer&gt;</dc:creator>");
    expect(opf).toContain("<dc:language>en-GB</dc:language>");
    expect(opf).toContain("<dc:publisher>Lex Press</dc:publisher>");
    expect(opf).toContain('<meta property="dcterms:modified">');
    expect(opf).toContain('properties="nav"');
    expect(opf).toContain('<itemref idref="chapter1"/>');
  });

  it("builds an EPUB 3 nav document linking to the chapter", async () => {
    const blob = await buildEpub({
      title: "My Book",
      html: "<p>Hi</p>",
      chapterTitle: "Prologue",
    });
    const { files } = await loadEpub(blob);
    const toc = files["OEBPS/toc.xhtml"];
    assertWellFormedXml(toc);
    expect(toc).toContain('epub:type="toc"');
    expect(toc).toContain('<a href="chapter1.xhtml">Prologue</a>');
  });

  it("produces well-formed XHTML chapter with XML declaration and self-closing void tags", async () => {
    const blob = await buildEpub({ title: "My Book", html: SAMPLE_HTML });
    const { files } = await loadEpub(blob);
    const chapter = files["OEBPS/chapter1.xhtml"];
    assertWellFormedXml(chapter);
    expect(chapter.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(
      true
    );
    expect(chapter).toMatch(/<br\s*\/>/);
    expect(chapter).toMatch(/<hr\s*\/>/);
    expect(chapter).toMatch(
      /<img[^>]*src="data:image\/png;base64,ABC"[^>]*\/>/
    );
    expect(chapter).toMatch(/<input[^>]*\/>/);
    expect(chapter).toContain('<style type="text/css">');
  });

  it("has exactly one <body> element — content is not wrapped in a second body", async () => {
    const blob = await buildEpub({
      title: "My Book",
      html: "<h1>Chapter</h1><p>Body text</p>",
    });
    const { files } = await loadEpub(blob);
    const chapter = files["OEBPS/chapter1.xhtml"];
    const doc = new DOMParser().parseFromString(chapter, "text/xml");
    expect(doc.getElementsByTagName("body").length).toBe(1);
    expect(doc.getElementsByTagName("html").length).toBe(1);
    expect(doc.getElementsByTagName("head").length).toBe(1);
    expect(doc.getElementsByTagName("body")[0].textContent).toContain(
      "Body text"
    );
  });

  it("writes dcterms:modified as a strict ISO-8601 UTC timestamp without fractional seconds", async () => {
    const blob = await buildEpub({ title: "My Book", html: "<p>Hi</p>" });
    const { files } = await loadEpub(blob);
    const modified = files["OEBPS/content.opf"].match(
      /<meta property="dcterms:modified">([^<]*)<\/meta>/
    )?.[1];
    expect(modified).toBeTruthy();
    expect(modified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("converts inline and block math to LaTeX-wrapped fallbacks", async () => {
    const blob = await buildEpub({ title: "Math Book", html: SAMPLE_HTML });
    const { files } = await loadEpub(blob);
    const chapter = files["OEBPS/chapter1.xhtml"];
    expect(chapter).toContain(
      '<span class="math-inline">\\(E = mc^2\\)</span>'
    );
    expect(chapter).toContain(
      '<div class="math-block">\\[\\sum_{i=1}^{n} i = n(n+1)/2\\]</div>'
    );
    expect(chapter).not.toContain("data-type");
  });

  it("drops TipTap data-* attributes but keeps task list structure", async () => {
    const blob = await buildEpub({ title: "Tasks", html: SAMPLE_HTML });
    const { files } = await loadEpub(blob);
    const chapter = files["OEBPS/chapter1.xhtml"];
    expect(chapter).not.toContain('data-type="taskList"');
    expect(chapter).not.toContain("data-checked");
    expect(chapter).toContain("Done task");
    expect(chapter).toContain("Pending task");
  });
});

describe("epubFileName", () => {
  it("slugs titles into safe filenames", () => {
    expect(epubFileName("The Last Lighthouse")).toBe(
      "the-last-lighthouse.epub"
    );
    expect(epubFileName("My: Book! 2026")).toBe("my-book-2026.epub");
    expect(epubFileName("  ")).toBe("document.epub");
  });
});
