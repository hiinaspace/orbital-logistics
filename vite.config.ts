import { defineConfig } from "vite";
export default defineConfig({
  appType: "mpa",
  base: "./",
  build: {
    rolldownOptions: {
      input: { landing: "index.html", viewer: "viewer/index.html" },
    },
  },
});
