import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdminRoute } from "../../../lib/adminRoute";
import type { AdminProductMode } from "../../clients/mode";
import { pmGet, pmPost } from "../../clients/api";
import "../clients/clientsDesign.css";
import "./sopModalsDesign.css";
import { HubShell } from "../clients/HubShell";
import { ConfirmModal, ErrorBanner, Toast, useIsPhone } from "../clients/uiBits";
import { SopsEditor } from "./SopsEditor";
import { SopsList } from "./SopsList";
import {
  SOP_DRAFT_KEY,
  clearSopDraft,
  downloadSopBackup,
  errMsg,
  filterSops,
  isVideoSop,
  newSopSeed,
  parseSopBackup,
  persistSopDraft,
  publicSopUrl,
  sopStats,
  uploadStepImages,
  type SopItem,
} from "./sopsBits";

// Same key SopsPanel writes (re-exported so the parent / tests can assert it).
export { SOP_DRAFT_KEY };

const FONT = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";

export type SopsHubAppProps = {
  route: AdminRoute;
  setRoute: (next: AdminRoute, opts?: { push?: boolean }) => void;
  onModeChange: (mode: AdminProductMode, patch?: Partial<AdminRoute>) => void;
  /** Same prop as SopsPanel: open the (parent-owned) Video Studio, optionally on an existing SOP. */
  onOpenVideoStudio?: (sopToEdit?: SopItem) => void;
  /** Same prop as SopsPanel: bump to reload the list (e.g. after the studio saves). */
  refreshTrigger?: number;
  /** When true, parent owns HubShell — render body only. */
  embedded?: boolean;
};

