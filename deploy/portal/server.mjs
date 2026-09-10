import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TEAM_VISIBLE_AS,
  normalizeNameList,
  hmac as hmacWith,
  safeEqual,
  hashPassword,
  passwordMatches,
  effectiveVisibleAs,
  canSeeTask,
  visibleSubtasksForUser,
  mergeSubtasks,
  allowedPriority,
  cleanDate,
  projectDocId,
  portalUserDocId,
  encodeDocPath,
} from "./lib.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(here, "public");
const port = Number(process.env.PORT || 8787);
const couchUrl = String(process.env.COUCHDB_URL || "http://127.0.0.1:5985").replace(/\/$/, "");
const couchDb = String(process.env.COUCHDB_DB || "gestore-attivita-kanban");
const couchUser = String(process.env.COUCHDB_USER || "");
const couchPassword = String(process.env.COUCHDB_PASSWORD || "");
const sessionSecret = String(process.env.SESSION_SECRET || "");
const sessionMaxAgeMs = Number(process.env.SESSION_MAX_AGE_HOURS || 12) * 60 * 60 * 1000;

// Protezione brute-force sul login: finestra scorrevole + lockout temporaneo, per IP e per IP+utente.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const MAX_BODY_BYTES = 1_000_000;
const loginAttempts = new Map();

if (!couchUser || !couchPassword) fatal("Set COUCHDB_USER and COUCHDB_PASSWORD.");
if (!sessionSecret || sessionSecret.length < 24) fatal("Set SESSION_SECRET with at least 24 characters.");

const bootstrapUsers = loadBootstrapUsers();
if (!bootstrapUsers.length) fatal("No admin user configured. Set PORTAL_USERS_FILE or PORTAL_USERS.");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
    const message = status === 413 ? "Richiesta troppo grande." : status === 500 ? "Errore del portale." : (error?.message || "Richiesta non valida.");
    sendJson(res, status, { error: status === 413 ? "payload_too_large" : "server_error", message });
  }
});

server.listen(port, () => {
  console.log(`Kanban responsabili portal listening on http://127.0.0.1:${port}`);
});

function fatal(message) {
  console.error(message);
  process.exit(1);
}

function loadBootstrapUsers() {
  const file = process.env.PORTAL_USERS_FILE || join(here, "users.json");
  let raw = "";
  if (existsSync(file)) raw = readFileSync(file, "utf8");
  else raw = process.env.PORTAL_USERS || "[]";
  const parsed = JSON.parse(raw);
  return (Array.isArray(parsed) ? parsed : []).map((user) => {
    const username = String(user.username || "").trim();
    const displayName = String(user.displayName || user.name || username).trim();
    const visibleAs = normalizeNameList(user.visibleAs?.length ? user.visibleAs : [displayName]);
    const groups = normalizeNameList(user.groups || []);
    return {
      username,
      displayName,
      visibleAs,
      groups,
      password: String(user.password || ""),
      passwordSha256: String(user.passwordSha256 || ""),
      passwordHash: String(user.passwordHash || ""),
      role: "admin",
      source: "bootstrap",
    };
  }).filter((user) => user.username && user.displayName && (user.password || user.passwordSha256 || user.passwordHash));
}

async function handleApi(req, res, url) {
  if (req.method === "POST" && url.pathname === "/api/login") return login(req, res);
  if (req.method === "POST" && url.pathname === "/api/logout") return logout(res);

  const user = await authenticatedUser(req);
  if (!user) return sendJson(res, 401, { error: "unauthenticated" });

  if (req.method === "GET" && url.pathname === "/api/me") return sendJson(res, 200, publicUser(user));
  if (req.method === "GET" && url.pathname === "/api/tasks") return listTasks(res, user);
  if (url.pathname.startsWith("/api/admin/")) {
    if (user.role !== "admin") return sendJson(res, 403, { error: "forbidden", message: "Solo l'admin puo gestire gli utenti." });
    return handleAdminApi(req, res, url);
  }
  if (req.method === "PATCH" && url.pathname.startsWith("/api/tasks/")) {
    const docId = decodeURIComponent(url.pathname.slice("/api/tasks/".length));
    return updateTask(req, res, user, docId);
  }
  sendJson(res, 404, { error: "not_found" });
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}

