// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { docxToHtml } from "../docxImport.js";

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

function makeDocx(documentXml, extraParts = {}) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.folder("_rels").file(".rels", RELS);
  zip.folder("word").file("document.xml", documentXml);
  for (const [path, content] of Object.entries(extraParts)) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: "arraybuffer" });
}

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function relsWithImage() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`;
}

describe("docxToHtml", () => {
  it("maps headings, paragraphs, and run formatting", async () => {
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Title Here</w:t></w:r></w:p>
        <w:p><w:r><w:t>Plain and </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>bold</w:t></w:r><w:r><w:t> and </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>italic</w:t></w:r><w:r><w:t>.</w:t></w:r></w:p>
      </w:body>
    </w:document>`;
    const { html } = await docxToHtml(await makeDocx(xml));
    expect(html).toContain("<h1");
    expect(html).toContain("Title Here");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("maps bulleted and numbered lists", async () => {
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>First</w:t></w:r></w:p>
        <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Second</w:t></w:r></w:p>
        <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t>Numbered</w:t></w:r></w:p>
      </w:body>
    </w:document>`;
    const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="\u2022"/><w:lvlJc w:val="left"/></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;
    const { html } = await docxToHtml(
      await makeDocx(xml, { "word/numbering.xml": numbering })
    );
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>First</li>");
    expect(html).toContain("<li>Second</li>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>Numbered</li>");
  });

  it("maps tables", async () => {
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:tbl>
          <w:tr><w:tc><w:p><w:r><w:t>Head</w:t></w:r></w:p></w:tc></w:tr>
          <w:tr><w:tc><w:p><w:r><w:t>Cell</w:t></w:r></w:p></w:tc></w:tr>
        </w:tbl>
      </w:body>
    </w:document>`;
    const { html } = await docxToHtml(await makeDocx(xml));
    expect(html).toContain("<table>");
    expect(html).toContain("<tr>");
    expect(html).toContain("<td>");
    expect(html).toContain("Head");
    expect(html).toContain("Cell");
  });

  it("keeps w:ins content and drops w:del content", async () => {
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:r><w:t>The </w:t></w:r>
          <w:del w:id="1" w:author="Lex" w:date="2026-08-04T00:00:00Z"><w:r><w:delText>old</w:delText></w:r></w:del>
          <w:ins w:id="1" w:author="Lex" w:date="2026-08-04T00:00:00Z"><w:r><w:t>new</w:t></w:r></w:ins>
          <w:r><w:t> word.</w:t></w:r>
        </w:p>
      </w:body>
    </w:document>`;
    const { html } = await docxToHtml(await makeDocx(xml));
    expect(html).toContain("The new word.");
    expect(html).not.toContain("old");
  });

  it("embeds images as base64 data URIs", async () => {
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
        xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <w:body>
        <w:p>
          <w:r><w:drawing><wp:inline><a:graphic><a:graphicData>
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:blipFill><a:blip r:embed="rId7"/></pic:blipFill>
            </pic:pic>
          </a:graphicData></a:graphic></wp:inline></w:drawing></w:r>
        </w:p>
      </w:body>
    </w:document>`;
    const pngBytes = Uint8Array.from(atob(PNG_BASE64), (c) => c.charCodeAt(0));
    const { html } = await docxToHtml(
      await makeDocx(xml, {
        "word/_rels/document.xml.rels": relsWithImage(),
        "word/media/image1.png": pngBytes,
      })
    );
    expect(html).toContain(`<img src="data:image/png;base64,${PNG_BASE64}"`);
  });

  it("prefers the PNG of a Word EMF+PNG blip pair", async () => {
    const emfBytes = new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x88, 0x00]);
    const pngBytes = Uint8Array.from(atob(PNG_BASE64), (c) => c.charCodeAt(0));
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
        xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <w:body>
        <w:p>
          <w:r><w:drawing><wp:inline><a:graphic><a:graphicData>
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:blipFill>
                <a:blip r:embed="rId8"/>
                <a:blip r:embed="rId7"/>
              </pic:blipFill>
            </pic:pic>
          </a:graphicData></a:graphic></wp:inline></w:drawing></w:r>
        </w:p>
      </w:body>
    </w:document>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
  <Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image2.emf"/>
