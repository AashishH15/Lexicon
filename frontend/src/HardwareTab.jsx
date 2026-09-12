import { useState, useEffect } from "react";
import { ArrowCounterClockwise, Check, CircleNotch, X } from "@phosphor-icons/react";
import Toggle from "./Toggle.jsx";
import { getHardwareProfile, setHardwareSettings } from "./api.js";

export default function HardwareTab() {
  const [loading, setLoading] = useState(true);
  const [hardware, setHardware] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadHardware();
  }, []);

  async function loadHardware() {
    try {
      setLoading(true);
      setError(null);
      const data = await getHardwareProfile();
      setHardware(data);
    } catch (err) {
      setError(err.message || "Failed to load hardware diagnostics");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleGpu(enableGpu) {
    if (!hardware) return;
    const nextDevice = enableGpu ? "gpu" : "cpu";
    if (hardware.device === nextDevice) return;

    try {
      setSaving(true);
      setHardware((prev) => ({ ...prev, device: nextDevice }));
      const updated = await setHardwareSettings({
        device: nextDevice,
        limitVramOffload: hardware.limit_vram_offload,
      });
      setHardware(updated);
    } catch (err) {
      setError(err.message || "Failed to update compute device");
      loadHardware();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleLimitOffload(nextLimit) {
    if (!hardware) return;

    try {
      setSaving(true);
      setHardware((prev) => ({ ...prev, limit_vram_offload: nextLimit }));
      const updated = await setHardwareSettings({
        device: hardware.device,
        limitVramOffload: nextLimit,
      });
      setHardware(updated);
    } catch (err) {
      setError(err.message || "Failed to update offload setting");
      loadHardware();
    } finally {
      setSaving(false);
    }
  }

  async function handleResetDefault() {
    if (!hardware) return;
    try {
      setSaving(true);
      const defaultDevice =
        hardware.gpu?.cuda_available && hardware.gpu?.name ? "gpu" : "cpu";
      const updated = await setHardwareSettings({
        device: defaultDevice,
        limitVramOffload: true,
      });
      setHardware(updated);
    } catch (err) {
      setError(err.message || "Failed to reset hardware settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !hardware) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted">
        <CircleNotch size={28} className="animate-spin text-pale-blue-text" />
        <span className="mt-3 font-sans text-xs">Inspecting system hardware…</span>
      </div>
    );
  }

  const hasGpu = Boolean(hardware?.gpu?.cuda_available && hardware?.gpu?.name);
  const isGpuActive = hasGpu && (hardware?.device || "gpu") === "gpu";
  const cpu = hardware?.cpu || {};
  const memory = hardware?.memory || {};
  const gpu = hardware?.gpu || {};
  const featureBadges =
    cpu.features && cpu.features.length > 0 ? cpu.features : [cpu.arch || "unknown"];

  const accelerators = hardware?.accelerators || { dedicated: [], integrated: [], npu: [] };
  const dedicatedGpus = accelerators.dedicated || [];
  const integratedGpus = accelerators.integrated || [];
  const npus = accelerators.npu || [];

  // Exclude primary compute GPU from additional dedicated listings to prevent duplicated UI items.
  const additionalDedicatedGpus = dedicatedGpus.filter(
    (dg) => !gpu.name || dg.name.toLowerCase() !== gpu.name.toLowerCase()
  );

  return (
    <div className="space-y-4" data-testid="hardware-tab-container">
      <div>
        <h2 className="font-serif text-xl font-bold text-ink">Hardware</h2>
        <p className="mt-1 font-sans text-xs text-muted">
          {npus.length > 0
            ? "CPU, memory, graphics, and neural processor diagnostics for local models."
            : "CPU, memory, and graphics settings for local models."}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-hairline bg-canvas px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            CPU
          </p>
          {cpu.compatible ? (
            <span className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold text-pale-green-text">
              <Check size={12} weight="bold" />
              Compatible
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold text-pale-red-text">
              <X size={12} weight="bold" />
              Not Compatible
            </span>
          )}
        </div>
        <p className="mt-2 font-sans text-sm font-medium text-ink">
          {cpu.name || "Unknown CPU"}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {featureBadges.map((badge) => (
            <span
              key={badge}
              className="rounded border border-hairline bg-surface px-2 py-0.5 font-mono text-[10px] text-ink"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-hairline bg-canvas px-4 py-3.5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
          Memory
        </p>
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs text-muted">RAM</span>
            <span className="font-sans text-sm font-medium text-ink">
              {memory.ram_gb ? `${memory.ram_gb} GB` : "N/A"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs text-muted">VRAM</span>
            <span className="font-sans text-sm font-medium text-ink">
              {memory.vram_gb ? `${memory.vram_gb} GB` : "0.00 GB"}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-hairline bg-canvas px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            GPU
          </p>
          <button
            type="button"
            onClick={handleResetDefault}
            disabled={saving}
            data-testid="hardware-reset-default-btn"
            className="flex items-center gap-1 font-sans text-xs text-muted transition-colors hover:text-ink"
          >
            <ArrowCounterClockwise size={13} />
            <span>Reset to default</span>
          </button>
        </div>

        <p className="mt-2 font-sans text-xs text-muted">
          {hasGpu
            ? `${gpu.count || 1} NVIDIA GPU · ${gpu.backend || "CUDA"}`
            : "No NVIDIA GPU detected"}
        </p>

        <div className="mt-3 flex flex-col gap-3 rounded-md border border-hairline bg-surface/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-sans text-sm font-medium text-ink">
              {gpu.name || "No NVIDIA GPU"}
            </p>
            <p className="mt-0.5 font-sans text-xs text-muted">
              {gpu.vram_gb ? `${gpu.vram_gb} GB VRAM` : "VRAM unavailable"}
              {gpu.backend ? ` · ${gpu.backend}` : ""}
            </p>
          </div>
          <div
            data-testid="gpu-toggle-segmented"
            className="inline-flex items-center self-start rounded-md border border-hairline bg-canvas p-0.5 sm:self-center"
          >
            <button
              type="button"
              data-testid="gpu-toggle-off"
              disabled={saving}
              onClick={() => handleToggleGpu(false)}
              className={
                "cursor-pointer rounded px-3 py-1 font-sans text-xs font-medium transition-colors " +
                (!isGpuActive
                  ? "bg-zinc-700 font-semibold text-white shadow-sm"
                  : "text-muted hover:text-ink")
              }
            >
              OFF
            </button>
            <button
              type="button"
              data-testid="gpu-toggle-on"
              disabled={saving || !hasGpu}
              onClick={() => handleToggleGpu(true)}
              className={
                "cursor-pointer rounded px-3 py-1 font-sans text-xs font-medium transition-colors " +
                (isGpuActive
                  ? "bg-pale-blue-text font-semibold text-white shadow-sm"
                  : "text-muted hover:text-ink")
              }
            >
              ON
            </button>
          </div>
        </div>

        {additionalDedicatedGpus.map((dg, idx) => (
          <div
            key={dg.name + idx}
            className="mt-3 flex flex-col gap-2 rounded-md border border-hairline bg-surface/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-sans text-sm font-medium text-ink">{dg.name}</p>
              <p className="mt-0.5 font-sans text-xs text-muted">
                {dg.vram_gb ? `${dg.vram_gb} GB VRAM · ` : ""}
                Dedicated graphics
              </p>
            </div>
            <span className="inline-flex items-center self-start rounded border border-hairline bg-surface px-2 py-0.5 font-mono text-[10px] font-medium text-ink sm:self-center">
              Dedicated GPU
            </span>
          </div>
        ))}

        <div className="mt-3 flex items-start justify-between gap-4 border-t border-hairline pt-3">
          <div className="min-w-0">
            <p className="font-sans text-sm font-medium text-ink">
              Limit Model Offload
            </p>
            <p className="mt-1 font-sans text-xs leading-relaxed text-muted">
              Keep layers in dedicated NVIDIA VRAM. Anything that does not fit
              stays on the CPU instead of spilling into shared GPU memory.
            </p>
          </div>
          <div className="shrink-0 pt-0.5">
            <Toggle
              checked={Boolean(hardware?.limit_vram_offload)}
              onChange={handleToggleLimitOffload}
              label="Limit Model Offload"
              data-testid="toggle-limit-vram-offload"
            />
          </div>
        </div>
      </div>

      {integratedGpus.length > 0 && (
        <div className="rounded-lg border border-hairline bg-canvas px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Integrated GPU
            </p>
            <span className="rounded border border-hairline bg-surface px-2 py-0.5 font-mono text-[10px] text-muted">
              Processor Graphics
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {integratedGpus.map((igpu, idx) => (
              <div
                key={igpu.name + idx}
                className="flex flex-col gap-2 rounded-md border border-hairline bg-surface/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-sans text-sm font-medium text-ink">
                    {igpu.name}
                  </p>
                  <p className="mt-0.5 font-sans text-xs text-muted">
                    {igpu.vram_gb ? `${igpu.vram_gb} GB VRAM · ` : ""}
                    Processor graphics · Shared system memory
                  </p>
                </div>
                <span className="inline-flex items-center self-start rounded border border-hairline bg-surface px-2 py-0.5 font-mono text-[10px] font-medium text-ink sm:self-center">
                  Integrated GPU
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {npus.length > 0 && (
        <div className="rounded-lg border border-hairline bg-canvas px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Neural Processing Unit (NPU)
            </p>
            <span className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold text-pale-blue-text">
              <Check size={12} weight="bold" />
              Detected
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {npus.map((npuItem, idx) => (
              <div
                key={npuItem.name + idx}
                className="flex flex-col gap-2 rounded-md border border-hairline bg-surface/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-sans text-sm font-medium text-ink">
                    {npuItem.name}
                  </p>
                  <p className="mt-0.5 font-sans text-xs text-muted">
                    Dedicated low-power AI processor · Neural Processing Unit
                  </p>
                </div>
                <span className="inline-flex items-center self-start rounded border border-pale-blue-text/30 bg-pale-blue-text/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-pale-blue-text sm:self-center">
                  NPU
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
