export type AdminProductMode = "crm" | "clients";

const MODE_KEY = "mrg_admin_mode";

export function readStoredAdminMode(): AdminProductMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "clients" || v === "crm") return v;
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
