import { create } from "zustand";
import type { Detection, ProjectAsset } from "@sketch2ui/shared-types";

interface ProjectState {
  asset: ProjectAsset | null;
  detections: Detection[];
  selectedId: string | null;
  activeClass: string;

  setAsset: (asset: ProjectAsset | null) => void;
  setDetections: (detections: Detection[]) => void;
  addDetection: (detection: Detection) => void;
  updateDetection: (id: string, patch: Partial<Detection>) => void;
  removeDetection: (id: string) => void;
  select: (id: string | null) => void;
  setActiveClass: (className: string) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  asset: null,
  detections: [],
  selectedId: null,
  activeClass: "text",

  setAsset: (asset) => set({ asset }),
  setDetections: (detections) => set({ detections }),
  addDetection: (detection) =>
    set((state) => ({ detections: [...state.detections, detection], selectedId: detection.id })),
  updateDetection: (id, patch) =>
    set((state) => ({
      detections: state.detections.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    })),
  removeDetection: (id) =>
    set((state) => ({
      detections: state.detections.filter((d) => d.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),
  select: (id) => set({ selectedId: id }),
  setActiveClass: (className) => set({ activeClass: className }),
}));
