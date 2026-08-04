import {
  GraduationCap,
  BookOpenText,
  Article,
  Briefcase,
} from "@phosphor-icons/react";

// Starter document templates. `html` is TipTap/ProseMirror-schema-compatible
// markup: math nodes use the real serialization (`data-type="inline-math"` /
// `data-type="block-math"` + `data-latex`), task lists use `ul[data-type="taskList"]`.
// `preview` is a short HTML snippet shown on the gallery card thumbnail only.
export const TEMPLATES = [
  {
    id: "academic-paper",
    name: "Academic Paper",
    icon: GraduationCap,
    tags: ["formal", "structured", "research"],
    description:
      "A ready-made research paper: abstract, structured sections, a results table, LaTeX math, and a references list.",
    html: `
<h1>Evaluating Local AI Assistance in the Lexicon Editor</h1>
<p><em>Priya Deshmukh &amp; Zhang Wei</em><br>Department of Language Technology, Lexicon Research Labs</p>
<h2>Abstract</h2>
<p>This paper investigates whether a locally hosted language model inside the Lexicon editor can improve prose clarity and grammatical correctness without compromising data confidentiality. Empirical benchmarks demonstrate measurable readability gains with zero telemetry transmission.</p>
<h2>Introduction</h2>
<p>Academic drafting imposes strict privacy and precision requirements. Cloud-based proofreading services introduce data leakage risks. Lexicon resolves this tension by running grammar analysis and model inference entirely on-device.</p>
<h2>Methodology</h2>
<p>We evaluated Lexicon&rsquo;s deterministic proofreader and local LLM backend across fifty technical drafts, measuring error detection accuracy and local execution latency.</p>
<h2>Results</h2>
<p>Table 1 summarises the comparative performance metrics of the Lexicon engine.</p>
<table><tbody><tr><th><p>Analysis Engine</p></th><th><p>Accuracy Score</p></th><th><p>Mean Latency</p></th></tr><tr><td><p>Lexicon Rule Engine</p></td><td><p>99.4%</p></td><td><p>12 ms</p></td></tr><tr><td><p>Local Llama Sidecar</p></td><td><p>94.1%</p></td><td><p>410 ms</p></td></tr></tbody></table>
<p>Execution latency scales predictably with model size according to the following formulation:</p>
<div data-type="block-math" data-latex="\\text{Error}(N) = aN^{-b} + c"></div>
<p>where <span data-type="inline-math" data-latex="N"></span> represents parameter count in millions. Tone alignment correlation was calculated as follows:</p>
<div data-type="block-math" data-latex="r = \\frac{\\sum (x_i - \\bar{x})(y_i - \\bar{y})}{\\sqrt{\\sum (x_i - \\bar{x})^2 \\sum (y_i - \\bar{y})^2}}"></div>
<h2>Discussion</h2>
<p>Lexicon demonstrates that local-first AI writing assistants match cloud productivity while preserving total privacy. Future work will focus on rich export format fidelity.</p>
<h2>References</h2>
<ol><li><p>Diop, A. &amp; Sat&omacr;, K. (2024). <em>On-Device Language Models in Lexicon</em>. Journal of Local Computing, 12(3), 45&ndash;67.</p></li><li><p>Eduardo, J. &amp; Deshmukh, P. (2023). Deterministic Grammar Analysis. <em>Lexicon Technical Reports</em>, 9(1), 88&ndash;102.</p></li></ol>
`,
    preview: `
<h1>Research Paper Title</h1>
<p>Abstract &mdash; a concise summary of the paper&rsquo;s contribution, methods, and findings.</p>
<h2>Introduction</h2>
<p>Context, motivation, and the research question&hellip;</p>
`,
  },
  {
    id: "novel-manuscript",
    name: "Novel Manuscript",
    icon: BookOpenText,
    tags: ["fiction", "manuscript", "long-form"],
    description:
      "Standard manuscript format: title block, chapter headers, scene breaks, and dialogue. Paragraphs carry first-line indentation intent, applied at print time by the Novel theme.",
    html: `
<h1>The Lexicon Chronicle</h1>
<p>By Jos&eacute; Eduardo<br>Word count: ~85,000<br>Status: drafted in Lexicon</p>
<hr>
<h1>Chapter One</h1>
<p style="text-indent: 2em">The studio was quiet in the early morning before dawn, and by the time Clara opened Lexicon, the canvas was ready for writing.</p>
<p style="text-indent: 2em">She turned to Sat&omacr;, who was inspecting the proofreading panel on the right side of the screen.</p>
<p style="text-indent: 2em">&ldquo;You didn&rsquo;t sleep,&rdquo; she said.</p>
<p style="text-indent: 2em">He looked up from the monitor and smiled. &ldquo;The entire manuscript is clean.&rdquo;</p>
<hr>
<h1>Chapter Two</h1>
<p style="text-indent: 2em">Three days passed before the final review phase was completed in Lexicon.</p>
<p style="text-indent: 2em">The complete draft was packaged cleanly into a single manuscript file, ready for publishing.</p>
`,
    preview: `
<h1>Chapter One</h1>
<p>Opening paragraph of the chapter, written in plain prose with dialogue embedded.</p>
<hr>
<h1>Chapter Two</h1>
<p>A new scene begins&hellip;</p>
`,
  },
  {
    id: "minimalist-blog",
    name: "Minimalist Blog",
    icon: Article,
    tags: ["casual", "web", "short-form"],
    description:
      "A clean blog post skeleton: catchy title, lead paragraph, pull quote, syntax-highlighted code block, and a summary list.",
    html: `
<h1>Building a Local-First Writing Workflow with Lexicon</h1>
<p><em>By Amina Diop</em></p>
<p>Twelve months ago I moved all my drafting into Lexicon. Here is how local-first editing transformed my focus and speed.</p>
<blockquote><p>&ldquo;Your words belong to you, before and after they are published.&rdquo;</p></blockquote>
<h2>Why local matters</h2>
<p>Writing inside Lexicon ensures your drafts remain strictly private on your own machine. There are no cloud sync hiccups, no telemetry trackers, and no subscription paywalls.</p>
<h2>A small example</h2>
<pre><code class="language-javascript">// A tiny Lexicon local document saver
for (const draft of drafts) {
  saveLocally(draft);
  console.log("saved " + draft.slug);
}</code></pre>
<h2>Summary</h2>
<ul><li><p>100% offline privacy with local AI models.</p></li><li><p>Instant grammar, spelling, and tone feedback.</p></li><li><p>Clean Markdown, HTML, and rich PDF exports.</p></li></ul>
`,
    preview: `
<h1>Post Title</h1>
<p>Lead paragraph that hooks the reader in one or two sentences.</p>
<blockquote><p>&ldquo;A quotable pull-quote from the post.&rdquo;</p></blockquote>
`,
  },
  {
    id: "executive-summary",
    name: "Executive Summary",
    icon: Briefcase,
    tags: ["business", "concise", "actionable"],
    description:
      "A corporate summary: header info, a key-takeaways callout, a structured metrics table, and an action-item task list.",
    html: `
<h1>Lexicon Product Roadmap &mdash; Q3 Review</h1>
<p><strong>Prepared by:</strong> John Doe<br><strong>Date:</strong> August 2026<br><strong>Status:</strong> Approved for release</p>
<h2>Key Takeaways</h2>
<blockquote><p><strong>1.</strong> Lexicon active user adoption grew 45% quarter over quarter. <strong>2.</strong> On-device proofreading latency dropped to 12 ms. <strong>3.</strong> Rich Export Formats (PDF, EPUB, DOCX) are on track for v0.9.0.</p></blockquote>
<p>This quarter confirmed that local-first positioning is Lexicon&rsquo;s core differentiator. The team is focused on delivering rich export presets and template support.</p>
<h2>Metrics</h2>
<table><tbody><tr><th><p>Key Metric</p></th><th><p>Q2</p></th><th><p>Q3</p></th><th><p>Change</p></th></tr><tr><td><p>Active writers</p></td><td><p>4,120</p></td><td><p>5,980</p></td><td><p>+45%</p></td></tr><tr><td><p>Proofread passes / day</p></td><td><p>18,400</p></td><td><p>32,100</p></td><td><p>+74%</p></td></tr><tr><td><p>Mean proofread latency</p></td><td><p>24 ms</p></td><td><p>12 ms</p></td><td><p>-50%</p></td></tr></tbody></table>
<h2>Action Items</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Ship Lexicon Prose Quality Detector (v0.8.0)</p></div></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Complete Template Gallery &amp; Modal (v0.9.0)</p></div></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Implement Styled PDF &amp; EPUB Exporters</p></div></li>
</ul>
`,
    preview: `
<h1>Quarterly Review</h1>
<p>Prepared for leadership &mdash; key metrics and decisions at a glance.</p>
<h2>Key Takeaways</h2>
<p>Growth, risk, and priority actions&hellip;</p>
`,
  },
];
