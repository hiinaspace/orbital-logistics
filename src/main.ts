import "./style.css";
import { mountWorkspace } from "./viewer/workspace";
const workspace = mountWorkspace(document.body);
if (import.meta.hot) import.meta.hot.dispose(() => workspace.dispose());
