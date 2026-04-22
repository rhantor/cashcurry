import { canEdit } from "./rolePolicy";

export default function SettingsSection({ role, sectionKey, children }) {
  // a render prop receives a function: (can, isLocked) => JSX
  return children((field) => canEdit(role, sectionKey, field));
}
