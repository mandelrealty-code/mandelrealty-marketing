import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";
import { defineConfig, type Plugin } from "vite";
import { handleDevApi } from "./shared/devApiRouter.js";

function auditDevApiPlugin(env: Record<string, string>): Plugin {
  for (const [k, v] of Object.entries(env)) {
    if (v && !process.env[k]) process.env[k] = v;
  }

  return {
    name: "audit-dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const handled = await handleDevApi(req, res, env);
          if (!handled) next();
        } catch (err) {
          console.error("[dev-api]", err);
          next();
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), auditDevApiPlugin(env)],
  };
});
