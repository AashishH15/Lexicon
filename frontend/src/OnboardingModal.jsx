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
} from "@phosphor-icons/react";
import ModelManager from "./ModelManager.jsx";
import { SETTINGS_DEFAULTS } from "./Settings.jsx";

const LANGUAGES = [
  { code: "en-US", name: "English (US)" },
  { code: "en-GB", name: "English (UK)" },
  { code: "en-CA", name: "English (Canada)" },
  { code: "en-AU", name: "English (Australia)" },
  { code: "de-DE", name: "German" },
  { code: "fr-FR", name: "French" },
  { code: "es-ES", name: "Spanish" },
];

export default function OnboardingModal({ onClose, onConfigured, onFinish }) {
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
      <div className="flex max-h-[90vh] h-auto w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg font-medium text-ink">Lexicon Setup</span>
            <span className="rounded bg-hairline/60 px-2 py-0.5 font-mono text-[11px] font-medium text-muted">
              Step {step} of 4
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
        <div className="grid grid-cols-4 gap-1 bg-hairline/30 px-6 py-1.5 border-b border-hairline/50">
          {[1, 2, 3, 4].map((i) => (
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
                  Language & Preferences
                </h2>
                <p className="font-sans text-sm text-muted leading-relaxed">
                  Select your primary writing dialect. Lexicon uses this for real-time spellchecking and rule matching.
                </p>
              </div>

              <div className="space-y-4 pt-1">
                {/* Language Picker */}
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 font-sans text-xs font-semibold text-ink uppercase tracking-wider">
                    <SlidersHorizontal size={14} weight="bold" /> Primary Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-canvas px-3.5 py-2.5 font-sans text-sm text-ink outline-none transition-colors focus:border-ink"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name} ({l.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
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
                  renderFooter={renderStep3Footer}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 text-center py-2">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-hairline/40 p-2">
                <img src="/lexicon-logo.png" alt="Lexicon Logo" className="h-12 w-12 object-contain" />
              </div>

              <div className="space-y-2">
                <h2 className="font-serif text-2xl font-medium tracking-tight text-ink">
                  You're Ready to Write!
                </h2>
                <p className="font-sans text-sm text-muted max-w-sm mx-auto leading-relaxed">
                  Explore Lexicon's inline proofreading, LaTeX math rendering, and local AI rewriting tools right away.
                </p>
              </div>

              <div className="space-y-3 pt-2 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={() => completeOnboarding(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 font-sans text-sm font-medium text-canvas shadow-md transition-all hover:bg-ink/90 active:scale-[0.99]"
                >
                  <BookOpen size={18} weight="bold" />
                  Load Interactive Sample Draft
                </button>

                <button
                  type="button"
                  onClick={() => completeOnboarding(false)}
                  className="w-full rounded-xl border border-hairline bg-canvas px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:bg-hairline/40"
                >
                  Start Blank Canvas
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation (Steps 1, 2, and 4) */}
        {(step < 3 || step === 4) && (
          <div className="flex items-center justify-between border-t border-hairline px-6 py-4">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => (step === 4 ? setStep(3) : setStep((s) => s - 1))}
                className="flex items-center gap-1 font-sans text-sm font-medium text-muted transition-colors hover:text-ink"
              >
                <ArrowLeft size={16} weight="bold" /> Back
              </button>
            ) : (
              <button
                type="button"
                onClick={() => completeOnboarding(false)}
                className="font-sans text-sm text-muted transition-colors hover:text-ink"
              >
                Skip Setup
              </button>
            )}

            {step < 3 && (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 font-sans text-sm font-medium text-canvas transition-colors hover:bg-ink/90"
              >
                Continue <ArrowRight size={16} weight="bold" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  function renderStep3Footer({ phase, wantBundle, modelKey, status, handleDownload }) {
    const ollamaActive = status?.preference?.backend === "ollama";
    return (
      <div className="mt-4 flex items-center justify-between border-t border-hairline pt-4">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="flex items-center gap-1 font-sans text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={16} weight="bold" /> Back
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStep(4)}
            className="rounded px-3 py-2 font-sans text-sm text-muted transition-colors hover:text-ink"
          >
            Skip AI Setup
          </button>

          {phase === "done" || (wantBundle && status?.models_ready?.[modelKey]) || ollamaActive ? (
            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 font-sans text-sm font-medium text-canvas transition-colors hover:bg-ink/90"
            >
              Continue <ArrowRight size={16} weight="bold" />
            </button>
          ) : wantBundle ? (
            phase === "downloading" ? (
              <button
                type="button"
                disabled
                className="flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-ink/50 px-4 py-2 font-sans text-sm font-medium text-canvas"
              >
                Downloading…
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 font-sans text-sm font-medium text-canvas transition-colors hover:bg-ink/90"
              >
                Download & Enable Lex
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 font-sans text-sm font-medium text-canvas transition-colors hover:bg-ink/90"
            >
              Continue <ArrowRight size={16} weight="bold" />
            </button>
          )}
        </div>
      </div>
    );
  }
}
