import { Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.js";
import Login from "./pages/Login.js";
import Register from "./pages/Register.js";
import ProjectWorkspace from "./pages/ProjectWorkspace.js";
import { ToastProvider } from "./components/ToastStack.js";
import { DialogProvider } from "./components/DialogHost.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { AuthProvider } from "./context/AuthContext.js";

// Phase 2B (docs/frontend/frontend-implementation-roadmap.md) — ToastProvider and
// DialogProvider are mounted once here so useToast()/useDialog() are callable from
// anywhere without prop-drilling. Both render nothing visible until a later phase
// actually calls showToast()/confirm() — see each provider's own header comment for
// which future phase wires that up. AppHeader is deliberately NOT mounted here; see
// the roadmap's Phase 2B result for why.
//
// Phase D1 — AuthProvider wraps everything (same "context provider around Routes"
// pattern as Toast/Dialog) so /login and /register are public and the two
// previously-open routes are gated behind ProtectedRoute.
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <DialogProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id"
              element={
                <ProtectedRoute>
                  <ProjectWorkspace />
                </ProtectedRoute>
              }
            />
          </Routes>
        </DialogProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
