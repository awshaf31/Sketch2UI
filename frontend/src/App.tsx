import { Suspense, lazy, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { ToastProvider } from "./components/ToastStack.js";
import { DialogProvider } from "./components/DialogHost.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { RouteErrorBoundary, RouteFallback } from "./components/RouteBoundary.js";
import { AuthProvider, useAuth } from "./context/AuthContext.js";

// DEF-013 — every page is a dynamic import so a visitor downloads only the surface
// they actually opened. Rollup derives one chunk per page from these calls; see
// vite.config.ts for why the chunk graph is left to it rather than hand-grouped.
const loadProjectWorkspace = () => import("./pages/ProjectWorkspace.js");

const Home = lazy(() => import("./pages/Home.js"));
const Pricing = lazy(() => import("./pages/Pricing.js"));
const Login = lazy(() => import("./pages/Login.js"));
const Register = lazy(() => import("./pages/Register.js"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.js"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.js"));
const Dashboard = lazy(() => import("./pages/Dashboard.js"));
const Account = lazy(() => import("./pages/Account.js"));
const ProjectWorkspace = lazy(loadProjectWorkspace);
const AdminOverview = lazy(() => import("./pages/AdminOverview.js"));
const AdminUsers = lazy(() => import("./pages/AdminUsers.js"));
const AdminProjects = lazy(() => import("./pages/AdminProjects.js"));
const AdminProjectDetail = lazy(() => import("./pages/AdminProjectDetail.js"));
const AdminJobs = lazy(() => import("./pages/AdminJobs.js"));
const AdminModels = lazy(() => import("./pages/AdminModels.js"));
const AdminTraining = lazy(() => import("./pages/AdminTraining.js"));
const AdminAuditLogs = lazy(() => import("./pages/AdminAuditLogs.js"));

// Opening a project is the dominant next action for a signed-in user, and the
// workspace is by far the largest chunk. Warming it as soon as auth resolves keeps
// that navigation synchronous — React.lazy resolves an already-settled promise
// without suspending — so the editor never flashes a loading state on the way in.
// Gating on "authenticated" rather than on the /app path is what keeps the marketing
// site clean: a logged-out visitor on "/" never requests the editor at all.
//
// This blocks nothing: it starts after first paint, concurrent with whatever the user
// does next.
function WorkspacePrefetch() {
  const { status } = useAuth();

  useEffect(() => {
    if (status === "authenticated") void loadProjectWorkspace();
  }, [status]);

  return null;
}

// Phase 2B — ToastProvider and DialogProvider are mounted once here so
// useToast()/useDialog() are callable from anywhere without prop-drilling. Both render
// nothing visible until a later phase actually calls showToast()/confirm() — see each
// provider's own header comment for which future phase wires that up. AppHeader is
// deliberately NOT mounted here; see the roadmap's Phase 2B result for why.
//
// Phase D1 — AuthProvider wraps everything (same "context provider around Routes"
// pattern as Toast/Dialog) so /login and /register are public and the app routes are
// gated behind ProtectedRoute.
//
// SaaS phase S3 — "/" and "/pricing" are now the public marketing site (auth-optional;
// Home reads useAuth() itself to point its CTA at /register or /app). The authenticated
// app moved from "/" and "/projects/:id" to "/app" and "/app/projects/:id" so a real
// homepage could exist without colliding with the Dashboard. Every internal link/
// navigate() call and all Playwright specs were updated in the same change.
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <DialogProvider>
          <WorkspacePrefetch />
          <RouteErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
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
            </Suspense>
          </RouteErrorBoundary>
        </DialogProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
