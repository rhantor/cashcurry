// Lazy loader + helpers for on-device face recognition (@vladmandic/face-api).
//
// The library bundles TensorFlow.js and is ~1-2 MB, and the models are ~7 MB,
// so EVERYTHING here is loaded on demand via dynamic import — it never touches
// the app's initial bundle. Only the kiosk and the staff face-enroll flow call
// loadFaceApi(). Models are served from /public/models (see /models).
//
// Tuned for tablet GPUs: tinyFaceDetector at a small input size on the WebGL
// backend keeps a match in the ~100-400 ms range.

const MODEL_URL = "/models";

let _faceapi = null;
let _loadPromise = null;

// Loads the face-api namespace and the three nets we use (detector, landmarks,
// recognition). Cached so repeated calls are free. Safe to call from many
// components — they all await the same promise.
export async function loadFaceApi() {
  if (_faceapi) return _faceapi;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    const faceapi = await import("@vladmandic/face-api");

    // Prefer WebGL; fall back to CPU if the tablet/browser lacks it.
    try {
      await faceapi.tf.setBackend("webgl");
      await faceapi.tf.ready();
    } catch {
      // face-api will use whatever backend initialised.
    }

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);

    _faceapi = faceapi;
    return faceapi;
  })();

  return _loadPromise;
}

// Detector options. inputSize 224 is the sweet spot for tablets; bump for
// enrollment where a touch more accuracy is worth a few extra ms. scoreThreshold
// is a touch low (0.4) so faces in dim light still register — a spurious
// detection just yields a non-matching descriptor, so it's safe.
export const tinyOptions = (faceapi, inputSize = 224, scoreThreshold = 0.4) =>
  new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold });

// ── Low-light handling ───────────────────────────────────────────────────────
// Faces vanish for the detector in dim light. processFrame draws the current
// frame into a reusable canvas with an ADAPTIVE brightness/contrast boost based
// on the measured average luminance, and returns that canvas for detection.
// Running detection (and descriptors) on the normalized frame makes enrollment
// and — later — the kiosk far more robust to poor lighting. Use the SAME
// processing at enroll and match time so descriptors stay comparable.
let _procCanvas = null;
let _measCanvas = null;

export function processFrame(source, workW = 480) {
  const sw = source.videoWidth || source.naturalWidth || source.width;
  const sh = source.videoHeight || source.naturalHeight || source.height;
  if (!sw || !sh) return null;

  // Measure mean luminance from a tiny 32x32 draw (cheap).
  if (!_measCanvas) _measCanvas = document.createElement("canvas");
  const m = _measCanvas;
  m.width = 32;
  m.height = 32;
  const mctx = m.getContext("2d", { willReadFrequently: true });
  mctx.drawImage(source, 0, 0, 32, 32);
  const px = mctx.getImageData(0, 0, 32, 32).data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) {
    sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  }
  const luma = sum / (px.length / 4); // 0..255

  // Aim for a mean around 125; boost when dark, never below 1x.
  const gain = Math.min(2.6, Math.max(1, 125 / (luma || 125)));

  const h = Math.round((sh * workW) / sw);
  if (!_procCanvas) _procCanvas = document.createElement("canvas");
  const c = _procCanvas;
  c.width = workW;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.filter =
    gain > 1.04 ? `brightness(${gain.toFixed(2)}) contrast(1.12) saturate(1.05)` : "none";
  ctx.drawImage(source, 0, 0, workW, h);

  return { input: c, luma, gain };
}

// Cheap presence check (detector only, no descriptor) — used for live UI
// feedback while positioning the face.
export async function detectPresence(faceapi, input, inputSize = 224) {
  const det = await faceapi.detectSingleFace(input, tinyOptions(faceapi, inputSize));
  return det || null;
}

// Detector + landmarks only (no descriptor) — fast enough to run in a live loop
// for head-pose guidance during enrollment.
export async function detectLandmarks(faceapi, input, inputSize = 256) {
  const res = await faceapi
    .detectSingleFace(input, tinyOptions(faceapi, inputSize))
    .withFaceLandmarks();
  return res || null;
}

const centroid = (pts) => {
  let x = 0;
  let y = 0;
  pts.forEach((p) => {
    x += p.x;
    y += p.y;
  });
  return { x: x / pts.length, y: y / pts.length };
};

// Rough head pose from 68 landmarks, normalized by inter-eye distance so it's
// scale-independent. Returns { yaw, pitch }:
//   yaw   — horizontal turn (nose tip vs eye midpoint)
//   pitch — vertical tilt (nose tip vs eye line)
// These are RAW values; enrollment calibrates a per-person baseline at "center"
// and measures deltas from it, so absolute values don't need to be exact.
export function estimatePose(landmarks) {
  const le = centroid(landmarks.getLeftEye());
  const re = centroid(landmarks.getRightEye());
  const nose = landmarks.getNose(); // 9 pts (27-35); index 3 ≈ nose tip (pt 30)
  const tip = nose[3] || nose[nose.length - 1];

  const eyeMidX = (le.x + re.x) / 2;
  const eyeMidY = (le.y + re.y) / 2;
  const eyeDist = Math.hypot(re.x - le.x, re.y - le.y) || 1;

  return {
    yaw: (tip.x - eyeMidX) / eyeDist,
    pitch: (tip.y - eyeMidY) / eyeDist,
  };
}

