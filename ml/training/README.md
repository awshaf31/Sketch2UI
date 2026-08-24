# ml/training

Training for the Sketch2UI UI-component detector. Plan §9.8–§9.10, §51 step 8.

## Setup

```bash
/usr/bin/python3 -m venv ml/training/.venv        # Python 3.9; torch 2.8 has wheels
ml/training/.venv/bin/pip install -r ml/training/requirements.txt
```

## Train

```bash
npm run build:v1                                   # regenerate the subset first
ml/training/.venv/bin/python ml/training/train_v1.py --device cpu
```

Defaults: `yolov8n.pt` pretrained, 60 epochs, imgsz 640, batch 8, seed 0.

**Use `--device cpu` on Apple Silicon.** MPS is auto-selected when available, but on a
memory-constrained machine its allocator degrades badly across a long run — measured
1.5 s/it early climbing to 20 s/it by epoch 29, with the machine swapping. A per-epoch
`torch.mps.empty_cache()` hook is installed and slows the decay but does not stop it.
CPU held ~1.7 s/it flat for all 60 epochs on this 2.7M-parameter model. Batch 16 on MPS
was ~20x slower than batch 8 for the same reason — benchmark before assuming otherwise.

Outputs go to `ml/training/runs/` (gitignored) and the frozen model to
`ml/models/ui-detector/<version>/` per §9.10.
