import { useState } from "react";
import {
  X,
  ShieldCheck,
  PencilLine,
  Robot,
  ArrowRight,
  ArrowLeft,
  Check,
  BookOpen,
  SlidersHorizontal,
  Sparkle,
  Palette,
  Flask,
  ChatTeardropText,
  Info,
} from "@phosphor-icons/react";
import ModelManager from "./ModelManager.jsx";
import Toggle from "./Toggle.jsx";
import LanguageDropdown from "./LanguageDropdown.jsx";
import { SETTINGS_DEFAULTS } from "./Settings.jsx";
import { TYPOGRAPHY_PRESETS } from "./typographyPresets.js";
import { PAPER_TEXTURES } from "./paperTextures.js";
import { READING_MODES } from "./readingMode.js";
import {
  loadTypographyPreset,
  loadPaperTexture,
  loadReadingMode,
  typographyPresetKey,
  paperTextureKey,
  readingModeKey,
} from "./appearanceSettings.js";
import { LANGUAGES } from "./languages.js";

export default function OnboardingModal({
  onClose,
  onConfigured,
  onPreferenceChange,
  onFinish,
  typographyPreset: activePresetProp,
  onTypographyPresetChange,
  paperTexture: activeTextureProp,
  onPaperTextureChange,
  readingMode: activeReadingModeProp,
  onReadingModeChange,
  betaOptIn: activeBetaOptInProp,
  onBetaOptInChange,
}) {
  const [step, setStep] = useState(1);
  const [language, setLanguage] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("lexicon:settings"));
      return saved?.language || SETTINGS_DEFAULTS.language;
    } catch {
      return SETTINGS_DEFAULTS.language;
    }
  });

  const [liveProofread, setLiveProofread] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("lexicon:settings"));
      return saved?.liveProofread !== undefined
        ? saved.liveProofread
        : SETTINGS_DEFAULTS.liveProofread;
    } catch {
      return SETTINGS_DEFAULTS.liveProofread;
    }
  });

  const [betaOptIn, setBetaOptIn] = useState(() => {
    if (activeBetaOptInProp !== undefined) return activeBetaOptInProp;
    const saved = localStorage.getItem("lexicon:betaOptIn");
    return saved !== null ? saved === "true" : (SETTINGS_DEFAULTS.betaOptIn || false);
  });

  const [preset, setPreset] = useState(() => activePresetProp || loadTypographyPreset());
  const [texture, setTexture] = useState(() => activeTextureProp || loadPaperTexture());
  const [reading, setReading] = useState(() => activeReadingModeProp || loadReadingMode());

  function handlePresetChange(val) {
    setPreset(val);
    localStorage.setItem(typographyPresetKey, val);
    onTypographyPresetChange?.(val);
  }

  function handleTextureChange(val) {
    setTexture(val);
    localStorage.setItem(paperTextureKey, val);
    onPaperTextureChange?.(val);
  }

  function handleReadingChange(val) {
    setReading(val);
    localStorage.setItem(readingModeKey, val);
    onReadingModeChange?.(val);
  }

  function handleBetaToggle(val) {
    setBetaOptIn(val);
    try {
      localStorage.setItem("lexicon:betaOptIn", String(val));
    } catch {
      // Ignore
    }
    onBetaOptInChange?.(val);
  }

  async function openFeedbackUrl(e) {
    e?.preventDefault?.();
    const url = "https://tally.so/r/LZq8vy";
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
    } catch {
      window.open(url, "_blank");
    }
  }

  function saveSettings(newLang, newLive) {
    try {
      const saved = JSON.parse(localStorage.getItem("lexicon:settings")) || {};
      const updated = {
        ...SETTINGS_DEFAULTS,
        ...saved,
        language: newLang,
        liveProofread: newLive,
      };
      localStorage.setItem("lexicon:settings", JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  }

  function handleLanguageChange(code) {
    setLanguage(code);
    localStorage.setItem("lexicon:language", code);
    saveSettings(code, liveProofread);
  }

  function handleLiveProofreadToggle(val) {
    setLiveProofread(val);
    saveSettings(language, val);
  }

  function completeOnboarding(loadSample = false) {
    localStorage.setItem("lexicon:aiSetupDone", "true");
    if (onFinish) {
      onFinish({ loadSample, language });
    } else {
      onClose?.();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
      <div
        className="flex max-h-[90vh] h-auto w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div className="flex items-center gap-2">
            <span id="onboarding-title" className="font-serif text-lg font-medium text-ink">Lexicon Setup</span>
            <span className="rounded bg-hairline/80 px-2.5 py-0.5 font-mono text-[11px] font-medium text-ink">
              Step {step} of 5
            </span>
          </div>
          <button
            type="button"
            onClick={() => completeOnboarding(false)}
            className="rounded p-1.5 text-muted transition-colors hover:bg-hairline/60 hover:text-ink"
            title="Skip onboarding"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="grid grid-cols-5 gap-1.5 bg-hairline/30 px-6 py-1.5 border-b border-hairline/50">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i <= step ? "bg-ink" : "bg-hairline/70"
              }`}
            />
          ))}
        </div>

        {/* Content Body */}
        <div className="lex-scroll min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="font-serif text-2xl font-medium tracking-tight text-ink">
                  Your Private, Offline Writing Companion
                </h2>
                <p className="font-sans text-sm text-muted leading-relaxed">
                  Lexicon is built to keep your writing completely private, calm, and distraction-free. No cloud accounts, no subscriptions, and no tracking.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-3.5 transition-colors">
                  <div className="mt-0.5 rounded-lg bg-hairline/60 p-2 text-ink">
                    <ShieldCheck size={20} weight="bold" />
                  </div>
                  <div>
                    <h3 className="font-sans text-sm font-semibold text-ink">100% Offline & Private</h3>
                    <p className="font-sans text-xs text-muted leading-normal mt-0.5">
                      Your drafts, notes, and documents stay strictly on your device. Nothing is uploaded to any remote server.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-3.5 transition-colors">
                  <div className="mt-0.5 rounded-lg bg-hairline/60 p-2 text-ink">
                    <PencilLine size={20} weight="bold" />
                  </div>
                  <div>
                    <h3 className="font-sans text-sm font-semibold text-ink">Local Rule Engine</h3>
                    <p className="font-sans text-xs text-muted leading-normal mt-0.5">
                      Instant, deterministic grammar and spellchecking powered by local LanguageTool (zero LLM latency).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-xl border border-hairline bg-canvas p-3.5 transition-colors">
                  <div className="mt-0.5 rounded-lg bg-hairline/60 p-2 text-ink">
                    <Robot size={20} weight="bold" />
                  </div>
                  <div>
                    <h3 className="font-sans text-sm font-semibold text-ink">Your Local Assistant (Lex)</h3>
                    <p className="font-sans text-xs text-muted leading-normal mt-0.5">
                      Opt-in for rewriting, tone adjustments, and summaries running entirely on your local hardware.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="font-serif text-2xl font-medium tracking-tight text-ink">
                  Language & Typography
                </h2>
                <p className="font-sans text-sm text-muted leading-relaxed">
                  Choose your primary writing language and font preset for body text and headings.
                </p>
              </div>

              <div className="space-y-4 pt-1">
                {/* Language Picker */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 font-sans text-xs font-semibold text-ink uppercase tracking-wider">
                    <SlidersHorizontal size={14} weight="bold" /> Primary Language
                    <span className="group relative inline-flex normal-case tracking-normal">
                      <Info
                        size={12}
                        weight="bold"
                        className="text-muted"
                        aria-label="Language info"
                      />
                      <span className="pointer-events-none absolute left-0 top-5 z-20 w-56 rounded-md border border-hairline bg-white p-2.5 font-sans text-[11px] font-normal leading-relaxed text-muted opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100">
                        If a selected language doesn&apos;t load or apply
                        correctly in Lexicon, please take a screenshot and send
                        it through the feedback form.
                      </span>
                    </span>
                  </label>
                  <LanguageDropdown
                    options={LANGUAGES}
                    value={language}
                    onChange={handleLanguageChange}
                  />
                </div>

                {/* Typography Preset */}
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-1.5 font-sans text-xs font-semibold text-ink uppercase tracking-wider">
                    <Palette size={14} weight="bold" /> Typography Preset
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {TYPOGRAPHY_PRESETS.map((p) => {
                      const sampleFont =
                        p.id === "editorial"
                          ? '"Newsreader", Georgia, serif'
                          : p.id === "modern"
                            ? '"Inter", sans-serif'
                            : p.id === "monospace"
                              ? '"JetBrains Mono", "Courier New", monospace'
                              : '"Geist Sans", -apple-system, sans-serif';
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handlePresetChange(p.id)}
                          className={
                            "flex flex-col justify-between rounded-xl border p-3 text-left transition-all " +
                            (preset === p.id
                              ? "border-ink bg-hairline/40 text-ink shadow-sm ring-1 ring-ink"
                              : "border-hairline bg-canvas text-muted hover:border-muted hover:text-ink")
                          }
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-sans text-xs font-bold text-ink">{p.label}</span>
                              {preset === p.id && <Check size={14} weight="bold" className="text-ink" />}
                            </div>
                            <p className="mt-1 font-sans text-[11px] leading-snug text-muted">{p.description}</p>
                          </div>
                          {/* In-Card Live Sample Text Preview */}
                          <div className="mt-2.5 rounded-lg border border-hairline bg-canvas p-2 text-[11px]">
                            <span
                              style={{ fontFamily: sampleFont }}
                              className={`text-ink leading-tight block ${p.id === "monospace" ? "font-mono" : ""}`}
                            >
                              The quick brown fox jumps over the lazy dog.
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="font-serif text-2xl font-medium tracking-tight text-ink">
                  Paper Texture & Reading Mode
                </h2>
                <p className="font-sans text-sm text-muted leading-relaxed">
                  Select your preferred writing surface and reading accessibility enhancements.
                </p>
              </div>

              <div className="space-y-5 pt-1">
                {/* Paper Canvas Texture */}
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 font-sans text-xs font-semibold text-ink uppercase tracking-wider">
                    <Palette size={14} weight="bold" /> Paper Texture
                    <span className="rounded border border-hairline px-1.5 py-px font-mono text-[9px] font-normal uppercase tracking-wider text-muted">
                      Beta
                    </span>
                    <span className="group relative inline-flex normal-case tracking-normal">
                      <Info
                        size={12}
                        weight="bold"
                        className="text-muted"
                        aria-label="Paper texture beta info"
                      />
                      <span className="pointer-events-none absolute left-0 top-5 z-20 w-56 rounded-md border border-hairline bg-white p-2.5 font-sans text-[11px] font-normal leading-relaxed text-muted opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100">
                        Paper textures are in beta and some edge cases may
                        remain. If you find one, please take a screenshot and
                        send it through the feedback form.
                      </span>
                    </span>
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {PAPER_TEXTURES.map((t) => {
                      const displayLabel = t.id === "warm-cream" ? "Cream" : t.label;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleTextureChange(t.id)}
                          className={
                            "flex flex-col items-center justify-between rounded-xl border p-2.5 transition-all h-20 " +
                            (texture === t.id
                              ? "border-ink bg-hairline/40 text-ink shadow-sm ring-1 ring-ink"
                              : "border-hairline bg-canvas text-muted hover:border-muted hover:text-ink")
                          }
                        >
                          <div className="flex w-full items-center justify-between">
                            <div
                              className="h-4 w-4 rounded-full border border-black/15 shadow-xs"
                              style={{ backgroundColor: t.pageColor }}
                            />
                            {texture === t.id ? (
                              <Check size={13} weight="bold" className="text-ink" />
                            ) : (
                              <div className="h-3 w-3" />
                            )}
                          </div>
                          <span className="font-sans text-[11px] font-semibold text-ink truncate whitespace-nowrap">
                            {displayLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Reading Mode */}
                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-1.5 font-sans text-xs font-semibold text-ink uppercase tracking-wider">
                    <BookOpen size={14} weight="bold" /> Reading Mode
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {READING_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleReadingChange(m.id)}
                        className={
                          "flex flex-col items-start rounded-xl border p-3 text-left transition-all " +
                          (reading === m.id
                            ? "border-ink bg-hairline/40 text-ink shadow-sm ring-1 ring-ink"
                            : "border-hairline bg-canvas text-muted hover:border-muted hover:text-ink")
                        }
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="font-sans text-xs font-bold text-ink">{m.label}</span>
                          {reading === m.id && <Check size={14} weight="bold" className="text-ink" />}
                        </div>
                        {/* Live Sample Preview for Reading Mode */}
                        <div className="mt-2 w-full rounded-lg border border-hairline bg-canvas p-2 text-[11px] text-ink">
                          {m.id === "bionic" ? (
                            <span className="leading-tight block">
                              <strong>The</strong> <strong>qui</strong>ck <strong>bro</strong>wn <strong>fo</strong>x.
                            </span>
                          ) : m.id === "open-dyslexic" ? (
                            <span style={{ fontFamily: '"OpenDyslexic", sans-serif' }} className="leading-tight block">
                              The quick brown fox.
                            </span>
                          ) : (
                            <span className="leading-tight block text-muted">
                              Standard rendering.
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="font-serif text-2xl font-medium tracking-tight text-ink">
                  Configure Lex Assistant
                </h2>
                <p className="font-sans text-sm text-muted leading-relaxed">
                  Lex is your local assistant writing companion for rewriting, tone adjustments, and summaries.
                </p>
              </div>

              <div className="pt-1">
                <ModelManager
                  mode="onboarding"
                  onConfigured={onConfigured}
                  onPreferenceChange={onPreferenceChange}
                  renderFooter={renderStep3Footer}
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5 text-center py-1">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-hairline/40 p-2">
                <img src="/lexicon-logo.png" alt="Lexicon Logo" className="h-10 w-10 object-contain" />
              </div>

              <div className="space-y-1.5">
                <h2 className="font-serif text-2xl font-medium tracking-tight text-ink">
                  You're Ready to Write!
                </h2>
                <p className="font-sans text-sm text-muted max-w-sm mx-auto leading-relaxed">
                  Explore Lexicon's inline proofreading, LaTeX math rendering, and local AI rewriting tools right away.
                </p>
              </div>

              {/* Beta Updates Opt-In Card */}
              <div className="mx-auto max-w-sm rounded-xl border border-hairline bg-canvas p-3.5 text-left transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-hairline/60 p-2 text-ink">
                      <Flask size={18} weight="bold" />
                    </div>
                    <div>
                      <h3 className="font-sans text-xs font-semibold text-ink">Receive Beta Updates</h3>
                      <p className="font-sans text-[11px] text-muted leading-tight mt-0.5">
                        Get early pre-release builds and test new features.
                      </p>
                    </div>
                  </div>
                  <Toggle checked={betaOptIn} onChange={handleBetaToggle} label="Toggle beta releases" />
                </div>
              </div>

              {/* Start Buttons */}
              <div className="space-y-2.5 pt-1 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={() => completeOnboarding(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 py-2.5 font-sans text-xs font-semibold text-white shadow-md transition-all hover:bg-ink/90 active:scale-[0.99]"
                >
                  <BookOpen size={16} weight="bold" />
                  <span>Start Writing with Sample Draft</span>
                </button>

                <button
                  type="button"
                  onClick={() => completeOnboarding(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-hairline bg-canvas px-5 py-2 font-sans text-xs font-semibold text-ink transition-colors hover:bg-hairline/40"
                >
                  <span>Start Blank Canvas</span>
                </button>

                {/* Send Feedback / Report Issue */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={openFeedbackUrl}
                    className="inline-flex items-center justify-center gap-1.5 font-sans text-[11px] font-medium text-muted transition-colors hover:text-ink hover:underline cursor-pointer"
                  >
                    <ChatTeardropText size={14} weight="bold" />
                    <span>Send feedback or report an issue</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {step !== 4 && (
          <div className="flex items-center justify-between border-t border-hairline px-6 py-4 bg-hairline/20">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 rounded-xl border border-hairline bg-canvas px-4 py-2 font-sans text-xs font-semibold text-ink transition-colors hover:bg-hairline/50"
              >
                <ArrowLeft size={14} weight="bold" /> Back
              </button>
            ) : (
              <div />
            )}

            {step < 5 && (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-1.5 rounded-xl bg-ink px-5 py-2 font-sans text-xs font-semibold text-white shadow-xs transition-colors hover:bg-ink/90 active:scale-[0.99]"
              >
                <span>Continue</span> <ArrowRight size={14} weight="bold" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  function renderStep3Footer({ phase, wantBundle, modelKey, status, handleDownload }) {
    const ollamaActive = status?.preference?.backend === "ollama";
    const lmStudioActive = status?.preference?.backend === "lmstudio";
    return (
      <div className="mt-4 flex items-center justify-between border-t border-hairline pt-4">
        <button
          type="button"
          onClick={() => setStep(3)}
          className="flex items-center gap-1 font-sans text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={16} weight="bold" /> Back
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStep(5)}
            className="rounded px-3 py-2 font-sans text-sm text-muted transition-colors hover:text-ink"
          >
            Skip AI Setup
          </button>

          {phase === "done" ||
          (wantBundle && status?.models_ready?.[modelKey]) ||
          ollamaActive ||
          lmStudioActive ? (
            <button
              type="button"
              onClick={() => setStep(5)}
              className="flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-ink/90"
            >
              Continue <ArrowRight size={16} weight="bold" />
            </button>
          ) : wantBundle ? (
            phase === "downloading" ? (
              <button
                type="button"
                disabled
                className="flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-ink/50 px-4 py-2 font-sans text-sm font-medium text-white"
              >
                Downloading…
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-ink/90"
              >
                Download & Enable Lex
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => setStep(5)}
              className="flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-ink/90"
            >
              Continue <ArrowRight size={16} weight="bold" />
            </button>
          )}
        </div>
      </div>
    );
  }
}