// Full pipeline: returns { detection, landmarks, descriptor } or null. The
// descriptor is the 128-number vector we store / match on.
export async function detectDescriptor(faceapi, input, inputSize = 320) {
  const res = await faceapi
    .detectSingleFace(input, tinyOptions(faceapi, inputSize))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return res || null;
}

// Float32Array/typed descriptor -> plain number[] for Firestore.
export const descriptorToArray = (d) => Array.from(d);

// Euclidean distance between two descriptors (plain arrays or typed). Lower =
// more similar. ~0.5 is the usual match threshold for face-api. (Phase 2 kiosk
// matching uses this.)
export function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// Enrolling the same face under two staff names would let one person punch in
// as the other, and would make the kiosk matcher pick whichever of the two it
// scored marginally better. So enrollment refuses a face that already belongs
// to someone else.
//
// The threshold is deliberately LOOSER than the kiosk's match threshold (0.5):
// anything the kiosk could possibly confuse must be caught here, with a margin.
export const DUPLICATE_FACE_THRESHOLD = 0.55;

// face_recognition emits 128-d descriptors. Anything else in the staff doc is
// corrupt or from another model — comparing it would produce meaningless
// distances (two identical 3-element arrays would "match" at 0), so skip it.
export const DESCRIPTOR_LENGTH = 128;
const isDescriptor = (d) => Array.isArray(d) ? d.length === DESCRIPTOR_LENGTH : d?.length === DESCRIPTOR_LENGTH;

// Closest already-enrolled staff member for `descriptor`, or null when it
// belongs to nobody. `enrolled` is [{ id, name, descriptors: number[][] }] and
// must already exclude the person being enrolled.
export function findDuplicateEnrollment(
  descriptor,
  enrolled = [],
  threshold = DUPLICATE_FACE_THRESHOLD
) {
  if (!isDescriptor(descriptor)) return null;
  let best = null;
  for (const person of enrolled) {
    for (const known of person.descriptors || []) {
      if (!isDescriptor(known)) continue;
      const distance = euclideanDistance(descriptor, known);
      if (distance < threshold && (!best || distance < best.distance)) {
        best = { id: person.id, name: person.name, distance };
      }
    }
  }
  return best;
}

// Smallest distance between any descriptor of `a` and any descriptor of `b`.
// Infinity when either side has nothing comparable.
function closestDistance(a, b) {
  let best = Infinity;
  for (const da of a.descriptors || []) {
    for (const db of b.descriptors || []) {
      if (!isDescriptor(da) || !isDescriptor(db)) continue;
      const d = euclideanDistance(da, db);
      if (d < best) best = d;
    }
  }
  return best;
}

// Audit already-enrolled staff for faces that collide — the duplicates that got
// in before `findDuplicateEnrollment` existed, or via a direct DB write.
// Colliding records are grouped (A~B and B~C put all three in one group) so the
// UI can say "these records share a face" rather than listing pairs twice.
// Returns [{ members: [{id, name}], distance }] — distance is the closest match
// found inside the group. O(n²) over staff, so call it from a useMemo.
export function findDuplicateEnrollmentGroups(
  enrolled = [],
  threshold = DUPLICATE_FACE_THRESHOLD
) {
  const people = enrolled.filter((p) => p.descriptors?.length);
  if (people.length < 2) return [];

  // Union-find: merge any two people whose faces match.
  const parent = new Map(people.map((p) => [p.id, p.id]));
  const find = (id) => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root);
    while (parent.get(id) !== root) {
      const next = parent.get(id);
      parent.set(id, root);
      id = next;
    }
    return root;
  };

  const links = [];
  for (let i = 0; i < people.length; i += 1) {
    for (let j = i + 1; j < people.length; j += 1) {
      const distance = closestDistance(people[i], people[j]);
      if (distance >= threshold) continue;
      links.push({ id: people[i].id, distance });
      const a = find(people[i].id);
      const b = find(people[j].id);
      if (a !== b) parent.set(a, b);
    }
  }
  if (!links.length) return [];

  // Roots settle only once every union is done, so resolve them now.
  const closestInGroup = new Map();
  for (const link of links) {
    const root = find(link.id);
    closestInGroup.set(root, Math.min(closestInGroup.get(root) ?? Infinity, link.distance));
  }

  const groups = new Map();
  for (const person of people) {
    const root = find(person.id);
    if (!closestInGroup.has(root)) continue;
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push({ id: person.id, name: person.name });
  }

  return [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([root, members]) => ({ members, distance: closestInGroup.get(root) }))
    .sort((a, b) => a.distance - b.distance);
}

// Draw the current video/image frame into a small square jpeg thumbnail
// (base64) for the attendance log. Kept tiny (default 96px) so it's a few KB.
export function captureThumbnail(source, size = 96) {
  const sw = source.videoWidth || source.naturalWidth || source.width;
  const sh = source.videoHeight || source.naturalHeight || source.height;
  if (!sw || !sh) return null;

  // Center-crop to a square before scaling down.
  const side = Math.min(sw, sh);
  const sx = (sw - side) / 2;
  const sy = (sh - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.7);
}
