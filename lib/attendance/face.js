// Faces at the kiosk (owner, 11 Nov 2026): face first, PIN second. The tablet
// turns a face into numbers (lib/face/human.js); those numbers, never the
// picture, are what is kept — on the server only (branches/{b}/faces/{staffId},
// closed to the app) — and compared there. Pure rules here.
//
// 12 Nov: the first model (128 numbers) mixed up two of the owner's staff.
// Now "faceres" (1024 numbers), compared by cosine distance (0 = the same
// picture, 1 = nothing alike). On the owner's own kiosk photos: the same person
// 0.08 apart, different people 0.49–0.73.

/** The model the numbers come from: faces taken with another one are ignored (taken again). */
export const FACE_MODEL = "faceres";
export const DESCRIPTOR_LENGTH = 1024;
/** Two faces closer than this are the same person. */
export const MATCH_DISTANCE = 0.3;
/** …and the best must beat the next person by this much, or it is too close to call (then: the PIN). */
export const MATCH_MARGIN = 0.1;
/** A new face this close (on average) to someone already added is refused as theirs. */
export const LOOKALIKE_DISTANCE = 0.25;
/** Samples kept per person (taken at enrolment); at least this many must agree. */
export const MAX_SAMPLES = 5;
export const MIN_SAMPLES = 3;

/** A descriptor sent by a tablet: DESCRIPTOR_LENGTH finite numbers, or null. */
export function cleanDescriptor(d) {
  if (!Array.isArray(d) || d.length !== DESCRIPTOR_LENGTH) return null;
  const out = d.map(Number);
  return out.every((x) => Number.isFinite(x) && Math.abs(x) < 100) && out.some((x) => x !== 0) ? out : null;
}

/** Cosine distance: 0 alike … 1 unrelated. */
export function distance(a, b) {
  let dot = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    x += a[i] * a[i];
    y += b[i] * b[i];
  }
  return x && y ? 1 - dot / Math.sqrt(x * y) : 1;
}

/** A person's closest sample to `d`. */
const nearest = (d, samples = []) => Math.min(...samples.map((s) => distance(d, s)), Infinity);

/**
 * Who this face is. faces: [{ staffId, samples }].
 * → { staffId, distance } when one person is clearly closest and close enough; else null.
 */
export function bestMatch(d, faces = [], { max = MATCH_DISTANCE, margin = MATCH_MARGIN } = {}) {
  const ranked = faces
    .map((f) => ({ staffId: f.staffId, distance: nearest(d, f.samples) }))
    .filter((r) => Number.isFinite(r.distance))
    .sort((a, b) => a.distance - b.distance);
  const [first, second] = ranked;
  if (!first || first.distance > max) return null;
  if (second && second.distance - first.distance < margin) return null;
  return { staffId: first.staffId, distance: Math.round(first.distance * 1000) / 1000 };
}

/** Is this face theirs? (A punch by face is checked again on the server.) */
export const isTheirs = (d, samples, max = MATCH_DISTANCE) => nearest(d, samples) <= max;

/**
 * Samples taken at enrolment: clean ones, the odd one out (a blur, a turn of
 * the head) dropped — each kept sample must be near most of the others — and
 * at least MIN_SAMPLES left. → { samples } or { error }.
 */
export function cleanSamples(list) {
  const all = (Array.isArray(list) ? list : []).map(cleanDescriptor).filter(Boolean).slice(0, MAX_SAMPLES);
  const kept = all.filter((s, i) => {
    const others = all.filter((_, j) => j !== i).map((o) => distance(s, o));
    return others.filter((x) => x <= MATCH_DISTANCE).length >= Math.ceil(others.length / 2);
  });
  if (kept.length < MIN_SAMPLES) return { error: "The pictures weren't clear enough. Face the camera in good light, only them in front of it, and try again." };
  return { samples: kept };
}

/**
 * Someone else already added with this face? → their staffId, or null. Judged
 * on all the new pictures together (their average nearness), not on one of them.
 */
export function lookalike(samples, faces = [], staffId) {
  for (const f of faces) {
    if (f.staffId === staffId || !f.samples?.length) continue;
    const avg = samples.reduce((n, s) => n + nearest(s, f.samples), 0) / samples.length;
    if (avg <= LOOKALIKE_DISTANCE) return f.staffId;
  }
  return null;
}

/** Firestore can't hold arrays of arrays: kept as { s0: [...], s1: [...] }. */
export const packSamples = (samples) => Object.fromEntries(samples.map((s, i) => [`s${i}`, s]));
export const unpackSamples = (packed = {}) => Object.keys(packed).sort().map((k) => packed[k]).map(cleanDescriptor).filter(Boolean);
