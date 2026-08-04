import JSZip from "jszip";

const MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const ALIGN_RE = /text-align\s*:\s*(left|center|right|justify)/;
const DATA_URI_RE =
  /^data:image\/(png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/=]+)$/;

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escAttr(value) {
  return esc(value).replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// HTML walk — mirrors buildTextWithMap (grammarHighlight.js) for offsets:
//   - block boundaries contribute a single "\n" (deduped) exactly like PM blocks
//   - math, images, and <br> contribute NO plain characters
//   - text blocks are split into formatting runs for OOXML rendering
// ---------------------------------------------------------------------------

function isBlockMathDiv(el) {
  return el.tagName === "DIV" && el.getAttribute("data-type") === "block-math";
}

function isBlockImage(el) {
  return el.tagName === "IMG" && el.parentElement?.tagName !== "P";
}

function parseDocument(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;

  const result = {
    plainText: "",
    paragraphs: [], // { runs, style, hr, mathBlock, image, cell, plainStart, plainEnd }
    tables: [], // { rows: [{ cells: [{ header, paragraphs: [idx] }] }] }
  };

  let current = null; // paragraph under construction

  function pushBoundary() {
    if (result.plainText.length > 0 && !result.plainText.endsWith("\n")) {
      result.plainText += "\n";
    }
  }

  function pushRun(run) {
    current.runs.push(run);
    if (!run.math && !run.image) {
      result.plainText += run.text;
    }
  }

  // --- run builder (recursive over inline content) ---
  function buildRuns(node, fmt) {
    if (node.nodeType === 3) {
      pushRun({ ...fmt, text: node.data });
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    const next = { ...fmt };
    if (tag === "strong" || tag === "b") next.b = true;
    else if (tag === "em" || tag === "i") next.i = true;
    else if (tag === "u") next.u = true;
    else if (tag === "s" || tag === "strike" || tag === "del") next.s = true;
    else if (tag === "mark") next.hl = true;
    else if (tag === "sub") next.sub = true;
    else if (tag === "sup") next.sup = true;
    else if (tag === "a") next.link = true;
    else if (tag === "code") next.mono = true;
    else if (tag === "br")
      return; // hard breaks are invisible to offsets
    else if (
      tag === "span" &&
      node.getAttribute("data-type") === "inline-math"
    ) {
      pushRun({
        ...fmt,
        math: true,
        text: `\\(${node.getAttribute("data-latex") || ""}\\)`,
      });
      return;
    } else if (tag === "img") {
      pushRun({ ...fmt, image: node });
      return;
    }
    for (const child of node.childNodes) buildRuns(child, next);
  }

  function emitParagraph(el, ctx) {
    const style = { type: "p" };
    const align = (el.getAttribute?.("style") || "").match(ALIGN_RE);
    if (align) style.align = align[1];
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) style.type = tag;
    else if (tag === "pre") style.type = "code";
    else if (ctx.quote) style.type = "quote";
    if (ctx.listItem) {
      style.list = { type: ctx.listItem.type, depth: ctx.listItem.depth };
      if (ctx.listItem.task != null) style.list.task = ctx.listItem.task;
    }
    current = {
      runs: [],
      style,
      cell: ctx.cell,
      plainStart: result.plainText.length,
    };
    if (style.type === "code") {
      // pre > code: collect text directly
      const codeEl = el.querySelector("code") || el;
      pushRun({ text: codeEl.textContent || "" });
    } else if (isBlockMathDiv(el)) {
      // block math contributes no plain text but renders its LaTeX source
      pushRun({
        math: true,
        text: `\\[${el.getAttribute("data-latex") || ""}\\]`,
      });
    } else if (el.tagName === "IMG") {
      // block-level image (TipTap serializes it outside <p>): treat it as an
      // image run so media registration and rendering pick it up
      current.runs.push({ image: el });
    } else if (tag === "hr") {
      current.hr = true;
    } else {
      for (const child of el.childNodes) buildRuns(child, {});
    }
    current.plainEnd = result.plainText.length;
    const paragraph = current;
    current = null;
    if (ctx.cell) ctx.cell.paragraphs.push(result.paragraphs.length);
    if (ctx.listItem) ctx.listItem.emitted = true;
    result.paragraphs.push(paragraph);
    return paragraph;
  }

  function walk(node, ctx) {
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();

    if (isBlockMathDiv(node)) {
      pushBoundary();
      emitParagraph(node, ctx);
      return;
    }
    if (isBlockImage(node)) {
      pushBoundary();
      emitParagraph(node, ctx);
      return;
    }

    if (tag === "ul" || tag === "ol") {
      pushBoundary();
      const type = tag === "ul" ? "bullet" : "decimal";
      const isTask =
        tag === "ul" && node.getAttribute("data-type") === "taskList";
      for (const child of node.childNodes) {
        walk(child, {
          ...ctx,
          listStack: [...ctx.listStack, { type, isTask }],
        });
      }
      return;
    }
    if (tag === "blockquote") {
      pushBoundary();
      for (const child of node.childNodes) walk(child, { ...ctx, quote: true });
      return;
    }
    if (tag === "table") {
      pushBoundary();
      const table = { rows: [] };
      result.tables.push(table);
      for (const child of node.childNodes) {
        walk(child, { ...ctx, table, row: null, cell: null });
      }
      return;
    }
    if (tag === "tr") {
      const row = { cells: [] };
      if (ctx.table) ctx.table.rows.push(row);
      for (const child of node.childNodes) {
        walk(child, { ...ctx, row, cell: null });
      }
      return;
    }
    if (tag === "td" || tag === "th") {
      pushBoundary();
      const cell = { header: tag === "th", paragraphs: [] };
      if (ctx.row) ctx.row.cells.push(cell);
      const cellCtx = { ...ctx, cell };
      for (const child of node.childNodes) walk(child, cellCtx);
      if (!cell.paragraphs.length) {
        // plain-text cell without a paragraph wrapper
        emitParagraph(node, cellCtx);
      }
      return;
    }
    if (tag === "li") {
      pushBoundary();
      const depth = ctx.listStack.length > 0 ? ctx.listStack.length - 1 : 0;
      const top = ctx.listStack[ctx.listStack.length - 1];
      const listItem = {
        type: top?.type || "bullet",
        depth,
        task:
          top?.isTask && node.getAttribute("data-type") === "taskItem"
            ? node.getAttribute("data-checked") === "true"
            : null,
        emitted: false,
      };
      const childCtx = { ...ctx, listItem };
      for (const child of node.childNodes) walk(child, childCtx);
      if (!listItem.emitted) {
        // list item with only text (no paragraph wrapper)
        emitParagraph(node, childCtx);
      }
      return;
    }
    if (tag === "p" || tag === "pre" || /^h[1-6]$/.test(tag) || tag === "hr") {
      pushBoundary();
      emitParagraph(node, ctx);
      return;
    }
    if (tag === "div") {
      // transparent wrapper (e.g. task item content) — recurse
      for (const child of node.childNodes) walk(child, ctx);
      return;
    }
    // any other element (tbody, thead, label, span, ...) — recurse
    for (const child of node.childNodes) walk(child, ctx);
  }

  for (const child of body.childNodes) {
    walk(child, {
      listStack: [],
      quote: false,
      cell: null,
      row: null,
      table: null,
      listItem: null,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// OOXML rendering
// ---------------------------------------------------------------------------

function runPropsXml(run) {
  const parts = [];
  if (run.b) parts.push("<w:b/>");
  if (run.i) parts.push("<w:i/>");
  if (run.u) parts.push('<w:u w:val="single"/>');
  if (run.s) parts.push("<w:strike/>");
  if (run.hl) parts.push('<w:highlight w:val="yellow"/>');
  if (run.sub) parts.push('<w:vertAlign w:val="subscript"/>');
  if (run.sup) parts.push('<w:vertAlign w:val="superscript"/>');
  if (run.mono)
    parts.push('<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>');
  if (run.link) parts.push('<w:color w:val="0563C1"/>');
  return parts.length ? `<w:rPr>${parts.join("")}</w:rPr>` : "";
}

function renderTextRun(run) {
  if (run.image) return renderImageRun(run);
  return `<w:r>${runPropsXml(run)}<w:t>${esc(run.text)}</w:t></w:r>`;
}

function renderImageRun(run) {
  const img = run.image;
  const src = img.getAttribute("src") || "";
  const dataUrl = src.match(DATA_URI_RE);
  if (!dataUrl) return `<w:r>${runPropsXml(run)}<w:t>[image]</w:t></w:r>`;
  const widthPx = parseInt(img.getAttribute("width") || "400", 10) || 400;
  const heightPx = parseInt(img.getAttribute("height") || "300", 10) || 300;
  const cx = widthPx * 9525;
  const cy = heightPx * 9525;
  const id = run.mediaId || 1;
  return (
    `<w:r>${runPropsXml(run)}<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${id}" name="image${id}"/>` +
    `<wp:cNvGraphicFramePr/>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="image${id}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="rId${run.relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic>` +
    `</wp:inline></w:drawing></w:r>`
  );
}

function listNumId(type) {
  return type === "decimal" ? 2 : 1;
}

function paragraphPrXml(style) {
  const parts = [];
  if (style.type === "code") {
    parts.push('<w:shd w:val="clear" w:fill="F2F2F2"/>');
  } else if (/^h[1-6]$/.test(style.type)) {
    parts.push(`<w:pStyle w:val="Heading${style.type.slice(1)}"/>`);
  }
  if (style.type === "quote") {
    parts.push('<w:ind w:left="720"/>');
  }
  if (style.list) {
    parts.push(
      `<w:numPr><w:ilvl w:val="${style.list.depth}"/><w:numId w:val="${listNumId(style.list.type)}"/></w:numPr>`
    );
  }
  if (style.align) {
    parts.push(
      `<w:jc w:val="${style.align === "justify" ? "both" : style.align}"/>`
    );
  }
  if (style.hr) {
    parts.push(
      '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr>'
    );
  }
  return parts.length ? `<w:pPr>${parts.join("")}</w:pPr>` : "";
}

function taskMarkerRun(task) {
  return { text: task ? "☑ " : "☐ ", marker: true };
}

function renderParagraph(paragraph, revCtx) {
  const { runs, style } = paragraph;
  const allRuns =
    style.list?.task != null ? [taskMarkerRun(style.list.task), ...runs] : runs;
  if (!revCtx) {
    return `<w:p>${paragraphPrXml(style)}${allRuns.map(renderTextRun).join("")}</w:p>`;
  }
  return renderParagraphTracked(paragraph, allRuns, revCtx);
}

function renderParagraphTracked(paragraph, runs, revCtx) {
  // Build plain-text units. Math/image/marker runs are opaque: they occupy
  // zero plain-text width (never inside a match range) and pass through
  // untouched. Text units carry absolute plain-text positions so revisions
  // slice in correctly regardless of surrounding markup.
  const units = [];
  let pos = paragraph.plainStart;
  for (const run of runs) {
    if (run.math || run.image || run.marker) {
      units.push({ run, start: pos, end: pos, opaque: true });
    } else {
      units.push({ run, start: pos, end: pos + run.text.length });
      pos += run.text.length;
    }
  }

  const overlaps = revCtx.revisions.filter(
    (r) =>
      r.offset < paragraph.plainEnd &&
      r.offset + r.length > paragraph.plainStart
  );

  if (!overlaps.length) {
    return `<w:p>${paragraphPrXml(paragraph.style)}${units.map((u) => renderTextRun(u.run)).join("")}</w:p>`;
  }

  const out = [];
  const extraParagraphs = [];
  let unitIndex = 0;

  // Emits all units strictly before `target` (absolute plain offset), splitting
  // a unit that straddles the boundary. Opaque units always emit in order.
  function emitUntil(target) {
    while (unitIndex < units.length) {
      const unit = units[unitIndex];
      if (unit.opaque) {
        out.push(renderTextRun(unit.run));
        unitIndex += 1;
        continue;
      }
      if (target <= unit.start) break;
      if (target >= unit.end) {
        out.push(renderTextRun(unit.run));
        unitIndex += 1;
        continue;
      }
      const cut = target - unit.start;
      out.push(
        renderTextRun({ ...unit.run, text: unit.run.text.slice(0, cut) })
      );
      units[unitIndex] = {
        run: { ...unit.run, text: unit.run.text.slice(cut) },
        start: target,
        end: unit.end,
      };
      break;
    }
  }

  for (const rev of overlaps) {
    const ls = rev.offset;
    const le = rev.offset + rev.length;
    emitUntil(ls);

    // collect the deleted range [ls, le) across text units
    const delPieces = [];
    let props = {};
    while (unitIndex < units.length) {
      const unit = units[unitIndex];
      if (unit.opaque) {
        unitIndex += 1;
        continue;
      }
      if (unit.start >= le) break;
      if (unit.end <= le) {
        delPieces.push(unit.run);
        if (!props.b && !props.i && !props.u && !props.s && !props.mono)
          props = unit.run;
        unitIndex += 1;
        continue;
      }
      const cut = le - unit.start;
      delPieces.push({ ...unit.run, text: unit.run.text.slice(0, cut) });
      if (!props.b && !props.i && !props.u && !props.s && !props.mono)
        props = unit.run;
      units[unitIndex] = {
        run: { ...unit.run, text: unit.run.text.slice(cut) },
        start: le,
        end: unit.end,
      };
      break;
    }

    const id = revCtx.nextId();
    if (delPieces.length) {
      const delRuns = delPieces
        .map(
          (p) =>
            `<w:r>${runPropsXml(p)}<w:delText>${esc(p.text)}</w:delText></w:r>`
        )
        .join("");
      out.push(
        `<w:del w:id="${id}" w:author="${escAttr(revCtx.author)}" w:date="${escAttr(revCtx.date)}">${delRuns}</w:del>`
      );
    }
    if (rev.suggestion) {
      const lines = rev.suggestion.split("\n");
      const insRun = (line) =>
        `<w:r>${runPropsXml(props)}<w:t>${esc(line)}</w:t></w:r>`;
      out.push(
        `<w:ins w:id="${id}" w:author="${escAttr(revCtx.author)}" w:date="${escAttr(revCtx.date)}">${insRun(lines[0])}</w:ins>`
      );
      for (const line of lines.slice(1)) {
        extraParagraphs.push(
          `<w:p>${paragraphPrXml(paragraph.style)}<w:ins w:id="${id}" w:author="${escAttr(revCtx.author)}" w:date="${escAttr(revCtx.date)}">${insRun(line)}</w:ins></w:p>`
        );
      }
    }
  }

  emitUntil(Infinity);
  const main = `<w:p>${paragraphPrXml(paragraph.style)}${out.join("")}</w:p>`;
  return [main, ...extraParagraphs].join("");
}

// ---------------------------------------------------------------------------
// Package assembly
// ---------------------------------------------------------------------------

function buildContentTypes(media) {
  const defaults = [
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package/relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
  ];
  if (media.some((m) => m.ext === "png")) {
    defaults.push('<Default Extension="png" ContentType="image/png"/>');
  }
  if (media.some((m) => m.ext === "jpeg")) {
    defaults.push('<Default Extension="jpeg" ContentType="image/jpeg"/>');
  }
  if (media.some((m) => m.ext === "gif")) {
    defaults.push('<Default Extension="gif" ContentType="image/gif"/>');
  }
  if (media.some((m) => m.ext === "webp")) {
    defaults.push('<Default Extension="webp" ContentType="image/webp"/>');
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  ${defaults.join("\n  ")}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>
`;
}

function buildDocumentXml(paragraphs, tables, media, revCtx) {
  // assign media rel ids in encounter order
  let mediaCounter = 0;
  const usedMedia = [];
  for (const paragraph of paragraphs) {
    for (const run of paragraph.runs) {
      if (run.image && !run.mediaId) {
        const src = run.image.getAttribute("src") || "";
        const match = src.match(DATA_URI_RE);
        if (match) {
          const ext = match[1] === "jpg" ? "jpeg" : match[1];
          mediaCounter += 1;
          run.mediaId = mediaCounter;
          run.relId = 2 + mediaCounter;
          usedMedia.push({
            ext,
            data: match[2],
            name: `image${mediaCounter}.${ext}`,
          });
        }
      }
    }
  }
  media.length = 0;
  media.push(...usedMedia);

  const bodyParts = [];
  for (const paragraph of paragraphs) {
    if (paragraph.cell) continue; // cells render inside their tables
    bodyParts.push(renderParagraph(paragraph, revCtx));
  }
  for (const table of tables) {
    const rowsXml = table.rows
      .map((row) => {
        const cellsXml = row.cells
          .map((cell) => {
            const cellXml = cell.paragraphs
              .map((idx) => renderParagraph(paragraphs[idx], revCtx))
              .join("");
            const pr = cell.header
              ? '<w:tcPr><w:shd w:val="clear" w:fill="D9E2F3"/></w:tcPr>'
              : "<w:tcPr/>";
            return `<w:tc>${pr}${cellXml}</w:tc>`;
          })
          .join("");
        return `<w:tr>${cellsXml}</w:tr>`;
      })
      .join("");
    bodyParts.push(
      `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>` +
        `<w:top w:val="single" w:sz="4" w:color="auto"/><w:left w:val="single" w:sz="4" w:color="auto"/>` +
        `<w:bottom w:val="single" w:sz="4" w:color="auto"/><w:right w:val="single" w:sz="4" w:color="auto"/>` +
        `<w:insideH w:val="single" w:sz="4" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:color="auto"/>` +
        `</w:tblBorders></w:tblPr>${rowsXml}</w:tbl>`
    );
  }

  const sectPr =
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>${bodyParts.join("")}${sectPr}</w:body>
</w:document>
`;
}

function buildStylesXml() {
  const heading = (level, size) =>
    `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="${240 - level * 20}" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr></w:style>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault/></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
${heading(1, 36)}
${heading(2, 32)}
${heading(3, 28)}
${heading(4, 24)}
${heading(5, 22)}
${heading(6, 22)}
</w:styles>
`;
}

function buildNumberingXml() {
  const abstractLevels = (numFmt, lvlText, font) => {
    let out = "";
    for (let i = 0; i < 9; i += 1) {
      const rPr = font
        ? `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/></w:rPr>`
        : "";
      out += `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${numFmt}"/><w:lvlText w:val="${lvlText}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 + i * 360}" w:hanging="360"/></w:pPr>${rPr}</w:lvl>`;
    }
    return out;
  };
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="multilevel"/>${abstractLevels("bullet", "•", "Symbol")}</w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="multilevel"/>${abstractLevels("decimal", "%1.")}</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>
`;
}

function buildRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
`;
}

function buildDocumentRels(media) {
  const parts = [
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>',
  ];
  media.forEach((m, i) => {
    parts.push(
      `<Relationship Id="rId${3 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`
    );
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${parts.join("\n")}
</Relationships>
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Builds the exact plain text that grammar check offsets index into
// (buildTextWithMap equivalent) — exported for tests.
export function buildPlainText(html) {
  return parseDocument(html).plainText;
}

// Builds a .docx Blob. `revisions` are { offset, length, suggestion } with
// offsets into the grammar-check plain text (see buildTextWithMap).
export async function buildDocx({
  html = "",
  revisions = [],
  author = "Lex",
  date,
  trackChanges = false,
} = {}) {
  const parsed = parseDocument(html);
  const docDate = date || new Date().toISOString().replace(/\.\d+Z$/, "Z");

  let revCtx = null;
  if (trackChanges) {
    const sorted = revisions
      .filter(
        (r) =>
          Number.isFinite(r.offset) && Number.isFinite(r.length) && r.length > 0
      )
      .sort((a, b) => a.offset - b.offset)
      .filter(
        (r, i, arr) =>
          i === 0 || r.offset >= arr[i - 1].offset + arr[i - 1].length
      );
    let nextId = 1;
    revCtx = {
      revisions: sorted,
      author,
      date: docDate,
      nextId: () => nextId++,
    };
  }

  const media = [];
  const documentXml = buildDocumentXml(
    parsed.paragraphs,
    parsed.tables,
    media,
    revCtx
  );

  const zip = new JSZip();
  zip.file("[Content_Types].xml", buildContentTypes(media));
  zip.file("_rels/.rels", buildRels());
  zip.file("word/document.xml", documentXml);
  zip.file("word/styles.xml", buildStylesXml());
  zip.file("word/numbering.xml", buildNumberingXml());
  zip.file("word/_rels/document.xml.rels", buildDocumentRels(media));
  media.forEach((m) => {
    zip.file(`word/media/${m.name}`, m.data, { base64: true });
  });

  return zip.generateAsync({
    type: "blob",
    mimeType: MIME,
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}
