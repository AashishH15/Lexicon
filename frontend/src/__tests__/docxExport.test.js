// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { buildDocx, buildPlainText } from "../docxExport.js";

const PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

// 1x1 white JPEG (ffd8ff magic)
const JPEG_1PX =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==";

const SAMPLE_HTML = `
<h1>Chapter</h1>
<p>Hello <strong>bold</strong> and <em>italic</em>.</p>
<ul><li>One</li><li>Two</li></ul>
<ol><li>First</li></ol>
<blockquote><p>A quote.</p></blockquote>
<pre><code>const x = 1;</code></pre>
<table><tbody><tr><th>Head</th></tr><tr><td>Cell</td></tr></tbody></table>
`;

async function loadDocx(blob) {
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

describe("buildPlainText", () => {
  it("reproduces grammar-check plain text with block newlines", () => {
    expect(buildPlainText(SAMPLE_HTML)).toBe(
      "Chapter\nHello bold and italic.\nOne\nTwo\nFirst\nA quote.\nconst x = 1;\nHead\nCell"
    );
  });

  it("skips math, images, and <br> but keeps newline boundaries", () => {
    const html =
      '<p>Line one<br>Line two <span data-type="inline-math" data-latex="E = mc^2">x</span>.</p>' +
      '<div data-type="block-math" data-latex="a+b"></div>' +
      '<p><img src="data:image/png;base64,AA"></p>' +
      "<p>After.</p>";
    expect(buildPlainText(html)).toBe("Line oneLine two .\nAfter.");
  });
});

describe("buildDocx — structure", () => {
  it("returns a Blob with the DOCX mime type and all required parts", async () => {
    const blob = await buildDocx({ html: "<p>Hi</p>" });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    const { files } = await loadDocx(blob);
    expect(files["[Content_Types].xml"]).toBeTruthy();
    expect(files["_rels/.rels"]).toBeTruthy();
    expect(files["word/document.xml"]).toBeTruthy();
    expect(files["word/styles.xml"]).toBeTruthy();
    expect(files["word/numbering.xml"]).toBeTruthy();
    expect(files["word/_rels/document.xml.rels"]).toBeTruthy();
  });

  it("produces well-formed XML in every part", async () => {
    const blob = await buildDocx({ html: SAMPLE_HTML });
    const { files } = await loadDocx(blob);
    for (const name of Object.keys(files)) {
      if (name.endsWith(".rels") || name.endsWith(".xml")) {
        assertWellFormedXml(files[name]);
      }
    }
  });

  it("maps headings, bold, italic, lists, quotes, code, and tables to OOXML", async () => {
    const blob = await buildDocx({ html: SAMPLE_HTML });
    const { files } = await loadDocx(blob);
    const doc = files["word/document.xml"];
    expect(doc).toContain('<w:pStyle w:val="Heading1"/>');
    expect(doc).toContain("<w:b/>");
    expect(doc).toContain("<w:i/>");
    expect(doc).toContain("<w:numPr>");
    expect(doc).toContain('<w:numId w:val="1"/>');
    expect(doc).toContain('<w:numId w:val="2"/>');
    expect(doc).toContain('<w:ind w:left="720"/>');
    expect(doc).toContain('<w:shd w:val="clear" w:fill="F2F2F2"/>');
    expect(doc).toContain("<w:tbl>");
    expect(doc).toContain("<w:tr>");
    expect(doc).toContain("<w:tc>");
    expect(doc).toContain("<w:t>Chapter</w:t>");
    expect(doc).toContain("<w:t>const x = 1;</w:t>");
  });
});

describe("buildDocx — tracked changes", () => {
  const HTML = "<p>The cat sat.</p><p>The dog ran.</p>";
  const REVISIONS = [
    { offset: 17, length: 3, suggestion: "hound" }, // "dog" in second paragraph
  ];

  it("emits w:del/w:ins with author, ISO date, and unique ids", async () => {
    const blob = await buildDocx({
      html: HTML,
      revisions: REVISIONS,
      author: "Lex",
      trackChanges: true,
    });
    const { files } = await loadDocx(blob);
    const doc = files["word/document.xml"];
    const delMatches = [...doc.matchAll(/<w:del /g)];
    const insMatches = [...doc.matchAll(/<w:ins /g)];
    expect(delMatches.length).toBe(1);
    expect(insMatches.length).toBe(1);
    expect(doc).toContain("<w:delText>dog</w:delText>");
    expect(doc).toContain("<w:t>hound</w:t>");
    expect(doc).toContain('w:author="Lex"');
    expect(doc).toMatch(/w:date="\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/);
    const delIds = [...doc.matchAll(/<w:del w:id="(\d+)"/g)].map((m) => m[1]);
    const insIds = [...doc.matchAll(/<w:ins w:id="(\d+)"/g)].map((m) => m[1]);
    // each revision pair shares one id; ids must be unique across revisions
    expect(new Set(delIds).size).toBe(delIds.length);
    expect(new Set(insIds).size).toBe(insIds.length);
    expect(delIds).toEqual(insIds);
  });

  it("places revisions in the correct paragraph", async () => {
    const blob = await buildDocx({
      html: HTML,
      revisions: REVISIONS,
      trackChanges: true,
    });
    const { files } = await loadDocx(blob);
    const doc = files["word/document.xml"];
    const delIndex = doc.indexOf("<w:delText>dog</w:delText>");
    const catIndex = doc.indexOf("<w:t>The cat sat.</w:t>");
    const secondParagraph = doc.indexOf("<w:p>", doc.indexOf("</w:p>"));
    expect(delIndex).toBeGreaterThan(catIndex);
    expect(delIndex).toBeGreaterThan(secondParagraph);
    expect(doc).toContain("<w:t>The </w:t>");
    expect(doc).not.toContain("<w:delText>cat</w:delText>");
  });

  it("uses the configured author name", async () => {
    const blob = await buildDocx({
      html: HTML,
      revisions: REVISIONS,
      author: "Jane Writer",
      trackChanges: true,
    });
    const { files } = await loadDocx(blob);
    expect(files["word/document.xml"]).toContain('w:author="Jane Writer"');
  });

  it("exports clean when trackChanges is disabled", async () => {
    const blob = await buildDocx({
      html: HTML,
      revisions: REVISIONS,
      trackChanges: false,
    });
    const { files } = await loadDocx(blob);
    const doc = files["word/document.xml"];
    expect(doc).not.toContain("<w:ins");
    expect(doc).not.toContain("<w:del");
    expect(doc).toContain("<w:t>The dog ran.</w:t>");
  });

  it("splits multi-paragraph replacements into separate paragraphs", async () => {
    const blob = await buildDocx({
      html: "<p>The dog ran.</p>",
      revisions: [{ offset: 4, length: 3, suggestion: "hound\nfled" }],
      trackChanges: true,
    });
    const { files } = await loadDocx(blob);
    const doc = files["word/document.xml"];
    expect((doc.match(/<w:ins /g) || []).length).toBe(2);
    expect(doc).toContain("<w:t>hound</w:t>");
    expect(doc).toContain("<w:t>fled</w:t>");
  });

  it("ignores out-of-range and zero-length revisions", async () => {
    const blob = await buildDocx({
      html: HTML,
      revisions: [
        { offset: 999, length: 3, suggestion: "x" },
        { offset: 5, length: 0, suggestion: "y" },
        REVISIONS[0],
      ],
      trackChanges: true,
    });
    const { files } = await loadDocx(blob);
    expect((files["word/document.xml"].match(/<w:del /g) || []).length).toBe(1);
  });
});

describe("buildDocx — content mapping", () => {
  it("renders math as LaTeX text and skips it in plain text", async () => {
    const html =
      '<p>Mass <span data-type="inline-math" data-latex="E = mc^2">m</span>.</p>' +
      '<div data-type="block-math" data-latex="a^2 + b^2 = c^2"></div>';
    expect(buildPlainText(html)).toBe("Mass .\n");
    const blob = await buildDocx({ html });
    const { files } = await loadDocx(blob);
    const doc = files["word/document.xml"];
    expect(doc).toContain("\\(E = mc^2\\)");
    expect(doc).toContain("\\[a^2 + b^2 = c^2\\]");
    expect(doc).not.toContain("data-type");
  });

  it("renders task lists with check markers", async () => {
    const html =
      '<ul data-type="taskList">' +
      '<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Done</p></div></li>' +
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>TODO</p></div></li>' +
      "</ul>";
    const blob = await buildDocx({ html });
    const { files } = await loadDocx(blob);
    const doc = files["word/document.xml"];
    expect(doc).toContain("☑ ");
    expect(doc).toContain("<w:t>Done</w:t>");
    expect(doc).toContain("☐ ");
    expect(doc).toContain("<w:t>TODO</w:t>");
  });

  it("embeds base64 images as media and placeholders for remote ones", async () => {
    const gif1px = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const html =
      `<p><img src="data:image/png;base64,${PNG_1PX}" alt="a"></p>` +
      `<p>Text <img src="https://example.com/x.png" alt="b"> here</p>` +
      `<p><img src="data:image/gif;base64,${gif1px}" alt="c"></p>`;
    const blob = await buildDocx({ html });
    const { zip, files } = await loadDocx(blob);
    expect(files["word/media/image1.png"]).toBeTruthy();
    expect(files["word/media/image2.gif"]).toBeTruthy();
    const doc = files["word/document.xml"];
    expect(doc).toContain("<w:drawing>");
    expect(doc).toContain('r:embed="rId3"');
    expect(doc).toContain("[image]");
    expect(files["word/_rels/document.xml.rels"]).toContain(
      'Target="media/image1.png"'
    );
    expect(files["[Content_Types].xml"]).toContain(
      '<Default Extension="png" ContentType="image/png"/>'
    );
    expect(files["[Content_Types].xml"]).toContain(
      '<Default Extension="gif" ContentType="image/gif"/>'
    );
    const png = await zip.file("word/media/image1.png").async("uint8array");
    expect(png[0]).toBe(0x89); // PNG magic byte
  });

  it("embeds block-level images (TipTap serializes <img> outside <p>)", async () => {
    // TipTap's Image node with inline:false emits the <img> as a block element
    // between paragraphs, not wrapped in <p>.
    const html =
      `<p>Before</p>` +
      `<img src="data:image/jpeg;base64,${JPEG_1PX}" alt="d">` +
      `<p>After</p>`;
    const blob = await buildDocx({ html });
    const { zip, files } = await loadDocx(blob);
    expect(files["word/media/image1.jpeg"]).toBeTruthy();
    const doc = files["word/document.xml"];
    expect(doc).toContain("<w:drawing>");
    expect(doc).toContain('r:embed="rId3"');
    expect(files["word/_rels/document.xml.rels"]).toContain(
      'Target="media/image1.jpeg"'
    );
    expect(files["[Content_Types].xml"]).toContain(
      '<Default Extension="jpeg" ContentType="image/jpeg"/>'
    );
    const jpeg = await zip.file("word/media/image1.jpeg").async("uint8array");
    expect(jpeg[0]).toBe(0xff); // JPEG magic byte
    expect(jpeg[1]).toBe(0xd8);
  });

  it("handles an empty document", async () => {
    const blob = await buildDocx({
      html: "",
      trackChanges: true,
      revisions: [{ offset: 0, length: 1, suggestion: "x" }],
    });
    const { files } = await loadDocx(blob);
    assertWellFormedXml(files["word/document.xml"]);
  });
});