function loginRateKeys(req, username) {
  const ip = clientIp(req);
  return [`ip:${ip}`, `user:${ip}|${String(username || "").toLowerCase()}`];
}

function loginRetryAfter(keys) {
  const now = Date.now();
  let retryAfter = 0;
  for (const key of keys) {
    const entry = loginAttempts.get(key);
    if (entry?.lockedUntil && now < entry.lockedUntil) {
      retryAfter = Math.max(retryAfter, Math.ceil((entry.lockedUntil - now) / 1000));
    }
  }
  return retryAfter;
}

function registerLoginFailure(keys) {
  const now = Date.now();
  for (const key of keys) {
    const entry = loginAttempts.get(key) || { count: 0, firstAt: now, lockedUntil: 0 };
    if (now - entry.firstAt > LOGIN_WINDOW_MS) {
      entry.count = 0;
      entry.firstAt = now;
      entry.lockedUntil = 0;
    }
    entry.count += 1;
    if (entry.count >= LOGIN_MAX_ATTEMPTS) entry.lockedUntil = now + LOGIN_LOCK_MS;
    loginAttempts.set(key, entry);
  }
}

function clearLoginFailures(keys) {
  for (const key of keys) loginAttempts.delete(key);
}

function sweepLoginAttempts() {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    const lockExpired = !entry.lockedUntil || now > entry.lockedUntil;
    if (lockExpired && now - entry.firstAt > LOGIN_WINDOW_MS) loginAttempts.delete(key);
  }
}
setInterval(sweepLoginAttempts, 5 * 60 * 1000).unref?.();

async function login(req, res) {
  const body = await readJson(req);
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const rateKeys = loginRateKeys(req, username);
  const retryAfter = loginRetryAfter(rateKeys);
  if (retryAfter > 0) {
    res.setHeader("Retry-After", String(retryAfter));
    return sendJson(res, 429, {
      error: "too_many_attempts",
      message: `Troppi tentativi di accesso. Riprova tra ${Math.ceil(retryAfter / 60)} minuti.`,
    });
  }
  const user = await findUser(username);
  if (!user || !passwordMatches(user, password)) {
    registerLoginFailure(rateKeys);
    return sendJson(res, 401, { error: "bad_credentials", message: "Credenziali non valide." });
  }
  clearLoginFailures(rateKeys);
  const expiresAt = Date.now() + sessionMaxAgeMs;
  const token = signSession({ username: user.username, expiresAt });
  res.setHeader("Set-Cookie", cookieHeader("kanban_portal", token, expiresAt));
  sendJson(res, 200, publicUser(user));
}

function logout(res) {
  res.setHeader("Set-Cookie", "kanban_portal=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  sendJson(res, 200, { ok: true });
}

function publicUser(user) {
  return { username: user.username, displayName: user.displayName, visibleAs: user.visibleAs, groups: user.groups, role: user.role || "user" };
}

async function handleAdminApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/admin/users") return sendJson(res, 200, { users: await listPortalUsers() });
  if (req.method === "GET" && url.pathname === "/api/admin/visible-as") return sendJson(res, 200, { visibleAs: await listAssignableVisibleAs() });
  if (req.method === "POST" && url.pathname === "/api/admin/users") return createPortalUser(req, res);
  if (req.method === "PATCH" && url.pathname.startsWith("/api/admin/users/")) {
    const username = decodeURIComponent(url.pathname.slice("/api/admin/users/".length));
    return updatePortalUser(req, res, username);
  }
  if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/users/")) {
    const username = decodeURIComponent(url.pathname.slice("/api/admin/users/".length));
    return deletePortalUser(res, username);
  }
  return sendJson(res, 404, { error: "not_found" });
}

