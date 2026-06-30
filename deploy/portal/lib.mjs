// Funzioni pure del portale (nessuna dipendenza da rete, env o stato globale),
// estratte da server.mjs per poterle testare in isolamento.
import { createHash, createHmac, timingSafeEqual, randomBytes, scryptSync } from "node:crypto";

export const TEAM_VISIBLE_AS = "Team";
const ALLOWED_PRIORITIES = ["high", "medium", "low", "none"];

export function normalizeNameList(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];
}

export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function hmac(secret, value) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyScrypt(stored, password) {
  const [scheme, saltHex, hashHex] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (!salt.length || !expected.length) return false;
  const derived = scryptSync(String(password), salt, expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function passwordMatches(user, password) {
  if (user.passwordHash) return verifyScrypt(user.passwordHash, password);
  if (user.password) return safeEqual(user.password, password);
  if (user.passwordSha256) return safeEqual(user.passwordSha256, sha256(password));
  return false;
}

export function effectiveVisibleAs(user) {
  if (user.role === "admin") return normalizeNameList(user.visibleAs || []);
  return normalizeNameList([...(user.visibleAs || []), TEAM_VISIBLE_AS]);
}

export function canSeeTask(user, task) {
  if (user.role === "admin") return true;
  const owner = String(task.owner || "").trim();
  return effectiveVisibleAs(user).includes(owner);
}

export function visibleSubtasksForUser(user, subtasks) {
  const list = Array.isArray(subtasks) ? subtasks : [];
  if (user.role === "admin") return list.map((subtask) => ({ ...subtask, editable: true }));
  const visibleAs = effectiveVisibleAs(user);
  return list.map((subtask) => ({
    ...subtask,
    editable: visibleAs.includes(String(subtask.owner || "").trim()),
  }));
}

export function mergeSubtasks(existing, updates) {
  const byId = new Map((Array.isArray(existing) ? existing : []).map((subtask) => [String(subtask.id || ""), { ...subtask }]));
  for (const update of Array.isArray(updates) ? updates : []) {
    const id = String(update.id || "");
    if (!id || !byId.has(id)) continue;
    byId.get(id).done = Boolean(update.done);
  }
  return [...byId.values()];
}

export function allowedPriority(value) {
  const priority = String(value || "none");
  return ALLOWED_PRIORITIES.includes(priority) ? priority : "none";
}

export function cleanDate(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

export function projectDocId(workspaceId, projectId) {
  if (!workspaceId || !projectId) return "";
  return ["project", encodeURIComponent(String(workspaceId)), encodeURIComponent(String(projectId))].join("::");
}

export function portalUserDocId(username) {
  return `portal-user::${encodeURIComponent(String(username || "").trim())}`;
}

export function encodeDocPath(id) {
  return String(id || "").split("/").map(encodeURIComponent).join("/");
}
