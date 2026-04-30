/**
 * Biometric Utilities for WebAuthn Registration and Authentication
 */

// Helper to convert ArrayBuffer to Base64
function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// Helper to convert Base64 to ArrayBuffer
function base64ToBuffer(base64) {
  const binary = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer.buffer;
}

/**
 * Register a new biometric credential for a staff member
 */
export async function registerBiometric(staffName, staffId) {
  if (!window.PublicKeyCredential) {
    throw new Error("Biometrics not supported on this browser.");
  }
  if (window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    throw new Error("Biometrics cannot be used on a raw IP address. Please use a domain name like localhost or an ngrok URL.");
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const createOptions = {
    publicKey: {
      challenge,
      rp: { name: "Cash Curry Kiosk" },
      user: {
        id: new TextEncoder().encode(staffId),
        name: staffName,
        displayName: staffName,
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      timeout: 60000,
      attestation: "none",
      authenticatorSelection: {
        userVerification: "preferred",
        authenticatorAttachment: "platform", // Force platform (TouchID/Windows Hello)
      },
    },
  };

  const credential = await navigator.credentials.create(createOptions);

  return {
    credentialId: bufferToBase64(credential.rawId),
    type: credential.type,
    // Note: In a full implementation, we'd send attestationObject to server
  };
}

/**
 * Verify a biometric credential
 */
export async function verifyBiometric(credentialId) {
  if (!window.PublicKeyCredential) {
    throw new Error("Biometrics not supported on this browser.");
  }
  if (window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    throw new Error("Biometrics cannot be used on a raw IP address. Please use a domain name like localhost or an ngrok URL.");
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const getOptions = {
    publicKey: {
      challenge,
      allowCredentials: [
        {
          id: base64ToBuffer(credentialId),
          type: "public-key",
        },
      ],
      timeout: 60000,
      userVerification: "required",
    },
  };

  const assertion = await navigator.credentials.get(getOptions);
  return !!assertion;
}

/**
 * Check if biometrics are available on this device
 */
export async function isBiometricAvailable() {
  if (!window.PublicKeyCredential) return false;
  return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
}
