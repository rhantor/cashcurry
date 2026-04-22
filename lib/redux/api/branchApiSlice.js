// lib/redux/api/branchApiSlice.js
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { auth, db, secondaryAuth } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";

export const branchApiSlice = createApi({
  reducerPath: "branchApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["Branches", "BranchAdmins", "BranchUsers"],
  endpoints: (builder) => ({
    // ✅ Get all branches for a company
    // lib/redux/api/branchApiSlice.js

    // Lightweight — only branch documents, no subcollections.
    // Use this anywhere you only need branch id/name (avoids subcollection permission errors).
    getBranchesBasic: builder.query({
      async queryFn(companyId) {
        try {
          const ref = collection(db, "companies", companyId, "branches");
          const snapshot = await getDocs(ref);
          const branches = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          return { data: branches };
        } catch (err) {
          console.error("[getBranchesBasic] Firestore error:", err?.code, err?.message, err);
          return { error: { code: err?.code, message: err?.message } };
        }
      },
      providesTags: ["Branches"],
    }),

    getBranches: builder.query({
      async queryFn(companyId) {
        try {
          const ref = collection(db, "companies", companyId, "branches");
          const snapshot = await getDocs(ref);

          const branches = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const branchData = { id: docSnap.id, ...docSnap.data() };

              // 🔽 Fetch admins subcollection
              const adminsRef = collection(
                db,
                "companies",
                companyId,
                "branches",
                docSnap.id,
                "admins"
              );
              const usersRef = collection(
                db,
                "companies",
                companyId,
                "branches",
                docSnap.id,
                "users"
              );
              const adminsSnap = await getDocs(adminsRef);
              const usersSnap = await getDocs(usersRef);

              const admins = adminsSnap.docs.map((adminDoc) => ({
                id: adminDoc.id,
                ...adminDoc.data(),
              }));
              const users = usersSnap.docs.map((userDoc) => ({
                id: userDoc.id,
                ...userDoc.data(),
              }));

              return { ...branchData, admins, users }; // replace branchAdmin with admins
            })
          );

          return { data: branches };
        } catch (err) {
          return { error: err };
        }
      },
      providesTags: ["Branches"],
    }),
    // get single branch
    getSingleBranch: builder.query({
      async queryFn({ companyId, branchId }) {
        try {
          const ref = doc(db, "companies", companyId, "branches", branchId);
          const snap = await getDoc(ref);

          if (!snap.exists()) {
            throw new Error("Branch not found");
          }

          return { data: { id: snap.id, ...snap.data() } };
        } catch (err) {
          return { error: err };
        }
      },
      providesTags: ["Branches"],
    }),

    // ✅ Add branch
    addBranch: builder.mutation({
      async queryFn({ companyId, ...branch }) {
        try {
          const ref = collection(db, "companies", companyId, "branches");
          const docRef = await addDoc(ref, branch);
          return { data: { id: docRef.id, ...branch } };
        } catch (err) {
          return { error: err };
        }
      },
      invalidatesTags: ["Branches"],
    }),

    // ✅ Update branch
    updateBranch: builder.mutation({
      async queryFn({ companyId, branchId, updates }) {
        try {
          const ref = doc(db, "companies", companyId, "branches", branchId);
          await updateDoc(ref, updates);
          return { data: { id: branchId, ...updates } };
        } catch (err) {
          return { error: err };
        }
      },
      invalidatesTags: ["Branches"],
    }),

    // ✅ Delete branch
    deleteBranch: builder.mutation({
      async queryFn({ companyId, branchId }) {
        try {
          const ref = doc(db, "companies", companyId, "branches", branchId);
          await deleteDoc(ref);
          return { data: branchId };
        } catch (err) {
          return { error: err };
        }
      },
      invalidatesTags: ["Branches"],
    }),
    // ✅ Assign Branch Admin (consistent with users)
    assignBranchAdmin: builder.mutation({
      async queryFn({
        companyId,
        branchId,
        adminName,
        adminEmail,
        adminUserName,
        adminPassword,
      }) {
        try {
          // 1️⃣ Check for missing fields
          if (!adminUserName || !adminEmail || !adminPassword) {
            return {
              error: {
                status: "MISSING_FIELDS",
                error: "Username, email, and password are required",
              },
            };
          }

          // 2️⃣ Check for maximum number of admins
          const adminsRef = collection(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "admins"
          );
          const adminsSnap = await getDocs(adminsRef);
          if (adminsSnap.docs.length >= 2) {
            return {
              error: {
                status: "MAX_ADMINS_REACHED",
                error: "This branch already has the maximum of 2 admins.",
              },
            };
          }

          const usernameKey = adminUserName.toLowerCase().trim();

          // 3️⃣ Check username uniqueness
          const usernameRef = doc(db, "usernames", usernameKey);
          const usernameSnap = await getDoc(usernameRef);
          if (usernameSnap.exists()) {
            return {
              error: {
                status: "USERNAME_TAKEN",
                error: "Username already exists",
              },
            };
          }

          // 🚨 NEW: Check email uniqueness in Firestore
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("email", "==", adminEmail));
          const emailQuerySnapshot = await getDocs(q);

          if (!emailQuerySnapshot.empty) {
            return {
              error: {
                status: "EMAIL_TAKEN", // Use a unique status code
                error: "This email is already in use by another account.",
              },
            };
          }

          // 4️⃣ Create Firebase Auth user via secondary instance so caller stays signed in
          const cred = await createUserWithEmailAndPassword(
            secondaryAuth,
            adminEmail,
            adminPassword
          );

          // 5️⃣ Save in global users
          await setDoc(doc(db, "users", cred.user.uid), {
            companyId,
            branchId,
            role: "branchAdmin",
            userName: adminUserName,
            name: adminName,
            email: adminEmail,
            createdAt: serverTimestamp(),
          });

          // 6️⃣ Save inside branch under "admins"
          await setDoc(
            doc(
              db,
              "companies",
              companyId,
              "branches",
              branchId,
              "admins",
              cred.user.uid
            ),
            {
              role: "branchAdmin",
              userName: adminUserName,
              fullName: adminName,
              email: adminEmail,
              branchId,
              createdAt: serverTimestamp(),
            }
          );

          // 7️⃣ Save username lookup
          await setDoc(usernameRef, {
            uid: cred.user.uid,
            userName: adminUserName,
            email: adminEmail,
            companyId,
            branchId,
          });

          return {
            data: {
              uid: cred.user.uid,
              email: adminEmail,
              userName: adminUserName,
              name: adminName,
              role: "branchAdmin",
              branchId,
            },
          };
        } catch (error) {
          console.error("Error in assignBranchAdmin:", error);
          return { error: { status: "CUSTOM_ERROR", error: error.message } };
        }
      },
      invalidatesTags: ["Branches", "BranchAdmins"],
    }),

    deleteAdmin: builder.mutation({
      async queryFn({ companyId, branchId, adminId }) {
        try {
          const adminRef = doc(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "admins",
            adminId
          );
          await deleteDoc(adminRef);
          return { data: "Admin deleted successfully" };
        } catch (err) {
          return { error: err };
        }
      },
      invalidatesTags: ["Branches"],
    }),
    updateBranchAdmin: builder.mutation({
      async queryFn({ companyId, branchId, adminId, updates }) {
        try {
          const adminRef = doc(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "admins",
            adminId
          );
          await updateDoc(adminRef, updates);
          return { data: "Admin updated successfully" };
        } catch (err) {
          return { error: err };
        }
      },
      invalidatesTags: ["Branches"],
    }),
    addBranchUser: builder.mutation({
      async queryFn({
        companyId,
        branchId,
        userName,
        email,
        password,
        role,
        fullName,
      }) {
        try {
          if (!userName || !email || !password) {
            return {
              error: {
                status: "MISSING_FIELDS",
                error: "Username, email, and password are required",
              },
            };
          }

          const usernameKey = userName.toLowerCase().trim();

          // 1️⃣ Check username uniqueness
          const usernameRef = doc(db, "usernames", usernameKey);
          const usernameSnap = await getDoc(usernameRef);
          if (usernameSnap.exists()) {
            return {
              error: {
                status: "USERNAME_TAKEN",
                error: "Username already exists",
              },
            };
          }

          // 2️⃣ Create Firebase Auth user via secondary instance so caller stays signed in
          const cred = await createUserWithEmailAndPassword(
            secondaryAuth,
            email,
            password
          );

          // 3️⃣ Save in global users
          await setDoc(doc(db, "users", cred.user.uid), {
            companyId,
            branchId,
            role,
            userName,
            fullName,
            email,
            createdAt: serverTimestamp(),
          });

          // 4️⃣ Save inside branch
          await setDoc(
            doc(
              db,
              "companies",
              companyId,
              "branches",
              branchId,
              "users",
              cred.user.uid
            ),
            {
              role,
              userName,
              fullName,
              email,
              createdAt: serverTimestamp(),
            }
          );

          // 5️⃣ Save username lookup
          await setDoc(usernameRef, {
            uid: cred.user.uid,
            email,
            companyId,
            branchId,
          });

          return {
            data: {
              uid: cred.user.uid,
              email,
              userName,
              fullName,
              role,
              branchId,
            },
          };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: error.message } };
        }
      },
      invalidatesTags: ["Branches", "BranchUsers"],
    }),
    updateBranchUser: builder.mutation({
      async queryFn({ companyId, branchId, userId, updates }) {
        try {
          const userRef = doc(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "users",
            userId
          );

          await updateDoc(userRef, updates);

          // ✅ also update global users if needed
          const globalUserRef = doc(db, "users", userId);
          await updateDoc(globalUserRef, updates);

          return { data: "User updated successfully" };
        } catch (err) {
          return { error: err };
        }
      },
      invalidatesTags: ["Branches", "BranchUsers"],
    }),

    deleteBranchUser: builder.mutation({
      async queryFn({ companyId, branchId, userId, userName }) {
        try {
          // 1️⃣ Delete from branch users
          await deleteDoc(
            doc(
              db,
              "companies",
              companyId,
              "branches",
              branchId,
              "users",
              userId
            )
          );

          // 2️⃣ Delete from global users
          await deleteDoc(doc(db, "users", userId));

          // 3️⃣ Delete from username lookup
          if (userName) {
            const usernameKey = userName.toLowerCase().trim();
            await deleteDoc(doc(db, "usernames", usernameKey));
          }

          return { data: "User deleted successfully" };
        } catch (err) {
          return { error: err };
        }
      },
      invalidatesTags: ["Branches", "BranchUsers"],
    }),
  }),
});

export const {
  useGetBranchesBasicQuery,
  useGetBranchesQuery,
  useAddBranchMutation,
  useUpdateBranchMutation,
  useDeleteBranchMutation,
  useAssignBranchAdminMutation,
  useDeleteAdminMutation,
  useUpdateBranchAdminMutation,
  useAddBranchUserMutation,
  useUpdateBranchUserMutation,
  useDeleteBranchUserMutation,
  useGetSingleBranchQuery
} = branchApiSlice;
