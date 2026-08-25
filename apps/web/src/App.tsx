import { Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.js";
import ProjectWorkspace from "./pages/ProjectWorkspace.js";
import { ToastProvider } from "./components/ToastStack.js";
import { DialogProvider } from "./components/DialogHost.js";

// Phase 2B (docs/frontend/frontend-implementation-roadmap.md) — ToastProvider and
// DialogProvider are mounted once here so useToast()/useDialog() are callable from
// anywhere without prop-drilling. Both render nothing visible until a later phase
// actually calls showToast()/confirm() — see each provider's own header comment for
// which future phase wires that up. AppHeader is deliberately NOT mounted here; see
// the roadmap's Phase 2B result for why.
export default function App() {
  return (
    <ToastProvider>
      <DialogProvider>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects/:id" element={<ProjectWorkspace />} />
        </Routes>
      </DialogProvider>
    </ToastProvider>
  );
}
