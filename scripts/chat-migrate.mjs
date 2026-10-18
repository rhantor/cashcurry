// `npm run chat:migrate` — copy the old branch chat
// (companies/{c}/branches/{b}/chat_messages) into the new chat (roadmap 4.4):
// companies/{c}/chats/branch_{b}/messages, same ids, same times. The old
// messages are left where they are. Safe to run again.
//
//   npm run chat:migrate                                   local emulators, report only
//   npm run chat:migrate -- --write                        local emulators, write
//   npm run chat:migrate -- --project <id>                 a real project, report only
//   npm run chat:migrate -- --project <id> --write --confirm
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { LOCAL_PROJECT_ID } from "./local/config.mjs";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};
const project = arg("--project");
const write = process.argv.includes("--write");
if (project) {
  if (write && !process.argv.includes("--confirm")) {
    console.error(`This writes to the real project "${project}". Add --confirm to go ahead.`);
    process.exit(1);
  }
  delete process.env.FIRESTORE_EMULATOR_HOST;
} else {
  process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
}

initializeApp({ projectId: project || LOCAL_PROJECT_ID });
const db = getFirestore();
console.log(`${write ? "Copying" : "Checking"} the old branch chat in ${project || "local emulators"}${write ? "" : " — report only, add --write to save"}`);

let total = 0;
for (const company of await db.collection("companies").listDocuments()) {
  for (const branch of await company.collection("branches").listDocuments()) {
    const old = await branch.collection("chat_messages").orderBy("createdAt").get();
    if (old.empty) continue;
    total += old.size;
    const name = (await branch.get()).data()?.name || branch.id;
    console.log(`  ${company.id} / ${name}: ${old.size} message(s)`);
    if (!write) continue;
    const chat = company.collection("chats").doc(`branch_${branch.id}`);
    if (!(await chat.get()).exists) await chat.set({ kind: "branch", branchId: branch.id, name, createdAt: old.docs[0].data().createdAt || new Date(), updatedAt: new Date() });
    for (let i = 0; i < old.size; i += 400) {
      const batch = db.batch();
      for (const d of old.docs.slice(i, i + 400)) {
        const m = d.data();
        batch.set(chat.collection("messages").doc(d.id), {
          byUid: m.senderUid || "",
          byName: m.senderName || "",
          text: m.text || "",
          files: [],
          replyTo: null,
          createdAt: m.createdAt || new Date(),
          deleted: false,
          movedFrom: `chat_messages/${d.id}`,
        });
      }
      await batch.commit();
    }
    const last = old.docs[old.size - 1].data();
    await chat.set({ lastMessage: { text: String(last.text || "").slice(0, 120), byUid: last.senderUid || "", byName: last.senderName || "", at: last.createdAt || new Date() } }, { merge: true });
  }
}
console.log(`${total} old message(s) ${write ? "copied" : "would be copied"}`);
process.exit(0);