async function findUser(username) {
  const bootstrap = bootstrapUsers.find((item) => item.username === username);
  if (bootstrap) return bootstrap;
  try {
    const doc = await couchGet(`/${encodeURIComponent(couchDb)}/${encodeDocPath(portalUserDocId(username))}`);
    return portalUserFromDoc(doc);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

function portalUserFromDoc(doc) {
  if (!doc || doc.type !== "kanban-portal-user" || doc.disabled) return null;
  return {
    username: String(doc.username || ""),
    displayName: String(doc.displayName || doc.username || ""),
    visibleAs: [String(doc.visibleAs || "").trim()].filter(Boolean),
    groups: [],
    passwordHash: String(doc.passwordHash || ""),
    password: String(doc.password || ""),
    passwordSha256: String(doc.passwordSha256 || ""),
    role: "user",
    source: "couchdb",
    _id: doc._id,
    _rev: doc._rev,
  };
}

async function listPortalUsers() {
  const result = await couchGetView("portal_users", { include_docs: true });
  return (result.rows || [])
    .map((row) => row.doc)
    .filter((doc) => doc && doc.type === "kanban-portal-user" && !doc.disabled)
    .map((doc) => ({
      username: doc.username,
      displayName: doc.displayName,
      visibleAs: doc.visibleAs,
      hasPassword: Boolean(doc.passwordHash || doc.password || doc.passwordSha256),
      updatedAt: doc.updatedAt || "",
    }))
    .sort((a, b) => String(a.displayName || a.username).localeCompare(String(b.displayName || b.username)));
}

async function listAssignableVisibleAs() {
  const result = await couchGetView("assignable_names", { group: true });
  return (result.rows || [])
    .map((row) => String(row.key || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

async function createPortalUser(req, res) {
  const body = await readJson(req);
  const username = String(body.username || "").trim();
  const displayName = String(body.displayName || username).trim();
  const visibleAs = String(body.visibleAs || "").trim();
  const password = String(body.password || "");
  const assignable = await listAssignableVisibleAs();
  if (!username || !displayName || !visibleAs || !password) {
    return sendJson(res, 400, { error: "bad_request", message: "Compila utente, nome, password e visibilità." });
  }
  if (!assignable.includes(visibleAs)) return sendJson(res, 400, { error: "bad_visible_as", message: "Scegli una visibilità presente nei dati CouchDB." });
  if (bootstrapUsers.some((user) => user.username === username)) return sendJson(res, 409, { error: "conflict", message: "Questo utente e riservato al bootstrap admin." });
  const existing = await findPortalUserDoc(username);
  if (existing && !existing.disabled) return sendJson(res, 409, { error: "conflict", message: "Utente gia presente." });
  const now = new Date().toISOString();
  const doc = {
    _id: portalUserDocId(username),
    ...(existing?._rev ? { _rev: existing._rev } : {}),
    type: "kanban-portal-user",
    username,
    displayName,
    visibleAs,
    passwordHash: hashPassword(password),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    disabled: false,
  };
  await couchPut(`/${encodeURIComponent(couchDb)}/${encodeDocPath(doc._id)}`, doc);
  return sendJson(res, 201, { user: { username, displayName, visibleAs, hasPassword: true, updatedAt: now } });
}

async function updatePortalUser(req, res, username) {
  const body = await readJson(req);
  const doc = await findPortalUserDoc(username);
  if (!doc || doc.disabled) return sendJson(res, 404, { error: "not_found", message: "Utente non trovato." });
  const assignable = await listAssignableVisibleAs();
  const next = { ...doc, updatedAt: new Date().toISOString() };
  if (Object.hasOwn(body, "displayName")) next.displayName = String(body.displayName || next.username).trim();
  if (Object.hasOwn(body, "visibleAs")) {
    const visibleAs = String(body.visibleAs || "").trim();
    if (!assignable.includes(visibleAs)) return sendJson(res, 400, { error: "bad_visible_as", message: "Scegli una visibilità presente nei dati CouchDB." });
    next.visibleAs = visibleAs;
  }
  if (body.password) {
    next.passwordHash = hashPassword(String(body.password));
    // Rimuove eventuali credenziali storiche in chiaro presenti sul documento.
    delete next.password;
    delete next.passwordSha256;
  }
  await couchPut(`/${encodeURIComponent(couchDb)}/${encodeDocPath(doc._id)}`, next);
  sendJson(res, 200, { user: { username: next.username, displayName: next.displayName, visibleAs: next.visibleAs, hasPassword: Boolean(next.passwordHash || next.password || next.passwordSha256), updatedAt: next.updatedAt } });
}

async function deletePortalUser(res, username) {
  const doc = await findPortalUserDoc(username);
  if (!doc) return sendJson(res, 404, { error: "not_found", message: "Utente non trovato." });
  await couchPut(`/${encodeURIComponent(couchDb)}/${encodeDocPath(doc._id)}`, { ...doc, disabled: true, updatedAt: new Date().toISOString() });
  sendJson(res, 200, { ok: true });
}

async function findPortalUserDoc(username) {
  try {
    return await couchGet(`/${encodeURIComponent(couchDb)}/${encodeDocPath(portalUserDocId(username))}`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function listTasks(res, user) {
  const tasksById = new Map();
  const visibleAs = effectiveVisibleAs(user);
  if (user.role === "admin") {
    const result = await couchGetView("by_type", { key: "kanban-task", include_docs: true });
    for (const row of result.rows || []) {
      if (row.doc?.type === "kanban-task") tasksById.set(row.doc._id, row.doc);
    }
  } else {
    for (const name of visibleAs) {
      const result = await couchGetView("tasks_by_owner", { startkey: [name], endkey: [name, {}], include_docs: true });
      for (const row of result.rows || []) {
        if (row.doc && canSeeTask(user, row.doc)) tasksById.set(row.doc._id, row.doc);
      }
    }
  }

  const tasks = [...tasksById.values()];
  const projects = await loadProjectNames(tasks);
  const openTasks = tasks.filter((task) => !projects.get(`${task.workspaceId}/${task.projectId}`)?.archived && !isDoneTask(task, projects));
  openTasks.sort((a, b) => String(a.dueDate || "9999-99-99").localeCompare(String(b.dueDate || "9999-99-99")) || String(a.name || "").localeCompare(String(b.name || "")));
  sendJson(res, 200, {
    tasks: openTasks.map((task) => publicTask(task, projects, user)),
    statusesByProject: Object.fromEntries([...projects.entries()].map(([key, project]) => [key, project.statuses || []])),
  });
}

async function loadProjectNames(tasks) {
  const ids = [...new Set(tasks.map((task) => projectDocId(task.workspaceId, task.projectId)).filter(Boolean))];
  if (!ids.length) return new Map();
  const result = await couchPostView("projects_by_id", { include_docs: true }, { keys: ids });
  const projects = new Map();
  for (const row of result.rows || []) {
    if (!row.doc) continue;
    projects.set(`${row.doc.workspaceId}/${row.doc.projectId}`, {
      name: row.doc.name || row.doc.projectId,
      statuses: row.doc.statuses || [],
      archived: Boolean(row.doc.archived),
    });
  }
  return projects;
}

function publicTask(task, projects, user = null) {
  const project = projects.get(`${task.workspaceId}/${task.projectId}`) || {};
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  return {
    id: task._id,
    taskId: task.taskId || task.id,
    name: task.name || "Senza titolo",
    projectName: project.name || task.projectId || "",
    workspaceId: task.workspaceId || "",
    projectId: task.projectId || "",
    owner: task.owner || "",
    groupId: task.groupId || "",
    visibleTo: task.visibleTo || [],
    statusId: task.statusId || "",
    priority: task.priority || "none",
    startDate: task.startDate || "",
    dueDate: task.dueDate || "",
    notes: task.notes || "",
    subtasks: user ? visibleSubtasksForUser(user, subtasks) : subtasks,
    updatedAt: task.updatedAt || "",
    revision: task._rev || "",
    changeKey: publicTaskChangeKey(task),
  };
}

function publicTaskChangeKey(task) {
  return JSON.stringify({
    rev: task._rev || "",
    taskId: task.taskId || task.id || "",
    name: task.name || "",
    owner: task.owner || "",
    groupId: task.groupId || "",
    visibleTo: task.visibleTo || [],
    statusId: task.statusId || "",
    priority: task.priority || "none",
    startDate: task.startDate || "",
    dueDate: task.dueDate || "",
    notes: task.notes || "",
    attachments: task.attachments || [],
    subtasks: task.subtasks || [],
    updatedAt: task.updatedAt || "",
  });
}

function isDoneTask(task, projects) {
  const project = projects.get(`${task.workspaceId}/${task.projectId}`) || {};
  const status = (project.statuses || []).find((item) => String(item.id || "") === String(task.statusId || ""));
  const statusText = `${status?.type || ""} ${status?.id || ""} ${status?.name || ""}`.toLowerCase();
  return /\bdone\b|\bcompletat/.test(statusText);
}

async function updateTask(req, res, user, docId) {
  const body = await readJson(req);
  const task = await couchGet(`/${encodeURIComponent(couchDb)}/${encodeDocPath(docId)}`);
  if (!canSeeTask(user, task)) return sendJson(res, 403, { error: "forbidden", message: "Attività non disponibile per questo responsabile." });

  const next = { ...task };
  if (Object.hasOwn(body, "statusId")) next.statusId = String(body.statusId || "");
  if (Object.hasOwn(body, "priority")) next.priority = allowedPriority(body.priority);
  if (Object.hasOwn(body, "dueDate")) next.dueDate = cleanDate(body.dueDate);
  if (Object.hasOwn(body, "notes")) next.notes = String(body.notes || "");
  if (Array.isArray(body.subtasks)) next.subtasks = mergeSubtasks(next.subtasks, body.subtasks);
  next.updatedAt = new Date().toISOString();

  const saved = await couchPut(`/${encodeURIComponent(couchDb)}/${encodeDocPath(docId)}`, next);
  next._rev = saved.rev;
  sendJson(res, 200, { task: publicTask(next, new Map(), user) });
}

function couchViewPath(viewName, params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) search.set(key, typeof value === "string" ? value : JSON.stringify(value));
  const query = search.toString();
  return `/${encodeURIComponent(couchDb)}/_design/kanban/_view/${encodeURIComponent(viewName)}${query ? `?${query}` : ""}`;
}

async function couchGetView(viewName, params = {}) {
  return couchGet(couchViewPath(viewName, params));
}

async function couchPostView(viewName, params, body) {
  return couchPost(couchViewPath(viewName, params), body);
}

async function couchGet(path) {
  const response = await fetch(`${couchUrl}${path}`, { headers: couchHeaders() });
  return parseCouchResponse(response);
}

async function couchPost(path, body) {
  const response = await fetch(`${couchUrl}${path}`, { method: "POST", headers: couchHeaders(), body: JSON.stringify(body) });
  return parseCouchResponse(response);
}

async function couchPut(path, body) {
  const response = await fetch(`${couchUrl}${path}`, { method: "PUT", headers: couchHeaders(), body: JSON.stringify(body) });
  return parseCouchResponse(response);
}

function couchHeaders() {
  return {
    Authorization: `Basic ${Buffer.from(`${couchUser}:${couchPassword}`).toString("base64")}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function parseCouchResponse(response) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = body.reason || body.error || `CouchDB HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function authenticatedUser(req) {
  const cookies = Object.fromEntries(String(req.headers.cookie || "").split(";").map((part) => part.trim().split("=")).filter((pair) => pair.length === 2));
  const session = verifySession(cookies.kanban_portal || "");
  if (!session) return null;
  return findUser(session.username);
}

function signSession(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = hmacWith(sessionSecret, encoded);
  return `${encoded}.${sig}`;
}

function verifySession(token) {
  const [encoded, sig] = String(token || "").split(".");
  if (!encoded || !sig || !safeEqual(hmacWith(sessionSecret, encoded), sig)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.expiresAt || Date.now() > Number(payload.expiresAt)) return null;
    return payload;
  } catch {
    return null;
  }
}

function cookieHeader(name, value, expiresAt) {
  const maxAge = Math.max(1, Math.floor((expiresAt - Date.now()) / 1000));
  const secure = process.env.COOKIE_SECURE === "false" ? "" : "; Secure";
  return `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

async function readJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error("Richiesta troppo grande.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function sendJson(res, status, body) {
  res.writeHead(status, { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function serveStatic(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") return sendJson(res, 405, { error: "method_not_allowed" });
  const filePath = staticFilePath(url.pathname);
  if (!filePath || !isStaticFile(filePath)) {
    res.writeHead(404, { ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end("Not found");
    return;
  }
  res.writeHead(200, { ...SECURITY_HEADERS, "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream", "Cache-Control": "no-store" });
  if (req.method === "HEAD") res.end();
  else createReadStream(filePath).pipe(res);
}

function staticFilePath(pathname) {
  let decoded = "";
  try {
    decoded = decodeURIComponent(String(pathname || "/"));
  } catch {
    return "";
  }
  const requested = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const filePath = resolve(publicDir, requested);
  const relativePath = relative(publicDir, filePath);
  if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) return "";
  return filePath;
}

function isStaticFile(filePath) {
  try {
    return existsSync(filePath) && statSync(filePath).isFile();
  } catch {
    return false;
  }
}
