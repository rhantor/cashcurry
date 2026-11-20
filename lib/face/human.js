"use client";
// Faces at the kiosk, second model (12 Nov 2026). The first one (face-api)
// could not tell two of the owner's staff apart — one was clocked out under
// the other's name. Measured on their kiosk photos, this one (@vladmandic/human,
// "faceres") put the same person at 0.96 and different people at 0.33–0.39.
// Loaded only on the kiosk and the face sheet; the models are in
// /models/human (blazeface finds faces, facemesh lines them up, faceres turns
// a face into 1024 numbers).

let human = null;
let loading = null;

/** The library and its three models, loaded once. */
export async function loadFace() {
  if (human) return human;
  if (!loading) {
    loading = (async () => {
      // its browser build (next.config.mjs points the package there)
      const { Human } = await import("@vladmandic/human");
      const h = new Human({
        modelBasePath: "/models/human/",
        backend: "webgl",
        debug: false,
        cacheSensitivity: 0, // every frame read afresh
        face: {
          enabled: true,
          detector: { modelPath: "blazeface.json", rotation: true, maxDetected: 3, minConfidence: 0.5, skipFrames: 0, skipTime: 0 },
          mesh: { enabled: true, modelPath: "facemesh.json" },
          description: { enabled: true, modelPath: "faceres.json", skipFrames: 0, skipTime: 0 },
          iris: { enabled: false },
          emotion: { enabled: false },
          antispoof: { enabled: false },
          liveness: { enabled: false },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: false },
        segmentation: { enabled: false },
      });
      await h.load();
      human = h;
      return h;
    })().catch((e) => {
      loading = null;
      throw e;
    });
  }
  return loading;
}

// Most frames have nobody close to the tablet. Looking for a face is cheap;
// lining it up (mesh) and turning it into numbers (faceres) is the heavy part.
// So each frame first only looks (LIGHT); the heavy pass runs only for a face
// near enough to be read (20 Nov, kiosk speed). Human keeps a config passed to
// detect(), so both passes say exactly which parts run.
const LIGHT = { face: { mesh: { enabled: false }, description: { enabled: false } } };
const FULL = { face: { mesh: { enabled: true }, description: { enabled: true } } };

const nearest = (faces) => faces.reduce((a, b) => ((b.boxRaw?.[2] || 0) > (a.boxRaw?.[2] || 0) ? b : a));

/**
 * The face in front of the camera: { descriptor (1024 numbers), size (its share
 * of the picture's width, 0–1), count (faces seen) } — the nearest face when
 * there are several; null when there is none. With `near`, a face smaller than
 * that comes back without a descriptor (only looked at, not read).
 */
export async function readFace(video, { near = 0 } = {}) {
  const h = await loadFace();
  if (near > 0) {
    const look = await h.detect(video, LIGHT);
    const seen = look.face || [];
    if (!seen.length) return null;
    const size = nearest(seen).boxRaw?.[2] || 0;
    if (size < near) return { descriptor: null, size, count: seen.length };
  }
  const r = await h.detect(video, FULL);
  const faces = (r.face || []).filter((f) => f.embedding?.length);
  if (!faces.length) return null;
  const n = nearest(faces);
  return { descriptor: Array.from(n.embedding), size: n.boxRaw?.[2] || 0, count: (r.face || []).length };
}
