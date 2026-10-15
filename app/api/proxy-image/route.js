import { NextResponse } from 'next/server';

// Serves this project's Storage files (receipts, bill PDFs, Z-reports) from our
// own origin, so the browser can draw them into PDFs/canvases without CORS
// errors.
//
// It only fetches download links from THIS project's Storage bucket, and only
// images and PDFs. It used to fetch any URL for anyone — an open proxy that
// could be pointed at other sites or internal addresses.

const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
const LOCAL = !!process.env.FIRESTORE_EMULATOR_HOST; // npm run dev:local
const ALLOWED_TYPES = /^(image\/|application\/pdf)/i;

function isOurStorageFile(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (!BUCKET) return false;
  const inOurBucket = u.pathname.startsWith(`/v0/b/${BUCKET}/o/`);
  const isFirebaseStorage = u.protocol === 'https:' && u.hostname === 'firebasestorage.googleapis.com';
  const isLocalEmulator = LOCAL && u.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(u.hostname) && u.port === '9199';
  return inOurBucket && (isFirebaseStorage || isLocalEmulator);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return new NextResponse('Missing URL parameter', { status: 400 });
    }
    if (!isOurStorageFile(url)) {
      return new NextResponse('Only files from this app\'s storage can be fetched', { status: 403 });
    }

    const response = await fetch(url, { redirect: 'error' });
    if (!response.ok) {
      return new NextResponse(`Failed to fetch image: ${response.statusText}`, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!ALLOWED_TYPES.test(contentType)) {
      return new NextResponse('Not an image or PDF', { status: 415 });
    }

    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Proxy Image Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
