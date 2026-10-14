import "./style.css";
import { mountWorkspace } from "./viewer/workspace";
const workspace = mountWorkspace(document.body);
window.addEventListener("pagehide", () => workspace.dispose(), { once: true });
window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
if (import.meta.hot) import.meta.hot.dispose(() => workspace.dispose());
