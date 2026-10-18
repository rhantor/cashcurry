"use client";
// Live issues (roadmap 4.5): a branch's (or several branches') for office
// roles; for staff only the ones they raised or were given — the only
// queries the rules let them run. And one issue's discussion.
import { useEffect, useMemo, useState } from "react";
import { onSnapshot, orderBy, query, where } from "firebase/firestore";
import { commentsCol, issuesCol } from "@/lib/issues/client";
import { timeOf } from "@/lib/chat/model";

const shape = (d, branchId) => {
  const x = d.data({ serverTimestamps: "estimate" });
  return { id: d.id, ...x, branchId: x.branchId || branchId, createdAtISO: x.createdAt?.toDate?.()?.toISOString?.() || "", lastAt: timeOf(x.lastActivityAt || x.createdAt) };
};

/** user: the person; branchIds: which branches to look at. */
export function useIssues(user, branchIds = []) {
  const [byKey, setByKey] = useState({});
  const [ready, setReady] = useState(false);
  const key = branchIds.join(",");
  const staff = user?.role === "staff";
  useEffect(() => {
    if (!user?.companyId || !user?.uid || !key) return;
    setByKey({});
    setReady(false);
    const stops = [];
    for (const b of key.split(",")) {
      const col = issuesCol(user.companyId, b);
      const queries = staff ? [["raised", query(col, where("reporterUid", "==", user.uid))], ["given", query(col, where("assigneeUid", "==", user.uid))]] : [["all", query(col)]];
      for (const [name, q] of queries) {
        stops.push(
          onSnapshot(
            q,
            (s) => {
              setByKey((m) => ({ ...m, [`${b}/${name}`]: s.docs.map((d) => shape(d, b)) }));
              setReady(true);
            },
            () => setReady(true)
          )
        );
      }
    }
    return () => stops.forEach((s) => s());
  }, [user?.companyId, user?.uid, key, staff]);

  const issues = useMemo(() => {
    const seen = new Map();
    for (const list of Object.values(byKey)) for (const i of list) seen.set(`${i.branchId}/${i.id}`, i);
    return [...seen.values()];
  }, [byKey]);
  return { issues, ready };
}

/** One issue's discussion, oldest first. */
export function useIssueComments(companyId, branchId, issueId) {
  const [comments, setComments] = useState([]);
  useEffect(() => {
    if (!companyId || !branchId || !issueId) return;
    return onSnapshot(
      query(commentsCol(companyId, branchId, issueId), orderBy("createdAt")),
      (s) => setComments(s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))),
      () => setComments([])
    );
  }, [companyId, branchId, issueId]);
  return comments;
}
