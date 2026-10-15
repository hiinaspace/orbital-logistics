import { defineConfig } from "vite";
import {
  transcriptHTML,
  transcriptMarkdown,
  transcriptPath,
} from "./scripts/build-log.ts";
export default defineConfig({
  appType: "mpa",
  base: "./",
  build: {
    rolldownOptions: {
      input: {
        landing: "index.html",
        viewer: "viewer/index.html",
        transcript: "build-log/index.html",
      },
    },
  },
  plugins: [
    {
      name: "static-build-transcript",
      transformIndexHtml: {
        order: "pre",
        handler(html, context) {
          return context.filename.endsWith("/build-log/index.html")
            ? html.replace("<!-- TRANSCRIPT -->", transcriptHTML())
            : html;
        },
      },
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "build-log.md",
          source: transcriptMarkdown(),
        });
      },
      configureServer(server) {
        server.watcher.add(transcriptPath.pathname);
        server.watcher.on("change", (path) => {
          if (path === transcriptPath.pathname)
            server.ws.send({ type: "full-reload", path: "/build-log/" });
        });
        server.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== "/build-log.md") return next();
          res.setHeader("Content-Type", "text/markdown; charset=utf-8");
          res.end(transcriptMarkdown());
        });
      },
    },
  ],
});
