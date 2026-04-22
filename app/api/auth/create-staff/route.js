import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import admin from "firebase-admin";

export async function POST(req) {
  try {
    const { companyId, branchId, staffId, firstName, lastName, email, icNumber } = await req.json();

    if (!companyId || !branchId || !staffId) {
      return NextResponse.json({ error: "Missing required identifiers" }, { status: 400 });
    }

    // Since Firebase Auth requires an email, use theirs or fallback to a domain-local pseudonymous email
    const fallbackEmail = `${(icNumber || staffId).replace(/\s/g, '').toLowerCase()}@cashcurry.local`;
    const finalEmail = email || fallbackEmail;
    
    // Default password can be their IC Number (if present) or a generic one
    const defaultPassword = icNumber ? icNumber : "password123";

    // 1. Create the user in Firebase Auth
    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email: finalEmail,
        emailVerified: false,
        password: defaultPassword,
        displayName: `${firstName} ${lastName}`.trim(),
        disabled: false,
      });
    } catch (authError) {
      return NextResponse.json({ error: authError.message || "Failed to create Auth User" }, { status: 400 });
    }

    const { uid } = userRecord;

    // 2. Set custom claims (optional but good practice)
    await adminAuth.setCustomUserClaims(uid, { role: "staff", companyId, branchId });

    // 3. Create the global user document
    await adminDb.collection("users").doc(uid).set({
      uid,
      email: finalEmail,
      username: email ? email.split('@')[0] : firstName.toLowerCase(),
      firstName,
      lastName,
      role: "staff",
      companyId,
      branchId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 4. Link UID to the existing branch staff document
    await adminDb
      .collection("companies").doc(companyId)
      .collection("branches").doc(branchId)
      .collection("staff").doc(staffId)
      .update({
        uid: uid,
        loginEmail: finalEmail,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    return NextResponse.json({ 
      success: true, 
      uid, 
      email: finalEmail, 
      password: defaultPassword 
    });

  } catch (error) {
    console.error("Generate login error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
