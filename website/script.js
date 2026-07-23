(function () {
  'use strict';

  // Constants & GitHub API Endpoints
  const GITHUB_REPO = 'AashishH15/Lexicon';
  const API_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
  const API_REPO_URL = `https://api.github.com/repos/${GITHUB_REPO}`;
  const FALLBACK_RELEASE_PAGE = `https://github.com/${GITHUB_REPO}/releases/latest`;

  // DOM Elements
  const primaryDownloadBtn = document.getElementById('primary-download-btn');
  const primaryDownloadText = document.getElementById('primary-download-text');
  const releaseVersionText = document.getElementById('release-version');
  const downloadCountBadge = document.getElementById('download-count-badge');
  const downloadCountText = document.getElementById('download-count-text');
  const platformToggleBtn = document.getElementById('platform-toggle');
  const platformMenu = document.getElementById('platform-menu');

  /**
   * Helper: Detect Apple Silicon GPU via WebGL (for Safari on M-series Macs)
   */
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

  /**
   * Dynamic OS & CPU Architecture Detection
   */
  async function detectEnvironment() {
    const ua = navigator.userAgent || '';
    const isWin = /Windows|Win32|Win64/i.test(ua);
    const isMac = /Macintosh|Mac OS X/i.test(ua);

    let arch = 'x64';

    // 1. User-Agent Client Hints
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
      // 2. UA String parsing fallback
      if (/ARM64|aarch64/i.test(ua)) {
        arch = 'arm64';
      } else if (/Win64|x86_64|x64|WOW64/i.test(ua)) {
        arch = 'x64';
      } else if (/Win32/i.test(ua) && !/Win64|WOW64/i.test(ua) && !isWin) {
        arch = 'x86';
      }
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

  /**
   * Flexible Release Asset Matcher for Tauri Builds
   */
  function matchAsset(assets, key) {
    if (!assets || !assets.length) return null;

    return assets.find(asset => {
      const name = asset.name.toLowerCase();
      // Skip signature files, json update files, and tar.gz bundles
      if (name.endsWith('.sig') || name.endsWith('.tar.gz') || name.endsWith('.json')) return false;

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

  /**
   * Fetch All GitHub Releases & Update Download Links + Total Downloads Count Across All Releases
   */
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
      const tagName = latestRelease.tag_name || 'v0.6.0';
      const latestAssets = latestRelease.assets || [];

      if (releaseVersionText) {
        releaseVersionText.textContent = `Latest version: ${tagName}`;
      }

      // Calculate total download count across ALL releases (matching GitHub's total download badge)
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

      // Find direct download link for primary detected OS from the latest release
      const matchedPrimary = matchAsset(latestAssets, env.key);
      if (primaryDownloadBtn) {
        if (matchedPrimary && matchedPrimary.browser_download_url) {
          primaryDownloadBtn.href = matchedPrimary.browser_download_url;
        } else {
          primaryDownloadBtn.href = latestRelease.html_url || FALLBACK_RELEASE_PAGE;
        }
      }

      // Update manual platform dropdown menu items with direct download links
      ['win_x64', 'win_arm64', 'win_x86', 'mac_arm64', 'mac_x64'].forEach(key => {
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

  /**
   * Fetch GitHub Repository Stars & Update Header Badge
   */
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
      }
    } catch (err) {
      console.warn('Could not fetch GitHub repository stars automatically:', err);
    }
  }

  /**
   * Platform Dropdown Toggle
   */
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

  // Initialize on DOM Ready
  document.addEventListener('DOMContentLoaded', function () {
    initReleaseInfo();
    initStarsBadge();
    initPlatformDropdown();
  });
})();
