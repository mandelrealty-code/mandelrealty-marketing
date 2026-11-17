import type { AdminRoute } from "../../../lib/adminRoute";
import type { AdminProductMode } from "../../clients/mode";

/** Map sidebar item ids to the HubShell `active` highlight. */
export function hubActiveFromOpsTab(opsTab: AdminRoute["opsTab"] | string | null | undefined): string {
  if (opsTab === "employees") return "team";
  if (opsTab === "month") return "revenue";
  if (opsTab === "sops" || !opsTab) return "sops";
  if (opsTab === "clients") return "clients";
  if (opsTab === "properties") return "properties";
  if (opsTab === "settings") return "settings";
  return "sops";
}

export type HubNavHost = {
  route: AdminRoute;
  setRoute: (next: AdminRoute, opts?: { push?: boolean }) => void;
  onModeChange: (mode: AdminProductMode, patch?: Partial<AdminRoute>) => void;
};

/** Shared sidebar navigation used by every OPS hub page. */
export function navigateHub(host: HubNavHost, id: string) {
  const { route, setRoute, onModeChange } = host;
  if (id === "crm") return onModeChange("crm");
  if (id === "copilot") return onModeChange("copilot");
  if (id === "onboarding") return onModeChange("onboarding");

  const opsTab: AdminRoute["opsTab"] =
    id === "dashboard" || id === "sops"
      ? "sops"
      : id === "team"
        ? "employees"
        : id === "revenue"
          ? "month"
          : id === "properties"
            ? "properties"
            : id === "clients"
              ? "clients"
              : id === "settings"
                ? "settings"
                : "sops";

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
}

export const OPS_SB_KEY = "mrg-ops-sb";
