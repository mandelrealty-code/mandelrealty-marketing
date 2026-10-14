/** The OPS navigation. Tasks moved to Copilot; OPS no longer lists or links to it. */
export const OPS_NAV = [
  ["reviews", "Reviews"],
  ["sops", "SOPs"],
  ["employees", "Employees"],
  ["clients", "Clients"],
  ["properties", "Properties"],
  ["month", "Revenue"],
  ["settings", "Settings"],
] as const;

/** The old OPS Tasks tab (/ops/tasks and /ops/tasks/:id) now opens the Tasks board in Copilot. */
export function opsPathOpensCopilotTasks(pathname: string): boolean {
  return /^\/ops\/tasks(?:\/|$)/.test(pathname.replace(/\/+$/, "") || "/");
}
