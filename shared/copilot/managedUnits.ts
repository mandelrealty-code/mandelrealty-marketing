/** The four units Copilot may raise. Every other listing stays silent. */

export function isManagedUnit(name: string, address = "", extra = ""): boolean {
  const blob = `${name} ${address} ${extra}`.toLowerCase();
  if (/1103|1104|2104|markham|partner loft|king st w/.test(blob)) return false;
  if (/charlotte/.test(blob) && /\b606\b/.test(blob)) return true;
  if (/roseglor/.test(blob) || /spacious 3br/.test(blob)) return true;
  if (/blue jays/.test(blob)) return true;
  if (/\bshaw\b/.test(blob)) return true;
  return false;
}
