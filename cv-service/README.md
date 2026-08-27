# cv-worker

FastAPI inference service for the Sketch2UI UI-component detector.
Plan references: §7.1 (CV worker responsibilities), §7.6 (error model), §19.6, §51 step 9.

## Setup

```bash
/usr/bin/python3 -m venv cv-service/.venv        # Python 3.9
cv-service/.venv/bin/pip install -r cv-service/requirements.txt
```

## Run

```bash
cd cv-service
.venv/bin/uvicorn main:app --port 8000 --host 127.0.0.1
```

⚠️ Bind to `127.0.0.1`. §19.6: the worker must not be exposed to the public internet —
only `backend` talks to it.

## Which model is loaded

**`ml/models/ui-detector/v1.0.0/`** — YOLOv8n, **16-class v1 subset**.

Weights are loaded **once at startup**, not per request.

The class vocabulary is read from that version's **own `classes.txt`**, which is the
16-class v1 subset with its own contiguous ids. It is **not** the full 41-class taxonomy
in `ml/dataset/classes.txt`, and the two orders do not agree. Reading the taxonomy here
would mislabel every detection. Any future model version must ship its own `classes.txt`
next to its weights for the same reason.

### Pointing at a different version

```bash
MODEL_VERSION=v1.1.0 .venv/bin/uvicorn main:app --port 8000
```

The service resolves `ml/models/ui-detector/$MODEL_VERSION/{weights.pt,classes.txt}`. No
code change is needed as long as the new version directory follows the §9.10 layout.
`GET /health` reports the version actually loaded — check it after switching.

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `MODEL_VERSION` | `v1.0.0` | registry directory under `ml/models/ui-detector/` |
| `CONFIDENCE_THRESHOLD` | `0.5` | default minimum confidence |
| `PORT` | `8000` | only used by `python main.py` |
| `LOG_LEVEL` | `INFO` | |

**On the 0.5 default.** v1.0.0's per-class test AP@0.5 ranges from 0.36 to 0.995.
`select` (0.364), `radio_button` (0.499) and `carousel` (0.539) are near chance, and
lowering the threshold surfaces far more of their false positives than true ones. 0.5 is
deliberately conservative — it favours precision, on the assumption that a user correcting
a missing box is cheaper than a user hunting down wrong ones. Revisit when the model
improves; see `ml/models/ui-detector/v1.0.0/README.md` for the per-class breakdown.

## Endpoints

### `GET /health`

```json
{ "status": "ok", "modelVersionId": "v1.0.0", "modelLoaded": true, "classes": 16 }
```

`status` is `degraded` when the weights failed to load — the process still starts so the
API gets a clean `MODEL_UNAVAILABLE` rather than a connection refusal.

### `POST /detect`

`multipart/form-data` with a `file` field (PNG/JPEG/WebP, ≤15MB). Optional
`?confidence=0.0..1.0` overrides the configured threshold.

```json
{
  "detections": [
    {
      "className": "button",
      "confidence": 0.983,
      "bbox": { "x": 0.533, "y": 0.687, "width": 0.209, "height": 0.078 },
      "source": "model",
      "modelVersionId": "v1.0.0"
    }
  ],
  "modelVersionId": "v1.0.0",
  "imageWidth": 640, "imageHeight": 640,
  "confidenceThreshold": 0.5, "durationMs": 2061.2
}
```

`bbox` is normalized and **top-left origin**, matching `BBox` in
`packages/shared-types/src/detection.ts`. YOLO's native center-origin `xywhn` is converted
in `app/detector/model.py`, then clamped into `[0,1]`.

## Page boundary filtering (§10)

`/detect` also detects the page region (§10.3 Strategy B, OpenCV contours) and applies
the §10.4 overlap rule. Detections falling outside come back with `status: "rejected"`
rather than being dropped (§10.7), plus an `insideFraction`. The response carries a
`pageBoundary` object; when no boundary is found or its confidence is below 0.35,
`applied` is false and everything stays active.

⚠️ **No perspective correction or cropping.** The boundary is a polygon in the ORIGINAL
image's coordinate space; nothing is warped or re-based. This is a deliberate deferral —
see [`docs/ml/page-boundary.md`](../../docs/ml/page-boundary.md) for the reasoning and
its consequences on skewed photographs.

## Not implemented here

- perspective correction / cropping (see above)
- multiple pages per image (§10.5)
- preprocessing/resolution normalisation (§Appendix S)
- layout inference (lives in `packages/codegen`)
- job chaining (§27.3)

## Errors (§7.6)

Consistent JSON; Python tracebacks are never surfaced.

```json
{ "error": { "code": "INVALID_IMAGE", "message": "…", "retryable": false } }
```

| Code | HTTP | Retryable | When |
|---|---:|---|---|
| `INVALID_IMAGE` | 400 / 413 | no | bad content type, empty, oversized, or undecodable |
| `MODEL_UNAVAILABLE` | 503 | yes | weights not loaded |
| `INFERENCE_FAILED` | 500 / 503 | yes | unexpected failure during prediction |

`retryable` follows §27.4: a corrupt image is never retried, transient failures may be.
Images are decode-checked *before* inference specifically so a corrupt file is classified
`INVALID_IMAGE` rather than as a generic inference failure — ultralytics raises the same
opaque exception for both.
