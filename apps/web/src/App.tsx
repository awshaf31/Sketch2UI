import { Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.js";
import ProjectWorkspace from "./pages/ProjectWorkspace.js";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/projects/:id" element={<ProjectWorkspace />} />
    </Routes>
  );
}
