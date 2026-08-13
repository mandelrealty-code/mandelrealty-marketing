export type AdminProductMode = "crm" | "ops";

const MODE_KEY = "mrg_admin_mode";

export function readStoredAdminMode(): AdminProductMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "crm") return "crm";
    // Legacy storage key "clients" maps to OPS
    if (v === "ops" || v === "clients") return "ops";
  } catch {
    /* ignore */
  }
  return "crm";
}

export function writeStoredAdminMode(mode: AdminProductMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}
