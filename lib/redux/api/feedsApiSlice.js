// lib/redux/api/feedsApiSlice.js
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  deleteDoc
} from "firebase/firestore";

export const feedsApiSlice = createApi({
  reducerPath: "feedsApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["WallPost", "Comment"],
  endpoints: (builder) => ({
    getWallPosts: builder.query({
      async queryFn({ companyId, branchId }) {
        try {
          const q = query(
            collection(db, "companies", companyId, "branches", branchId, "wall_posts"),
            orderBy("timestamp", "desc")
          );
          const querySnapshot = await getDocs(q);
          const posts = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toMillis ? doc.data().timestamp.toMillis() : doc.data().timestamp,
          }));
          return { data: posts };
        } catch (err) {
          console.error("Error fetching wall posts:", err);
          return { error: err.message };
        }
      },
      providesTags: ["WallPost"],
    }),

    addWallPost: builder.mutation({
      async queryFn({ companyId, branchId, type, content, authorId, authorName }) {
        try {
          await addDoc(
            collection(db, "companies", companyId, "branches", branchId, "wall_posts"),
            {
              type,
              content,
              authorId,
              authorName,
              timestamp: serverTimestamp(),
              isResolved: false,
              resolvedBy: null
            }
          );
          return { data: "ok" };
        } catch (err) {
          return { error: err.message };
        }
      },
      invalidatesTags: ["WallPost"],
    }),

    togglePostResolved: builder.mutation({
      async queryFn({ companyId, branchId, postId, isResolved, resolvedBy, resolvedByName }) {
        try {
          await updateDoc(
            doc(db, "companies", companyId, "branches", branchId, "wall_posts", postId),
            {
              isResolved,
              resolvedBy: isResolved ? resolvedBy : null,
              resolvedByName: isResolved ? resolvedByName : null,
              resolvedAt: isResolved ? serverTimestamp() : null
            }
          );
          return { data: "ok" };
        } catch (err) {
          return { error: err.message };
        }
      },
      invalidatesTags: ["WallPost"],
    }),

    deleteWallPost: builder.mutation({
      async queryFn({ companyId, branchId, postId }) {
        try {
          await deleteDoc(doc(db, "companies", companyId, "branches", branchId, "wall_posts", postId));
          return { data: "ok" };
        } catch (err) {
           return { error: err.message };
        }
      },
      invalidatesTags: ["WallPost"]
    }),

    getComments: builder.query({
      async queryFn({ companyId, branchId, postId }) {
        try {
          const q = query(
            collection(db, "companies", companyId, "branches", branchId, "wall_posts", postId, "comments"),
            orderBy("timestamp", "asc")
          );
          const querySnapshot = await getDocs(q);
          const comments = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toMillis ? doc.data().timestamp.toMillis() : doc.data().timestamp,
          }));
          return { data: comments };
        } catch (err) {
          return { error: err.message };
        }
      },
      providesTags: (result, error, arg) => [{ type: "Comment", id: arg.postId }],
    }),

    addComment: builder.mutation({
      async queryFn({ companyId, branchId, postId, content, authorId, authorName }) {
        try {
          await addDoc(
            collection(db, "companies", companyId, "branches", branchId, "wall_posts", postId, "comments"),
            {
              content,
              authorId,
              authorName,
              timestamp: serverTimestamp(),
            }
          );
          return { data: "ok" };
        } catch (err) {
          return { error: err.message };
        }
      },
      invalidatesTags: (result, error, arg) => [{ type: "Comment", id: arg.postId }],
    }),
  }),
});

export const {
  useGetWallPostsQuery,
  useAddWallPostMutation,
  useTogglePostResolvedMutation,
  useDeleteWallPostMutation,
  useGetCommentsQuery,
  useAddCommentMutation,
} = feedsApiSlice;
