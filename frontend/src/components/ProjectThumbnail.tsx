import { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { cn } from "./cn.js";

// Mockup 2 (Dashboard project cards). Dashboard's project list (GET /api/projects) carries
// no page/asset ids, so this component looks its own thumbnail up via the existing
// listPages -> listAssets -> assetUrl chain (the same ownership-gated image route the
// workspace already uses) rather than the API gaining a new field. Page count is a
// byproduct of that same listPages call, so it's reported back via onPageCount instead of
// Dashboard fetching it again separately.

interface ProjectThumbnailProps {
  projectId: string;
  projectName: string;
  onPageCount?: (count: number) => void;
  className?: string;
}

type ThumbnailState = { kind: "loading" } | { kind: "image"; src: string } | { kind: "empty" };

export function ProjectThumbnail({ projectId, projectName, onPageCount, className }: ProjectThumbnailProps) {
  const [state, setState] = useState<ThumbnailState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });

    (async () => {
      const pages = await api.listPages(projectId).catch(() => []);
      if (cancelled) return;
      onPageCount?.(pages.length);

      const firstPage = pages[0];
      if (!firstPage) {
        setState({ kind: "empty" });
        return;
      }

      const assets = await api.listAssets(projectId, firstPage.id).catch(() => []);
      if (cancelled) return;

      const firstAsset = assets[0];
      setState(
        firstAsset
          ? { kind: "image", src: api.assetUrl(projectId, firstPage.id, firstAsset.id) }
          : { kind: "empty" }
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (state.kind === "image") {
    return (
      <img
        src={state.src}
        alt={`Preview of ${projectName}`}
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }

  if (state.kind === "loading") {
    return <div className={cn("h-full w-full bg-surface-sunken", className)} aria-hidden="true" />;
  }

  // Draft, no sketch yet — a neutral diagonal hairline pattern, not an illustration,
  // per the blueprint: distinguishes "nothing uploaded" from a broken image without
  // inventing decorative art.
  return (
    <div
      className={cn("h-full w-full bg-surface-sunken", className)}
      style={{
        backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 6px, #dde1e8 6px, #dde1e8 7px)",
      }}
      aria-hidden="true"
    />
  );
}
