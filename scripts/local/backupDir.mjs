// Where the client backup is on this machine: CC_BACKUP_DIR, else the path in
// the git-ignored .local/backup-path.txt (relative to the repo). The repo is
// public, so the folder's name is not written here. Null when there is none.
import fs from "node:fs";
import path from "node:path";

export function findBackupDir(root) {
  if (process.env.CC_BACKUP_DIR) return path.resolve(process.env.CC_BACKUP_DIR);
  try {
    const saved = fs.readFileSync(path.join(root, ".local", "backup-path.txt"), "utf8").trim();
    return saved ? path.resolve(root, saved) : null;
  } catch {
    return null;
  }
}
