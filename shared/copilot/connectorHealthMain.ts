import { readFileSync } from "node:fs";
import { formatConnectorReport, connectorHealthReport } from "./connectorHealth.js";

function loadEnv(file: string): void {
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

loadEnv(".env.local");
loadEnv(".env");

const rows = await connectorHealthReport();
console.log(formatConnectorReport(rows));
