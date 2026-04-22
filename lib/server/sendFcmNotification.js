// lib/server/sendFcmNotification.js
import admin from "firebase-admin";
import serviceAccount from "./serviceAccountKey.json"; // your downloaded service account

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Fetch manager/owner FCM tokens
export async function getManagerTokens(companyId) {
  const usersRef = admin.firestore().collection("companies").doc(companyId).collection("users");
  const snapshot = await usersRef.where("role", "in", ["owner", "manager"]).get();
  const tokens = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.fcmToken) tokens.push(data.fcmToken);
  });
  return tokens;
}

// Send notification
export async function sendFcmNotification(companyId, title, body, data = {}) {
  const tokens = await getManagerTokens(companyId);
  if (!tokens.length) return;

  const payload = {
    notification: { title, body },
    data,
  };

  try {
    await admin.messaging().sendToDevice(tokens, payload);
    console.log("✅ FCM sent to managers/owners");
  } catch (err) {
    console.error("❌ FCM error:", err);
  }
}
