"""Train and freeze the Sketch2UI v1 UI-component detector.

Plan references:
  section 9.8  training process (prepare -> validate -> data.yaml -> train from
               pretrained -> evaluate -> confusion matrix -> weak classes)
  section 9.9  metrics to track
  section 9.10 model registry layout
  section 51   step 8

This is a SMOKE TEST of the training pipeline, not a production model. 156 images is
far below what a 16-class detector needs; the numbers it produces say "the pipeline
runs end to end", not "this detector works". See the generated model README.

Trains on the v1 subset only (ml/dataset/v1), never the full 41-class dataset —
see ml/dataset/v1-training-scope.md.

Usage:
    ml/training/.venv/bin/python ml/training/train_v1.py
    ml/training/.venv/bin/python ml/training/train_v1.py --epochs 5 --version v0.0.1-test
"""

from __future__ import annotations

import argparse
import json
import platform
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
V1_DIR = REPO_ROOT / "ml" / "dataset" / "v1"
V1_DATA_YAML = V1_DIR / "data.yaml"
V1_CLASSES = REPO_ROOT / "ml" / "dataset" / "v1-classes.txt"
REGISTRY_ROOT = REPO_ROOT / "ml" / "models" / "ui-detector"
RUNS_DIR = REPO_ROOT / "ml" / "training" / "runs"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    # section 9.8 step 4: train FROM PRETRAINED weights. 156 images cannot train a
    # detector from random init; transfer learning from COCO is the only viable path.
    p.add_argument("--model", default="yolov8n.pt",
                   help="pretrained checkpoint (nano = the plan's 'tiny-style' lightweight detector)")
    p.add_argument("--epochs", type=int, default=60)
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--batch", type=int, default=16)
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--device", default=None, help="mps / cpu / 0 (default: auto)")
    p.add_argument("--version", default="v1.0.0", help="registry version directory name")
    p.add_argument("--name", default="v1", help="ultralytics run name")
    return p.parse_args()


def pick_device(explicit: str | None) -> str:
    """Auto-select a device.

    Note on Apple Silicon: MPS is picked when available, but on a memory-constrained
    machine its allocator degrades badly over a long run even with a per-epoch cache
    flush (measured here: 1.5 s/it early, 7+ s/it by epoch 11, machine swapping). CPU
    sustained ~1.7 s/it flat for this 2.7M-parameter model, so `--device cpu` is the
    more predictable choice at this dataset size. Benchmark before assuming MPS wins.
    """
    if explicit:
        return explicit
    import torch
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "0"
    return "cpu"


def preflight() -> list[str]:
    """section 9.8 step 2: validate labels before training."""
    if not V1_DATA_YAML.exists():
        sys.exit(f"Missing {V1_DATA_YAML}. Run `npm run build:v1` first.")
    if not V1_CLASSES.exists():
        sys.exit(f"Missing {V1_CLASSES}. Run `npm run build:v1` first.")

    classes = V1_CLASSES.read_text().strip().split("\n")
    problems = []
    for split in ("train", "val", "test"):
        img_dir = V1_DIR / "images" / split
        lbl_dir = V1_DIR / "labels" / split
        if not img_dir.exists() or not any(img_dir.iterdir()):
            problems.append(f"{split}: no images")
            continue
        stems_i = {p.stem for p in img_dir.iterdir() if p.name != ".gitkeep"}
        stems_l = {p.stem for p in lbl_dir.glob("*.txt")}
        if stems_i ^ stems_l:
            problems.append(f"{split}: {len(stems_i ^ stems_l)} unpaired image/label")
        for p in lbl_dir.glob("*.txt"):
            body = p.read_text().strip()
            if not body:
                problems.append(f"{p.name}: empty label file")
                continue
            for i, line in enumerate(body.split("\n"), 1):
                parts = line.split()
                if len(parts) != 5:
                    problems.append(f"{p.name}:{i}: {len(parts)} fields")
                    continue
                cid = int(parts[0])
                vals = [float(v) for v in parts[1:]]
                if not 0 <= cid < len(classes):
                    problems.append(f"{p.name}:{i}: class id {cid} out of range")
                if any(v < 0 or v > 1 for v in vals) or vals[2] <= 0 or vals[3] <= 0:
                    problems.append(f"{p.name}:{i}: bad geometry")
    return problems


