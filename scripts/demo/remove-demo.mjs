// `npm run demo:remove` — what `npm run demo:live` made in the live app, and
// nothing else: companies/demo-company (with everything under it), the demo
// logins (Auth uid demo-…) and their users/usernames, the demo join links, and
// files under */demo-company/* in storage.
//
//   npm run demo:remove                     show what would go (changes nothing)
//   npm run demo:remove -- --delete --confirm   delete it, for good
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CO = "demo-company";
const remove = process.argv.includes("--delete");
if (remove && !process.argv.includes("--confirm")) {
  console.error("This deletes the demo company from the live app. Add --confirm.");
  process.exit(1);
}
for (const v of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]) delete process.env[v];
const bucketName = (fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=["']?([^"'\r\n]+)/m) || [])[1];
initializeApp({
  projectId: "pos-system-448bc",
  storageBucket: bucketName,
  credential: cert(JSON.parse(fs.readFileSync(path.join(ROOT, "lib", "server", "serviceAccountKey.json"), "utf8"))),
});
const db = getFirestore();
const auth = getAuth();

const isDemo = (uid) => String(uid || "").startsWith("demo-");
const users = (await db.collection("users").where("companyId", "==", CO).get()).docs.filter((d) => isDemo(d.id));
const usernames = (await db.collection("usernames").where("companyId", "==", CO).get()).docs.filter((d) => isDemo(d.data().uid));
const joinLinks = (await db.collection("joinLinks").where("companyId", "==", CO).get()).docs;
const logins = [];
let pageToken;
do {
  const page = await auth.listUsers(1000, pageToken);
  logins.push(...page.users.filter((u) => isDemo(u.uid) && String(u.email || "").endsWith("@demo.test")));
  pageToken = page.pageToken;
} while (pageToken);
const [files] = bucketName ? await getStorage().bucket().getFiles() : [[]];
const demoFiles = files.filter((f) => f.name.split("/").includes(CO));
const company = await db.doc(`companies/${CO}`).get();
const branches = await db.collection(`companies/${CO}/branches`).listDocuments();

console.log(`companies/${CO}: ${company.exists ? "there" : "not found"}, ${branches.length} branches (everything under it goes)`);
console.log(`users ${users.length}, usernames ${usernames.length} (${usernames.map((d) => d.id).join(", ")}), join links ${joinLinks.length}, logins ${logins.length}, files ${demoFiles.length}`);
if (!remove) {
  console.log("Nothing deleted. Run again with --delete --confirm.");
  process.exit(0);
}
await db.recursiveDelete(db.doc(`companies/${CO}`));
for (const d of [...users, ...usernames, ...joinLinks]) await d.ref.delete();
if (logins.length) await auth.deleteUsers(logins.map((u) => u.uid));
for (const f of demoFiles) await f.delete();
console.log("The demo company is gone.");
process.exit(0);
