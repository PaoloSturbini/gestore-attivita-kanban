const loginView = document.getElementById("loginView");
const tasksView = document.getElementById("tasksView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const pageEyebrow = document.getElementById("pageEyebrow");
const pageTitle = document.getElementById("pageTitle");
const taskList = document.getElementById("taskList");
const emptyState = document.getElementById("emptyState");
const filtersPanel = document.getElementById("filtersPanel");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const priorityFilter = document.getElementById("priorityFilter");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");
const adminTasksBtn = document.getElementById("adminTasksBtn");
const adminToggleBtn = document.getElementById("adminToggleBtn");
const adminPanel = document.getElementById("adminPanel");
const userForm = document.getElementById("userForm");
const newUsername = document.getElementById("newUsername");
const newDisplayName = document.getElementById("newDisplayName");
const newVisibleAs = document.getElementById("newVisibleAs");
const newPassword = document.getElementById("newPassword");
const adminMessage = document.getElementById("adminMessage");
const userList = document.getElementById("userList");
const taskTemplate = document.getElementById("taskTemplate");
const userTemplate = document.getElementById("userTemplate");

let currentUser = null;
let tasks = [];
let statusesByProject = {};
let portalUsers = [];
let assignableVisibleAs = [];
let knownTaskUpdates = new Map();
let currentPage = "tasks";

const priorityLabels = {
  high: "Alta",
  medium: "Media",
  low: "Bassa",
  none: "ND",
};

const TASK_UPDATE_STORAGE_PREFIX = "kanban-portal-task-updates-v1";

init();

async function init() {
  bindEvents();
  try {
    currentUser = await api("/api/me");
    showTasksView();
    await loadTasks();
  } catch {
    showLoginView();
  }
}

function bindEvents() {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.textContent = "";
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    try {
      currentUser = await api("/api/login", { method: "POST", body: { username, password } });
      knownTaskUpdates = new Map();
      loginForm.reset();
      showTasksView();
      await loadTasks();
    } catch (error) {
      loginError.textContent = error.message || "Accesso non riuscito.";
    }
  });

  refreshBtn.addEventListener("click", loadTasks);
  adminTasksBtn.addEventListener("click", async () => {
    await showPortalPage("tasks");
  });
  adminToggleBtn.addEventListener("click", async () => {
    await showPortalPage("users");
  });
  userForm.addEventListener("submit", createUser);
  logoutBtn.addEventListener("click", async () => {
    await api("/api/logout", { method: "POST", body: {} }).catch(() => {});
    currentUser = null;
    tasks = [];
    currentPage = "tasks";
    knownTaskUpdates = new Map();
    showLoginView();
  });
  searchInput.addEventListener("input", renderTasks);
  statusFilter.addEventListener("change", renderTasks);
  priorityFilter.addEventListener("change", renderTasks);
}

function showLoginView() {
  loginView.hidden = false;
  tasksView.hidden = true;
}

function showTasksView() {
  loginView.hidden = true;
  tasksView.hidden = false;
  adminTasksBtn.hidden = currentUser?.role !== "admin";
  adminToggleBtn.hidden = currentUser?.role !== "admin";
  showPortalPage("tasks");
}

async function showPortalPage(page) {
  currentPage = page === "users" && currentUser?.role === "admin" ? "users" : "tasks";
  const admin = currentUser?.role === "admin";
  pageEyebrow.textContent = currentPage === "users" ? "Amministrazione" : admin ? "Tutte le attività" : "Le mie attività";
  pageTitle.textContent = currentPage === "users" ? "Utenti portale" : admin ? "Tutte le attività" : currentUser?.displayName ? `Attività di ${currentUser.displayName}` : "Attività";
  adminPanel.hidden = currentPage !== "users";
  filtersPanel.hidden = currentPage !== "tasks";
  taskList.hidden = currentPage !== "tasks";
  emptyState.hidden = currentPage !== "tasks" || taskList.children.length > 0;
  refreshBtn.hidden = currentPage !== "tasks";
  adminTasksBtn.classList.toggle("active", admin && currentPage === "tasks");
  adminToggleBtn.classList.toggle("active", admin && currentPage === "users");
  if (currentPage === "users") await loadAdminData();
  if (currentPage === "tasks") renderTasks();
}

