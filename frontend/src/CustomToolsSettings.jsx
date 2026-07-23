import { useState, useEffect } from "react";
import {
  Pencil,
  Trash,
  Plus,
  ArrowCounterClockwise,
  CaretDown,
  CaretRight,
  Sparkle,
  Globe,
  Sliders,
  MagicWand,
  PencilLine,
  Bookmark,
  Lightning,
  Brain,
  Compass,
  Tag,
} from "@phosphor-icons/react";
import {
  AI_TOOL_NAMES,
  DEFAULT_INSTRUCTIONS,
  MAX_CUSTOM_TOOLS,
  getPromptOverrides,
  savePromptOverride,
  resetPromptOverride,
  getCustomTools,
  saveCustomTool,
  deleteCustomTool,
} from "./prompts.js";

export const CUSTOM_ICON_MAP = {
  Sparkle,
  Globe,
  Sliders,
  MagicWand,
  PencilLine,
  Bookmark,
  Lightning,
  Brain,
  Compass,
  Tag,
};

export const AVAILABLE_ICON_NAMES = Object.keys(CUSTOM_ICON_MAP);

export default function CustomToolsSettings() {
  const [activeTab, setActiveTab] = useState("custom"); // "custom" | "builtin"
  const [overrides, setOverrides] = useState(getPromptOverrides);
  const [customTools, setCustomTools] = useState(getCustomTools);
  const [editingBuiltin, setEditingBuiltin] = useState(null); // tool name string
  const [builtinDraft, setBuiltinDraft] = useState("");
  
  // Custom tool form state
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [editingToolId, setEditingToolId] = useState(null); // null for new tool
  const [toolName, setToolName] = useState("");
  const [toolPrompt, setToolPrompt] = useState("");
  const [toolIcon, setToolIcon] = useState("Sparkle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    function refresh() {
      setOverrides(getPromptOverrides());
      setCustomTools(getCustomTools());
    }
    window.addEventListener("lexicon:tools-changed", refresh);
    return () => window.removeEventListener("lexicon:tools-changed", refresh);
  }, []);

  function handleSaveBuiltin(name) {
    savePromptOverride(name, builtinDraft);
    setEditingBuiltin(null);
  }

  function handleResetBuiltin(name) {
    resetPromptOverride(name);
    setBuiltinDraft(DEFAULT_INSTRUCTIONS[name] || "");
  }

  function openNewToolModal() {
    if (customTools.length >= MAX_CUSTOM_TOOLS) return;
    setEditingToolId(null);
    setToolName("");
    setToolPrompt("");
    setToolIcon("Sparkle");
    setErrorMsg("");
    setIsToolModalOpen(true);
  }

  function openEditToolModal(tool) {
    setEditingToolId(tool.id);
    setToolName(tool.name);
    setToolPrompt(tool.prompt);
    setToolIcon(tool.icon || "Sparkle");
    setErrorMsg("");
    setIsToolModalOpen(true);
  }

  function handleSaveCustomTool(e) {
    e.preventDefault();
    if (!toolName.trim()) {
      setErrorMsg("Tool name is required.");
      return;
    }
    if (!toolPrompt.trim()) {
      setErrorMsg("Instruction prompt is required.");
      return;
    }
    try {
      saveCustomTool({
        id: editingToolId,
        name: toolName.trim(),
        prompt: toolPrompt.trim(),
        icon: toolIcon,
      });
      setIsToolModalOpen(false);
    } catch (err) {
      setErrorMsg(err.message || "Failed to save tool.");
    }
  }

  function handleDeleteTool(id) {
    deleteCustomTool(id);
  }

  return (
    <div className="mt-8 border-t border-hairline pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            AI Prompts & Custom Tools
          </p>
          <p className="mt-1 font-sans text-xs text-muted">
            Customize built-in AI instructions or create custom shortcuts.
          </p>
        </div>
      </div>

      {/* Segmented Tab Bar */}
      <div className="mt-3 flex overflow-hidden rounded border border-hairline bg-canvas">
        <button
          type="button"
          onClick={() => setActiveTab("custom")}
          className={
            "flex-1 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors " +
            (activeTab === "custom"
              ? "bg-white text-ink font-semibold shadow-xs"
              : "text-muted hover:text-ink")
          }
        >
          Custom Tools ({customTools.length}/{MAX_CUSTOM_TOOLS})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("builtin")}
          className={
            "flex-1 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors border-l border-hairline " +
            (activeTab === "builtin"
              ? "bg-white text-ink font-semibold shadow-xs"
              : "text-muted hover:text-ink")
          }
        >
          Built-in Prompts ({Object.keys(overrides).length} modified)
        </button>
      </div>

      {/* Tab 1: Custom Tools */}
      {activeTab === "custom" && (
        <div className="mt-4 space-y-3">
          {customTools.length === 0 ? (
            <p className="font-sans text-xs text-muted italic py-2">
              No custom tools created yet. Add one to tailor AI outputs to your workflow.
            </p>
          ) : (
            <div className="space-y-2">
              {customTools.map((tool) => {
                const IconComponent = CUSTOM_ICON_MAP[tool.icon] || Sparkle;
                return (
                  <div
                    key={tool.id}
                    className="flex items-center justify-between rounded border border-hairline bg-canvas p-2.5 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-white border border-hairline text-ink">
                        <IconComponent size={14} weight="bold" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-sans text-xs font-semibold text-ink truncate">
                          {tool.name}
                        </p>
                        <p className="font-sans text-[11px] text-muted truncate max-w-[220px]">
                          {tool.prompt}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditToolModal(tool)}
                        className="rounded p-1 text-muted hover:bg-hairline hover:text-ink transition-colors"
                        title="Edit custom tool"
                      >
                        <Pencil size={14} weight="bold" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTool(tool.id)}
                        className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Delete custom tool"
                      >
                        <Trash size={14} weight="bold" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {customTools.length < MAX_CUSTOM_TOOLS && (
            <button
              type="button"
              onClick={openNewToolModal}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-hairline py-2 text-xs font-medium text-ink hover:border-ink hover:bg-canvas transition-colors"
            >
              <Plus size={14} weight="bold" />
              Add Custom Tool
            </button>
          )}
        </div>
      )}

      {/* Tab 2: Built-in Prompts */}
      {activeTab === "builtin" && (
        <div className="mt-4 space-y-2 max-h-[260px] overflow-y-auto pr-1 lex-scroll">
          {AI_TOOL_NAMES.map((name) => {
            const isModified = Boolean(overrides[name]);
            const isEditing = editingBuiltin === name;
            const currentInstruction = isEditing
              ? builtinDraft
              : overrides[name] || DEFAULT_INSTRUCTIONS[name] || "";

            return (
              <div
                key={name}
                className="rounded border border-hairline bg-canvas p-2.5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditing) {
                          setEditingBuiltin(null);
                        } else {
                          setEditingBuiltin(name);
                          setBuiltinDraft(overrides[name] || DEFAULT_INSTRUCTIONS[name] || "");
                        }
                      }}
                      className="flex items-center gap-1.5 text-left font-sans text-xs font-semibold text-ink hover:text-muted transition-colors"
                    >
                      {isEditing ? <CaretDown size={12} weight="bold" /> : <CaretRight size={12} weight="bold" />}
                      <span>{name}</span>
                    </button>
                    {isModified && (
                      <span className="rounded bg-pale-blue px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink font-medium">
                        Modified
                      </span>
                    )}
                  </div>
                  {isModified && (
                    <button
                      type="button"
                      onClick={() => handleResetBuiltin(name)}
                      className="flex items-center gap-1 font-mono text-[10px] uppercase text-muted hover:text-ink transition-colors"
                      title="Reset prompt to default"
                    >
                      <ArrowCounterClockwise size={12} weight="bold" />
                      Reset
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="mt-2.5 space-y-2">
                    <textarea
                      rows={3}
                      value={builtinDraft}
                      onChange={(e) => setBuiltinDraft(e.target.value)}
                      className="w-full rounded border border-hairline bg-white p-2 font-sans text-xs text-ink focus:border-ink focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingBuiltin(null)}
                        className="rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted hover:text-ink"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveBuiltin(name)}
                        className="rounded bg-ink px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white hover:bg-black"
                      >
                        Save Prompt
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 font-sans text-[11px] text-muted line-clamp-2 pl-4">
                    {currentInstruction}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for creating/editing a custom tool */}
      {isToolModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 px-4"
          onClick={() => setIsToolModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-hairline bg-white p-5 shadow-lg lex-card-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-sans text-sm font-semibold text-ink">
              {editingToolId ? "Edit Custom Tool" : "Add Custom Tool"}
            </h3>
            
            {errorMsg && (
              <p className="mt-2 font-sans text-xs text-red-600 font-medium">{errorMsg}</p>
            )}

            <form onSubmit={handleSaveCustomTool} className="mt-4 space-y-3">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-muted">
                  Tool Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. British English"
                  value={toolName}
                  onChange={(e) => setToolName(e.target.value)}
                  className="mt-1 w-full rounded border border-hairline bg-canvas px-2.5 py-1.5 font-sans text-xs text-ink focus:border-ink focus:outline-none"
                  maxLength={30}
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-muted mb-1">
                  Icon
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_ICON_NAMES.map((iconName) => {
                    const IconComp = CUSTOM_ICON_MAP[iconName];
                    const selected = toolIcon === iconName;
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setToolIcon(iconName)}
                        className={
                          "flex h-7 w-7 items-center justify-center rounded border transition-colors " +
                          (selected
                            ? "border-ink bg-ink text-white"
                            : "border-hairline bg-canvas text-muted hover:text-ink")
                        }
                      >
                        <IconComp size={14} weight="bold" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-muted">
                  System Instruction Prompt
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Rewrite the text below to use British English spelling and formatting conventions."
                  value={toolPrompt}
                  onChange={(e) => setToolPrompt(e.target.value)}
                  className="mt-1 w-full rounded border border-hairline bg-canvas p-2 font-sans text-xs text-ink focus:border-ink focus:outline-none"
                />
                <p className="mt-1 font-sans text-[10px] text-muted">
                  Output formatting rules are automatically appended under the hood to ensure clean local AI output.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => setIsToolModalOpen(false)}
                  className="rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-ink px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white hover:bg-black"
                >
                  Save Tool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
