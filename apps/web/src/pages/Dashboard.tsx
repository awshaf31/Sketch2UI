import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Project } from "@sketch2ui/shared-types";
import { api } from "../services/api.js";

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .listProjects()
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const project = await api.createProject({ name: name.trim() });
      navigate(`/projects/${project.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(id: string) {
    await api.deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-gray-900">Sketch2UI</h1>
      <p className="mt-1 text-sm text-gray-500">
        Turn a hand-drawn wireframe into HTML/CSS with a live preview.
      </p>

      <form onSubmit={handleCreate} className="mt-8 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project name"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Create project
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-8">
        {loading ? (
          <p className="text-sm text-gray-500">Loading projects…</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-gray-500">No projects yet. Create one above.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="text-left text-sm font-medium text-gray-900 hover:underline"
                >
                  {p.name}
                  <span className="ml-2 text-xs font-normal text-gray-400">{p.status}</span>
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-xs text-gray-400 hover:text-red-600"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
