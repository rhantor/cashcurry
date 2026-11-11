// Faces at the kiosk (owner, 11 Nov 2026): face first, PIN second. The tablet
// turns a face into 128 numbers (@vladmandic/face-api, lib/face/faceApi.js);
// those numbers, never the picture, are what is kept — on the server only
// (branches/{b}/faces/{staffId}, closed to the app) — and compared there.
// Pure rules here.

export const DESCRIPTOR_LENGTH = 128;
/** Two faces closer than this are the same person. */
export const MATCH_DISTANCE = 0.5;
/** …and the best must beat the next person by this much, or it is too close to call. */
export const MATCH_MARGIN = 0.05;
/** Samples kept per person (taken at enrolment). */
export const MAX_SAMPLES = 5;

/** A descriptor sent by a tablet: 128 finite numbers, or null. */
export function cleanDescriptor(d) {
  if (!Array.isArray(d) || d.length !== DESCRIPTOR_LENGTH) return null;
  const out = d.map(Number);
  return out.every((x) => Number.isFinite(x) && Math.abs(x) < 10) ? out : null;
}

export function distance(a, b) {
  let s = 0;
  for (let i = 0; i < DESCRIPTOR_LENGTH; i++) {
    const x = a[i] - b[i];
    s += x * x;
  }
  return Math.sqrt(s);
}

/** A person's closest sample to `d`. */
const nearest = (d, samples = []) => Math.min(...samples.map((s) => distance(d, s)), Infinity);

/**
 * Who this face is. faces: [{ staffId, samples: [[128]] }].
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
 * Samples taken at enrolment: clean, at least 2, at most MAX_SAMPLES, and
 * alike (one person, not two people taking turns). → { samples } or { error }.
 */
export function cleanSamples(list) {
  const samples = (Array.isArray(list) ? list : []).map(cleanDescriptor).filter(Boolean).slice(0, MAX_SAMPLES);
  if (samples.length < 2) return { error: "Hold still and look at the camera — not enough good pictures." };
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      if (distance(samples[i], samples[j]) > MATCH_DISTANCE) return { error: "The pictures don't look like one person. Try again with only them in front of the camera." };
    }
  }
  return { samples };
}

/** Someone else already enrolled with this face? → their staffId, or null. */
export function lookalike(samples, faces = [], staffId) {
  for (const f of faces) {
    if (f.staffId === staffId) continue;
    if (samples.some((s) => isTheirs(s, f.samples))) return f.staffId;
  }
  return null;
}

/** Firestore can't hold arrays of arrays: kept as { s0: [...], s1: [...] }. */
export const packSamples = (samples) => Object.fromEntries(samples.map((s, i) => [`s${i}`, s]));
export const unpackSamples = (packed = {}) => Object.keys(packed).sort().map((k) => packed[k]).map(cleanDescriptor).filter(Boolean);
