import { keysForTyped, looksLikeStaffId } from "@/lib/staffLogin";
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  setDoc,
  doc,
  serverTimestamp,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  runTransaction
} from "firebase/firestore";
import { db, auth, secondaryAuth } from "@/lib/firebase";

export const authApiSlice = createApi({
  reducerPath: "authApi",
  baseQuery: fakeBaseQuery(),
  // ✅ ADD THIS LINE to define the "User" tag type
  tagTypes: ["User"],
  endpoints: (builder) => ({
    signup: builder.mutation({
      async queryFn({ email, password }) {
        try {
          const cred = await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );
          await sendEmailVerification(cred.user);

          return { data: { uid: cred.user.uid, email } };
        } catch (error) {
          if (error.code === "auth/email-already-in-use") {
            // A sign-up that never finished (the verify page was closed before
            // the company was made) left the account without a profile. With
            // the right password, carry on from there instead of a dead end.
            try {
              const cred = await signInWithEmailAndPassword(auth, email, password);
              const profile = await getDoc(doc(db, "users", cred.user.uid));
              if (!profile.exists()) {
                if (!cred.user.emailVerified) await sendEmailVerification(cred.user);
                return { data: { uid: cred.user.uid, email, resumed: true } };
              }
            } catch {
              /* wrong password or another problem — say the email is taken */
            }
            return {
              error: {
                status: "EMAIL_EXISTS",
                error: "That email already has an account. Sign in instead.",
              },
            };
          }
          return { error: { status: "CUSTOM_ERROR", error: error.message } };
        }
      },
    }),
    finalizeSignup: builder.mutation({
      async queryFn({ uid, email, companyName, userName, name = "", inviteCode }) {
        try {
          await auth.currentUser?.reload();
          if (!auth.currentUser?.emailVerified) {
            throw new Error("Email not verified yet.");
          }

          // Re-validate and atomically mark the invite code as used
          const inviteRef = doc(db, "signupInvites", inviteCode);
          // The owner signs in by username like everyone else, so it is
          // claimed here, in the same transaction (it was never registered).
          const usernameKey = String(userName || "").trim().toLowerCase();
          const usernameRef = doc(db, "usernames", usernameKey);
          let companyId;
          await runTransaction(db, async (tx) => {
            const inviteSnap = await tx.get(inviteRef);
            const usernameSnap = usernameKey ? await tx.get(usernameRef) : null;
            if (!inviteSnap.exists() || inviteSnap.data().used === true) {
              throw new Error("Invalid or already used invite code.");
            }
            if (usernameSnap?.exists() && usernameSnap.data().uid !== uid) {
              throw new Error("That username is taken — go back and pick another.");
            }

            const companyRef = doc(collection(db, "companies"));
            companyId = companyRef.id;

            tx.set(companyRef, {
              name: companyName,
              createdAt: serverTimestamp(),
              // The database rules check this invite is unused and consumed by
              // this same transaction before allowing a new company.
              inviteCode,
              ownerUid: uid,
              ownerEmail: email,
              ownerUserName: userName,
            });

            tx.set(doc(db, "companies", companyId, "users", uid), {
              email,
              role: "owner",
              userName,
              name: name || userName,
              createdAt: serverTimestamp(),
              emailVerified: true,
            });

            tx.set(doc(db, "users", uid), {
              email,
              role: "owner",
              userName,
              name: name || userName,
              companyId,
              createdAt: serverTimestamp(),
              emailVerified: true,
            });

            if (usernameKey) tx.set(usernameRef, { uid, email, companyId });

            tx.update(inviteRef, {
              used: true,
              usedAt: serverTimestamp(),
              usedBy: uid,
            });
          });

          return { data: { uid, companyId } };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: error.message } };
        }
      },
    }),
    resendVerification: builder.mutation({
      async queryFn() {
        try {
          if (!auth.currentUser) throw new Error("No current user");
          await sendEmailVerification(auth.currentUser);
          return { data: "sent" };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: error.message } };
        }
      },
    }),
    resetPassword: builder.mutation({
      async queryFn(email) {
        try {
          await sendPasswordResetEmail(auth, email);
          return { data: "Reset link sent! Please check your email." };
        } catch (err) {
          let message = err.message;
          if (err.code === "auth/user-not-found") {
            message = "No account found with this email.";
          }
          return { error: { status: err.code, message } };
        }
      },
    }),

    // login: builder.mutation({
    //   async queryFn({ username, password }) {
    //     try {
    //       // 1️⃣ Look up user by username inside companies/*/users collection
    //       const companiesSnap = await getDocs(collection(db, "companies"));
    //       let foundUser = null;
    //       let companyId = null;

    //       for (const companyDoc of companiesSnap.docs) {
    //         const userDoc = await getDocs(
    //           collection(db, "companies", companyDoc.id, "users")
    //         );
    //         userDoc.forEach((docu) => {
    //           const data = docu.data();
    //           if (data.userName?.toLowerCase() === username.toLowerCase()) {
    //             foundUser = { ...data, uid: docu.id };
    //             companyId = companyDoc.id;
    //           }
    //         });
    //         if (foundUser) break;
    //       }

    //       if (!foundUser) {
    //         return {
    //           error: {
    //             status: "USER_NOT_FOUND",
    //             error: "Invalid credentials.",
    //           },
    //         };
    //       }

    //       // 2️⃣ Sign in with Firebase Auth using stored email
    //       const cred = await signInWithEmailAndPassword(
    //         auth,
    //         foundUser.email,
    //         password
    //       );

    //       if (!cred.user.emailVerified) {
    //         return {
    //           error: {
    //             status: "EMAIL_NOT_VERIFIED",
    //             error: "Please verify your email before login.",
    //           },
    //         };
    //       }

    //       // 3️⃣ Return merged user info
    //       return {
    //         data: {
    //           user: {
    //             uid: cred.user.uid,
    //             email: foundUser.email,
    //             username: foundUser.userName,
    //             role: foundUser.role,
    //             companyId,
    //           },
    //         },
    //       };
    //     } catch (error) {
    //       return { error: { status: "CUSTOM_ERROR", error: error.message } };
    //     }
    //   },
    // }),
    // addCompanyUser: builder.mutation({
    //   async queryFn({ companyId, userName, password, role, uid }) {
    //     try {
    //       // Hash the password (replace with a secure hashing library in production)
    //       const hashedPassword = password; // Example: bcrypt.hashSync(password, 10);

    //       // Use uid as document ID
    //       const userId = uid;
    //       const userRef = doc(db, "companies", companyId, "users", userId);
    //       await setDoc(userRef, {
    //         userName,
    //         password: hashedPassword, // Store the hashed password
    //         role,
    //         createdAt: serverTimestamp(),
    //       });

    //       return { data: { userName, role } };
    //     } catch (error) {
    //       return { error: { status: "CUSTOM_ERROR", error: error.message } };
    //     }
    //   },
    //   invalidatesTags: ["User"], // 🟢 invalidate tag
    // }),

    // 🟢 Login
    // 🔹 LOGIN by username or email
    login: builder.mutation({
      async queryFn({ usernameOrEmail, password }) {
        try {
          let email = usernameOrEmail;

          // A phone or IC number: a staff member's login (docs/STAFF_APP.md)
          let staffEmail = null;
          if (looksLikeStaffId(usernameOrEmail)) {
            for (const key of await keysForTyped(usernameOrEmail)) {
              const found = await getDoc(doc(db, "staffLogins", key)).catch(() => null);
              if (found?.exists()) {
                staffEmail = found.data().email;
                break;
              }
            }
          }

          // ✅ If it's not an email, lookup in "usernames" collection
          if (staffEmail) {
            email = staffEmail;
          } else if (!usernameOrEmail.includes("@")) {
            const usernameDoc = await getDoc(
              doc(db, "usernames", usernameOrEmail.toLowerCase())
            );
            if (!usernameDoc.exists()) {
              return {
                error: { status: "USER_NOT_FOUND", error: looksLikeStaffId(usernameOrEmail) ? "No login with that phone or IC number" : "Invalid username" },
              };
            }
            email = usernameDoc.data().email;
          }

          // ✅ Sign in
          const cred = await signInWithEmailAndPassword(auth, email, password);

          // ✅ Fetch user metadata
          const userSnap = await getDoc(doc(db, "users", cred.user.uid));
          if (!userSnap.exists()) {
            return {
              error: {
                status: "NO_METADATA",
                error: "User metadata not found",
              },
            };
          }
          const userData = userSnap.data();

          // ✅ Only owner requires verification
          if (userData.role === "owner" && !cred.user.emailVerified) {
            return {
              error: {
                status: "EMAIL_NOT_VERIFIED",
                error: "Please verify your email before login.",
              },
            };
          }

          // ✅ Return structured user
          return {
            data: {
              user: {
                uid: cred.user.uid,
                email: cred.user.email,
                username: userData.userName,
                role: userData.role,
                companyId: userData.companyId,
                branchId: userData.branchId || null,
                defaultBranchId: userData.defaultBranchId || null,
                // the staff record a staff login is (rules: staff read their own rows)
                staffId: userData.staffId || null,
                createdAt: userData.createdAt,
              },
            },
          };
        } catch (error) {
          let msg = error.message;
          if (error.code === "auth/invalid-credential") {
            msg = "Incorrect password";
          } else if (error.code === "auth/user-not-found") {
            msg = "No user found with this email.";
          }
          return { error: { status: error.code, error: msg } };
        }
      },
    }),

    // 🔹 ADD NEW COMPANY USER (with username check + mapping)
    addCompanyUser: builder.mutation({
      async queryFn({ companyId, email, password, userName, role }) {
        try {
          const usernameKey = userName.toLowerCase();

          // 1️⃣ Check if username already exists
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

          // 2️⃣ Create Firebase Auth user via secondary instance so owner stays signed in
          const cred = await createUserWithEmailAndPassword(
            secondaryAuth,
            email,
            password
          );

          // 3️⃣ Save metadata in global users collection
          await setDoc(doc(db, "users", cred.user.uid), {
            companyId,
            role,
            userName,
            email,
            createdAt: serverTimestamp(),
          });

          // 4️⃣ Also add inside company’s user sub-collection
          await setDoc(
            doc(db, "companies", companyId, "users", cred.user.uid),
            {
              role,
              userName,
              email,
              createdAt: serverTimestamp(),
            }
          );

          // 5️⃣ Save username lookup (username → uid + email)
          await setDoc(usernameRef, {
            uid: cred.user.uid,
            email,
            companyId,
          });

          return { data: { uid: cred.user.uid, email, userName, role } };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: error.message } };
        }
      },
      invalidatesTags: ["User"],
    }),

    getCompaniesUsers: builder.query({
      async queryFn(companyId) {
        try {
          const usersSnap = await getDocs(
            collection(db, "companies", companyId, "users")
          );
          const users = usersSnap.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          }));
          return { data: users };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: error.message } };
        }
      },
      providesTags: ["User"], // 🟢 provide tag
    }),
    updateCompanyUser: builder.mutation({
      async queryFn({ companyId, uid, userName, role }) {
        try {
          const userRef = doc(db, "companies", companyId, "users", uid);
          const globalUserRef = doc(db, "users", uid);

          await Promise.all([
            updateDoc(userRef, { userName, role }),
            updateDoc(globalUserRef, { userName, role }),
          ]);

          const updatedUser = { id: uid, userName, role };
          return { data: updatedUser };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: error.message } };
        }
      },
      invalidatesTags: ["User"],
    }),

    deleteCompanyUser: builder.mutation({
      async queryFn({ companyId, uid }) {
        // Your logic to delete the user from Firestore
        // Use `deleteDoc` here
        try {
          const userRef = doc(db, "companies", companyId, "users", uid);
          await deleteDoc(userRef);
          return { data: "User deleted successfully" };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: error.message } };
        }
      },
      invalidatesTags: ["User"],
    }),
    
    updateUserDefaultBranch: builder.mutation({
      async queryFn({ uid, companyId, defaultBranchId }) {
        try {
          const userRef = doc(db, "companies", companyId, "users", uid);
          const globalUserRef = doc(db, "users", uid);

          await Promise.all([
            updateDoc(userRef, { defaultBranchId }),
            updateDoc(globalUserRef, { defaultBranchId }),
          ]);

          return { data: { defaultBranchId } };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: error.message } };
        }
      },
    }),

    // Inside your authApiSlice endpoints section...

getCompanyDetails: builder.query({
  async queryFn(companyId) {
    try {
      if (!companyId) return { data: null };
      const companyRef = doc(db, "companies", companyId);
      const companySnap = await getDoc(companyRef);
      if (companySnap.exists()) {
        return { data: { id: companySnap.id, ...companySnap.data() } };
      }
      return { data: null };
    } catch (error) {
      return { error: { status: "CUSTOM_ERROR", error: error.message } };
    }
  },
}),
  }),
});

export const {
  useSignupMutation,
  useFinalizeSignupMutation,
  useLoginMutation,
  useResendVerificationMutation,
  useGetCompaniesUsersQuery,
  useAddCompanyUserMutation,
  useUpdateCompanyUserMutation,
  useDeleteCompanyUserMutation,
  useUpdateUserDefaultBranchMutation,
  useResetPasswordMutation,
  useGetCompanyDetailsQuery,
} = authApiSlice;