</Relationships>`;
    const { html } = await docxToHtml(
      await makeDocx(xml, {
        "word/_rels/document.xml.rels": rels,
        "word/media/image1.png": pngBytes,
        "word/media/image2.emf": emfBytes,
      })
    );
    expect(html).toContain(`<img src="data:image/png;base64,${PNG_BASE64}"`);
    expect(html).not.toContain("data:image/x-emf");
    expect(html).not.toContain("data:null");
    expect((html.match(/<img /g) || []).length).toBe(1);
  });

  it("drops non-renderable images and sniffs the mime from bytes", async () => {
    const webpBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x20,
    ]);
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
        xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <w:body>
        <w:p>
          <w:r><w:drawing><wp:inline><a:graphic><a:graphicData>
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:blipFill><a:blip r:embed="rId7"/></pic:blipFill>
            </pic:pic>
          </a:graphicData></a:graphic></wp:inline></w:drawing></w:r>
        </w:p>
      </w:body>
    </w:document>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.webp"/>
</Relationships>`;
    // no <Default Extension="webp"> in content types — bytes must decide
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
    const zip = new JSZip();
    zip.file("[Content_Types].xml", contentTypes);
    zip.folder("_rels").file(".rels", RELS);
    zip.folder("word").file("document.xml", xml);
    zip.file("word/_rels/document.xml.rels", rels);
    zip.file("word/media/image1.webp", webpBytes);
    const { html } = await docxToHtml(
      await zip.generateAsync({ type: "arraybuffer" })
    );
    expect(html).toContain(`<img src="data:image/webp;base64,`);
    expect(html).not.toContain("data:null");
  });

  it("drops an EMF-only drawing entirely", async () => {
    const emfBytes = new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x88, 0x00]);
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
        xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>Kept</w:t></w:r></w:p>
        <w:p>
          <w:r><w:drawing><wp:inline><a:graphic><a:graphicData>
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:blipFill><a:blip r:embed="rId7"/></pic:blipFill>
            </pic:pic>
          </a:graphicData></a:graphic></wp:inline></w:drawing></w:r>
        </w:p>
      </w:body>
    </w:document>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.emf"/>
</Relationships>`;
    const { html } = await docxToHtml(
      await makeDocx(xml, {
        "word/_rels/document.xml.rels": rels,
        "word/media/image1.emf": emfBytes,
      })
    );
    expect(html).toContain("Kept");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("data:null");
  });

  it("survives Word math (OMML) without breaking surrounding text", async () => {
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
        xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
      <w:body>
        <w:p>
          <w:r><w:t>Before </w:t></w:r>
          <m:oMathPara><m:oMath><m:r><m:t>x=1</m:t></m:r></m:oMath></m:oMathPara>
          <w:r><w:t> after.</w:t></w:r>
        </w:p>
      </w:body>
    </w:document>`;
    const { html } = await docxToHtml(await makeDocx(xml));
    expect(html).toContain("Before");
    expect(html).toContain("after.");
  });

  it("rejects a non-docx payload", async () => {
    const garbage = new TextEncoder().encode("this is not a zip").buffer;
    await expect(docxToHtml(garbage)).rejects.toThrow();
  });

  it("round-trips a Lexicon DOCX export back into HTML", async () => {
    const { buildDocx } = await import("../docxExport.js");
    const html =
      `<h2>Chapter</h2><p>Hello <strong>bold</strong> world.</p>` +
      `<ul><li><p>One</p></li></ul><table><tbody><tr><th>H</th><td>C</td></tr></tbody></table>`;
    const blob = await buildDocx({ html, trackChanges: false });
    const { html: imported } = await docxToHtml(await blob.arrayBuffer());
    expect(imported).toContain("<h2");
    expect(imported).toContain("Chapter");
    expect(imported).toContain("<strong>bold</strong>");
    expect(imported).toContain("<ul>");
    expect(imported).toContain("<li>One</li>");
    expect(imported).toContain("<table>");
    expect(imported).toContain("C");
  });
});
