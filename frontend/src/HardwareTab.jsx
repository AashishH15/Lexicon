import { useState, useEffect } from "react";
import {
  ArrowCounterClockwise,
  Check,
  CircleNotch,
  DotsThreeVertical,
  Trash,
  X,
} from "@phosphor-icons/react";
import Toggle from "./Toggle.jsx";
import {
  getHardwareProfile,
  setHardwareSettings,
  getGpuPackages,
  installGpuPackage,
  cancelGpuPackageInstall,
  uninstallGpuPackage,
  activateGpuPackage,
  restartBackend,
} from "./api.js";

export default function HardwareTab() {
  const [loading, setLoading] = useState(true);
  const [hardware, setHardware] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [gpuPackages, setGpuPackages] = useState([]);
  const [activePackageId, setActivePackageId] = useState(null);
  const [packActionLoading, setPackActionLoading] = useState(false);
  const [switchingPackageId, setSwitchingPackageId] = useState(null);
  const [deletingPackageId, setDeletingPackageId] = useState(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);
  const [openMenuPkgId, setOpenMenuPkgId] = useState(null);

  useEffect(() => {
    if (!openMenuPkgId) return;
    const handleDocClick = (e) => {
      if (!e.target.closest(`[data-gpu-pack-menu="${openMenuPkgId}"]`)) {
        setOpenMenuPkgId(null);
      }
    };
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [openMenuPkgId]);

  useEffect(() => {
    loadHardware();
    loadPackages();
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

  async function loadPackages() {
    try {
      const data = await getGpuPackages();
      const pkgs = data.packages || [];
      setGpuPackages(pkgs);
      const downloading = pkgs.find(
        (p) => p.status?.state === "downloading" || p.status?.state === "extracting"
      );
      if (downloading) {
        setActivePackageId(downloading.id);
      }
    } catch {
      // Non-blocking package load
    }
  }

  // Poll download progress when an accelerator pack is downloading or extracting.
  useEffect(() => {
    if (!activePackageId) return;

    const timer = setInterval(async () => {
      try {
        const data = await getGpuPackages();
        const pkgs = data.packages || [];
        setGpuPackages(pkgs);
        const current = pkgs.find((p) => p.id === activePackageId);
        if (!current) {
          clearInterval(timer);
          setActivePackageId(null);
          return;
        }

        if (current.status?.state === "ready") {
          clearInterval(timer);
          setActivePackageId(null);
          try {
            await restartBackend();
          } catch {}
          const updated = await getHardwareProfile();
          setHardware(updated);
          try {
            const settingsUpdated = await setHardwareSettings({
              device: "gpu",
              limitVramOffload: true,
            });
            setHardware(settingsUpdated);
          } catch {}
        } else if (current.status?.state === "error" || current.status?.state === "cancelled") {
          clearInterval(timer);
          setActivePackageId(null);
        }
      } catch {
        clearInterval(timer);
        setActivePackageId(null);
      }
    }, 350);

    return () => clearInterval(timer);
  }, [activePackageId]);

  async function handleInstallPack(pkgId) {
    try {
      setPackActionLoading(true);
      setError(null);
      setGpuPackages((prev) =>
        prev.map((p) =>
          p.id === pkgId
            ? {
                ...p,
                status: {
                  package: pkgId,
                  state: "downloading",
                  progress_pct: 1.0,
                  bytes_done: 0,
                  bytes_total: p.download_size_bytes || 42323800,
                  speed_mbps: 0,
                  error: null,
                },
              }
            : p
        )
      );
      setActivePackageId(pkgId);
      await installGpuPackage(pkgId);
      await loadPackages();
    } catch (err) {
      setError(err.message || "Failed to start acceleration package download");
      setActivePackageId(null);
      await loadPackages();
    } finally {
      setPackActionLoading(false);
    }
  }

  async function handleCancelPack(pkgId) {
    try {
      await cancelGpuPackageInstall(pkgId);
      setActivePackageId(null);
      await loadPackages();
    } catch (err) {
      setError(err.message || "Failed to cancel package download");
    }
  }

  async function handleActivatePack(pkgId) {
    try {
      setSwitchingPackageId(pkgId);
      setPackActionLoading(true);
      setError(null);
      await activateGpuPackage(pkgId);
      try {
        await restartBackend();
      } catch {}
      const updatedHardware = await getHardwareProfile();
      setHardware(updatedHardware);
      await loadPackages();
      const pkg = gpuPackages.find((p) => p.id === pkgId);
      const name = pkg?.backend || (pkgId === "vulkan" ? "Vulkan" : "CUDA");
      const gpu = updatedHardware?.gpu || {};
      const offloadReady = Boolean(gpu.offload_supported || gpu.cuda_available);
      if (offloadReady) {
        setActionSuccessMsg(`Switched compute runtime to ${name}`);
        setTimeout(() => setActionSuccessMsg(null), 3500);
      } else {
        setError(`Switched preference to ${name}, but GPU offload could not be initialized.`);
      }
    } catch (err) {
      setError(err.message || "Failed to switch compute runtime");
    } finally {
      setPackActionLoading(false);
      setSwitchingPackageId(null);
    }
  }

  async function handleUninstallPack(pkgId) {
    try {
      setDeletingPackageId(pkgId);
      setPackActionLoading(true);
      setError(null);
      const pkg = gpuPackages.find((p) => p.id === pkgId);
      const name = pkg?.backend || (pkgId === "vulkan" ? "Vulkan" : "CUDA");
      // Optimistically remove from installed packages so the user immediately sees the change
      setGpuPackages((prev) =>
        prev.map((p) =>
          p.id === pkgId ? { ...p, installed: false, status: { ...p.status, state: "idle" } } : p
        )
      );
      const result = await uninstallGpuPackage(pkgId);
      if (result && result.success === false) {
        throw new Error(result.error || `Failed to uninstall ${pkgId} package`);
      }
      try {
        await restartBackend();
      } catch {}
      await loadPackages();
      await loadHardware();
      setActionSuccessMsg(`${name} runtime files removed`);
      setTimeout(() => setActionSuccessMsg(null), 3500);
    } catch (err) {
      setError(err.message || "Failed to uninstall package");
      await loadPackages();
    } finally {
      setPackActionLoading(false);
      setDeletingPackageId(null);
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
        (hardware.gpu?.cuda_available || hardware.gpu?.offload_supported) && hardware.gpu?.name
          ? "gpu"
          : "cpu";
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

  const gpu = hardware?.gpu || {};
  const isOffloadReady = Boolean(gpu.offload_supported || gpu.cuda_available);
  const hasGpu = Boolean(isOffloadReady && gpu.name);
  const isGpuActive = hasGpu && (hardware?.device || "gpu") === "gpu";
  const cpu = hardware?.cpu || {};
  const memory = hardware?.memory || {};
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
  const additionalIntegratedGpus = integratedGpus.filter(
    (ig) => !gpu.name || ig.name.toLowerCase() !== gpu.name.toLowerCase()
  );

  const requiresPack = Boolean(gpu.name && !isOffloadReady);

  // Determine fallback packages to display if backend packages list is empty
  const defaultFallbackPackages = [];
  if (gpu.vendor === "NVIDIA" || (gpu.name && gpu.name.toLowerCase().includes("nvidia"))) {
    defaultFallbackPackages.push({
      id: "cuda",
      name: "NVIDIA CUDA 12.4 Acceleration Pack",
      backend: "CUDA",
      vendor: "NVIDIA",
      download_size_bytes: 536551897,
      installed: Boolean(isOffloadReady && gpu.backend === "CUDA"),
      recommended: true,
      description:
        "Fastest Tensor Core acceleration and dedicated VRAM offloading for NVIDIA GeForce and RTX cards.",
      status: { state: isOffloadReady && gpu.backend === "CUDA" ? "ready" : "idle", progress_pct: 0 },
    });
    defaultFallbackPackages.push({
      id: "vulkan",
      name: "Vulkan GPU Acceleration Pack",
      backend: "Vulkan",
      vendor: "AMD/Intel",
      download_size_bytes: 42323234,
      installed: Boolean(isOffloadReady && gpu.backend === "Vulkan"),
      recommended: false,
      description:
        "Universal cross-vendor GPU acceleration runtime (lighter 40 MB download).",
      status: { state: isOffloadReady && gpu.backend === "Vulkan" ? "ready" : "idle", progress_pct: 0 },
    });
  } else if (gpu.name) {
    defaultFallbackPackages.push({
      id: "vulkan",
      name: "Vulkan GPU Acceleration Pack",
      backend: "Vulkan",
      vendor: "AMD/Intel",
      download_size_bytes: 42323234,
      installed: Boolean(isOffloadReady && gpu.backend === "Vulkan"),
      recommended: true,
      description:
        "Universal cross-vendor GPU acceleration for AMD Radeon, Intel Arc, and integrated graphics.",
      status: { state: isOffloadReady && gpu.backend === "Vulkan" ? "ready" : "idle", progress_pct: 0 },
    });
  }

  const displayPackages = gpuPackages.length > 0 ? gpuPackages : defaultFallbackPackages;

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
          {gpu.name
            ? gpu.backend === "Metal"
              ? "Apple Silicon · Metal"
              : isOffloadReady
                ? `${gpu.count || 1} ${gpu.vendor || "NVIDIA"} GPU · ${gpu.backend || "CUDA"}`
                : `${gpu.count || 1} ${gpu.vendor || "NVIDIA"} GPU · Pack Required`
            : "No GPU detected"}
        </p>

        <div className="mt-3 flex flex-col gap-3 rounded-md border border-hairline bg-surface/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-sans text-sm font-medium text-ink">
              {gpu.name || "No GPU"}
            </p>
            <p className="mt-0.5 font-sans text-xs text-muted">
              {gpu.vram_gb ? `${gpu.vram_gb} GB VRAM` : "VRAM unavailable"}
              {gpu.backend && gpu.backend !== "None" ? ` · ${gpu.backend}` : ""}
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

        {requiresPack && (
          <div
            className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-500"
            data-testid="gpu-pack-card"
          >
            <p className="font-medium">
              GPU acceleration package required to offload model layers.
            </p>
            <p className="mt-0.5 text-muted">
              Download and enable an acceleration runtime from the section below to use your {gpu.name}.
            </p>
          </div>
        )}

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
              Prevents slowdowns by keeping the AI within your GPU's fast dedicated VRAM.
              Any overflow stays on the CPU instead of spilling into slower shared memory.
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

      {/* Compute Acceleration & Downloads Section */}
      <div
        className="rounded-lg border border-hairline bg-canvas px-4 py-3.5"
        data-testid="acceleration-runtimes-section"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Compute Acceleration & Runtimes
            </p>
            <p className="mt-0.5 font-sans text-xs text-muted">
              Download, switch, or update GPU acceleration runtimes for local AI models.
            </p>
          </div>
          <span className="self-start rounded border border-hairline bg-surface px-2 py-0.5 font-mono text-[10px] text-muted sm:self-center">
            llama.cpp v0.3.34
          </span>
        </div>

        {actionSuccessMsg && (
          <div
            data-testid="gpu-pack-success-msg"
            className="mt-3 flex items-center gap-2 rounded-md border border-pale-green-text/30 bg-pale-green-text/10 px-3 py-2 font-sans text-xs font-medium text-pale-green-text transition-all duration-300"
          >
            <Check size={14} weight="bold" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        <div className="mt-3.5 space-y-3">
          {gpu.backend === "Metal" && (
            <div className="flex flex-col gap-2 rounded-md border border-hairline bg-surface/60 p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-sans text-sm font-semibold text-ink">
                    Apple Silicon Metal
                  </p>
                  <span className="rounded bg-pale-green-text/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-pale-green-text">
                    Built-in
                  </span>
                </div>
                <p className="mt-0.5 font-sans text-xs text-muted">
                  Native macOS Metal acceleration with Unified Memory. Zero download required.
                </p>
              </div>
              <span className="font-mono text-xs text-pale-green-text font-medium">
                Ready
              </span>
            </div>
          )}

          {displayPackages.map((pkg) => {
            const isPkgInstalled = Boolean(pkg.installed);
            const isPkgActive =
              isPkgInstalled &&
              isOffloadReady &&
              (gpu.backend?.toLowerCase() === pkg.backend?.toLowerCase() ||
                (pkg.id === "cuda" && gpu.backend === "CUDA") ||
                (pkg.id === "vulkan" && gpu.backend === "Vulkan"));
            const isPkgDownloading =
              pkg.status?.state === "downloading" ||
              pkg.status?.state === "extracting" ||
              activePackageId === pkg.id;
            const isPkgSwitching = switchingPackageId === pkg.id;
            const isPkgDeleting = deletingPackageId === pkg.id;

            return (
              <div
                key={pkg.id}
                data-testid={`gpu-pack-item-${pkg.id}`}
                className={`rounded-md border p-3.5 transition-all ${
                  isPkgSwitching
                    ? "border-pale-blue-text/40 bg-pale-blue-text/5"
                    : isPkgDeleting
                      ? "border-red-500/30 bg-red-500/5 opacity-70"
                      : "border-hairline bg-surface/60"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-sans text-sm font-semibold text-ink">
                        {pkg.name}
                      </p>
                      <span className="shrink-0 rounded border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">
                        {pkg.download_size_bytes
                          ? `${Math.round(pkg.download_size_bytes / (1024 * 1024))} MB`
                          : pkg.id === "cuda"
                            ? "511 MB"
                            : "40 MB"}
                      </span>
                      <span className="shrink-0 rounded border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">
                        {pkg.id === "cuda" ? "CUDA 12.4" : "Vulkan 1.3+"}
                      </span>
                      {isPkgActive ? (
                        <span className="shrink-0 rounded bg-pale-blue-text/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-pale-blue-text">
                          Downloaded
                        </span>
                      ) : isPkgInstalled ? (
                        <span className="shrink-0 rounded border border-hairline bg-surface px-2 py-0.5 font-mono text-[10px] font-medium text-muted">
                          Downloaded
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 font-sans text-xs text-muted leading-relaxed">
                      {pkg.description}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 pt-0.5">
                    {isPkgDownloading ? (
                      <button
                        type="button"
                        data-testid="cancel-gpu-pack-btn"
                        onClick={() => handleCancelPack(pkg.id)}
                        className="cursor-pointer rounded border border-hairline bg-canvas px-3 py-1.5 font-sans text-xs font-medium text-muted transition-colors hover:text-ink"
                      >
                        Cancel
                      </button>
                    ) : isPkgDeleting ? (
                      <div className="flex items-center gap-1.5 px-2 py-1 font-sans text-xs font-medium text-red-500">
                        <CircleNotch size={13} className="animate-spin text-red-500" />
                        <span>Deleting…</span>
                      </div>
                    ) : isPkgInstalled ? (
                      <div className="flex items-center gap-2">
                        {!isPkgActive && (
                          isPkgSwitching ? (
                            <button
                              type="button"
                              disabled
                              className="flex items-center gap-1.5 cursor-wait rounded bg-surface border border-pale-blue-text/40 px-3 py-1 font-sans text-xs font-medium text-ink animate-pulse"
                            >
                              <CircleNotch size={12} className="animate-spin text-pale-blue-text" />
                              <span>Switching to {pkg.backend}…</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleActivatePack(pkg.id)}
                              disabled={packActionLoading}
                              className="cursor-pointer rounded bg-surface border border-hairline px-3 py-1 font-sans text-xs font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-50"
                            >
                              Switch to {pkg.backend}
                            </button>
                          )
                        )}
                        <div className="relative" data-gpu-pack-menu={pkg.id}>
                          <button
                            type="button"
                            data-testid={`gpu-pack-menu-btn-${pkg.id}`}
                            onClick={() =>
                              setOpenMenuPkgId((curr) => (curr === pkg.id ? null : pkg.id))
                            }
                            title="Package options"
                            aria-label="Package options"
                            className="flex h-7 w-7 items-center justify-center rounded border border-hairline bg-canvas text-muted transition-colors hover:border-muted hover:text-ink"
                          >
                            <DotsThreeVertical size={16} weight="bold" />
                          </button>
                          {openMenuPkgId === pkg.id && (
                            <div
                              data-testid={`gpu-pack-dropdown-${pkg.id}`}
                              className="absolute right-0 z-30 mt-1 w-32 rounded-md border border-hairline bg-canvas p-1 shadow-lg"
                            >
                              <button
                                type="button"
                                data-testid="reinstall-gpu-pack-btn"
                                onClick={() => {
                                  setOpenMenuPkgId(null);
                                  handleInstallPack(pkg.id);
                                }}
                                disabled={packActionLoading}
                                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left font-sans text-xs text-ink transition-colors hover:bg-hairline/60 disabled:opacity-50"
                              >
                                <ArrowCounterClockwise size={13} className="text-muted" />
                                <span>Reinstall</span>
                              </button>
                              <button
                                type="button"
                                data-testid="uninstall-gpu-pack-btn"
                                onClick={() => {
                                  setOpenMenuPkgId(null);
                                  handleUninstallPack(pkg.id);
                                }}
                                disabled={packActionLoading}
                                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left font-sans text-xs text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                              >
                                <Trash size={13} className="text-red-500" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        data-testid="install-gpu-pack-btn"
                        onClick={() => handleInstallPack(pkg.id)}
                        disabled={packActionLoading}
                        className="cursor-pointer rounded bg-pale-blue-text px-3 py-1.5 font-sans text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        Download & Enable
                      </button>
                    )}
                  </div>
                </div>

                {isPkgDownloading && (
                  <div className="mt-3 space-y-1.5 border-t border-hairline pt-2.5">
                    <div className="flex items-center justify-between font-sans text-xs text-muted">
                      <span>
                        Downloading… {pkg.status?.progress_pct || 0}%
                        {pkg.status?.speed_mbps ? ` · ${pkg.status?.speed_mbps} Mbps` : ""}
                      </span>
                      <span>
                        {pkg.status?.bytes_done
                          ? `${(pkg.status.bytes_done / (1024 * 1024)).toFixed(1)} MB / ${(pkg.status.bytes_total / (1024 * 1024)).toFixed(1)} MB`
                          : ""}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                      <div
                        data-testid="gpu-pack-progress-bar"
                        className="h-full bg-pale-blue-text transition-all duration-300 ease-out"
                        style={{ width: `${pkg.status?.progress_pct || 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {additionalIntegratedGpus.length > 0 && (
        <div className="rounded-lg border border-hairline bg-canvas px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Integrated GPU
            </p>
            <span className="rounded border border-hairline bg-surface px-2 py-0.5 font-mono text-[10px] font-medium text-ink">
              Processor Graphics
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {additionalIntegratedGpus.map((igpu, idx) => (
              <div
                key={igpu.name + idx}
                className="flex flex-col gap-2 rounded-md border border-hairline bg-surface/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-sans text-sm font-medium text-ink">{igpu.name}</p>
                  <p className="mt-0.5 font-sans text-xs text-muted">
                    {igpu.vram_gb ? `${igpu.vram_gb} GB shared · ` : "Shared memory · "}
                    {igpu.vendor || "Integrated graphics"}
                  </p>
                </div>
                <span className="inline-flex items-center self-start rounded border border-hairline bg-surface px-2 py-0.5 font-mono text-[10px] font-medium text-muted sm:self-center">
                  Integrated
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
            <span className="rounded border border-hairline bg-surface px-2 py-0.5 font-mono text-[10px] font-medium text-ink">
              AI Accelerator
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {npus.map((npu, idx) => (
              <div
                key={npu.name + idx}
                className="flex flex-col gap-2 rounded-md border border-hairline bg-surface/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-sans text-sm font-medium text-ink">{npu.name}</p>
                  <p className="mt-0.5 font-sans text-xs text-muted">
                    {npu.vendor || "Neural Accelerator"} · Local NPU
                  </p>
                </div>
                <span className="inline-flex items-center self-start rounded border border-hairline bg-surface px-2 py-0.5 font-mono text-[10px] font-medium text-pale-blue-text sm:self-center">
                  Detected
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
