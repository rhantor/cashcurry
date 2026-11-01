// A new cost with a voucher, saved as the app does (lib/costs/client.js
// addCost): it takes the branch's next running number in the same write (1 Nov).
export async function nextVoucherNo(env, branchPath) {
  let last = 0;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const s = await ctx.firestore().doc(`${branchPath}/counters/vouchers`).get();
    last = s.exists ? s.data().last || 0 : 0;
  });
  return last + 1;
}

/** Save `cost` (with a voucher) as `fs`, numbered; `more(batch, no)` adds to the same write. */
export async function saveNumbered(env, fs, branchPath, id, cost, more = () => {}) {
  const no = await nextVoucherNo(env, branchPath);
  const b = fs.batch();
  b.set(fs.doc(`${branchPath}/costs/${id}`), { ...cost, voucher: { ...cost.voucher, no } });
  b.set(fs.doc(`${branchPath}/counters/vouchers`), { last: no, ref: id });
  more(b, no);
  return b.commit();
}
