import http from "node:http";

// A deterministic stand-in for services/cv-worker — plan §24: "mock detection result...
// and separately test real CV inference." Real model output is nondeterministic (a
// version bump, a retrain, or hardware differences can shift a box by a pixel or drop a
// low-confidence detection), which would make the E2E suite flaky for reasons that have
// nothing to do with the web/API code it exists to protect.
//
// Implements just enough of the worker contract (services/cv-worker's actual API) for
// apps/api/src/modules/detections/detect.job.ts to accept the response: POST /detect
// returns exactly one detection, and GET /health respond for parity with a real check.

const PORT = Number(process.env.MOCK_CV_WORKER_PORT ?? 8099);

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", modelVersionId: "e2e-mock", modelLoaded: true, classes: 1 }));
    return;
  }

  if (req.method === "POST" && req.url === "/detect") {
    // The real worker reads a multipart file upload; the mock doesn't need to parse it
    // at all — the response is fixed regardless of input, which is exactly what makes
    // the E2E test deterministic.
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          detections: [
            {
              className: "button",
              confidence: 0.91,
              bbox: { x: 0.1, y: 0.1, width: 0.2, height: 0.08 },
              modelVersionId: "e2e-mock",
              status: "active",
            },
          ],
          modelVersionId: "e2e-mock",
          pageBoundary: {
            polygon: [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ],
            confidence: 1,
            method: "none",
            areaFraction: 1,
            applied: false,
          },
          rejectedCount: 0,
        })
      );
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "unknown route" } }));
});

// Loopback-only, matching the real worker (services/cv-worker runs uvicorn with
// host="127.0.0.1" — "the worker must not be reachable from the public internet, only
// through this API"). Without an explicit host, Node's default bind is all interfaces,
// which would needlessly expose this unauthenticated mock to the local network for the
// duration of a test run.
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mock CV worker listening on http://127.0.0.1:${PORT}`);
});
