(function () {
 'use strict';

 document.documentElement.classList.add('js');

 const GITHUB_REPO = 'AashishH15/Lexicon';
 const API_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
 const API_REPO_URL = `https://api.github.com/repos/${GITHUB_REPO}`;
 const FALLBACK_RELEASE_PAGE = `https://github.com/${GITHUB_REPO}/releases/latest`;

 const primaryDownloadBtn = document.getElementById('primary-download-btn');
 const primaryDownloadText = document.getElementById('primary-download-text');
 const releaseVersionText = document.getElementById('release-version');
 const downloadCountBadge = document.getElementById('download-count-badge');
 const downloadCountText = document.getElementById('download-count-text');
  const platformToggleBtn = document.getElementById('platform-toggle');
  const platformMenu = document.getElementById('platform-menu');

  let heroVisible = true;

  function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

 
 function isAppleSiliconGPU() {
 try {
 const canvas = document.createElement('canvas');
 const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
 if (!gl) return false;
 const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
 if (!debugInfo) return false;
 const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
 return /Apple M|Apple GPU|ANGLE.*Apple/i.test(renderer);
 } catch (e) {
 return false;
 }
 }

 
 async function detectEnvironment() {
 const ua = navigator.userAgent || '';
 const isWin = /Windows|Win32|Win64/i.test(ua);
 const isMac = /Macintosh|Mac OS X/i.test(ua);
 const isLinux = /Linux|X11/i.test(ua) && !/Android/i.test(ua);

 let arch = 'x64';

 if (navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === 'function') {
 try {
 const hints = await navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness']);
 const hintsArch = (hints.architecture || '').toLowerCase();
 const hintsBitness = (hints.bitness || '').toString();

 if (hintsArch === 'arm' || hintsArch === 'arm64') {
 arch = 'arm64';
 } else if (hintsBitness === '32') {
 arch = 'x86';
 } else {
 arch = 'x64';
 }
 } catch (err) {
 console.warn('Client Hints detection failed:', err);
 }
 } else {
 if (/ARM64|aarch64/i.test(ua)) {
 arch = 'arm64';
 } else if (/Win64|x86_64|x64|WOW64/i.test(ua)) {
 arch = 'x64';
 } else if (/Win32/i.test(ua) && !/Win64|WOW64/i.test(ua) && !isWin) {
 arch = 'x86';
 }
 }

 if (isLinux) {
 return { key: 'linux_x64', label: 'Download for Linux (DEB)' };
 }

 if (isMac) {
 const isArmMac = arch === 'arm64' || isAppleSiliconGPU() || /Macintosh.*Apple/i.test(ua);
 if (isArmMac) {
 return { key: 'mac_arm64', label: 'Download for macOS (Apple Silicon)' };
 }
 return { key: 'mac_x64', label: 'Download for macOS (Intel)' };
 }

 if (isWin) {
 if (arch === 'arm64') return { key: 'win_arm64', label: 'Download for Windows (ARM64)' };
 if (arch === 'x86') return { key: 'win_x86', label: 'Download for Windows (32-bit)' };
 return { key: 'win_x64', label: 'Download for Windows (x64)' };
 }

 return { key: 'win_x64', label: 'Download for Windows (x64)' };
 }

 
 function matchAsset(assets, key) {
 if (!assets || !assets.length) return null;

 return assets.find(asset => {
 const name = asset.name.toLowerCase();
 if (name.endsWith('.sig') || name.endsWith('.json')) return false;

 if (key === 'linux_x64') {
 return name.endsWith('.deb') || (name.includes('linux') && name.endsWith('.tar.gz'));
 }
 if (key === 'win_x64') {
 return name.endsWith('.exe') && name.includes('x64');
 }
 if (key === 'win_arm64') {
 return name.endsWith('.exe') && (name.includes('arm64') || name.includes('aarch64'));
 }
 if (key === 'win_x86') {
 return name.endsWith('.exe') && (name.includes('x86') || name.includes('i686'));
 }
 if (key === 'mac_arm64') {
 return name.endsWith('.dmg') && (name.includes('aarch64') || name.includes('arm64'));
 }
 if (key === 'mac_x64') {
 return name.endsWith('.dmg') && (name.includes('x64') || name.includes('x86_64'));
 }

 return false;
 });
 }

 
 async function initReleaseInfo() {
 const env = await detectEnvironment();

 if (primaryDownloadText) {
 primaryDownloadText.textContent = env.label;
 }

 try {
 const response = await fetch(API_RELEASES_URL);
 if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);

 const releases = await response.json();
 const latestRelease = Array.isArray(releases) && releases.length > 0 ? releases[0] : releases;
 const tagName = latestRelease.tag_name || 'v0.9.0';
 const latestAssets = latestRelease.assets || [];

 if (releaseVersionText) {
 releaseVersionText.textContent = `Latest version: ${tagName}`;
 }

 let totalDownloads = 0;
 if (Array.isArray(releases)) {
 releases.forEach(rel => {
 if (rel.assets && Array.isArray(rel.assets)) {
 rel.assets.forEach(asset => {
 totalDownloads += (asset.download_count || 0);
 });
 }
 });
 } else {
 totalDownloads = latestAssets.reduce((sum, asset) => sum + (asset.download_count || 0), 0);
 }

 const roundedDownloads = Math.floor(totalDownloads / 5) * 5;
 if (downloadCountBadge && downloadCountText && roundedDownloads > 0) {
 downloadCountText.textContent = `${roundedDownloads}+ downloads`;
 downloadCountBadge.style.visibility = 'visible';
 }
 const trustDownloads = document.getElementById('trust-downloads');
 if (trustDownloads && roundedDownloads > 0) {
   trustDownloads.textContent = roundedDownloads + '+';
 }

 const matchedPrimary = matchAsset(latestAssets, env.key);
 if (primaryDownloadBtn) {
 if (matchedPrimary && matchedPrimary.browser_download_url) {
 primaryDownloadBtn.href = matchedPrimary.browser_download_url;
 } else {
 primaryDownloadBtn.href = latestRelease.html_url || FALLBACK_RELEASE_PAGE;
 }
 }

 ['win_x64', 'win_arm64', 'win_x86', 'mac_arm64', 'mac_x64', 'linux_x64'].forEach(key => {
 const asset = matchAsset(latestAssets, key);
 const el = document.getElementById(`dl-${key.replace('_', '-')}`);
 if (el && asset && asset.browser_download_url) {
 el.href = asset.browser_download_url;
 }
 });

 } catch (err) {
 console.warn('Could not fetch GitHub release details automatically:', err);
 if (primaryDownloadBtn) {
 primaryDownloadBtn.href = FALLBACK_RELEASE_PAGE;
 }
 if (releaseVersionText) {
 releaseVersionText.textContent = 'Latest release on GitHub';
 }
 }
 }

 
 async function initStarsBadge() {
 const starsContainer = document.getElementById('github-stars-container');
 const starsCountText = document.getElementById('github-stars-count');
 if (!starsContainer || !starsCountText) return;

 try {
 const response = await fetch(API_REPO_URL);
 if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
 const data = await response.json();
 const stars = data.stargazers_count;
 if (typeof stars === 'number') {
 starsCountText.textContent = stars;
 starsContainer.style.display = 'inline-flex';
 const trustStars = document.getElementById('trust-stars');
 if (trustStars) trustStars.textContent = String(stars);
 }
 } catch (err) {
 console.warn('Could not fetch GitHub repository stars automatically:', err);
 }
 }

 
 function initPlatformDropdown() {
 if (!platformToggleBtn || !platformMenu) return;

 platformToggleBtn.addEventListener('click', function (e) {
 e.stopPropagation();
 platformMenu.classList.toggle('active');
 });

 document.addEventListener('click', function (e) {
 if (!platformMenu.contains(e.target) && e.target !== platformToggleBtn) {
 platformMenu.classList.remove('active');
 }
 });
 }

  function initSmoothScroll() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof window.Lenis === 'undefined') return;

  const lenis = new Lenis({
  duration: 1.15,
  smoothWheel: true,
  });

  function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
  link.addEventListener('click', function (e) {
  const href = link.getAttribute('href');
  if (href === '#') {
  e.preventDefault();
  lenis.scrollTo(0);
  return;
  }
  const target = document.querySelector(href);
  if (!target) return;
  e.preventDefault();
  lenis.scrollTo(target, { offset: -92 });
  });
  });
  }

  function initRevealAnimations() {
  const revealSelector =
  '.section-header, .bento-card, .proofread-live, .editor-live, .export-live-card, .manifesto-card, .tutorial-card, .privacy-card, .faq-item, .setup-step-box, .support-card, .privacy-comparison-table, .footer';
 const revealEls = Array.prototype.slice.call(document.querySelectorAll(revealSelector));

 if (!('IntersectionObserver' in window)) {
 revealEls.forEach(function (el) { el.classList.add('reveal', 'visible'); });
 return;
 }

 const observer = new IntersectionObserver(function (entries) {
 entries.forEach(function (entry) {
 if (!entry.isIntersecting) return;
 const el = entry.target;
 const siblings = Array.prototype.slice.call(el.parentElement.children)
 .filter(function (n) { return n.classList && n.classList.contains('reveal'); });
 const index = siblings.indexOf(el);
 el.style.transitionDelay = Math.min(index * 80, 400) + 'ms';
 el.classList.add('visible');
 observer.unobserve(el);
 });
 }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });

  revealEls.forEach(function (el) {
  el.classList.add('reveal');
  Array.prototype.forEach.call(el.children, function (child, i) {
  child.style.setProperty('--ci', String(i));
  });
  observer.observe(el);
  });
  }

  function initHeroVisibility() {
  const targets = [
  document.querySelector('.proofread-live'),
  document.querySelector('.editor-live')
  ].filter(function (el) { return !!el; });
  if (!targets.length || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(function (entries) {
  heroVisible = entries.some(function (e) { return e.isIntersecting; });
  }, { threshold: 0.05 });
  targets.forEach(function (el) { observer.observe(el); });
  }

  function initTypingDemo() {
  const typeEl = document.querySelector('.pl-type');
  const caret = document.querySelector('.pl-caret');
  const chip = document.querySelector('.proofread-chip');
  const chipLabel = document.querySelector('.proofread-chip-label');
  const chipFix = document.querySelector('.proofread-chip-fix');
  const chipApply = document.querySelector('.chip-apply');
  const metricsEl = document.querySelector('.proofread-live-metrics');
  if (!typeEl || !caret || !chip) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scripts = [
  { text: 'The quik brown fox jumps over the lazy dog.', err: 'quik', fix: 'quick', label: 'Spelling', clarityBefore: 74 },
  { text: "Its a calm, private way to write your first draft.", err: 'Its', fix: "It's", label: 'Grammar', clarityBefore: 79 },
  { text: 'The report was written by the team in under an hour.', err: 'was written by the team', fix: 'the team wrote', label: 'Passive voice', clarityBefore: 71 },
  { text: 'At the end of the day, we need to deliver on time.', err: 'At the end of the day', fix: 'Ultimately', label: 'Clich\u00E9', clarityBefore: 76 },
  { text: 'I think the report is solid. I think we can ship it.', err: 'I think we can ship it', fix: 'We can ship it', label: 'Repetitive opener', clarityBefore: 70 }
  ];

  function updateMetrics(clarity, count) {
  if (!metricsEl) return;
  metricsEl.textContent = 'Clarity ' + clarity + ' \u00B7 ' + count + (count === 1 ? ' char' : ' chars');
  }

  if (reduced) {
  typeEl.textContent = scripts[0].text.replace(scripts[0].err, scripts[0].fix);
  const staticCount = scripts[0].text.length - scripts[0].err.length + scripts[0].fix.length;
  updateMetrics(100, staticCount);
  return;
  }

  function typeScript(script) {
  return new Promise(function (resolve) {
  typeEl.innerHTML = '';
  const errStart = script.text.indexOf(script.err);
  const errEnd = errStart + script.err.length;
  let i = 0;
  let errSpan = null;
  const out = document.createElement('span');
  typeEl.appendChild(out);
  function tick() {
  if (i >= script.text.length) { setTimeout(resolve, 300); return; }
  const ch = script.text.charAt(i);
  if (i === errStart) {
  errSpan = document.createElement('span');
  errSpan.className = 'err';
  out.appendChild(errSpan);
  }
  const holder = (errSpan && i < errEnd) ? errSpan : out;
  holder.appendChild(document.createTextNode(ch));
  i += 1;
  updateMetrics(script.clarityBefore, i);
  setTimeout(tick, 32 + Math.random() * 28);
  }
  tick();
  });
  }

  async function applyFix(script) {
  await sleep(500);
  const errEl = typeEl.querySelector('.err');
  if (errEl) {
  errEl.classList.remove('err');
  errEl.classList.add('fixed');
  errEl.textContent = script.fix;
  }
  chipApply.textContent = 'Applied';
  chip.classList.add('chip-applied');
  const finalCount = script.text.length - script.err.length + script.fix.length;
  updateMetrics(100, finalCount);
  }

  async function runLoop() {
  let s = 0;
  while (true) {
  if (!heroVisible) { await sleep(500); continue; }
  const script = scripts[s % scripts.length];
  s += 1;
  updateMetrics(script.clarityBefore, 0);
  await typeScript(script);
  await sleep(650);
  chipLabel.textContent = script.label;
  chipFix.textContent = script.err + ' \u2192 ' + script.fix;
  chip.classList.add('chip-show');
  await applyFix(script);
  await sleep(1900);
  chip.classList.remove('chip-show', 'chip-applied');
  chipApply.textContent = 'Apply';
  typeEl.innerHTML = '';
  }
  }

  setTimeout(runLoop, 2400);
  }

  function initEditorDemo() {
  const typeEl = document.querySelector('.el-type');
  const sceneWrap = document.querySelector('.el-scene-wrap');
  const palette = document.querySelector('.cmd-palette');
  const metric = document.querySelector('[data-editor-metric]');
  if (!typeEl || !sceneWrap || !palette) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scripts = [
  {
  cmd: 'math',
  prefix: 'The area of a circle is ',
  metric: 'LaTeX \u00B7 KaTeX math',
  scene: '<div class="el-scene el-scene-math">A = \u03C0r\u00B2</div>'
  },
  {
  cmd: 'quote',
  prefix: 'Add a moment of calm: ',
  metric: 'Slash commands',
  scene: '<div class="el-scene el-scene-quote">A quiet desk, a clear page, nothing else.</div>'
  },
  {
  cmd: 'table',
  prefix: 'Chapter status: ',
  metric: 'Rich tables',
  scene: '<table class="el-scene el-scene-table"><thead><tr><th>Task</th><th>Status</th></tr></thead><tbody><tr><td>Chapter 3</td><td>In progress</td></tr><tr><td>Proofread pass</td><td>Done</td></tr></tbody></table>'
  }
  ];

  const rows = Array.prototype.slice.call(palette.querySelectorAll('.cmd-row'));

  if (reduced) {
  typeEl.textContent = scripts[0].prefix + '/' + scripts[0].cmd;
  sceneWrap.innerHTML = scripts[0].scene;
  sceneWrap.style.maxHeight = (sceneWrap.scrollHeight + 2) + 'px';
  return;
  }

  function typeText(text, done) {
  let i = 0;
  function tick() {
  if (i >= text.length) { done(); return; }
  typeEl.appendChild(document.createTextNode(text.charAt(i)));
  i += 1;
  setTimeout(tick, 34 + Math.random() * 26);
  }
  tick();
  }

  async function runLoop() {
  let s = 0;
  while (true) {
  if (!heroVisible) { await sleep(500); continue; }
  const script = scripts[s % scripts.length];
  s += 1;
  typeEl.innerHTML = '';
  sceneWrap.style.maxHeight = '0px';
  sceneWrap.innerHTML = '';
  palette.classList.remove('show');
  if (metric) metric.textContent = script.metric;
  await new Promise(function (resolve) { typeText(script.prefix, resolve); });
  typeEl.appendChild(document.createTextNode('/'));
  palette.classList.add('show');
  await sleep(420);
  await new Promise(function (resolve) {
  let i = 0;
  function tick() {
  if (i >= script.cmd.length) { resolve(); return; }
  const ch = script.cmd.charAt(i);
  typeEl.appendChild(document.createTextNode(ch));
  i += 1;
  const partial = script.cmd.slice(0, i);
  rows.forEach(function (row) {
  const active = row.getAttribute('data-cmd').indexOf(partial) === 0;
  row.classList.toggle('active', active);
  });
  setTimeout(tick, 85);
  }
  tick();
  });
  await sleep(350);
  palette.classList.remove('show');
  sceneWrap.innerHTML = script.scene;
  sceneWrap.style.maxHeight = (sceneWrap.scrollHeight + 2) + 'px';
  await sleep(2600);
  }
  }

  setTimeout(runLoop, 2400);
  }

  function initExportStudioDemo() {
    const card = document.getElementById('export-demo-card');
    if (!card) return;

    const formatButtons = Array.prototype.slice.call(card.querySelectorAll('.export-chip'));
    const themeButtons = Array.prototype.slice.call(card.querySelectorAll('.export-preset-chip'));
    const previewBox = document.getElementById('export-live-preview');
    const titleEl = document.getElementById('export-snippet-title');
    const textEl = document.getElementById('export-snippet-text');
    const docTag = document.getElementById('export-doc-tag');
    const metricsText = document.getElementById('export-metrics-text');
    const progressFill = document.getElementById('export-progress-fill');
    const statusBadge = document.getElementById('export-status-badge');

    const themesData = {
      academic: {
        tag: 'Academic Paper Template',
        title: 'A Quantitative Analysis of Local-First Systems',
        text: 'Abstract. Local-first software architectures eliminate remote cloud dependencies, preserve user data privacy, and deliver responsive typing.',
        class: 'theme-academic'
      },
      novel: {
        tag: 'Novel Manuscript Template',
        title: 'Chapter 1: The Midnight Call',
        text: 'The rain tapped rhythmically against the window pane. Arthur sat at his mahogany desk, staring at the blank sheet of paper before him...',
        class: 'theme-novel'
      },
      minimalist: {
        tag: 'Minimalist Blog Post',
        title: 'Designing for Quiet Focus in Modern Web Apps',
        text: 'Great interfaces don’t shout. They step out of the way, giving your prose maximum breathing room and visual calm.',
        class: 'theme-minimalist'
      },
      executive: {
        tag: 'Executive Summary Brief',
        title: 'Q3 Product Strategy & Privacy Compliance Report',
        text: 'Key Takeaways: 100% on-device AI rewrites achieved zero compliance risk while reducing cloud API infrastructure costs by $14,000/mo.',
        class: 'theme-executive'
      }
    };

    const formatsData = {
      pdf: 'PDF (Vector) · 300 DPI',
      epub: 'EPUB 3 · Reflowable eBook',
      docx: 'DOCX · Tracked Changes Redlines',
      html: 'HTML · Self-Contained Web Document'
    };

    let activeFormat = 'pdf';
    let activeTheme = 'academic';
    let autoTimer = null;
    const themeKeys = ['academic', 'novel', 'minimalist', 'executive'];
    const formatKeys = ['pdf', 'epub', 'docx', 'html'];
    let autoIndex = 0;

    function triggerExportAnimation(fmtKey) {
      if (!progressFill) return;
      progressFill.style.transition = 'none';
      progressFill.style.width = '0%';
      progressFill.style.opacity = '1';
      setTimeout(function () {
        progressFill.style.transition = 'width 0.8s ease';
        progressFill.style.width = '100%';
        if (statusBadge) statusBadge.textContent = 'Rendering ' + fmtKey.toUpperCase() + '...';
        setTimeout(function () {
          if (statusBadge) statusBadge.textContent = 'Export Complete ✓';
          setTimeout(function () {
            progressFill.style.transition = 'opacity 0.4s ease';
            progressFill.style.opacity = '0';
            setTimeout(function () {
              progressFill.style.width = '0%';
              progressFill.style.opacity = '1';
              if (statusBadge) statusBadge.textContent = 'Ready for 1-click export';
            }, 400);
          }, 600);
        }, 800);
      }, 20);
    }

    function updateState(formatKey, themeKey, isUserClick) {
      activeFormat = formatKey || activeFormat;
      activeTheme = themeKey || activeTheme;

      formatButtons.forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-format') === activeFormat);
      });

      themeButtons.forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-theme') === activeTheme);
      });

      if (metricsText && formatsData[activeFormat]) {
        metricsText.textContent = formatsData[activeFormat];
      }

      const tData = themesData[activeTheme];
      if (tData && previewBox) {
        previewBox.className = 'export-live-snippet-box ' + tData.class;
        if (docTag) docTag.textContent = tData.tag;
        if (titleEl) titleEl.textContent = tData.title;
        if (textEl) textEl.textContent = tData.text;
      }

      triggerExportAnimation(activeFormat);

      if (isUserClick && autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
    }

    formatButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        updateState(btn.getAttribute('data-format'), activeTheme, true);
      });
    });

    themeButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        updateState(activeFormat, btn.getAttribute('data-theme'), true);
      });
    });

    // Auto-cycle demo every 3.8 seconds
    autoTimer = setInterval(function () {
      autoIndex = (autoIndex + 1) % 4;
      updateState(formatKeys[autoIndex], themeKeys[autoIndex], false);
    }, 3800);
  }

  function initAiWowDemo() {
    const card = document.getElementById('ai-wow-demo');
    if (!card) return;

    const typeTextEl = document.getElementById('ai-type-text');
    const statusBadge = document.getElementById('ai-wow-status-badge');
    const grammarChip = document.getElementById('ai-grammar-chip');
    const chipBtn = document.getElementById('ai-chip-btn');
    const toolbar = document.getElementById('ai-wow-toolbar');
    const toolButtons = Array.prototype.slice.call(card.querySelectorAll('.ai-toolbar-btn'));
    const diffCard = document.getElementById('ai-wow-diff');
    const diffLabel = document.getElementById('ai-diff-label');
    const diffRemoved = document.getElementById('ai-diff-removed');
    const diffAdded = document.getElementById('ai-diff-added');
    const caret = document.getElementById('ai-caret');

    if (!typeTextEl || !grammarChip || !toolbar || !diffCard) return;

    const toolsData = {
      concise: {
        source: 'The algorithm works efficiently.',
        result: 'The algorithm is efficient.',
        label: 'Lex Rewrite \u00B7 Concise'
      },
      rewrite: {
        source: 'The algorithm works efficiently.',
        result: 'The algorithm runs efficiently.',
        label: 'Lex Rewrite \u00B7 Rewrite'
      },
      active: {
        source: 'The report was written by the team.',
        result: 'The team wrote the report.',
        label: 'Lex Rewrite \u00B7 Active Voice'
      },
      professional: {
        source: 'The algorithm works efficiently.',
        result: 'The algorithm operates with optimal efficiency.',
        label: 'Lex Rewrite \u00B7 Professional'
      },
      friendly: {
        source: 'The algorithm works efficiently.',
        result: 'This algorithm works really well.',
        label: 'Lex Rewrite \u00B7 Friendly'
      },
      summary: {
        source: 'The algorithm works efficiently.',
        result: 'An efficient algorithm.',
        label: 'Lex Rewrite \u00B7 Summary'
      },
      keypoints: {
        source: 'The algorithm works efficiently.',
        result: '\u2022 Runs efficiently  \u2022 Reliable performance',
        label: 'Lex Rewrite \u00B7 Key Points'
      }
    };
    const toolKeys = ['concise', 'rewrite', 'active', 'professional', 'friendly', 'summary', 'keypoints'];

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      typeTextEl.textContent = toolsData.concise.result;
      return;
    }

    let inView = true;
    if ('IntersectionObserver' in window) {
      inView = false;
      const observer = new IntersectionObserver(function (entries) {
        inView = entries.some(function (entry) { return entry.isIntersecting; });
      }, { threshold: 0.15 });
      observer.observe(card);
    }

    let autoTimer = null;
    let autoIndex = 0;
    let activeTool = 'concise';
    let interactive = false;
    let introToken = 0;

    function sleepMs(ms) {
      return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    async function waitForView() {
      while (!inView) {
        await sleepMs(400);
      }
    }

    async function typeString(str, speed) {
      typeTextEl.innerHTML = '';
      for (let i = 0; i < str.length; i++) {
        typeTextEl.textContent += str.charAt(i);
        await sleepMs(speed || 36);
      }
    }

    function setHighlightedSource(source) {
      typeTextEl.innerHTML = '';
      const span = document.createElement('span');
      span.className = 'ai-highlighted';
      span.textContent = source;
      typeTextEl.appendChild(span);
      typeTextEl.style.color = '';
    }

    function applyTool(toolKey, isUserClick) {
      const data = toolsData[toolKey];
      if (!data) return;
      activeTool = toolKey;

      toolButtons.forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-tool') === toolKey);
      });

      setHighlightedSource(data.source);
      if (diffLabel) diffLabel.textContent = data.label;
      if (diffRemoved) diffRemoved.textContent = data.source;
      if (diffAdded) diffAdded.textContent = data.result;

      grammarChip.classList.remove('visible');
      toolbar.classList.add('visible');
      diffCard.classList.add('visible');
      if (caret) caret.style.display = 'none';

      if (statusBadge) {
        statusBadge.textContent = isUserClick
          ? 'Lex \u00B7 ' + toolKey.charAt(0).toUpperCase() + toolKey.slice(1)
          : 'Lex Rewriting...';
      }

      if (isUserClick && autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
        // Resume auto-cycle after a short pause so the demo stays alive
        setTimeout(function () {
          if (!interactive || autoTimer) return;
          startAutoCycle();
        }, 8000);
      }
    }

    function startAutoCycle() {
      if (autoTimer) clearInterval(autoTimer);
      autoTimer = setInterval(function () {
        if (!inView) return;
        autoIndex = (autoIndex + 1) % toolKeys.length;
        applyTool(toolKeys[autoIndex], false);
        if (statusBadge) statusBadge.textContent = 'Offline Engine \u00B7 Try a tool';
      }, 3800);
    }

    function enterInteractiveMode() {
      interactive = true;
      applyTool('concise', false);
      if (statusBadge) statusBadge.textContent = 'Offline Engine \u00B7 Try a tool';
      startAutoCycle();
    }

    toolButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!interactive) return;
        const key = btn.getAttribute('data-tool');
        autoIndex = Math.max(0, toolKeys.indexOf(key));
        applyTool(key, true);
        if (statusBadge) {
          const label = (toolsData[key] && toolsData[key].label) || key;
          statusBadge.textContent = label.replace('Lex Rewrite \u00B7 ', 'Lex \u00B7 ') + ' Applied \u2713';
        }
      });
    });

    async function runIntroOnce(token) {
      grammarChip.classList.remove('visible');
      if (chipBtn) chipBtn.classList.remove('clicked');
      toolbar.classList.remove('visible');
      diffCard.classList.remove('visible');
      typeTextEl.innerHTML = '';
      typeTextEl.style.color = '';
      if (caret) caret.style.display = '';
      if (statusBadge) statusBadge.textContent = '100% Offline \u00B7 On-device';

      await waitForView();
      if (token !== introToken) return;
      await sleepMs(800);
      if (token !== introToken) return;

      if (statusBadge) statusBadge.textContent = 'Typing Draft...';
      await typeString('The algorithm works ', 32);
      if (token !== introToken) return;

      const typoSpan = document.createElement('span');
      typoSpan.className = 'pl-squiggle';
      typeTextEl.appendChild(typoSpan);
      const typoWord = 'efficient';
      for (let i = 0; i < typoWord.length; i++) {
        typoSpan.textContent += typoWord.charAt(i);
        await sleepMs(38);
        if (token !== introToken) return;
      }

      await sleepMs(400);
      if (token !== introToken) return;

      if (statusBadge) statusBadge.textContent = '1 Grammar Suggestion';
      grammarChip.classList.add('visible');
      await sleepMs(1000);
      if (token !== introToken) return;

      if (chipBtn) chipBtn.classList.add('clicked');
      await sleepMs(300);
      if (token !== introToken) return;

      typeTextEl.innerHTML = 'The algorithm works efficiently.';
      grammarChip.classList.remove('visible');
      if (statusBadge) statusBadge.textContent = 'Spelling Fixed \u2713';
      await sleepMs(900);
      if (token !== introToken) return;

      if (statusBadge) statusBadge.textContent = 'Lex Ready \u00B7 Offline Engine';
      setHighlightedSource('The algorithm works efficiently.');
      await sleepMs(600);
      if (token !== introToken) return;

      enterInteractiveMode();
    }

    setTimeout(function () {
      introToken += 1;
      runIntroOnce(introToken);
    }, 1000);
  }

  function initMobileNav() {
    const toggle = document.getElementById('nav-toggle');
    const links = document.getElementById('nav-links');
    if (!toggle || !links) return;

    function closeMenu() {
      links.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    }

    function openMenu() {
      links.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
    }

    toggle.addEventListener('click', function () {
      if (links.classList.contains('is-open')) closeMenu();
      else openMenu();
    });

    links.querySelectorAll('a').forEach(function (anchor) {
      anchor.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMenu();
    });

    document.addEventListener('click', function (event) {
      if (!links.classList.contains('is-open')) return;
      if (links.contains(event.target) || toggle.contains(event.target)) return;
      closeMenu();
    });
  }

  function softenMobileHeroVideo() {
    if (window.matchMedia('(max-width: 640px)').matches) {
      const video = document.querySelector('.faux-window-body video');
      if (video) {
        video.removeAttribute('autoplay');
        video.pause();
        video.setAttribute('preload', 'none');
      }
    }
  }

  function initFaqAccordion() {
    const items = Array.prototype.slice.call(document.querySelectorAll('.faq-item'));
    if (!items.length) return;

    function setExpanded(item, expanded) {
      const summary = item.querySelector('summary');
      const answer = item.querySelector('.faq-answer');

      item.classList.toggle('is-open', expanded);
      if (summary) summary.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      if (answer) answer.setAttribute('aria-hidden', expanded ? 'false' : 'true');
    }

    items.forEach(function (item) {
      const summary = item.querySelector('summary');
      if (!summary) return;

      // Keep native open so the browser never tears the panel out of layout
      // mid-close (that snap/jitter). Visual state is class-driven only.
      item.open = true;
      setExpanded(item, false);

      summary.addEventListener('click', function (event) {
        event.preventDefault();

        const willOpen = !item.classList.contains('is-open');

        items.forEach(function (other) {
          if (other !== item) setExpanded(other, false);
        });

        setExpanded(item, willOpen);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initSmoothScroll();
    initReleaseInfo();
    initStarsBadge();
    initPlatformDropdown();
    initMobileNav();
    softenMobileHeroVideo();
    initFaqAccordion();
    initRevealAnimations();
    initHeroVisibility();
    initTypingDemo();
    initEditorDemo();
    initExportStudioDemo();
    initAiWowDemo();
  });
})();