def collect_metrics(results, classes: list[str]) -> dict:
    """section 9.9 metrics."""
    box = results.box
    per_class = {}
    # results.box.maps is per-class mAP@0.5:0.95, indexed by class id present in the run.
    ap50 = list(box.ap50) if hasattr(box, "ap50") else []
    ap = list(box.ap) if hasattr(box, "ap") else []
    p_arr = list(box.p) if hasattr(box, "p") else []
    r_arr = list(box.r) if hasattr(box, "r") else []
    ap_index = list(box.ap_class_index) if hasattr(box, "ap_class_index") else []

    for i, cid in enumerate(ap_index):
        name = classes[int(cid)] if int(cid) < len(classes) else str(cid)
        per_class[name] = {
            "precision": float(p_arr[i]) if i < len(p_arr) else None,
            "recall": float(r_arr[i]) if i < len(r_arr) else None,
            "ap50": float(ap50[i]) if i < len(ap50) else None,
            "ap50_95": float(ap[i]) if i < len(ap) else None,
        }

    return {
        "precision": float(box.mp),
        "recall": float(box.mr),
        "mAP50": float(box.map50),
        "mAP50_95": float(box.map),
        "per_class": per_class,
    }


def main() -> None:
    args = parse_args()

    print("=" * 70)
    print("Sketch2UI v1 detector — PIPELINE SMOKE TEST, not a production model")
    print("=" * 70)

    problems = preflight()
    if problems:
        print("\nLabel validation failed (section 9.8 step 2):")
        for p in problems[:20]:
            print(f"  {p}")
        sys.exit(1)
    print("\nLabel validation passed (section 9.8 step 2).")

    classes = V1_CLASSES.read_text().strip().split("\n")
    device = pick_device(args.device)
    print(f"Classes : {len(classes)}")
    print(f"Device  : {device}")
    print(f"Model   : {args.model} (pretrained — transfer learning, section 9.8 step 4)")
    print(f"Epochs  : {args.epochs}\n")

    from ultralytics import YOLO

    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    model = YOLO(args.model)

    # PyTorch's MPS allocator does not release its cache across epochs, so a long run
    # degrades badly: measured 1.1 s/it at epoch 2 climbing to 20 s/it by epoch 29,
    # with the machine down to ~55 MB free. Flushing the cache each epoch holds the
    # rate flat. Harmless on CPU/CUDA, where the hook is a no-op.
    if device == "mps":
        import torch

        def _flush_mps(_trainer):
            torch.mps.empty_cache()

        model.add_callback("on_train_epoch_end", _flush_mps)
        model.add_callback("on_val_end", _flush_mps)

    started = datetime.now(timezone.utc)
    model.train(
        data=str(V1_DATA_YAML),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        seed=args.seed,
        device=device,
        project=str(RUNS_DIR),
        name=args.name,
        exist_ok=True,
        plots=True,          # section 9.8 step 6: confusion matrix
        val=True,
    )
    finished = datetime.now(timezone.utc)

    run_dir = RUNS_DIR / args.name
    best = run_dir / "weights" / "best.pt"
    if not best.exists():
        sys.exit(f"Training finished but {best} is missing.")

    # Evaluate on val and on the held-out test split separately (section 9.9).
    print("\nEvaluating on val split…")
    val_metrics = collect_metrics(YOLO(str(best)).val(
        data=str(V1_DATA_YAML), split="val", device=device,
        project=str(RUNS_DIR), name=f"{args.name}_val", exist_ok=True, plots=True,
    ), classes)

    print("Evaluating on test split…")
    test_metrics = collect_metrics(YOLO(str(best)).val(
        data=str(V1_DATA_YAML), split="test", device=device,
        project=str(RUNS_DIR), name=f"{args.name}_test", exist_ok=True, plots=True,
    ), classes)

    freeze(args, classes, best, run_dir, val_metrics, test_metrics, started, finished, device)


