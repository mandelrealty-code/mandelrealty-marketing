/** The OPS navigation. Tasks and Reviews moved to Copilot; OPS no longer lists or links to them. */
export const OPS_NAV = [
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

/** The old OPS Reviews tab (/ops/reviews and /ops/reviews/:id) now opens Reviews in Copilot. */
export function opsPathOpensCopilotReviews(pathname: string): boolean {
  return /^\/ops\/reviews(?:\/|$)/.test(pathname.replace(/\/+$/, "") || "/");
}
