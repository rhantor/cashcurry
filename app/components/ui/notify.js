// Toasts and dialogs you can call from anywhere — event handlers, export
// helpers, API code — like the browser's alert()/confirm()/prompt() they
// replace, but without freezing the page:
//
//   import { toast, confirmDialog, promptDialog } from "@/app/components/ui/notify";
//   toast.success("Saved");
//   if (!(await confirmDialog({ title: "Delete this cost?", danger: true }))) return;
//   const reason = await promptDialog({ title: "Why reject?" }); // null if cancelled
//
// <UIProvider> (app/components/ui) mounts the toast list and the dialog host
// and registers them here. Calls before that are queued.

// Stacks: a nested <UIProvider> (e.g. the /ui preview) takes over while it is
// mounted and hands back to the app's own when it unmounts.
const toastApis = [];
const dialogHosts = [];
const pendingToasts = [];
const pendingDialogs = [];
const top = (stack) => stack[stack.length - 1] || null;

/** Called by <ToastProvider>; returns the function that unregisters it. */
export function registerToasts(api) {
  toastApis.push(api);
  while (pendingToasts.length) {
    const [name, args] = pendingToasts.shift();
    api[name](...args);
  }
  return () => toastApis.splice(toastApis.lastIndexOf(api), 1);
}

/** Called by <DialogHost>; returns the function that unregisters it. */
export function registerDialogs(host) {
  dialogHosts.push(host);
  while (pendingDialogs.length) host(pendingDialogs.shift());
  return () => dialogHosts.splice(dialogHosts.lastIndexOf(host), 1);
}

const tone = (name) => (title, opts) => {
  const api = top(toastApis);
  if (api) return api[name](title, opts);
  pendingToasts.push([name, [title, opts]]);
  return null;
};

export const toast = {
  success: tone("success"),
  error: tone("error"),
  warning: tone("warning"),
  info: tone("info"),
  /** Loading → success/error in place (see Toast.jsx). */
  promise: (p, labels) => (top(toastApis) ? top(toastApis).promise(p, labels) : p),
  dismiss: (id) => top(toastApis)?.dismiss(id),
};

const ask = (request) =>
  new Promise((resolve) => {
    const r = { ...request, resolve };
    const host = top(dialogHosts);
    if (host) host(r);
    else pendingDialogs.push(r);
  });

/**
 * Ask before doing something. Resolves true (confirmed) or false.
 * Accepts a plain message too: confirmDialog("Delete this?").
 */
export const confirmDialog = (opts) =>
  ask({ kind: "confirm", ...(typeof opts === "string" ? { title: opts } : opts) });

/** Ask for a short text. Resolves the text, or null if cancelled. */
export const promptDialog = (opts) =>
  ask({ kind: "prompt", ...(typeof opts === "string" ? { title: opts } : opts) });