export function SopsHubApp({ route, setRoute, onModeChange, onOpenVideoStudio, refreshTrigger, embedded = false }: SopsHubAppProps) {
  const phone = useIsPhone();

  const [sops, setSops] = useState<SopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [selectedCat, setSelectedCat] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSop, setEditingSop] = useState<SopItem | null>(null);
  const [editorError, setEditorError] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const baseline = useRef("");
  const copiedTimer = useRef<number | null>(null);

  const [pendingDelete, setPendingDelete] = useState<SopItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT;
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(
    () => () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    },
    [],
  );

  /* ---------------- data (same call as SopsPanel) ---------------- */

  const fetchSops = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await pmGet<{ sops: SopItem[] }>("sops");
      setSops(data.sops || []);
    } catch (err: unknown) {
      setSops([]);
      setLoadError(errMsg(err, "Could not load SOPs."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSops();
  }, [fetchSops, refreshTrigger]);

  // Draft autosave: same 400 ms debounce and key as SopsPanel.
  useEffect(() => {
    if (!editingSop || !editorOpen) return;
    const t = window.setTimeout(() => {
      void persistSopDraft(editingSop).then((ok) => {
        if (ok) setDraftSavedAt(new Date());
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [editingSop, editorOpen]);

  /* ---------------- editor open / close ---------------- */

  const openEditor = (sop: SopItem) => {
    baseline.current = JSON.stringify(sop);
    setEditorError("");
    setDraftSavedAt(null);
    setEditingSop(sop);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingSop(null);
    setEditorError("");
    setProgress(null);
  };

  const dirty = Boolean(editingSop) && JSON.stringify(editingSop) !== baseline.current;

  /* ---------------- list actions ---------------- */

  const handleCopyLink = (sop: SopItem) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(publicSopUrl(sop.slug)).catch(() => {});
    }
    setToast("Public link copied");
    setCopiedSlug(sop.slug);
    if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopiedSlug(null), 2500);
  };

  const handleImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseSopBackup(String(reader.result || ""));
        setError("");
        openEditor(parsed);
        setToast(`Imported 1 SOP from ${file.name}`);
      } catch (err: unknown) {
        setError(`Could not import backup: ${errMsg(err, String(err))}`);
      }
    };
    reader.readAsText(file);
  };

  const handleOpenNew = () => openEditor(newSopSeed());

  const handleEditSop = (sop: SopItem) => {
    if (isVideoSop(sop) && onOpenVideoStudio) {
      onOpenVideoStudio(sop);
      return;
    }
    // Deep clone to allow safe editing
    openEditor(JSON.parse(JSON.stringify(sop)));
  };

  const deleteSop = async (sop: SopItem) => {
    try {
      await pmPost("sops", { op: "delete", id: sop.id || sop.slug, slug: sop.slug });
      setSops((prev) => prev.filter((s) => s.id !== sop.id && s.slug !== sop.slug));
      if (editingSop && (editingSop.id === sop.id || editingSop.slug === sop.slug)) {
        closeEditor();
      }
      setToast(`Deleted “${sop.title}”`);
      return true;
    } catch (err: unknown) {
      const msg = `Could not delete SOP: ${errMsg(err, String(err))}`;
      if (editorOpen) setEditorError(msg);
      else setError(msg);
      return false;
    }
  };

  const confirmListDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    await deleteSop(pendingDelete);
    setDeleting(false);
    setPendingDelete(null);
  };

  /* ---------------- publish (SopsPanel.handleSaveSop, unchanged) ---------------- */

  const handleSaveSop = async () => {
    if (!editingSop) return;
    setSaving(true);
    setEditorError("");
    try {
      await persistSopDraft(editingSop);
      const { slug, steps } = await uploadStepImages(editingSop, (done, total) => setProgress({ done, total }));
      const payload = { ...editingSop, slug, steps };
      setEditingSop(payload);
      const res = await pmPost<{ sop: SopItem }>("sops", {
        op: "save",
        ...payload,
      });
      if (res.sop) {
        setSops((prev) => {
          const idx = prev.findIndex((s) => s.id === res.sop.id || s.slug === res.sop.slug);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = res.sop;
            return next;
          }
          return [res.sop, ...prev];
        });
      }
      clearSopDraft();
      closeEditor();
      setToast(payload.is_published ? "Published. The public link is live." : "Saved as a draft.");
    } catch (err: unknown) {
      setEditorError(`Could not save SOP: ${errMsg(err, String(err))}`);
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  /* ---------------- derived ---------------- */

  const filteredSops = useMemo(() => filterSops(sops, selectedCat, searchQuery), [sops, selectedCat, searchQuery]);
  const stats = useMemo(() => sopStats(sops), [sops]);

  /* ---------------- navigation ---------------- */

  const navOps = useCallback(
    (opsTab: AdminRoute["opsTab"]) => {
      setRoute(
        {
          ...route,
          mode: "ops",
          opsTab,
          propertyId: null,
          clientId: null,
          clientEdit: false,
          createClient: false,
          hstClientId: null,
          employeeId: null,
        },
        { push: true },
      );
    },
    [route, setRoute],
  );

  const onNavigate = (id: string) => {
    if (id === "crm") return onModeChange("crm");
    if (id === "copilot") return onModeChange("copilot");
    if (id === "onboarding") return onModeChange("onboarding");
    if (id === "dashboard" || id === "sops") return navOps("sops");
    if (id === "team") return navOps("employees");
    if (id === "properties") return navOps("properties");
    if (id === "revenue") return navOps("month");
    if (id === "clients") return navOps("clients");
    if (id === "settings") return navOps("settings");
  };

  /* ---------------- render ---------------- */

  const banner =
    loadError || error ? (
      <ErrorBanner
        title={loadError ? "Could not load SOPs." : error}
        detail={loadError && !phone ? loadError : undefined}
        onRetry={loadError ? () => void fetchSops() : undefined}
        onDismiss={() => {
          setLoadError("");
          setError("");
        }}
      />
    ) : null;

  const list = (
    <SopsList
      phone={phone}
      loading={loading}
      banner={banner}
      sops={sops}
      filtered={filteredSops}
      stats={stats}
      selectedCat={selectedCat}
      onCat={setSelectedCat}
      query={searchQuery}
      onQuery={setSearchQuery}
      copiedSlug={copiedSlug}
      onRecord={() => onOpenVideoStudio?.()}
      onImport={handleImportBackup}
      onNew={handleOpenNew}
      onEdit={handleEditSop}
      onCopy={handleCopyLink}
      onDelete={setPendingDelete}
    />
  );

  return (
    <div className={`mrgc sp-hub${phone ? " is-phone" : ""}${embedded ? " hub-embed" : ""}`}>
      {embedded ? (
        list
      ) : (
        <HubShell
          active="sops"
          onNavigate={onNavigate}
          phone={phone}
          fab={phone ? { label: "New SOP", onClick: handleOpenNew } : null}
        >
          {list}
        </HubShell>
      )}

      {editorOpen && editingSop ? (
        <SopsEditor
          phone={phone}
          sop={editingSop}
          onChange={setEditingSop}
          dirty={dirty}
          draftSavedAt={draftSavedAt}
          saving={saving}
          progress={progress}
          error={editorError}
          onDismissError={() => setEditorError("")}
          onClose={closeEditor}
          onDiscard={closeEditor}
          onPublish={() => void handleSaveSop()}
          onDelete={(sop) => void deleteSop(sop)}
          onDownload={() => {
            void persistSopDraft(editingSop);
            downloadSopBackup(editingSop);
          }}
          onVideoStudio={
            onOpenVideoStudio
              ? () => {
                  const sopToTransfer = editingSop;
                  setEditorOpen(false);
                  setEditingSop(null);
                  onOpenVideoStudio(sopToTransfer);
                }
              : undefined
          }
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmModal
          phone={phone}
          busy={deleting}
          title={`Delete ${pendingDelete.title || "this SOP"}?`}
          body="The guide and its public link are removed. It can’t be undone."
          confirmLabel="Delete SOP"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmListDelete()}
        />
      ) : null}

      <Toast message={toast} />
    </div>
  );
}
