export type AdminProductMode = "dashboard" | "crm" | "onboarding" | "ops" | "copilot";

const MODE_KEY = "mrg_admin_mode";

export function readStoredAdminMode(): AdminProductMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "dashboard") return "dashboard";
    if (v === "crm") return "crm";
    // Legacy storage key "clients" maps to OPS
    if (v === "ops" || v === "clients") return "ops";
    if (v === "copilot") return "copilot";
    if (v === "onboarding") return "onboarding";
  } catch {
    /* ignore */
  }
  return "dashboard";
}

export function writeStoredAdminMode(mode: AdminProductMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}
