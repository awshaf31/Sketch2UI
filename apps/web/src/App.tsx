import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home.js";
import Pricing from "./pages/Pricing.js";
import Dashboard from "./pages/Dashboard.js";
import Account from "./pages/Account.js";
import Login from "./pages/Login.js";
import Register from "./pages/Register.js";
import ProjectWorkspace from "./pages/ProjectWorkspace.js";
import AdminOverview from "./pages/AdminOverview.js";
import AdminUsers from "./pages/AdminUsers.js";
import AdminProjects from "./pages/AdminProjects.js";
import AdminProjectDetail from "./pages/AdminProjectDetail.js";
import AdminJobs from "./pages/AdminJobs.js";
import AdminModels from "./pages/AdminModels.js";
import AdminTraining from "./pages/AdminTraining.js";
import AdminAuditLogs from "./pages/AdminAuditLogs.js";
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
// pattern as Toast/Dialog) so /login and /register are public and the app routes are
// gated behind ProtectedRoute.
//
// SaaS phase S3 — "/" and "/pricing" are now the public marketing site (auth-optional;
// Home reads useAuth() itself to point its CTA at /register or /app). The authenticated
// app moved from "/" and "/projects/:id" to "/app" and "/app/projects/:id" so a real
// homepage could exist without colliding with the Dashboard. Every internal link/
// navigate() call and all Playwright specs were updated in the same change — see
// docs/execution/phase-log.md's Phase S3 entry.
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <DialogProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/projects/:id"
              element={
                <ProtectedRoute>
                  <ProjectWorkspace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/account"
              element={
                <ProtectedRoute>
                  <Account />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminOverview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/projects"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminProjects />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/projects/:id"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminProjectDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/jobs"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminJobs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/models"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminModels />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/training"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminTraining />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminAuditLogs />
                </ProtectedRoute>
              }
            />
          </Routes>
        </DialogProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