async function loadTasks() {
  refreshBtn.disabled = true;
  try {
    const result = await api("/api/tasks");
    const nextTasks = result.tasks || [];
    const previousTaskUpdates = loadKnownTaskUpdates();
    const hadKnownTasks = previousTaskUpdates.size > 0;
    tasks = nextTasks.map((task) => ({
      ...task,
      isNew: hadKnownTasks && previousTaskUpdates.get(task.id) !== taskChangeKey(task),
    }));
    knownTaskUpdates = new Map(nextTasks.map((task) => [task.id, taskChangeKey(task)]));
    saveKnownTaskUpdates();
    statusesByProject = result.statusesByProject || {};
    renderStatusFilter();
    renderTasks();
  } finally {
    refreshBtn.disabled = false;
  }
}

function taskUpdateStorageKey() {
  const userKey = currentUser?.username || currentUser?.displayName || "anonymous";
  return `${TASK_UPDATE_STORAGE_PREFIX}:${userKey}`;
}

function loadKnownTaskUpdates() {
  if (knownTaskUpdates.size) return knownTaskUpdates;
  try {
    const raw = window.localStorage?.getItem(taskUpdateStorageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    knownTaskUpdates = new Map(Array.isArray(parsed) ? parsed : []);
  } catch {
    knownTaskUpdates = new Map();
  }
  return knownTaskUpdates;
}

function saveKnownTaskUpdates() {
  try {
    window.localStorage?.setItem(taskUpdateStorageKey(), JSON.stringify([...knownTaskUpdates]));
  } catch {
    // Il portale resta funzionante anche se il browser blocca localStorage.
  }
}

function taskChangeKey(task) {
  return JSON.stringify({
    id: task.id || "",
    taskId: task.taskId || "",
    revision: task.revision || "",
    changeKey: task.changeKey || "",
    name: task.name || "",
    projectName: task.projectName || "",
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
    subtasks: (task.subtasks || []).map((subtask) => ({
      id: subtask.id || "",
      name: subtask.name || "",
      owner: subtask.owner || "",
      done: Boolean(subtask.done),
      editable: subtask.editable !== false,
    })),
    updatedAt: task.updatedAt || "",
  });
}

async function loadAdminData() {
  if (currentUser?.role !== "admin") return;
  adminMessage.textContent = "";
  const [usersResult, visibleResult] = await Promise.all([api("/api/admin/users"), api("/api/admin/visible-as")]);
  portalUsers = usersResult.users || [];
  assignableVisibleAs = visibleResult.visibleAs || [];
  renderVisibleAsSelect(newVisibleAs, "");
  renderUsers();
}

function renderVisibleAsSelect(select, selected) {
  select.innerHTML = assignableVisibleAs.map((name) => `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`).join("");
  if (assignableVisibleAs.includes(selected)) select.value = selected;
}

function renderUsers() {
  userList.textContent = "";
  for (const user of portalUsers) userList.append(renderUser(user));
}

function renderUser(user) {
  const node = userTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.username = user.username;
  node.querySelector("strong").textContent = user.displayName || user.username;
  node.querySelector("span").textContent = user.username;
  const visibleSelect = node.querySelector('[data-user-field="visibleAs"]');
  renderVisibleAsSelect(visibleSelect, user.visibleAs);
  const passwordField = node.querySelector('[data-user-field="password"]');
  passwordField.value = "";
  passwordField.placeholder = user.hasPassword ? "Password impostata · scrivi per cambiarla" : "Imposta una password";
  node.querySelector('[data-user-action="save"]').addEventListener("click", () => saveUser(node, user));
  node.querySelector('[data-user-action="delete"]').addEventListener("click", () => deleteUser(user));
  return node;
}

async function createUser(event) {
  event.preventDefault();
  adminMessage.textContent = "";
  try {
    await api("/api/admin/users", {
      method: "POST",
      body: {
        username: newUsername.value,
        displayName: newDisplayName.value,
        visibleAs: newVisibleAs.value,
        password: newPassword.value,
      },
    });
    userForm.reset();
    await loadAdminData();
    adminMessage.textContent = "Utente creato.";
  } catch (error) {
    adminMessage.textContent = error.message || "Creazione non riuscita.";
  }
}

async function saveUser(node, user) {
  adminMessage.textContent = "";
  const password = node.querySelector('[data-user-field="password"]').value;
  const body = {
    visibleAs: node.querySelector('[data-user-field="visibleAs"]').value,
    password,
  };
  try {
    await api(`/api/admin/users/${encodeURIComponent(user.username)}`, { method: "PATCH", body });
    await loadAdminData();
    adminMessage.textContent = "Utente aggiornato.";
  } catch (error) {
    adminMessage.textContent = error.message || "Aggiornamento non riuscito.";
  }
}

async function deleteUser(user) {
  adminMessage.textContent = "";
  if (!window.confirm(`Eliminare ${user.displayName || user.username}?`)) return;
  try {
    await api(`/api/admin/users/${encodeURIComponent(user.username)}`, { method: "DELETE", body: {} });
    await loadAdminData();
    adminMessage.textContent = "Utente eliminato.";
  } catch (error) {
    adminMessage.textContent = error.message || "Eliminazione non riuscita.";
  }
}

function renderStatusFilter() {
  const selected = statusFilter.value;
  const options = new Map();
  for (const statuses of Object.values(statusesByProject)) {
    for (const status of statuses || []) options.set(status.id, status.name);
  }
  statusFilter.innerHTML = `<option value="">Tutti</option>${[...options].map(([id, name]) => `<option value="${escapeAttr(id)}">${escapeHtml(name)}</option>`).join("")}`;
  statusFilter.value = options.has(selected) ? selected : "";
}

function renderTasks() {
  if (currentPage !== "tasks") return;
  const query = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const priority = priorityFilter.value;
  const filtered = tasks.filter((task) => {
    const text = [task.name, task.projectName, task.owner, task.notes].join(" ").toLowerCase();
    return (!query || text.includes(query)) && (!status || task.statusId === status) && (!priority || task.priority === priority);
  });

  taskList.textContent = "";
  emptyState.hidden = filtered.length > 0;
  for (const task of filtered) taskList.append(renderTask(task));
}

function renderTask(task) {
  const node = taskTemplate.content.firstElementChild.cloneNode(true);
  const projectKey = `${task.workspaceId}/${task.projectId}`;
  const statuses = statusesByProject[projectKey] || [];
  node.dataset.id = task.id;
  node.querySelector(".project-name").textContent = task.projectName || task.projectId || "Progetto";
  node.querySelector("h2").textContent = task.name;
  node.querySelector(".owner").textContent = task.owner || "ND";
  node.querySelector(".due").textContent = task.dueDate ? formatDate(task.dueDate) : "No scad.";
  node.querySelector(".updated").textContent = task.updatedAt ? formatDate(task.updatedAt.slice(0, 10)) : "Non sinc.";
  node.querySelector(".new-pill").hidden = !task.isNew;

  const pill = node.querySelector(".priority-pill");
  pill.textContent = priorityLabels[task.priority] || "ND";
  pill.classList.add(task.priority || "none");

  const statusSelect = node.querySelector('[data-field="statusId"]');
  statusSelect.innerHTML = statuses.map((status) => `<option value="${escapeAttr(status.id)}">${escapeHtml(status.name)}</option>`).join("");
  statusSelect.value = task.statusId;
  node.querySelector('[data-field="priority"]').value = task.priority || "none";
  node.querySelector('[data-field="dueDate"]').value = task.dueDate || "";
  node.querySelector('[data-field="notes"]').value = task.notes || "";

  const subtasks = node.querySelector(".subtasks");
  subtasks.innerHTML = (task.subtasks || []).map((subtask) => `
    <label class="subtask-row ${subtask.editable === false ? "readonly" : ""}">
      <input type="checkbox" data-subtask="${escapeAttr(subtask.id)}" ${subtask.done ? "checked" : ""} ${subtask.editable === false ? "disabled" : ""} />
      <span>${escapeHtml(subtask.name || "Sotto-attività")}${subtask.owner ? ` · ${escapeHtml(subtask.owner)}` : ""}</span>
    </label>
  `).join("");
  if (!task.subtasks?.length) subtasks.hidden = true;

  node.querySelector('[data-action="save"]').addEventListener("click", () => saveTask(node, task));
  return node;
}

async function saveTask(node, task) {
  const saveButton = node.querySelector('[data-action="save"]');
  const saveState = node.querySelector(".save-state");
  saveButton.disabled = true;
  saveState.textContent = "Salvataggio...";
  const body = {
    statusId: node.querySelector('[data-field="statusId"]').value,
    priority: node.querySelector('[data-field="priority"]').value,
    dueDate: node.querySelector('[data-field="dueDate"]').value,
    notes: node.querySelector('[data-field="notes"]').value,
    subtasks: [...node.querySelectorAll("[data-subtask]:not(:disabled)")].map((input) => ({ id: input.dataset.subtask, done: input.checked })),
  };
  try {
    await api(`/api/tasks/${encodeURIComponent(task.id)}`, { method: "PATCH", body });
    saveState.textContent = "Salvata";
    await loadTasks();
  } catch (error) {
    saveState.textContent = error.message || "Errore";
  } finally {
    saveButton.disabled = false;
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.reason || data.error || "Errore richiesta.");
  return data;
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}