def freeze(args, classes, best, run_dir, val_metrics, test_metrics, started, finished, device) -> None:
    """section 9.10: never ship 'latest.pt' alone — freeze a versioned directory."""
    out = REGISTRY_ROOT / args.version
    out.mkdir(parents=True, exist_ok=True)

    shutil.copy2(best, out / "weights.pt")
    shutil.copy2(V1_DATA_YAML, out / "data.yaml")
    shutil.copy2(V1_CLASSES, out / "classes.txt")

    for plot in ("confusion_matrix.png", "confusion_matrix_normalized.png",
                 "results.png", "PR_curve.png"):
        src = run_dir / plot
        if src.exists():
            shutil.copy2(src, out / plot)

    import torch, ultralytics
    metrics = {
        "model_version": args.version,
        "created_utc": finished.isoformat(),
        "training_seconds": round((finished - started).total_seconds(), 1),
        "status": "smoke_test",
        "caveat": (
            "Trained on 156 images across 16 classes. Far below the data needed for a "
            "reliable detector. These metrics demonstrate the pipeline runs end to end; "
            "they are not evidence the detector works in production."
        ),
        "dataset": {
            "source": "ml/dataset/v1 (derived subset of the full 41-class ml/dataset)",
            "scope_doc": "ml/dataset/v1-training-scope.md",
            "classes": len(classes),
            "class_list": classes,
        },
        "config": {
            "pretrained_weights": args.model,
            "epochs": args.epochs,
            "imgsz": args.imgsz,
            "batch": args.batch,
            "seed": args.seed,
            "device": device,
            "ultralytics": ultralytics.__version__,
            "torch": torch.__version__,
            "python": platform.python_version(),
            "platform": platform.platform(),
        },
        "metrics": {"val": val_metrics, "test": test_metrics},
    }
    (out / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")

    # Classes the evaluator never scored (no predictions at all) are the weakest of
    # all — surface them explicitly rather than letting them vanish from the ranking.
    scored = test_metrics["per_class"]
    unscored = [c for c in classes if c not in scored]
    weak = [(c, 0.0) for c in unscored]
    weak += sorted(((n, m["ap50"] or 0.0) for n, m in scored.items()), key=lambda kv: kv[1])
    weak = weak[:3]
    (out / "README.md").write_text(render_readme(args, classes, metrics, weak))

    print("\n" + "=" * 70)
    print(f"Frozen: {out.relative_to(REPO_ROOT)}")
    print("=" * 70)
    print(f"  val  mAP@0.5 {val_metrics['mAP50']:.4f}   mAP@0.5:0.95 {val_metrics['mAP50_95']:.4f}")
    print(f"  test mAP@0.5 {test_metrics['mAP50']:.4f}   mAP@0.5:0.95 {test_metrics['mAP50_95']:.4f}")
    weak_str = ", ".join(f"{n} {v:.3f}" for n, v in weak) if weak else "(none scored)"
    print(f"  weakest (test AP@0.5): {weak_str}")
    print("\n  Reminder: smoke test, not a production model.\n")


def render_readme(args, classes, metrics, weak) -> str:
    val, test = metrics["metrics"]["val"], metrics["metrics"]["test"]
    rows = []
    for name in classes:
        v = val["per_class"].get(name, {})
        t = test["per_class"].get(name, {})
        def f(x):
            return f"{x:.3f}" if isinstance(x, (int, float)) else "—"
        rows.append(
            f"| `{name}` | {f(t.get('precision'))} | {f(t.get('recall'))} | "
            f"{f(t.get('ap50'))} | {f(t.get('ap50_95'))} | {f(v.get('ap50'))} |"
        )

    return f"""# ui-detector {args.version}

⚠️ **PIPELINE SMOKE TEST — NOT A PRODUCTION MODEL.**

Trained on **156 images** across **{len(classes)} classes**. That is far below what a
{len(classes)}-class hand-drawn-sketch detector needs. The metrics below show the
training and evaluation pipeline runs end to end (§9.8). They are **not** evidence that
this detector is usable, and it should not be wired into `cv-service` or
`backend` on the strength of them.

Frozen per §9.10. Do not overwrite this directory — cut a new version instead.

## Contents

| File | What |
|---|---|
| `weights.pt` | best checkpoint by val fitness |
| `data.yaml` | the exact v1-subset config used for training |
| `classes.txt` | **v1 subset class order — frozen.** Model output ids index THIS file, not `ml/dataset/classes.txt` |
| `metrics.json` | §9.9 metrics, val and test |
| `confusion_matrix*.png`, `results.png`, `PR_curve.png` | §9.8 step 6 diagnostics |

⚠️ **Class-id namespace.** This model emits ids `0..{len(classes) - 1}` indexing
`classes.txt` *in this directory* — the 16-class v1 subset. The full taxonomy has 41
classes with different ids (`ml/dataset/classes.txt`). Anything consuming this model
must translate through the file shipped here.

## Dataset

- Source: `ml/dataset/v1`, a derived view of the full 41-class `ml/dataset`.
- Scope and exclusion rationale: `ml/dataset/v1-training-scope.md`.
- 25 taxonomy classes were **excluded for insufficient data**, not because they are
  unimportant — several (`page`, `card`, `nav_item`) are central to the product.
- Upstream data includes two CC BY 4.0 datasets from Roboflow Universe; see
  `ml/dataset/README.md` for the attribution that must travel with any redistribution.

## Training config

| Setting | Value |
|---|---|
| pretrained weights | `{args.model}` (transfer learning — §9.8 step 4) |
| epochs | {args.epochs} |
| image size | {args.imgsz} |
| batch | {args.batch} |
| seed | {args.seed} |
| device | {metrics['config']['device']} |
| ultralytics | {metrics['config']['ultralytics']} |
| torch | {metrics['config']['torch']} |
| python | {metrics['config']['python']} |

## Metrics (§9.9)

| Split | Precision | Recall | mAP@0.5 | mAP@0.5:0.95 |
|---|---:|---:|---:|---:|
| val | {val['precision']:.4f} | {val['recall']:.4f} | {val['mAP50']:.4f} | {val['mAP50_95']:.4f} |
| test | {test['precision']:.4f} | {test['recall']:.4f} | {test['mAP50']:.4f} | {test['mAP50_95']:.4f} |

### Per class (test split, val AP@0.5 for comparison)

| Class | P | R | AP@0.5 | AP@0.5:0.95 | val AP@0.5 |
|---|---:|---:|---:|---:|---:|
{chr(10).join(rows)}

## Known weak classes (§9.8 step 7)

Lowest test AP@0.5:

{chr(10).join(f"- `{n}` — AP@0.5 {v:.3f}" + (" (no predictions produced at all)" if n not in test["per_class"] else "") for n, v in weak) if weak else "_No class produced scoreable predictions._"}

§9.3 predicts this failure mode directly: a hand-drawn small rectangle is genuinely
ambiguous between `input`, `button`, `image`, `card` and `select`, and with this little
data the detector cannot separate them. Inspect `confusion_matrix.png` to see which
pairs are actually being swapped.

**Do not fix this by retraining with different hyperparameters.** The constraint is data
volume, not optimisation. §9.8 steps 8-9: add difficult examples for the weak classes,
then retrain.

## Next steps

1. Collect more sketches, especially for the weak classes above and the 25 excluded ones.
2. Re-run `npm run export:dataset && npm run import:external && npm run build:v1`.
3. Retrain as a new version — never overwrite this one.
4. Only wire a model into `cv-service` (§51 step 9) once its metrics justify it.
"""


if __name__ == "__main__":
    main()
