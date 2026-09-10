// ==================================================================
// FILE GENERATO AUTOMATICAMENTE - NON MODIFICARE A MANO.
// Modifica i moduli in src/*.js e rigenera con: macos/bundle_app_js.sh
// ==================================================================
const STORAGE_KEY = "kanban-task-manager-v1";
const POUCH_DB_NAME = "gestore-attivita-kanban-local";
const POUCH_STATE_DOC_ID = "app-state";
const POUCH_META_DOC_ID = "kanban-meta";
const DOC_ID_SEPARATOR = "::";
const WORKSPACE_DOC_PREFIX = "workspace";
const PROJECT_DOC_PREFIX = "project";
const TASK_DOC_PREFIX = "task";
const DEFAULT_COUCH_HOST = "https://pstdb.pst.my";
const DEFAULT_COUCH_DATABASE = "gestore-attivita-kanban";
const DEFAULT_COUCH_REMOTE_URL = `${DEFAULT_COUCH_HOST}/${DEFAULT_COUCH_DATABASE}`;
const SYNC_AUTH_STORAGE_KEY = "kanban-task-manager-sync-auth-v1";

function today() {
  return new Date();
}
const seededProjects = Array.isArray(window.KANBAN_INITIAL_PROJECTS) ? structuredClone(window.KANBAN_INITIAL_PROJECTS) : [];

const initialData = {
  schemaVersion: 5,
  revision: 0,
  updatedAt: "",
  activeWorkspaceId: "workspace-default",
  activeProjectId: seededProjects[0]?.id || "",
  activeView: "board",
  route: seededProjects.length ? "project" : "projects",
  deadlineFilter: "all",
  ownerFilter: "",
  priorityFilter: "",
  emptyWorkspaceList: false,
  search: "",
  sync: {
    remoteEnabled: true,
    remoteUrl: DEFAULT_COUCH_REMOTE_URL,
    remoteStatus: "Non sincronizzato",
    remoteError: "",
    lastRemoteSyncAt: "",
    lastRemotePullAt: "",
    lastRemotePushAt: "",
    remoteFrequencyHours: 6,
  },
  ui: {
    sidebarFontScale: 88,
    contentFontScale: 88,
    sidebarWidth: 264,
    theme: "light",
    workspaceName: "default",
    accentColor: "#9365f4",
    attachmentEditorName: "",
    attachmentEditorPath: "",
    attachmentDirectoryName: "",
    attachmentDirectoryPath: "",
    autoArchiveDoneEnabled: false,
    autoArchiveDoneDelayDays: 7,
    remindersEnabled: false,
    remindersListName: "kanban",
    remindersLastSyncAt: "",
    remindersLastSyncStatus: "",
    remindersLastSyncError: "",
    autoBackupDirectoryName: "",
    autoBackupDirectoryPath: "",
    autoBackupDirectoryBookmark: "",
    autoBackupFrequencyHours: 6,
    lastAutoBackupAt: "",
    lastAutoBackupPath: "",
    lastAutoBackupError: "",
    lastAttachmentCheckAt: "",
    missingAttachmentCount: 0,
    missingAttachments: [],
    deadlinesCollapsed: false,
    ownersCollapsed: false,
    priorityCollapsed: false,
    archiveCollapsed: true,
    projectsCollapsed: false,
    configCollapsed: false,
    allDeadlinesTabOpen: false,
    calendarTabOpen: false,
    participants: [],
    tableSort: { key: "dueDate", direction: "asc" },
    openProjects: {},
    openProjectTabs: seededProjects[0] ? [seededProjects[0].id] : [],
    openOwnerTabs: [],
    openPriorityTabs: [],
  },
  projects: seededProjects,
  workspaces: [],
};

// NB: l'inizializzazione (state = loadState()) è in fondo al file, DOPO la definizione
// di PRIORITY_OPTIONS/VIEW_OPTIONS/STATUS_COLORS ed els, che loadState() usa indirettamente.
let state;
let draggedTaskId = null;
let suppressNextTaskClick = false;
let pointerDrag = null;
let columnDrag = null;
let pendingRestoreProjects = [];
let pendingRestoreWorkspaces = [];
let pendingRestoreKind = "";
let projectCreateOpen = false;
let pendingRenameProjectId = null;
let pendingProjectActionsId = "";
let workspaceCreateOpen = false;
let pendingRenameParticipant = "";
let workspaceRenameOpen = false;
let pendingRenameWorkspaceId = "";
let taskAttachmentDraft = [];
let pendingAttachmentTrash = "";
let taskAutosaveTimer = null;
let pendingUndo = null;
let undoToastTimer = null;
let activeConfigPanel = "";
let autoBackupTimer = null;
let autoBackupInFlight = false;
let suppressNextAutoBackup = false;
let pouchDb = null;
let pouchSaveTimer = null;
let pouchSaveInFlight = false;
let pouchPersistenceInitialized = false;
let pendingPouchStateText = "";
let pouchSaveWaiters = [];
let remoteDb = null;
let remoteSyncHandler = null;
let remoteSyncSignature = "";
let remoteSyncTimer = null;
let remoteAutoSyncTimer = null;
let remoteSyncInFlight = false;
let remoteSyncQueued = false;
let remoteApplyInFlight = false;
let remoteApplyTimer = null;
let pendingRemoteKanbanApply = false;
let pendingRemoteState = null;
let remoteSyncAuth = loadRemoteSyncAuth();
let remindersSyncTimer = null;
let remindersSyncInFlight = false;
let suppressNextReminderSync = false;
const REMOTE_SYNC_TIMEOUT_MS = 45000;
// Backoff esponenziale per evitare loop di retry su errori persistenti (credenziali errate, 502, offline).
const REMOTE_SYNC_BACKOFF_BASE_MS = 30 * 1000;
const REMOTE_SYNC_BACKOFF_MAX_MS = 30 * 60 * 1000;
const REMOTE_SYNC_MAX_FAILURES = 6;
let remoteSyncFailureCount = 0;
let remoteBackoffTimer = null;

const VIEW_OPTIONS = [
  { id: "board", label: "Board" },
  { id: "table", label: "List" },
  { id: "timeline", label: "Timeline" },
  { id: "dashboard", label: "Dashboard" },
];

const CONFIGURABLE_VIEW_OPTIONS = VIEW_OPTIONS.filter((view) => view.id !== "dashboard");

const PRIORITY_OPTIONS = [
  { id: "high", label: "Alto", className: "priority-high" },
  { id: "medium", label: "Medio", className: "priority-medium" },
  { id: "low", label: "Basso", className: "priority-low" },
  { id: "none", label: "ND", className: "priority-none" },
];

const STATUS_COLORS = [
  { name: "Verde", value: "#dfeec7", text: "#56833e" },
  { name: "Menta", value: "#cdebd9", text: "#418f66" },
  { name: "Lavanda", value: "#dcd8f6", text: "#6656dd" },
  { name: "Azzurro", value: "#d8ecfb", text: "#2677a8" },
  { name: "Giallo", value: "#f4e6b7", text: "#8c6a14" },
  { name: "Rosa", value: "#f4d7df", text: "#a13f59" },
  { name: "Grigio", value: "#e6e8ee", text: "#555a66" },
];

const els = {
  projectList: document.getElementById("projectList"),
  projectTabs: document.getElementById("projectTabs"),
  content: document.getElementById("content"),
  pageTitle: document.getElementById("pageTitle"),
  workspaceNamePill: document.getElementById("workspaceNamePill"),
  exportExcelBtn: document.getElementById("exportExcelBtn"),
  importExcelBtn: document.getElementById("importExcelBtn"),
  importExcelInput: document.getElementById("importExcelInput"),
  calendarToggle: document.getElementById("calendarToggle"),
  searchPanel: document.getElementById("searchPanel"),
  searchInput: document.getElementById("searchInput"),
  sidebarSearchPanel: document.getElementById("sidebarSearchPanel"),
  sidebarSearchInput: document.getElementById("sidebarSearchInput"),
  sidebarResizeHandle: document.getElementById("sidebarResizeHandle"),
  taskDialog: document.getElementById("taskDialog"),
  taskForm: document.getElementById("taskForm"),
  taskId: document.getElementById("taskId"),
  taskName: document.getElementById("taskName"),
  taskStart: document.getElementById("taskStart"),
  taskDue: document.getElementById("taskDue"),
  taskOwner: document.getElementById("taskOwner"),
  taskPriority: document.getElementById("taskPriority"),
  taskStatus: document.getElementById("taskStatus"),
  taskNotes: document.getElementById("taskNotes"),
  taskReminderEnabled: document.getElementById("taskReminderEnabled"),
  attachFileBtn: document.getElementById("attachFileBtn"),
  newAttachmentBtn: document.getElementById("newAttachmentBtn"),
  attachmentList: document.getElementById("attachmentList"),
  subtaskFields: document.getElementById("subtaskFields"),
  deleteTaskBtn: document.getElementById("deleteTaskBtn"),
  dialogTitle: document.getElementById("dialogTitle"),
  taskConflictBanner: document.getElementById("taskConflictBanner"),
  statusDialog: document.getElementById("statusDialog"),
  statusForm: document.getElementById("statusForm"),
  statusName: document.getElementById("statusName"),
  statusVisibilityList: document.getElementById("statusVisibilityList"),
  projectNoteDialog: document.getElementById("projectNoteDialog"),
  projectNoteForm: document.getElementById("projectNoteForm"),
  projectNoteId: document.getElementById("projectNoteId"),
  projectNoteText: document.getElementById("projectNoteText"),
  projectDeleteDialog: document.getElementById("projectDeleteDialog"),
  projectDeleteForm: document.getElementById("projectDeleteForm"),
  projectDeleteId: document.getElementById("projectDeleteId"),
  projectDeleteName: document.getElementById("projectDeleteName"),
  statusDeleteDialog: document.getElementById("statusDeleteDialog"),
  statusDeleteForm: document.getElementById("statusDeleteForm"),
  statusDeleteId: document.getElementById("statusDeleteId"),
  statusDeleteName: document.getElementById("statusDeleteName"),
  sidebarFontScale: document.getElementById("sidebarFontScale"),
  sidebarFontScaleValue: document.getElementById("sidebarFontScaleValue"),
  contentFontScale: document.getElementById("contentFontScale"),
  contentFontScaleValue: document.getElementById("contentFontScaleValue"),
  themeMode: document.getElementById("themeMode"),
  accentPalette: document.getElementById("accentPalette"),
  workspaceSelect: document.getElementById("workspaceSelect"),
  newWorkspaceBtn: document.getElementById("newWorkspaceBtn"),
  workspaceCreateSlot: document.getElementById("workspaceCreateSlot"),
  workspaceDock: document.getElementById("workspaceDock"),
  participantsList: document.getElementById("participantsList"),
  newParticipantBtn: document.getElementById("newParticipantBtn"),
  attachmentEditorName: document.getElementById("attachmentEditorName"),
  selectAttachmentEditorBtn: document.getElementById("selectAttachmentEditorBtn"),
  clearAttachmentEditorBtn: document.getElementById("clearAttachmentEditorBtn"),
  attachmentDirectoryName: document.getElementById("attachmentDirectoryName"),
  selectAttachmentDirectoryBtn: document.getElementById("selectAttachmentDirectoryBtn"),
  clearAttachmentDirectoryBtn: document.getElementById("clearAttachmentDirectoryBtn"),
  autoArchiveDoneEnabled: document.getElementById("autoArchiveDoneEnabled"),
  autoArchiveDoneDelay: document.getElementById("autoArchiveDoneDelay"),
  syncRemindersEnabled: document.getElementById("syncRemindersEnabled"),
  remindersListSelect: document.getElementById("remindersListSelect"),
  remindersListName: document.getElementById("remindersListName"),
  refreshRemindersListsBtn: document.getElementById("refreshRemindersListsBtn"),
  syncRemindersNowBtn: document.getElementById("syncRemindersNowBtn"),
  remindersSyncStatus: document.getElementById("remindersSyncStatus"),
  autoBackupDirectoryName: document.getElementById("autoBackupDirectoryName"),
  autoBackupFrequency: document.getElementById("autoBackupFrequency"),
  selectAutoBackupDirectoryBtn: document.getElementById("selectAutoBackupDirectoryBtn"),
  clearAutoBackupDirectoryBtn: document.getElementById("clearAutoBackupDirectoryBtn"),
  remoteSyncEnabled: document.getElementById("remoteSyncEnabled"),
  remoteCouchUrl: document.getElementById("remoteCouchUrl"),
  remoteCouchUser: document.getElementById("remoteCouchUser"),
  remoteCouchPassword: document.getElementById("remoteCouchPassword"),
  remoteSyncFrequency: document.getElementById("remoteSyncFrequency"),
  remoteSyncNowBtn: document.getElementById("remoteSyncNowBtn"),
  remoteSyncStatus: document.getElementById("remoteSyncStatus"),
  dataSafetyCenter: document.getElementById("dataSafetyCenter"),
  verifyAttachmentsBtn: document.getElementById("verifyAttachmentsBtn"),
  attachmentCheckResult: document.getElementById("attachmentCheckResult"),
  deadlineToggle: document.getElementById("deadlineToggle"),
  deadlineTitleBtn: document.getElementById("deadlineTitleBtn"),
  deadlineBody: document.getElementById("deadlineBody"),
  ownerToggle: document.getElementById("ownerToggle"),
  ownerTitleBtn: document.getElementById("ownerTitleBtn"),
  ownerBody: document.getElementById("ownerBody"),
  ownerList: document.getElementById("ownerList"),
  priorityToggle: document.getElementById("priorityToggle"),
  priorityTitleBtn: document.getElementById("priorityTitleBtn"),
  priorityBody: document.getElementById("priorityBody"),
  archiveToggle: document.getElementById("archiveToggle"),
  archiveChevron: document.getElementById("archiveChevron"),
  archiveBody: document.getElementById("archiveBody"),
  archiveList: document.getElementById("archiveList"),
  projectsToggle: document.getElementById("projectsToggle"),
  projectsTitleBtn: document.getElementById("projectsTitleBtn"),
  projectsBody: document.getElementById("projectsBody"),
  configDialog: document.getElementById("configDialog"),
  configToggle: document.getElementById("configToggle"),
  configBody: document.getElementById("configBody"),
  backupDialog: document.getElementById("backupDialog"),
  backupForm: document.getElementById("backupForm"),
  backupWorkspaceList: document.getElementById("backupWorkspaceList"),
  backupProjectList: document.getElementById("backupProjectList"),
  restoreDialog: document.getElementById("restoreDialog"),
  restoreForm: document.getElementById("restoreForm"),
  restoreProjectList: document.getElementById("restoreProjectList"),
  restoreFileSlot: document.getElementById("restoreFileSlot"),
  restoreFileInput: document.getElementById("restoreFileInput"),
  undoToast: document.getElementById("undoToast"),
};

// Inizializzazione dello stato: ora tutte le costanti (PRIORITY_OPTIONS, ecc.) ed els sono
// già definite, quindi loadState()/normalizeState non incappano in errori di TDZ.
state = loadState();

render();
bindEvents();
initializePouchPersistence();
// Salvataggio all'avvio SOLO se lo stato caricato contiene progetti: evita che un lancio
// con stato vuoto (es. archivio non ancora letto) sovrascriva e cancelli i dati esistenti.
// Se ci sono progetti, propaga lo stato anche al file nativo (persistenza indipendente dal percorso).
if (state.activeView === "grid") state.activeView = "timeline";
if (stateProjectCount(state) > 0 || state.emptyWorkspaceList) saveState();
// Salvataggio difensivo anche alla chiusura della finestra.
window.addEventListener("pagehide", () => {
  if (stateProjectCount(state) > 0 || state.emptyWorkspaceList) saveState();
});
function createTask(id, name, startDate, dueDate, owner, statusId, notes, subtasks, priority = "none", attachments = [], reminderEnabled = false) {
  return { id, name, startDate, dueDate, owner, statusId, notes, subtasks, priority, attachments: normalizeAttachments(attachments), reminderEnabled: Boolean(reminderEnabled), completedAt: "" };
}

function normalizeAttachments(attachments) {
  const seen = new Set();
  return (Array.isArray(attachments) ? attachments : [])
    .map((attachment) => {
      const path = String(attachment?.path || "").trim();
      const name = String(attachment?.name || path.split("/").filter(Boolean).at(-1) || "").trim();
      if (!name && !path) return null;
      const key = (path || name).toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        id: String(attachment?.id || crypto.randomUUID()),
        name: name || "Allegato",
        path,
        kind: String(attachment?.kind || fileKindFromName(name || path)),
        addedAt: String(attachment?.addedAt || new Date().toISOString()),
      };
    })
    .filter(Boolean);
}

function fileKindFromName(name) {
  const extension = String(name || "").split(".").pop()?.toLowerCase();
  if (extension === "md" || extension === "markdown") return "markdown";
  if (extension === "txt" || extension === "text") return "text";
  return "file";
}

function normalizeParticipants(participants) {
  const seen = new Set();
  return (Array.isArray(participants) ? participants : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function cleanIdBase(value, fallback = "item") {
  return (
    String(value || fallback)
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "") || fallback
  );
}

function uniqueNormalizedId(value, usedIds, fallback = "item") {
  const base = cleanIdBase(value, fallback);
  let id = base;
  let counter = 2;
  while (usedIds.has(id)) {
    id = `${base}-${counter}`;
    counter += 1;
  }
  usedIds.add(id);
  return id;
}

function normalizeProjectData(project) {
  const projectName = String(project?.name || "Senza titolo").trim() || "Senza titolo";
  const statuses = Array.isArray(project?.statuses) && project.statuses.length ? project.statuses : defaultStatuses();
  const usedStatusIds = new Set();
  const normalizedStatuses = statuses.map((status, index) => {
    const type = String(status?.type || status?.id || "custom");
    const id = uniqueNormalizedId(status?.id || type || status?.name, usedStatusIds, `status-${index + 1}`);
    return {
      id,
      name: String(status?.name || "Stato").trim() || "Stato",
      type,
      hidden: Boolean(status?.hidden),
      color: status?.color || "",
      textColor: status?.textColor || "",
    };
  });
  const statusIds = new Set(normalizedStatuses.map((status) => status.id));
  const fallbackStatus = normalizedStatuses[0]?.id || "todo";
  const usedTaskIds = new Set();

  return {
    id: String(project?.id || cleanIdBase(projectName, "progetto")),
    name: projectName,
    note: String(project?.note || ""),
    archived: Boolean(project?.archived),
    archivedAt: String(project?.archivedAt || ""),
    archiveKind: String(project?.archiveKind || ""),
    archiveSourceProjectId: String(project?.archiveSourceProjectId || ""),
    statuses: normalizedStatuses,
    enabledViews: {
      board: project?.enabledViews?.board !== false,
      table: project?.enabledViews?.table !== false,
      timeline: (project?.enabledViews?.timeline ?? project?.enabledViews?.grid) !== false,
      dashboard: project?.enabledViews?.dashboard !== false,
    },
    tasks: Array.isArray(project?.tasks)
      ? project.tasks.map((task) => normalizeTaskData(task, statusIds, fallbackStatus, usedTaskIds)).filter(Boolean)
      : [],
  };
}

function normalizeTaskData(task, statusIds, fallbackStatus, usedTaskIds = new Set()) {
  if (!task || typeof task !== "object") return null;
  const name = String(task.name || "Senza titolo").trim() || "Senza titolo";
  const id = uniqueNormalizedId(task.id || name || "attivita", usedTaskIds, "attivita");
  const usedSubtaskIds = new Set();

  return {
    id,
    name,
    startDate: String(task.startDate || ""),
    dueDate: String(task.dueDate || ""),
    owner: String(task.owner || ""),
    priority: priorityOption(task.priority, true).id,
    statusId: statusIds.has(task.statusId) ? task.statusId : fallbackStatus,
    reminderEnabled: Boolean(task.reminderEnabled),
    completedAt: String(task.completedAt || ""),
    archivedAt: String(task.archivedAt || ""),
    archivedFromProjectId: String(task.archivedFromProjectId || ""),
    notes: String(task.notes || ""),
    attachments: normalizeAttachments(task.attachments),
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks
          .map((subtask) => normalizeSubtaskData(subtask, usedSubtaskIds))
          .filter((subtask) => subtask.name)
      : [],
    ...(normalizeSyncConflict(task.syncConflict) ? { syncConflict: normalizeSyncConflict(task.syncConflict) } : {}),
  };
}

// Marcatore di conflitto di sincronizzazione: conserva i valori alternativi scartati
// dalla risoluzione automatica, così non vengono mai persi in silenzio.
function normalizeSyncConflict(value) {
  if (!value || typeof value !== "object") return null;
  const alternatives = (Array.isArray(value.alternatives) ? value.alternatives : [])
    .map((alt) => ({
      rev: String(alt?.rev || ""),
      updatedAt: String(alt?.updatedAt || ""),
      fields: Array.isArray(alt?.fields) ? alt.fields.map(String) : [],
      values: alt && typeof alt.values === "object" ? alt.values : {},
    }))
    .filter((alt) => alt.fields.length);
  if (!alternatives.length) return null;
  return { detectedAt: String(value.detectedAt || ""), alternatives };
}

function normalizeSubtaskData(subtask, usedSubtaskIds = new Set()) {
  if (!subtask || typeof subtask !== "object") return { id: uniqueNormalizedId("", usedSubtaskIds, "sotto-attivita"), name: "", done: false, dueDate: "", owner: "" };
  const name = String(subtask.name || "").trim();
  return {
    id: uniqueNormalizedId(subtask.id || name || "sotto-attivita", usedSubtaskIds, "sotto-attivita"),
    name,
    done: Boolean(subtask.done),
    dueDate: String(subtask.dueDate || ""),
    owner: String(subtask.owner || ""),
  };
}

function normalizeVisibleTo(value) {
  return normalizeParticipants(value);
}

function taskAccessList(task) {
  return normalizeVisibleTo([task?.owner, ...(Array.isArray(task?.subtasks) ? task.subtasks.map((subtask) => subtask.owner) : [])]);
}

function enrichTaskDocumentMetadata(task, workspaceId, projectId, now = "") {
  const groupId = String(task?.groupId || workspaceId || "").trim();
  const explicitVisibleTo = normalizeVisibleTo(task?.visibleTo);
  const visibleTo = explicitVisibleTo.length ? explicitVisibleTo : taskAccessList(task);
  return {
    ...task,
    workspaceId: String(task?.workspaceId || workspaceId || ""),
    projectId: String(task?.projectId || projectId || ""),
    owner: String(task?.owner || ""),
    groupId,
    visibleTo,
    updatedAt: String(task?.updatedAt || now || ""),
  };
}

function enrichWorkspaceDocumentMetadata(workspace, now = "") {
  const workspaceId = String(workspace?.id || "");
  return {
    ...workspace,
    projects: (Array.isArray(workspace?.projects) ? workspace.projects : []).map((project) => {
      const projectId = String(project?.id || "");
      return {
        ...project,
        workspaceId,
        updatedAt: String(project?.updatedAt || now || ""),
        tasks: (Array.isArray(project?.tasks) ? project.tasks : []).map((task) => enrichTaskDocumentMetadata(task, workspaceId, projectId, now)),
      };
    }),
  };
}

function taskOwnersFromProjects(projects) {
  return normalizeParticipants(
    (Array.isArray(projects) ? projects : []).flatMap((project) =>
      Array.isArray(project.tasks)
        ? project.tasks.flatMap((task) => [task.owner, ...(Array.isArray(task.subtasks) ? task.subtasks.map((subtask) => subtask.owner) : [])])
        : [],
    ),
  );
}

function priorityOption(priority, includeNone = true) {
  const value = String(priority || "none").trim().toLowerCase();
  return PRIORITY_OPTIONS.find((item) => item.id === value && (includeNone || item.id !== "none")) || (includeNone ? PRIORITY_OPTIONS.find((item) => item.id === "none") : null);
}

function normalizePriorityTabs(tabs) {
  return (Array.isArray(tabs) ? tabs : []).map((tab) => priorityOption(tab, false)?.id).filter(Boolean);
}

function normalizeAutoBackupFrequency(value) {
  const hours = Number(value);
  return [1, 3, 6, 12, 24].includes(hours) ? hours : 6;
}

function normalizeAutoArchiveDoneDelay(value) {
  const days = Number(value);
  return [1, 3, 7, 30].includes(days) ? days : 7;
}

function normalizeRemoteSyncFrequency(value) {
  const hours = Number(value);
  return [1, 3, 6, 12].includes(hours) ? hours : 6;
}

function normalizeRemoteCouchUrl(value) {
  let raw = String(value || "").trim();
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const url = new URL(raw);
    if (!url.pathname || url.pathname === "/") url.pathname = `/${DEFAULT_COUCH_DATABASE}`;
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

function normalizeSyncSettings(sync = {}) {
  const hasRemoteUrl = Object.prototype.hasOwnProperty.call(sync || {}, "remoteUrl");
  return {
    remoteEnabled: sync?.remoteEnabled !== false,
    remoteUrl: normalizeRemoteCouchUrl(hasRemoteUrl ? sync.remoteUrl : DEFAULT_COUCH_REMOTE_URL),
    remoteStatus: String(sync?.remoteStatus || "Non sincronizzato"),
    remoteError: String(sync?.remoteError || ""),
    lastRemoteSyncAt: String(sync?.lastRemoteSyncAt || ""),
    lastRemotePullAt: String(sync?.lastRemotePullAt || ""),
    lastRemotePushAt: String(sync?.lastRemotePushAt || ""),
    remoteFrequencyHours: normalizeRemoteSyncFrequency(sync?.remoteFrequencyHours),
  };
}

function activeProjects() {
  return (Array.isArray(state?.projects) ? state.projects : []).filter((project) => !project.archived);
}

function archivedProjects() {
  return (Array.isArray(state?.projects) ? state.projects : []).filter((project) => project.archived);
}

function isDoneStatus(project, statusId) {
  return project?.statuses?.find((status) => status.id === statusId)?.type === "done";
}

function updateTaskCompletionMetadata(now = new Date().toISOString()) {
  for (const project of state.projects || []) {
    for (const task of project.tasks || []) {
      if (isDoneStatus(project, task.statusId)) {
        task.completedAt = String(task.completedAt || now);
      } else {
        task.completedAt = "";
      }
    }
  }
}

function doneArchiveProjectId(projectId) {
  return `archivio-attivita-${String(projectId || "progetto")}`;
}

function doneArchiveProjectName(project) {
  return `${project.name} - Attività concluse`;
}

function findOrCreateDoneArchiveProject(sourceProject, now = new Date().toISOString()) {
  const archiveId = doneArchiveProjectId(sourceProject.id);
  let archiveProject = state.projects.find((project) => project.id === archiveId || project.archiveSourceProjectId === sourceProject.id);
  if (!archiveProject) {
    archiveProject = normalizeProjectData({
      id: archiveId,
      name: doneArchiveProjectName(sourceProject),
      note: `Archivio automatico attività concluse di ${sourceProject.name}`,
      archived: true,
      archivedAt: now,
      archiveKind: "done-tasks",
      archiveSourceProjectId: sourceProject.id,
      statuses: structuredClone(sourceProject.statuses || defaultStatuses()),
      enabledViews: structuredClone(sourceProject.enabledViews || { board: true, table: true, timeline: true, dashboard: true }),
      tasks: [],
    });
    archiveProject.archiveKind = "done-tasks";
    archiveProject.archiveSourceProjectId = sourceProject.id;
    state.projects.push(archiveProject);
  }
  archiveProject.archived = true;
  archiveProject.archivedAt = String(archiveProject.archivedAt || now);
  archiveProject.archiveKind = "done-tasks";
  archiveProject.archiveSourceProjectId = sourceProject.id;
  archiveProject.name = doneArchiveProjectName(sourceProject);
  archiveProject.statuses = structuredClone(sourceProject.statuses || archiveProject.statuses || defaultStatuses());
  return archiveProject;
}

function archiveCompletedTasksIfNeeded(now = new Date().toISOString()) {
  if (!state.ui?.autoArchiveDoneEnabled) return;
  const delayMs = normalizeAutoArchiveDoneDelay(state.ui.autoArchiveDoneDelayDays) * 24 * 60 * 60 * 1000;
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) return;
  for (const project of [...(state.projects || [])]) {
    if (project.archived || project.archiveKind === "done-tasks") continue;
    const dueTasks = [];
    project.tasks = (project.tasks || []).filter((task) => {
      if (!isDoneStatus(project, task.statusId)) return true;
      const completedMs = Date.parse(task.completedAt || "");
      if (!Number.isFinite(completedMs) || nowMs - completedMs < delayMs) return true;
      dueTasks.push(task);
      return false;
    });
    if (!dueTasks.length) continue;
    const archiveProject = findOrCreateDoneArchiveProject(project, now);
    const existingTaskIds = new Set((archiveProject.tasks || []).map((task) => task.id));
    for (const task of dueTasks) {
      const archivedTask = {
        ...structuredClone(task),
        archivedAt: now,
        archivedFromProjectId: project.id,
      };
      if (existingTaskIds.has(archivedTask.id)) archivedTask.id = `${archivedTask.id}-archiviata-${crypto.randomUUID().slice(0, 8)}`;
      archiveProject.tasks.push(archivedTask);
      existingTaskIds.add(archivedTask.id);
    }
  }
}

function decodeNativeSyncAuth() {
  const encoded = window.KANBAN_SYNC_AUTH_BASE64;
  if (!encoded) return null;
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return safeParseState(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function loadRemoteSyncAuth() {
  // Nell'app nativa le credenziali vivono nel Keychain di macOS (iniettate all'avvio),
  // non nel localStorage in chiaro. In un browser puro si usa il localStorage come fallback.
  const native = decodeNativeSyncAuth();
  if (native) {
    return { username: String(native.username || ""), password: String(native.password || "") };
  }
  try {
    const parsed = safeParseState(localStorage.getItem(SYNC_AUTH_STORAGE_KEY));
    return {
      username: String(parsed?.username || ""),
      password: String(parsed?.password || ""),
    };
  } catch {
    return { username: "", password: "" };
  }
}

function saveRemoteSyncAuth() {
  const payload = JSON.stringify({
    username: String(remoteSyncAuth?.username || ""),
    password: String(remoteSyncAuth?.password || ""),
  });
  if (window.webkit?.messageHandlers?.saveSyncAuth) {
    try {
      window.webkit.messageHandlers.saveSyncAuth.postMessage(payload);
      // Con il Keychain disponibile non lasciamo mai le credenziali in chiaro nel localStorage.
      try {
        localStorage.removeItem(SYNC_AUTH_STORAGE_KEY);
      } catch {
        // ignore
      }
      return;
    } catch (error) {
      console.error("Salvataggio credenziali nel Keychain non riuscito", error);
    }
  }
  try {
    localStorage.setItem(SYNC_AUTH_STORAGE_KEY, payload);
  } catch (error) {
    console.error("Salvataggio credenziali replica non riuscito", error);
  }
}

function remotePouchOptions() {
  const username = String(remoteSyncAuth?.username || "").trim();
  const password = String(remoteSyncAuth?.password || "");
  return {
    skip_setup: true,
    ...(username || password ? { auth: { username, password } } : {}),
  };
}

function priorityBadge(priority) {
  const option = priorityOption(priority, true);
  if (!option || option.id === "none") return "";
  return `<span class="priority-badge ${option.className}">${option.label}</span>`;
}

function ownerBadge(owner) {
  const cleanOwner = String(owner || "").trim();
  if (!cleanOwner) return "";
  return `<span class="owner-badge">${escapeHtml(cleanOwner)}</span>`;
}

function overdueBadge() {
  return `<span class="overdue-badge">Scaduta</span>`;
}

function defaultStatuses() {
  return [
    { id: "todo", name: "To Do", type: "to-do", color: "#f8d7da", textColor: "#a83246" },
    { id: "doing", name: "Doing", type: "doing", color: "#d8ecfb", textColor: "#2677a8" },
    { id: "done", name: "Done", type: "done", color: "#dfeec7", textColor: "#56833e" },
  ];
}

function standardStatusColor(status) {
  return {
    "to-do": { color: "#f8d7da", textColor: "#a83246" },
    doing: { color: "#d8ecfb", textColor: "#2677a8" },
    done: { color: "#dfeec7", textColor: "#56833e" },
  }[status.type || status.id];
}

function sampleWorkspaceProject() {
  return {
    id: `progetto-prova-${crypto.randomUUID().slice(0, 8)}`,
    name: "Progetto prova",
    statuses: defaultStatuses(),
    enabledViews: { board: true, table: true, timeline: true, dashboard: true },
    tasks: [createTask(`prova-${crypto.randomUUID().slice(0, 8)}`, "Prova", "", "", "", "todo", "", [])],
  };
}

function workspaceUiSnapshot(ui = state.ui) {
  return {
    sidebarFontScale: ui.sidebarFontScale,
    contentFontScale: ui.contentFontScale,
    sidebarWidth: ui.sidebarWidth,
    theme: ui.theme,
    workspaceName: ui.workspaceName || "default",
    accentColor: ui.accentColor,
    attachmentEditorName: ui.attachmentEditorName || "",
    attachmentEditorPath: ui.attachmentEditorPath || "",
    attachmentDirectoryName: ui.attachmentDirectoryName || "",
    attachmentDirectoryPath: ui.attachmentDirectoryPath || "",
    autoArchiveDoneEnabled: Boolean(ui.autoArchiveDoneEnabled),
    autoArchiveDoneDelayDays: normalizeAutoArchiveDoneDelay(ui.autoArchiveDoneDelayDays),
    remindersEnabled: Boolean(ui.remindersEnabled),
    remindersListName: String(ui.remindersListName || "kanban").trim() || "kanban",
    remindersLastSyncAt: ui.remindersLastSyncAt || "",
    remindersLastSyncStatus: ui.remindersLastSyncStatus || "",
    remindersLastSyncError: ui.remindersLastSyncError || "",
    autoBackupDirectoryName: ui.autoBackupDirectoryName || "",
    autoBackupDirectoryPath: ui.autoBackupDirectoryPath || "",
    autoBackupDirectoryBookmark: ui.autoBackupDirectoryBookmark || "",
    autoBackupFrequencyHours: normalizeAutoBackupFrequency(ui.autoBackupFrequencyHours),
    lastAutoBackupAt: ui.lastAutoBackupAt || "",
    lastAutoBackupPath: ui.lastAutoBackupPath || "",
    lastAutoBackupError: ui.lastAutoBackupError || "",
    lastAttachmentCheckAt: ui.lastAttachmentCheckAt || "",
    missingAttachmentCount: Number(ui.missingAttachmentCount) || 0,
    missingAttachments: Array.isArray(ui.missingAttachments) ? ui.missingAttachments : [],
    deadlinesCollapsed: Boolean(ui.deadlinesCollapsed),
    ownersCollapsed: Boolean(ui.ownersCollapsed),
    priorityCollapsed: Boolean(ui.priorityCollapsed),
    projectsCollapsed: Boolean(ui.projectsCollapsed),
    archiveCollapsed: ui.archiveCollapsed === undefined ? true : Boolean(ui.archiveCollapsed),
    configCollapsed: Boolean(ui.configCollapsed),
    participants: normalizeParticipants(ui.participants || []),
    tableSort: ui.tableSort || { key: "dueDate", direction: "asc" },
    tableColumnWidths: ui.tableColumnWidths || {},
    openProjects: ui.openProjects || {},
    openProjectTabs: ui.openProjectTabs || [],
    openOwnerTabs: ui.openOwnerTabs || [],
    openPriorityTabs: ui.openPriorityTabs || [],
    allDeadlinesTabOpen: Boolean(ui.allDeadlinesTabOpen),
    calendarTabOpen: Boolean(ui.calendarTabOpen),
  };
}

function normalizeWorkspace(workspace) {
  const name = String(workspace?.name || workspace?.ui?.workspaceName || "default").trim() || "default";
  const usedProjectIds = new Set();
  const projects = (Array.isArray(workspace?.projects) ? workspace.projects : []).map((project) => {
    const normalizedProject = normalizeProjectData(project);
    normalizedProject.id = uniqueNormalizedId(normalizedProject.id || normalizedProject.name, usedProjectIds, "progetto");
    return normalizedProject;
  });
  const ui = { ...workspaceUiSnapshot({ ...initialData.ui, ...(workspace?.ui || {}), workspaceName: name }) };
  ui.participants = normalizeParticipants([...ui.participants, ...taskOwnersFromProjects(projects)]);
  return enrichWorkspaceDocumentMetadata({
    id: String(workspace?.id || cleanIdBase(name || "workspace", "workspace")),
    name,
    ui,
    projects,
  });
}

function safeParseState(text) {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function kanbanDocId(prefix, ...parts) {
  return [prefix, ...parts.map((part) => encodeURIComponent(String(part || "")))].join(DOC_ID_SEPARATOR);
}

function isKanbanDataDocId(id) {
  return (
    id === POUCH_META_DOC_ID ||
    String(id || "").startsWith(`${WORKSPACE_DOC_PREFIX}${DOC_ID_SEPARATOR}`) ||
    String(id || "").startsWith(`${PROJECT_DOC_PREFIX}${DOC_ID_SEPARATOR}`) ||
    String(id || "").startsWith(`${TASK_DOC_PREFIX}${DOC_ID_SEPARATOR}`)
  );
}

// Tipi di documento che il desktop deve replicare. Esclude esplicitamente i documenti
// "kanban-portal-user" (che contengono credenziali dei responsabili) e qualunque altro
// documento applicativo del portale, così non finiscono mai nel PouchDB locale dei Mac.
const SYNC_DOC_TYPES = ["kanban-meta", "kanban-workspace", "kanban-project", "kanban-task"];

function remoteReplicationFilter() {
  return {
    selector: {
      $or: [{ type: { $in: SYNC_DOC_TYPES } }, { _id: POUCH_STATE_DOC_ID }],
    },
  };
}

function stateToKanbanDocs(sourceState) {
  const snapshot = normalizeState(structuredClone(sourceState || initialData));
  const updatedAt = String(snapshot.updatedAt || new Date().toISOString());
  const docs = [
    {
      _id: POUCH_META_DOC_ID,
      type: "kanban-meta",
      schemaVersion: snapshot.schemaVersion || initialData.schemaVersion,
      revision: stateRevisionValue(snapshot),
      updatedAt,
      activeWorkspaceId: String(snapshot.activeWorkspaceId || ""),
      activeProjectId: String(snapshot.activeProjectId || ""),
      activeView: String(snapshot.activeView || "board"),
      route: String(snapshot.route || "projects"),
      deadlineFilter: String(snapshot.deadlineFilter || "all"),
      ownerFilter: String(snapshot.ownerFilter || ""),
      priorityFilter: String(snapshot.priorityFilter || ""),
      emptyWorkspaceList: Boolean(snapshot.emptyWorkspaceList),
      search: String(snapshot.search || ""),
      sync: normalizeSyncSettings(snapshot.sync),
    },
  ];

  for (const workspace of snapshot.workspaces || []) {
    const workspaceId = String(workspace.id || "");
    docs.push({
      _id: kanbanDocId(WORKSPACE_DOC_PREFIX, workspaceId),
      type: "kanban-workspace",
      workspaceId,
      name: String(workspace.name || "default"),
      ui: workspaceUiSnapshot(workspace.ui || {}),
      updatedAt,
    });

    for (const project of workspace.projects || []) {
      const projectId = String(project.id || "");
      docs.push({
        _id: kanbanDocId(PROJECT_DOC_PREFIX, workspaceId, projectId),
        type: "kanban-project",
        workspaceId,
        projectId,
        name: String(project.name || "Senza titolo"),
        note: String(project.note || ""),
        archived: Boolean(project.archived),
        archivedAt: String(project.archivedAt || ""),
        archiveKind: String(project.archiveKind || ""),
        archiveSourceProjectId: String(project.archiveSourceProjectId || ""),
        statuses: structuredClone(project.statuses || defaultStatuses()),
        enabledViews: structuredClone(project.enabledViews || {}),
        updatedAt: String(project.updatedAt || updatedAt),
      });

      for (const task of project.tasks || []) {
        const taskDoc = enrichTaskDocumentMetadata(task, workspaceId, projectId, updatedAt);
        docs.push({
          ...structuredClone(taskDoc),
          _id: kanbanDocId(TASK_DOC_PREFIX, workspaceId, projectId, taskDoc.id),
          type: "kanban-task",
          taskId: String(taskDoc.id || ""),
        });
      }
    }
  }
  return docs;
}

function kanbanDocsToState(docs) {
  const cleanDocs = (Array.isArray(docs) ? docs : []).filter((doc) => doc && !doc._deleted);
  const meta = cleanDocs.find((doc) => doc._id === POUCH_META_DOC_ID || doc.type === "kanban-meta");
  if (!meta) return null;

  const workspaces = cleanDocs
    .filter((doc) => doc.type === "kanban-workspace")
    .map((workspaceDoc) => {
      const workspaceId = String(workspaceDoc.workspaceId || workspaceDoc.id || "");
      const projects = cleanDocs
        .filter((doc) => doc.type === "kanban-project" && String(doc.workspaceId || "") === workspaceId)
        .map((projectDoc) => {
          const projectId = String(projectDoc.projectId || projectDoc.id || "");
          const tasks = cleanDocs
            .filter((doc) => doc.type === "kanban-task" && String(doc.workspaceId || "") === workspaceId && String(doc.projectId || "") === projectId)
            .map((taskDoc) => {
              const { _id, _rev, type, taskId, ...task } = structuredClone(taskDoc);
              return { ...task, id: String(task.id || taskId || "") };
            });
          return {
            id: projectId,
            name: String(projectDoc.name || "Senza titolo"),
            note: String(projectDoc.note || ""),
            archived: Boolean(projectDoc.archived),
            archivedAt: String(projectDoc.archivedAt || ""),
            archiveKind: String(projectDoc.archiveKind || ""),
            archiveSourceProjectId: String(projectDoc.archiveSourceProjectId || ""),
            statuses: structuredClone(projectDoc.statuses || defaultStatuses()),
            enabledViews: structuredClone(projectDoc.enabledViews || {}),
            updatedAt: String(projectDoc.updatedAt || ""),
            tasks,
          };
        });
      return {
        id: workspaceId,
        name: String(workspaceDoc.name || workspaceDoc.ui?.workspaceName || "default"),
        ui: structuredClone(workspaceDoc.ui || {}),
        projects,
      };
    });

  return normalizeState({
    ...structuredClone(initialData),
    schemaVersion: Number(meta.schemaVersion) || initialData.schemaVersion,
    revision: stateRevisionValue(meta),
    updatedAt: String(meta.updatedAt || ""),
    activeWorkspaceId: String(meta.activeWorkspaceId || workspaces[0]?.id || ""),
    activeProjectId: String(meta.activeProjectId || ""),
    activeView: String(meta.activeView || "board"),
    route: String(meta.route || "projects"),
    deadlineFilter: String(meta.deadlineFilter || "all"),
    ownerFilter: String(meta.ownerFilter || ""),
    priorityFilter: String(meta.priorityFilter || ""),
    emptyWorkspaceList: Boolean(meta.emptyWorkspaceList),
    search: String(meta.search || ""),
    sync: normalizeSyncSettings(meta.sync),
    workspaces,
  });
}

async function readKanbanDocsState(db) {
  const result = await db.allDocs({ include_docs: true });
  const docs = result.rows.map((row) => row.doc).filter(Boolean);
  return kanbanDocsToState(docs);
}

function comparableKanbanDoc(doc) {
  const copy = structuredClone(doc || {});
  delete copy._rev;
  delete copy._conflicts;
  return JSON.stringify(copy);
}

function compareKanbanDocFreshness(a, b) {
  const updatedDiff = stateUpdatedAtValue(a) - stateUpdatedAtValue(b);
  if (updatedDiff) return updatedDiff;
  const revisionDiff = stateRevisionValue(a) - stateRevisionValue(b);
  if (revisionDiff) return revisionDiff;
  return String(a?._rev || "").localeCompare(String(b?._rev || ""));
}

// Campi di una task che, se differiscono fra revisioni in conflitto, rappresentano una
// modifica potenzialmente concorrente (es. responsabile dal portale + desktop).
const TASK_CONFLICT_FIELDS = ["name", "owner", "statusId", "priority", "startDate", "dueDate", "notes", "subtasks"];

function describeTaskConflictFields(winner, loser) {
  const fields = [];
  for (const field of TASK_CONFLICT_FIELDS) {
    if (JSON.stringify(loser?.[field] ?? null) !== JSON.stringify(winner?.[field] ?? null)) fields.push(field);
  }
  return fields;
}

// Costruisce il documento vincente preservando, in `syncConflict`, i valori delle revisioni
// perdenti che differiscono: nessun dato viene scartato in silenzio e l'utente viene avvisato.
function annotateTaskConflict(winner, losers) {
  const alternatives = [];
  for (const loser of losers) {
    const fields = describeTaskConflictFields(winner, loser);
    if (!fields.length) continue;
    alternatives.push({
      rev: String(loser._rev || ""),
      updatedAt: String(loser.updatedAt || ""),
      fields,
      values: Object.fromEntries(fields.map((field) => [field, structuredClone(loser[field] ?? null)])),
    });
  }
  if (!alternatives.length) return null;
  const previous = normalizeSyncConflict(winner.syncConflict)?.alternatives || [];
  const merged = structuredClone(winner);
  merged.syncConflict = {
    detectedAt: new Date().toISOString(),
    alternatives: [...previous, ...alternatives].slice(-10),
  };
  return merged;
}

async function resolveKanbanDocConflicts(db) {
  if (!db) return false;
  const result = await db.allDocs({ include_docs: true, conflicts: true });
  let resolvedAny = false;
  for (const row of result.rows || []) {
    const current = row.doc;
    if (!current || !isKanbanDataDocId(current._id) || !Array.isArray(current._conflicts) || !current._conflicts.length) continue;
    const conflicts = (
      await Promise.all(
        current._conflicts.map((rev) =>
          db.get(current._id, { rev }).catch((error) => {
            if (error?.status === 404) return null;
            throw error;
          }),
        ),
      )
    ).filter(Boolean);
    const candidates = [current, ...conflicts];
    const winner = candidates.reduce((best, doc) => (compareKanbanDocFreshness(doc, best) > 0 ? doc : best), current);
    const losers = conflicts.filter((doc) => doc._rev !== winner._rev);

    // Per i task preserviamo i valori concorrenti scartati; per gli altri documenti
    // (workspace/progetto/meta) resta la scelta della revisione più recente.
    let winningDoc = structuredClone(winner);
    delete winningDoc._conflicts;
    if (winner.type === "kanban-task") {
      const annotated = annotateTaskConflict(winningDoc, losers);
      if (annotated) winningDoc = annotated;
    }
    const changed = current._rev !== winner._rev || winningDoc.syncConflict;
    if (changed) {
      await db.put({ ...winningDoc, _id: current._id, _rev: current._rev });
    }
    for (const loser of losers) {
      await db.remove(loser._id, loser._rev);
    }
    resolvedAny = true;
  }
  return resolvedAny;
}

async function writeKanbanDocs(db, sourceState) {
  const docs = stateToKanbanDocs(sourceState);
  const nextIds = new Set(docs.map((doc) => doc._id));
  const existingRows = await db.allDocs({ include_docs: true });
  const existingById = new Map(existingRows.rows.filter((row) => row.doc).map((row) => [row.id, row.doc]));
  const docsWithRevs = docs
    .filter((doc) => {
      const existing = existingById.get(doc._id);
      return !existing || comparableKanbanDoc(existing) !== comparableKanbanDoc(doc);
    })
    .map((doc) => ({
      ...doc,
      ...(existingById.get(doc._id)?._rev ? { _rev: existingById.get(doc._id)._rev } : {}),
    }));
  const deletedDocs = existingRows.rows
    .filter((row) => row.doc && isKanbanDataDocId(row.id) && !nextIds.has(row.id))
    .map((row) => ({ _id: row.id, _rev: row.doc._rev, _deleted: true }));
  const changes = [...docsWithRevs, ...deletedDocs];
  if (!changes.length) return;
  const results = await db.bulkDocs(changes);
  const failed = results.find((result) => result?.error);
  if (failed) throw failed;
}

function stateProjectCount(obj) {
  if (!obj || typeof obj !== "object") return 0;
  let count = Array.isArray(obj.projects) ? obj.projects.length : 0;
  if (Array.isArray(obj.workspaces)) {
    for (const workspace of obj.workspaces) {
      if (Array.isArray(workspace?.projects)) count += workspace.projects.length;
    }
  }
  return count;
}

function stateUpdatedAtValue(obj) {
  const timestamp = Date.parse(String(obj?.updatedAt || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function stateRevisionValue(obj) {
  const revision = Number(obj?.revision);
  return Number.isFinite(revision) ? revision : 0;
}

function loadState() {
  // Considera sia il file nativo (indipendente dal percorso dell'app) sia il localStorage,
  // e sceglie la sorgente piu recente. Se entrambe sono vecchie e prive di metadati,
  // usa ancora il numero di progetti come fallback per non perdere archivi storici.
  const sources = [
    safeParseState(loadNativeStateText()),
    safeParseState(localStorage.getItem(STORAGE_KEY)),
  ].filter(Boolean);
  if (!sources.length) return normalizeState(structuredClone(initialData));
  sources.sort((a, b) => compareStateFreshness(b, a));
  return normalizeState(sources[0]);
}

function compareStateFreshness(a, b) {
  const updatedDiff = stateUpdatedAtValue(a) - stateUpdatedAtValue(b);
  if (updatedDiff) return updatedDiff;
  const revisionDiff = stateRevisionValue(a) - stateRevisionValue(b);
  if (revisionDiff) return revisionDiff;
  return stateProjectCount(a) - stateProjectCount(b);
}

function loadNativeStateText() {
  const encoded = window.KANBAN_NATIVE_STATE_BASE64;
  if (!encoded) return "";
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function normalizeState(nextState) {
  nextState.schemaVersion = Number(nextState.schemaVersion) || initialData.schemaVersion;
  nextState.revision = stateRevisionValue(nextState);
  nextState.updatedAt = String(nextState.updatedAt || "");
  nextState.route = nextState.route || "project";
  nextState.ownerFilter = String(nextState.ownerFilter || "");
  nextState.priorityFilter = String(nextState.priorityFilter || "");
  nextState.sync = normalizeSyncSettings(nextState.sync);
  nextState.projects = Array.isArray(nextState.projects) ? nextState.projects : [];
  if (!nextState.projects.some((project) => project.id === nextState.activeProjectId)) {
    nextState.activeProjectId = nextState.projects.find((project) => !project.archived)?.id || nextState.projects[0]?.id || "";
  }
  if (!nextState.projects.length) {
    nextState.route = "projects";
  }
  nextState.ui = {
    ...structuredClone(initialData.ui),
    ...(nextState.ui || {}),
    openProjects: {
      ...structuredClone(initialData.ui.openProjects),
      ...(nextState.ui?.openProjects || {}),
    },
    openProjectTabs: nextState.ui?.openProjectTabs?.length ? nextState.ui.openProjectTabs : [],
    openOwnerTabs: Array.isArray(nextState.ui?.openOwnerTabs) ? nextState.ui.openOwnerTabs : [],
    openPriorityTabs: Array.isArray(nextState.ui?.openPriorityTabs) ? nextState.ui.openPriorityTabs : [],
  };

  nextState.emptyWorkspaceList = Boolean(nextState.emptyWorkspaceList);

  if ((!Array.isArray(nextState.workspaces) || !nextState.workspaces.length) && !nextState.emptyWorkspaceList) {
    nextState.workspaces = [
      normalizeWorkspace({
        id: nextState.activeWorkspaceId || "workspace-default",
        name: nextState.ui.workspaceName || "default",
        ui: nextState.ui,
        projects: nextState.projects,
      }),
    ];
  } else {
    nextState.workspaces = Array.isArray(nextState.workspaces) ? nextState.workspaces.map(normalizeWorkspace) : [];
  }

  if (!nextState.workspaces.length) {
    nextState.activeWorkspaceId = "";
    nextState.activeProjectId = "";
    nextState.route = "projects";
    nextState.projects = [];
    nextState.ui = { ...structuredClone(initialData.ui), workspaceName: "" };
    return nextState;
  }

  nextState.activeWorkspaceId = nextState.activeWorkspaceId || nextState.workspaces[0].id;
  const activeWorkspace = nextState.workspaces.find((workspace) => workspace.id === nextState.activeWorkspaceId) || nextState.workspaces[0];
  nextState.activeWorkspaceId = activeWorkspace.id;
  nextState.ui = {
    ...structuredClone(initialData.ui),
    ...activeWorkspace.ui,
    workspaceName: activeWorkspace.name,
  };
  nextState.projects = structuredClone(activeWorkspace.projects);
  if (!nextState.projects.some((project) => project.id === nextState.activeProjectId)) {
    nextState.activeProjectId = nextState.projects.find((project) => !project.archived)?.id || nextState.projects[0]?.id || "";
  }
  if (!nextState.projects.length) {
    nextState.route = "projects";
  }

  nextState.ui.openProjectTabs = nextState.ui.openProjectTabs.filter((projectId) => nextState.projects.some((project) => project.id === projectId));

  if (nextState.activeProjectId && nextState.route === "project" && !nextState.ui.openProjectTabs.includes(nextState.activeProjectId)) {
    nextState.ui.openProjectTabs.push(nextState.activeProjectId);
  }

  const legacyFontScale = Number(nextState.ui.fontScale) || initialData.ui.contentFontScale;
  nextState.ui.sidebarFontScale = Number(nextState.ui.sidebarFontScale) || legacyFontScale;
  nextState.ui.contentFontScale = Number(nextState.ui.contentFontScale) || legacyFontScale;
  // Migrazione: chi non ha mai ridimensionato (largo storico 318px) passa al nuovo default più snello.
  if (Number(nextState.ui.sidebarWidth) === 318) nextState.ui.sidebarWidth = initialData.ui.sidebarWidth;
  nextState.ui.sidebarWidth = clampSidebarWidth(nextState.ui.sidebarWidth);
  nextState.ui.theme = nextState.ui.theme === "dark" ? "dark" : "light";
  nextState.ui.workspaceName = String(nextState.ui.workspaceName || "default");
  nextState.ui.accentColor = /^#[0-9a-f]{6}$/i.test(nextState.ui.accentColor || "") ? nextState.ui.accentColor : initialData.ui.accentColor;
  nextState.ui.attachmentEditorName = String(nextState.ui.attachmentEditorName || "");
  nextState.ui.attachmentEditorPath = String(nextState.ui.attachmentEditorPath || "");
  nextState.ui.attachmentDirectoryName = String(nextState.ui.attachmentDirectoryName || "");
  nextState.ui.attachmentDirectoryPath = String(nextState.ui.attachmentDirectoryPath || "");
  nextState.ui.autoBackupDirectoryName = String(nextState.ui.autoBackupDirectoryName || "");
  nextState.ui.autoBackupDirectoryPath = String(nextState.ui.autoBackupDirectoryPath || "");
  nextState.ui.autoBackupDirectoryBookmark = String(nextState.ui.autoBackupDirectoryBookmark || "");
  nextState.ui.autoBackupFrequencyHours = normalizeAutoBackupFrequency(nextState.ui.autoBackupFrequencyHours);
  nextState.ui.lastAutoBackupAt = String(nextState.ui.lastAutoBackupAt || "");
  nextState.ui.lastAutoBackupPath = String(nextState.ui.lastAutoBackupPath || "");
  nextState.ui.lastAutoBackupError = String(nextState.ui.lastAutoBackupError || "");
  nextState.ui.lastAttachmentCheckAt = String(nextState.ui.lastAttachmentCheckAt || "");
  nextState.ui.missingAttachmentCount = Number(nextState.ui.missingAttachmentCount) || 0;
  nextState.ui.missingAttachments = Array.isArray(nextState.ui.missingAttachments) ? nextState.ui.missingAttachments : [];
  nextState.ui.participants = normalizeParticipants([...nextState.ui.participants, ...taskOwnersFromProjects(nextState.projects)]);
  nextState.ui.openOwnerTabs = normalizeParticipants(nextState.ui.openOwnerTabs).filter((owner) => nextState.ui.participants.includes(owner));
  nextState.ui.openPriorityTabs = normalizePriorityTabs(nextState.ui.openPriorityTabs);
  if (nextState.route === "owner" && !nextState.ui.participants.includes(nextState.ownerFilter)) {
    nextState.route = "projects";
    nextState.ownerFilter = "";
  }
  if (nextState.route === "priority" && !priorityOption(nextState.priorityFilter, false)) {
    nextState.route = "projects";
    nextState.priorityFilter = "";
  }
  if (nextState.route === "calendar") nextState.ui.calendarTabOpen = true;
  nextState.projects = nextState.projects.map(normalizeProjectData);
  nextState.projects.forEach((project) => {
    if (nextState.activeView === "grid") nextState.activeView = "timeline";
    project.statuses.forEach((status) => {
      status.hidden = Boolean(status.hidden);
      const standardColor = standardStatusColor(status);
      status.color = status.color || standardColor?.color || "";
      status.textColor = status.textColor || standardColor?.textColor || "";
    });
  });
  nextState.projects = enrichWorkspaceDocumentMetadata(
    {
      id: nextState.activeWorkspaceId,
      projects: nextState.projects,
    },
    nextState.updatedAt,
  ).projects;
  const activeWorkspaceIndex = nextState.workspaces.findIndex((workspace) => workspace.id === nextState.activeWorkspaceId);
  if (activeWorkspaceIndex >= 0) nextState.workspaces[activeWorkspaceIndex].projects = structuredClone(nextState.projects);
  return nextState;
}

let storageQuotaWarned = false;
function saveState() {
  const now = new Date().toISOString();
  updateTaskCompletionMetadata(now);
  archiveCompletedTasksIfNeeded(now);
  syncActiveWorkspace();
  state.schemaVersion = initialData.schemaVersion;
  state.sync = normalizeSyncSettings(state.sync);
  state.revision = stateRevisionValue(state) + 1;
  state.updatedAt = now;
  state.workspaces = (Array.isArray(state.workspaces) ? state.workspaces : []).map((workspace) => enrichWorkspaceDocumentMetadata(workspace, state.updatedAt));
  const activeWorkspace = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);
  if (activeWorkspace) state.projects = structuredClone(activeWorkspace.projects);
  const serialized = JSON.stringify(state);
  persistStateSnapshot(serialized);
  queuePouchStateSave(serialized);
  startRemoteReplication();
  if (typeof scheduleAutoBackup === "function") scheduleAutoBackup();
  if (typeof scheduleReminderSync === "function") scheduleReminderSync();
}

function persistStateSnapshot(serialized) {
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.error("Salvataggio su localStorage non riuscito", error);
    if (!storageQuotaWarned && (error?.name === "QuotaExceededError" || error?.code === 22)) {
      storageQuotaWarned = true;
      window.alert(
        "Spazio di archiviazione locale esaurito: alcune modifiche potrebbero non essere salvate.\nEsegui un backup dei progetti ed elimina i dati non necessari.",
      );
    }
  }
  saveNativeState(serialized);
}

function getPouchDb() {
  if (typeof PouchDB === "undefined") return null;
  if (!pouchDb) pouchDb = new PouchDB(POUCH_DB_NAME, { auto_compaction: true });
  return pouchDb;
}

function queuePouchStateSave(serialized) {
  if (!getPouchDb()) return;
  pendingPouchStateText = serialized;
  if (!pouchPersistenceInitialized) return;
  clearTimeout(pouchSaveTimer);
  pouchSaveTimer = setTimeout(flushPouchStateSave, 250);
}

function resolvePouchSaveWaiters() {
  const waiters = pouchSaveWaiters;
  pouchSaveWaiters = [];
  waiters.forEach((resolve) => resolve());
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function flushPouchStateSave() {
  const db = getPouchDb();
  if (!db) return;
  if (pouchSaveInFlight) {
    return new Promise((resolve) => pouchSaveWaiters.push(resolve));
  }
  if (!pendingPouchStateText) return;
  clearTimeout(pouchSaveTimer);
  pouchSaveInFlight = true;
  try {
    while (pendingPouchStateText) {
      const stateText = pendingPouchStateText;
      pendingPouchStateText = "";
      try {
        const parsed = safeParseState(stateText) || {};
        await writeKanbanDocs(db, parsed);
      } catch (error) {
        if (error?.status === 409) {
          pendingPouchStateText = stateText;
          await delay(300);
        } else {
          console.error("Salvataggio su PouchDB non riuscito", error);
        }
      }
    }
  } finally {
    pouchSaveInFlight = false;
    resolvePouchSaveWaiters();
    if (pendingPouchStateText) {
      clearTimeout(pouchSaveTimer);
      pouchSaveTimer = setTimeout(flushPouchStateSave, 250);
    }
  }
}

function remoteSyncUrl() {
  state.sync = normalizeSyncSettings(state.sync);
  return state.sync.remoteUrl;
}

function remoteSyncSignatureValue(url = remoteSyncUrl()) {
  return [url, String(remoteSyncAuth?.username || "").trim()].join("|");
}

function stopRemoteReplication(status = "Disattivata") {
  clearTimeout(remoteSyncTimer);
  clearTimeout(remoteAutoSyncTimer);
  clearTimeout(remoteBackoffTimer);
  clearTimeout(remoteApplyTimer);
  remoteSyncTimer = null;
  remoteAutoSyncTimer = null;
  remoteBackoffTimer = null;
  remoteApplyTimer = null;
  remoteSyncFailureCount = 0;
  remoteSyncQueued = false;
  pendingRemoteKanbanApply = false;
  pendingRemoteState = null;
  if (remoteSyncHandler?.cancel) remoteSyncHandler.cancel();
  remoteSyncHandler = null;
  remoteDb = null;
  remoteSyncSignature = "";
  markRemoteSyncStatus(status, "");
}

function startRemoteReplication({ force = false } = {}) {
  const db = getPouchDb();
  if (!db || !pouchPersistenceInitialized) return;
  state.sync = normalizeSyncSettings(state.sync);
  const url = remoteSyncUrl();
  if (!state.sync.remoteEnabled || !url) {
    stopRemoteReplication("Disattivata");
    return;
  }
  const signature = remoteSyncSignatureValue(url);
  if (!force && remoteSyncSignature === signature) return;
  if (remoteSyncHandler?.cancel) remoteSyncHandler.cancel();
  remoteSyncHandler = null;
  remoteDb = null;
  remoteSyncSignature = signature;
  // Cambio di configurazione/azione esplicita: azzera il backoff e riparti pulito.
  remoteSyncFailureCount = 0;
  clearTimeout(remoteBackoffTimer);
  remoteBackoffTimer = null;
  markRemoteSyncStatus("Replica remota pronta", "");
  scheduleRemoteAutoSync();
  if (force || !state.sync.lastRemoteSyncAt) queueRemoteSyncNow();
}

// Riprova ritardata con backoff esponenziale dopo un errore di sync, senza ripianificare
// l'auto-sync periodico (che ricreerebbe un ciclo stretto). Dopo troppi fallimenti consecutivi
// si ferma e lascia il rilancio all'utente.
function scheduleRemoteBackoffRetry() {
  clearTimeout(remoteBackoffTimer);
  remoteBackoffTimer = null;
  if (!state.sync?.remoteEnabled) return;
  if (remoteSyncFailureCount >= REMOTE_SYNC_MAX_FAILURES) {
    markRemoteSyncStatus(
      "Sync in pausa dopo troppi errori",
      state.sync?.remoteError || "Controlla rete e credenziali, poi premi «Sincronizza ora».",
    );
    return;
  }
  const delayMs = Math.min(
    REMOTE_SYNC_BACKOFF_BASE_MS * 2 ** Math.max(0, remoteSyncFailureCount - 1),
    REMOTE_SYNC_BACKOFF_MAX_MS,
  );
  remoteBackoffTimer = setTimeout(() => {
    remoteBackoffTimer = null;
    if (!state.sync?.remoteEnabled) return;
    queueRemoteSyncNow();
  }, delayMs);
}

// Rilancio manuale (pulsante / azione utente): azzera il backoff e sincronizza subito.
function triggerRemoteSyncNow() {
  remoteSyncFailureCount = 0;
  clearTimeout(remoteBackoffTimer);
  remoteBackoffTimer = null;
  queueRemoteSyncNow();
}

function scheduleRemoteAutoSync() {
  clearTimeout(remoteAutoSyncTimer);
  remoteAutoSyncTimer = null;
  state.sync = normalizeSyncSettings(state.sync);
  if (!state.sync.remoteEnabled || !state.sync.remoteUrl) return;
  const frequencyMs = normalizeRemoteSyncFrequency(state.sync.remoteFrequencyHours) * 60 * 60 * 1000;
  const lastSyncMs = Date.parse(state.sync.lastRemoteSyncAt || "");
  const elapsedMs = Number.isFinite(lastSyncMs) ? Date.now() - lastSyncMs : frequencyMs;
  const delayMs = Math.max(1000, frequencyMs - elapsedMs);
  remoteAutoSyncTimer = setTimeout(() => {
    remoteAutoSyncTimer = null;
    if (!state.sync.remoteEnabled) return;
    queueRemoteSyncNow();
    scheduleRemoteAutoSync();
  }, delayMs);
}

function queueRemoteSyncNow() {
  if (!state.sync?.remoteEnabled) return;
  if (remoteSyncInFlight) {
    remoteSyncQueued = true;
    return;
  }
  clearTimeout(remoteSyncTimer);
  remoteSyncTimer = setTimeout(runRemoteSyncNow, 80);
}

function queueRemoteKanbanApply() {
  pendingRemoteKanbanApply = true;
  scheduleRemoteApply();
}

function queueRemoteStateApply(remoteState) {
  if (!remoteState) return;
  if (pendingRemoteState && compareStateFreshness(remoteState, pendingRemoteState) <= 0) return;
  pendingRemoteState = remoteState;
  scheduleRemoteApply();
}

function scheduleRemoteApply(delayMs = 80) {
  clearTimeout(remoteApplyTimer);
  remoteApplyTimer = setTimeout(processQueuedRemoteApply, delayMs);
}

function remoteApplyBlockedByLocalWork() {
  return (
    remoteSyncInFlight ||
    pouchSaveInFlight ||
    Boolean(pendingPouchStateText) ||
    Boolean(taskAutosaveTimer) ||
    Boolean(els.taskDialog?.open)
  );
}

async function processQueuedRemoteApply() {
  clearTimeout(remoteApplyTimer);
  remoteApplyTimer = null;
  if (remoteApplyInFlight || (!pendingRemoteKanbanApply && !pendingRemoteState)) return;
  if (remoteApplyBlockedByLocalWork()) {
    scheduleRemoteApply(600);
    return;
  }

  remoteApplyInFlight = true;
  try {
    if (pendingRemoteKanbanApply) {
      pendingRemoteKanbanApply = false;
      await applyRemoteKanbanDocs();
    }
    if (pendingRemoteState) {
      const remoteState = pendingRemoteState;
      pendingRemoteState = null;
      applyRemoteState(remoteState, { queuePouch: true });
    }
  } finally {
    remoteApplyInFlight = false;
    if (pendingRemoteKanbanApply || pendingRemoteState) scheduleRemoteApply();
  }
}

function runPouchSync(db, remote) {
  return new Promise((resolve, reject) => {
    const sync = db
      .sync(remote, { include_docs: true, conflicts: true, retry: false, ...remoteReplicationFilter() })
      .on("change", handleRemoteSyncChange)
      .on("denied", reject)
      .on("error", reject)
      .on("complete", resolve);
    remoteSyncHandler = sync;
    const timer = setTimeout(() => {
      sync.cancel();
      reject(new Error(`Timeout replica dopo ${Math.round(REMOTE_SYNC_TIMEOUT_MS / 1000)} secondi`));
    }, REMOTE_SYNC_TIMEOUT_MS);
    sync.then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function runRemoteSyncNow() {
  if (remoteSyncInFlight) {
    remoteSyncQueued = true;
    return;
  }
  const db = getPouchDb();
  if (!db) return;
  state.sync = normalizeSyncSettings(state.sync);
  const url = remoteSyncUrl();
  if (!state.sync.remoteEnabled || !url) {
    stopRemoteReplication("Disattivata");
    return;
  }
  remoteSyncInFlight = true;
  if (remoteSyncHandler?.cancel) remoteSyncHandler.cancel();
  remoteSyncHandler = null;
  markRemoteSyncStatus("Sincronizzazione remota in corso", "");
  try {
    await flushPouchStateSave();
    const remote = new PouchDB(url, remotePouchOptions());
    remoteDb = remote;
    await runPouchSync(db, remote);
    const resolvedLocal = await resolveKanbanDocConflicts(db);
    const resolvedRemote = await resolveKanbanDocConflicts(remote);
    if (resolvedLocal || resolvedRemote) await runPouchSync(db, remote);
    if (resolvedLocal) queueRemoteKanbanApply();
    remoteSyncFailureCount = 0;
    clearTimeout(remoteBackoffTimer);
    remoteBackoffTimer = null;
    markRemoteSyncStatus("Sincronizzato", "");
    scheduleRemoteAutoSync();
  } catch (error) {
    remoteSyncFailureCount += 1;
    markRemoteSyncStatus("Errore replica remota", remoteSyncErrorMessage(error));
    // Niente auto-sync periodico qui: solo un singolo retry con backoff crescente.
    scheduleRemoteBackoffRetry();
  } finally {
    remoteSyncInFlight = false;
    await processQueuedRemoteApply();
    if (remoteSyncQueued) {
      remoteSyncQueued = false;
      queueRemoteSyncNow();
    }
  }
}

function handleRemoteSyncChange(change) {
  const now = new Date().toISOString();
  state.sync = normalizeSyncSettings(state.sync);
  state.sync.lastRemoteSyncAt = now;
  if (change?.direction === "pull") state.sync.lastRemotePullAt = now;
  if (change?.direction === "push") state.sync.lastRemotePushAt = now;
  state.sync.remoteStatus = change?.direction === "pull" ? "Dati ricevuti dal remoto" : "Dati inviati al remoto";
  state.sync.remoteError = "";

  const docs = change?.change?.docs || [];
  if (change?.direction === "pull") {
    if (docs.some((doc) => isKanbanDataDocId(doc?._id))) queueRemoteKanbanApply();
    docs.forEach(queueRemoteStateDocApply);
  }
  renderRemoteSyncStatus();
}

async function applyRemoteKanbanDocs() {
  const db = getPouchDb();
  if (!db) return false;
  try {
    const remoteState = await readKanbanDocsState(db);
    return applyRemoteState(remoteState);
  } catch (error) {
    console.error("Applicazione documenti remoti non riuscita", error);
    return false;
  }
}

function queueRemoteStateDocApply(doc) {
  if (!doc || doc._id !== POUCH_STATE_DOC_ID || !doc.stateText) return;
  const remoteState = safeParseState(doc.stateText);
  if (!remoteState || compareStateFreshness(remoteState, state) <= 0) return;
  queueRemoteStateApply(remoteState);
}

function applyRemoteState(remoteState, { queuePouch = false } = {}) {
  if (!remoteState || compareStateFreshness(remoteState, state) <= 0) return false;
  state = normalizeState(remoteState);
  pouchPersistenceInitialized = true;
  suppressNextAutoBackup = true;
  persistStateSnapshot(JSON.stringify(state));
  if (queuePouch) queuePouchStateSave(JSON.stringify(state));
  render();
  return true;
}

function markRemoteSyncStatus(status, error = "") {
  if (!state?.sync) return;
  state.sync = normalizeSyncSettings(state.sync);
  state.sync.remoteStatus = status;
  state.sync.remoteError = String(error || "");
  renderRemoteSyncStatus();
}

function renderRemoteSyncStatus() {
  if (typeof renderRemoteSyncConfig === "function") renderRemoteSyncConfig();
  if (typeof renderDataSafetyCenter === "function") renderDataSafetyCenter();
}

function remoteSyncErrorMessage(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  return String(error.message || error.reason || error.name || "Errore sconosciuto");
}

async function initializePouchPersistence() {
  const db = getPouchDb();
  if (!db) return;
  try {
    const docsState = await readKanbanDocsState(db);
    if (docsState && compareStateFreshness(docsState, state) > 0) {
      state = normalizeState(docsState);
      pouchPersistenceInitialized = true;
      suppressNextAutoBackup = true;
      persistStateSnapshot(JSON.stringify(state));
      render();
      startRemoteReplication();
      return;
    }
  } catch (error) {
    console.error("Lettura documenti PouchDB non riuscita", error);
  }

  try {
    const doc = await db.get(POUCH_STATE_DOC_ID);
    const legacyState = safeParseState(doc.stateText);
    if (legacyState && compareStateFreshness(legacyState, state) > 0) {
      state = normalizeState(legacyState);
      pouchPersistenceInitialized = true;
      suppressNextAutoBackup = true;
      saveState();
      render();
      startRemoteReplication();
      return;
    }
  } catch (error) {
    if (error?.status !== 404) console.error("Lettura stato legacy da PouchDB non riuscita", error);
  }
  pouchPersistenceInitialized = true;
  if (stateProjectCount(state) > 0 || state.emptyWorkspaceList) queuePouchStateSave(JSON.stringify(state));
  startRemoteReplication();
}

function saveNativeState(serialized) {
  if (!window.webkit?.messageHandlers?.saveAppState) return;
  try {
    window.webkit.messageHandlers.saveAppState.postMessage(serialized);
  } catch {
    // localStorage remains available as a fallback when native persistence is unavailable.
  }
}

function syncActiveWorkspace() {
  if (!Array.isArray(state.workspaces)) state.workspaces = [];
  if (!state.workspaces.length && state.emptyWorkspaceList) return;
  if (!state.activeWorkspaceId && !state.workspaces.length) return;
  const index = state.workspaces.findIndex((workspace) => workspace.id === state.activeWorkspaceId);
  const snapshot = normalizeWorkspace({
    id: state.activeWorkspaceId || "workspace-default",
    name: state.ui.workspaceName || "default",
    ui: workspaceUiSnapshot(),
    projects: structuredClone(state.projects),
  });
  if (index >= 0) state.workspaces.splice(index, 1, snapshot);
  else state.workspaces.push(snapshot);
}

function loadWorkspace(workspaceId, shouldSync = true) {
  if (shouldSync) syncActiveWorkspace();
  const workspace = state.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return;
  state.emptyWorkspaceList = false;
  state.activeWorkspaceId = workspace.id;
  state.ui = { ...structuredClone(initialData.ui), ...structuredClone(workspace.ui), workspaceName: workspace.name };
  state.projects = structuredClone(workspace.projects);
  state.activeProjectId = state.projects[0]?.id || "";
  state.route = "projects";
  state.activeView = projectEnabledViews(state.projects[0] || {})[0] || "board";
  workspaceRenameOpen = false;
  pendingRenameWorkspaceId = "";
  workspaceCreateOpen = false;
  pendingRenameParticipant = "";
  saveState();
  render();
}

function createWorkspaceFromName(name) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return;

  syncActiveWorkspace();
  state.emptyWorkspaceList = false;
  const workspaceName = uniqueWorkspaceName(cleanName);
  const workspace = normalizeWorkspace({
    id: uniqueWorkspaceId(slugify(workspaceName || "workspace")),
    name: workspaceName,
    ui: {
      ...structuredClone(initialData.ui),
      workspaceName,
      openProjects: {},
      openProjectTabs: [],
      tableColumnWidths: {},
    },
    projects: [sampleWorkspaceProject()],
  });

  state.workspaces.push(workspace);
  workspaceCreateOpen = false;
  pendingRenameWorkspaceId = "";
  loadWorkspace(workspace.id);
}

function renameWorkspace(workspaceId, name) {
  const targetId = String(workspaceId || state.activeWorkspaceId || "");
  if (!targetId) return;
  const cleanName = String(name || "").trim();
  if (!cleanName) {
    deleteWorkspace(targetId);
    return;
  }
  const existing = state.workspaces.find(
    (workspace) => workspace.id !== targetId && workspace.name.trim().toLowerCase() === cleanName.toLowerCase(),
  );
  if (existing) return;

  const workspace = state.workspaces.find((item) => item.id === targetId);
  if (workspace) {
    workspace.name = cleanName;
    workspace.ui = { ...workspace.ui, workspaceName: cleanName };
  }
  if (targetId === state.activeWorkspaceId) state.ui.workspaceName = cleanName;
  workspaceRenameOpen = false;
  pendingRenameWorkspaceId = "";
  saveState();
  render();
}

function deleteWorkspace(workspaceId) {
  const currentId = String(workspaceId || "");
  if (!currentId) return;
  const deletedIndex = state.workspaces.findIndex((workspace) => workspace.id === currentId);
  const deletedWorkspace = deletedIndex >= 0 ? structuredClone(state.workspaces[deletedIndex]) : null;
  const previousActiveWorkspaceId = state.activeWorkspaceId;
  state.workspaces = state.workspaces.filter((workspace) => workspace.id !== currentId);
  workspaceRenameOpen = false;
  pendingRenameWorkspaceId = "";
  workspaceCreateOpen = false;

  if (!state.workspaces.length) {
    state.emptyWorkspaceList = true;
    state.activeWorkspaceId = "";
    state.projects = [];
    state.activeProjectId = "";
    state.route = "projects";
    state.ui = { ...structuredClone(initialData.ui), workspaceName: "" };
    saveState();
    render();
    if (deletedWorkspace) registerWorkspaceUndo(deletedWorkspace, deletedIndex, previousActiveWorkspaceId);
    return;
  }

  state.emptyWorkspaceList = false;
  if (state.activeWorkspaceId === currentId) {
    loadWorkspace(state.workspaces[0].id, false);
    return;
  }

  saveState();
  render();
  if (deletedWorkspace) registerWorkspaceUndo(deletedWorkspace, deletedIndex, previousActiveWorkspaceId);
}

function registerWorkspaceUndo(workspace, index, previousActiveWorkspaceId) {
  registerUndo(`Spazio "${workspace.name}" cancellato.`, () => {
    if (state.workspaces.some((item) => item.id === workspace.id)) return;
    state.emptyWorkspaceList = false;
    state.workspaces.splice(Math.min(Math.max(index, 0), state.workspaces.length), 0, workspace);
    loadWorkspace(previousActiveWorkspaceId === workspace.id ? workspace.id : state.activeWorkspaceId || workspace.id, false);
  });
}

function activeProject() {
  return state.projects.find((project) => project.id === state.activeProjectId) || activeProjects()[0] || state.projects[0] || null;
}
function bindEvents() {
  document.querySelectorAll(".view-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.route = "project";
      state.activeView = tab.dataset.view;
      saveState();
      render();
    });
  });

  document.querySelectorAll(".deadline-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (state.route === "project" && activeProject()) {
        state.route = "project";
      } else {
        state.route = "all-deadlines";
        state.ui.allDeadlinesTabOpen = true;
      }
      state.deadlineFilter = link.dataset.filter;
      saveState();
      render();
    });
  });

  document.querySelectorAll(".priority-link").forEach((link) => {
    link.addEventListener("click", () => openPriorityView(link.dataset.priorityFilter));
  });

  els.calendarToggle.addEventListener("click", openWorkspaceCalendar);
  document.getElementById("newTaskBtn").addEventListener("click", () => openTaskDialog());
  document.getElementById("settingsBtn").addEventListener("click", openStatusSettings);
  document.getElementById("exportBtn").addEventListener("click", exportProjectMarkdown);
  els.exportExcelBtn.addEventListener("click", exportProjectExcel);
  els.importExcelBtn.addEventListener("click", openProjectExcelImport);
  els.importExcelInput.addEventListener("change", handleProjectExcelFile);
  document.getElementById("backupProjectsBtn").addEventListener("click", openBackupDialog);
  document.getElementById("restoreProjectsBtn").addEventListener("click", () => {
    els.restoreFileInput.value = "";
    if (window.webkit?.messageHandlers?.restoreBackup) {
      window.webkit.messageHandlers.restoreBackup.postMessage({
        attachmentDirectoryPath: state.ui.attachmentDirectoryPath || "",
      });
      return;
    }
    els.restoreFileSlot.hidden = false;
    els.restoreFileInput.click();
  });
  document.getElementById("searchBtn").addEventListener("click", () => toggleSearch("main"));
  document.getElementById("searchToggle").addEventListener("click", () => toggleSearch("sidebar"));
  document.getElementById("addSubtaskBtn").addEventListener("click", () => addSubtaskField("", false));
  if (els.taskConflictBanner) {
    els.taskConflictBanner.addEventListener("click", (event) => {
      if (event.target.closest('[data-action="dismiss-sync-conflict"]')) dismissTaskSyncConflict();
    });
  }
  els.attachFileBtn.addEventListener("click", pickTaskAttachment);
  els.newAttachmentBtn.addEventListener("click", createTaskAttachment);
  document.getElementById("resetSetupBtn").addEventListener("click", resetSetup);
  els.deadlineTitleBtn.addEventListener("click", openDeadlinesPage);
  els.ownerTitleBtn.addEventListener("click", openOwnersPage);
  els.priorityTitleBtn.addEventListener("click", openPrioritiesPage);
  els.deadlineToggle.addEventListener("click", () => toggleSection("deadlinesCollapsed"));
  els.ownerToggle.addEventListener("click", () => toggleSection("ownersCollapsed"));
  els.priorityToggle.addEventListener("click", () => toggleSection("priorityCollapsed"));
  els.archiveToggle.addEventListener("click", openArchivePage);
  els.archiveChevron.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSection("archiveCollapsed");
  });
  els.projectsTitleBtn.addEventListener("click", openHomePage);
  els.projectsToggle.addEventListener("click", () => toggleSection("projectsCollapsed"));
  els.configToggle.addEventListener("click", () => {
    if (els.configDialog.open) {
      els.configDialog.close();
      return;
    }
    renderWorkspaceSelect();
    setActiveConfigPanel(activeConfigPanel || "workspace");
    els.configDialog.showModal();
  });
  document.querySelectorAll("[data-config-panel-tab]").forEach((button) => {
    button.addEventListener("click", () => setActiveConfigPanel(button.dataset.configPanelTab));
    button.addEventListener("focus", () => setActiveConfigPanel(button.dataset.configPanelTab));
  });
  els.sidebarResizeHandle.addEventListener("pointerdown", startSidebarResize);
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      const dialog = button.closest("dialog");
      if (dialog === els.taskDialog) flushTaskAutosave();
      if (dialog === els.projectNoteDialog) saveProjectNote({ close: false, renderPage: false });
      dialog.close();
      if (dialog === els.projectNoteDialog) render();
    });
  });
  els.configDialog.addEventListener("click", (event) => {
    if (event.target === els.configDialog) els.configDialog.close();
  });

  els.searchInput.addEventListener("input", (event) => {
    updateSearch(event.target.value);
  });

  els.sidebarSearchInput.addEventListener("input", (event) => {
    updateSearch(event.target.value);
  });

  els.workspaceSelect.addEventListener("change", (event) => loadWorkspace(event.target.value));
  els.newWorkspaceBtn.addEventListener("click", () => {
    workspaceCreateOpen = true;
    workspaceRenameOpen = false;
    renderShell();
    els.workspaceCreateSlot.querySelector("input")?.focus();
  });

  els.newParticipantBtn.addEventListener("click", () => {
    createEditableParticipant();
  });

  els.selectAttachmentEditorBtn.addEventListener("click", selectAttachmentEditor);
  els.clearAttachmentEditorBtn.addEventListener("click", clearAttachmentEditor);
  els.selectAttachmentDirectoryBtn.addEventListener("click", selectAttachmentDirectory);
  els.clearAttachmentDirectoryBtn.addEventListener("click", clearAttachmentDirectory);
  els.autoArchiveDoneEnabled.addEventListener("change", (event) => {
    state.ui.autoArchiveDoneEnabled = event.target.checked;
    renderTaskArchiveConfig();
    saveState();
  });
  els.autoArchiveDoneDelay.addEventListener("change", (event) => {
    state.ui.autoArchiveDoneDelayDays = normalizeAutoArchiveDoneDelay(event.target.value);
    renderTaskArchiveConfig();
    saveState();
  });
  els.syncRemindersEnabled.addEventListener("change", (event) => {
    state.ui.remindersEnabled = event.target.checked;
    state.ui.remindersLastSyncError = "";
    renderRemindersConfig();
    saveState();
    if (state.ui.remindersEnabled) {
      refreshReminderLists({ silent: true });
      scheduleReminderSync({ immediate: true });
    }
  });
  els.remindersListSelect.addEventListener("change", (event) => {
    if (!event.target.value) return;
    state.ui.remindersListName = event.target.value;
    state.ui.remindersLastSyncError = "";
    renderRemindersConfig();
    saveState();
  });
  els.remindersListName.addEventListener("change", (event) => {
    state.ui.remindersListName = normalizeReminderListName(event.target.value);
    state.ui.remindersLastSyncError = "";
    renderRemindersConfig();
    saveState();
  });
  els.refreshRemindersListsBtn.addEventListener("click", () => refreshReminderLists());
  els.syncRemindersNowBtn.addEventListener("click", () => syncWorkspaceReminders({ manual: true }));
  els.selectAutoBackupDirectoryBtn.addEventListener("click", selectAutoBackupDirectory);
  els.clearAutoBackupDirectoryBtn.addEventListener("click", clearAutoBackupDirectory);
  els.autoBackupFrequency.addEventListener("change", (event) => {
    state.ui.autoBackupFrequencyHours = normalizeAutoBackupFrequency(event.target.value);
    renderAutoBackupConfig();
    saveState();
  });
  els.remoteSyncEnabled.addEventListener("change", (event) => {
    state.sync = normalizeSyncSettings({ ...state.sync, remoteEnabled: event.target.checked });
    if (state.sync.remoteEnabled) startRemoteReplication({ force: true });
    else stopRemoteReplication("Disattivata");
    saveState();
  });
  els.remoteCouchUrl.addEventListener("change", (event) => {
    state.sync = normalizeSyncSettings({ ...state.sync, remoteUrl: event.target.value });
    renderRemoteSyncConfig();
    saveState();
    startRemoteReplication({ force: true });
  });
  els.remoteCouchUrl.addEventListener("blur", (event) => {
    event.target.value = normalizeRemoteCouchUrl(event.target.value);
  });
  els.remoteCouchUser.addEventListener("change", (event) => {
    remoteSyncAuth.username = String(event.target.value || "").trim();
    saveRemoteSyncAuth();
    startRemoteReplication({ force: true });
  });
  els.remoteCouchPassword.addEventListener("change", (event) => {
    remoteSyncAuth.password = String(event.target.value || "");
    saveRemoteSyncAuth();
    startRemoteReplication({ force: true });
  });
  els.remoteSyncFrequency.addEventListener("change", (event) => {
    state.sync = normalizeSyncSettings({ ...state.sync, remoteFrequencyHours: event.target.value });
    renderRemoteSyncConfig();
    saveState();
    if (state.sync.remoteEnabled) scheduleRemoteAutoSync();
  });
  els.remoteSyncNowBtn.addEventListener("click", triggerRemoteSyncNow);
  els.verifyAttachmentsBtn.addEventListener("click", verifyAllAttachments);

  els.sidebarFontScale.addEventListener("input", (event) => {
    state.ui.sidebarFontScale = Number(event.target.value);
    applyFontScale();
    saveState();
  });

  els.contentFontScale.addEventListener("input", (event) => {
    state.ui.contentFontScale = Number(event.target.value);
    applyFontScale();
    saveState();
  });

  els.themeMode.addEventListener("change", (event) => {
    state.ui.theme = event.target.value === "dark" ? "dark" : "light";
    applyTheme();
    saveState();
  });

  els.accentPalette.querySelectorAll("[data-accent]").forEach((button) => {
    button.addEventListener("click", () => {
      state.ui.accentColor = button.dataset.accent;
      applyAccent();
      syncActiveWorkspace();
      renderWorkspaceSelect();
      renderWorkspaceDock();
      saveState();
    });
  });

  els.taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveTaskFromDialog({ close: false, renderPage: true });
  });

  els.taskForm.addEventListener("input", scheduleTaskAutosave);
  els.taskForm.addEventListener("change", scheduleTaskAutosave);

  els.taskForm.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.type === "submit" || target.type === "button" || target.type === "checkbox" || target.type === "hidden") return;
    event.preventDefault();
    target.blur();
  });

  els.deleteTaskBtn.addEventListener("click", deleteTaskFromDialog);

  els.statusForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addStatus();
  });

  els.projectNoteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveProjectNote();
  });
  els.projectNoteText.addEventListener("input", () => saveProjectNote({ close: false, renderPage: true }));

  els.projectDeleteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    deleteProject(els.projectDeleteId.value);
    els.projectDeleteDialog.close();
  });

  els.statusDeleteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    deleteStatus(els.statusDeleteId.value);
    els.statusDeleteDialog.close();
  });

  els.backupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    backupSelectedProjects();
  });

  els.restoreForm.addEventListener("submit", (event) => {
    event.preventDefault();
    restoreSelectedBackup();
  });

  els.restoreFileInput.addEventListener("change", handleRestoreFile);
  bindContentDelegation();
  bindKofiRedirect();
}

function bindKofiRedirect() {
  document.querySelector(".kofi-widget")?.addEventListener("click", (event) => {
    const clickable = event.target.closest("a, button, img");
    if (!clickable) return;
    event.preventDefault();
    openExternalUrl("https://ko-fi.com/pst");
  });
}

function openExternalUrl(url) {
  if (window.webkit?.messageHandlers?.openExternalUrl) {
    window.webkit.messageHandlers.openExternalUrl.postMessage({ url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function render() {
  renderShell();
  renderContent();
}

function renderShell() {
  const project = activeProject();
  const isProjectsRoute = state.route === "projects";
  const isAllDeadlinesRoute = state.route === "all-deadlines";
  const isCalendarRoute = state.route === "calendar";
  const isArchiveRoute = state.route === "archive";
  const hasProject = Boolean(project);
  const isProjectRoute = state.route === "project" && hasProject;
  const enabledViews = project ? projectEnabledViews(project) : [];

  applyFontScale();
  applyTheme();
  applyAccent();
  applySidebarWidth();
  renderCollapsibleSections();
  renderArchiveNav();
  renderProjectTabs();
  renderWorkspaceDock();
  renderOwnerList();
  renderParticipantsConfig();
  els.pageTitle.textContent =
    state.route === "owner"
      ? `Responsabile: ${state.ownerFilter}`
      : state.route === "priority"
        ? `Priorità: ${priorityOption(state.priorityFilter, false)?.label || ""}`
      : isArchiveRoute
        ? "Archivio"
      : isCalendarRoute
        ? "Calendario"
      : isAllDeadlinesRoute
        ? `Tutti i progetti - ${deadlineFilterName(state.deadlineFilter)}`
        : isProjectsRoute || !project
          ? "Lista progetti"
          : project.name;
  els.searchInput.value = state.search;
  els.sidebarSearchInput.value = state.search;
  els.sidebarFontScale.value = state.ui.sidebarFontScale;
  els.sidebarFontScaleValue.textContent = `${state.ui.sidebarFontScale}%`;
  els.contentFontScale.value = state.ui.contentFontScale;
  els.contentFontScaleValue.textContent = `${state.ui.contentFontScale}%`;
  els.themeMode.value = state.ui.theme;
  updateAccentSelection();
  renderWorkspaceSelect();
  renderTaskArchiveConfig();
  renderRemindersConfig();
  renderAttachmentConfig();
  renderAutoBackupConfig();
  renderRemoteSyncConfig();
  renderDataSafetyCenter();
  els.workspaceNamePill.textContent = state.ui.workspaceName || "default";
  if (isProjectRoute && enabledViews.length && !enabledViews.includes(state.activeView)) {
    state.activeView = enabledViews[0];
  }
  document.querySelector(".view-strip").hidden = !isProjectRoute || !enabledViews.length;
  document.querySelector(".share-row").hidden = !isProjectRoute;
  document.getElementById("newTaskBtn").disabled = !isProjectRoute;
  document.getElementById("settingsBtn").disabled = !isProjectRoute;
  document.getElementById("exportBtn").disabled = !isProjectRoute;
  els.exportExcelBtn.disabled = !isProjectRoute;
  els.importExcelBtn.disabled = !isProjectRoute;
  els.searchPanel.classList.toggle("open", isProjectRoute && els.searchPanel.classList.contains("open"));

  document.querySelectorAll(".view-tab").forEach((tab) => {
    tab.hidden = isProjectRoute && !enabledViews.includes(tab.dataset.view);
    tab.classList.toggle("active", tab.dataset.view === state.activeView);
  });

  document.querySelectorAll(".deadline-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.filter === state.deadlineFilter);
  });

  document.querySelectorAll(".priority-link").forEach((link) => {
    link.classList.toggle("active", state.route === "priority" && link.dataset.priorityFilter === state.priorityFilter);
  });
  els.archiveToggle.classList.toggle("active", state.route === "archive");
  els.calendarToggle.classList.toggle("active", state.route === "calendar");

  els.projectList.innerHTML = activeProjects()
    .map((item) => {
      const active = item.id === state.activeProjectId ? "active" : "";
      const open = state.ui.openProjects[item.id] === true;
      return `
        <div class="project-group ${open ? "open" : "closed"}">
          <div class="project-row ${active}">
            <button class="project-select" data-open-sidebar-project="${item.id}" aria-expanded="${open}">
              <span class="project-name">${escapeHtml(item.name)}</span>
            </button>
            <button class="project-collapse" data-toggle-project="${item.id}" aria-label="Comprimi viste ${escapeHtml(item.name)}" aria-expanded="${open}">
              <span aria-hidden="true">${open ? "⌄" : "›"}</span>
            </button>
          </div>
          <div class="project-views">
            ${CONFIGURABLE_VIEW_OPTIONS.map(
              (view) => `
                <div class="sub-view ${item.enabledViews?.[view.id] ? "enabled" : ""} ${state.route === "project" && item.id === state.activeProjectId && view.id === state.activeView ? "active" : ""}">
                  <label class="sub-view-toggle" aria-label="Abilita ${view.label} per ${escapeHtml(item.name)}">
                    <input type="checkbox" data-toggle-view="${view.id}" data-project-view="${item.id}" ${item.enabledViews?.[view.id] ? "checked" : ""} />
                    <span class="view-tick" aria-hidden="true">✓</span>
                  </label>
                  <button class="sub-view-name" data-open-project-view="${view.id}" data-open-project-view-project="${item.id}" type="button" ${item.enabledViews?.[view.id] ? "" : "disabled"}>
                    ${view.label}
                  </button>
                </div>
              `,
            ).join("")}
          </div>
        </div>
      `;
    })
    .join("");

  els.projectList.querySelectorAll("[data-toggle-view]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      toggleProjectView(checkbox.dataset.projectView, checkbox.dataset.toggleView, checkbox.checked);
    });
  });

  els.projectList.querySelectorAll("[data-open-project-view]").forEach((button) => {
    button.addEventListener("click", () => {
      openProjectTab(button.dataset.openProjectViewProject, button.dataset.openProjectView);
    });
  });

  els.projectList.querySelectorAll("[data-toggle-project]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleSidebarProject(button.dataset.toggleProject);
    });
  });

  els.projectList.querySelectorAll("[data-open-sidebar-project]").forEach((button) => {
    button.addEventListener("click", () => {
      openSidebarProject(button.dataset.openSidebarProject);
    });
  });
}

function renderProjectTabs() {
  const openTabs = state.ui.openProjectTabs
    .map((projectId) => state.projects.find((project) => project.id === projectId))
    .filter(Boolean);
  const ownerTabs = normalizeParticipants(state.ui.openOwnerTabs).filter((owner) => state.ui.participants.includes(owner));
  const priorityTabs = normalizePriorityTabs(state.ui.openPriorityTabs);

  els.projectTabs.innerHTML = `
    <div class="project-tab home-project-tab ${state.route === "projects" ? "active" : ""}">
      <button class="project-tab-main" data-home-projects-tab type="button">
        <span class="home-mark" aria-hidden="true">⌂</span>
        <span>Lista progetti</span>
      </button>
    </div>
    <div class="project-tab ${state.route === "archive" ? "active" : ""}">
      <button class="project-tab-main" data-archive-tab type="button">
        <span>Archivio</span>
      </button>
    </div>
    ${
      state.ui.allDeadlinesTabOpen || state.route === "all-deadlines"
        ? `
          <div class="project-tab ${state.route === "all-deadlines" ? "active" : ""}">
            <button class="project-tab-main" data-all-deadlines-tab type="button">
              <span>Tutti i progetti</span>
            </button>
            <button class="project-tab-close" data-close-all-deadlines-tab type="button" aria-label="Chiudi tab Tutti i progetti">×</button>
          </div>
        `
        : ""
    }
    ${
      state.ui.calendarTabOpen || state.route === "calendar"
        ? `
          <div class="project-tab ${state.route === "calendar" ? "active" : ""}">
            <button class="project-tab-main" data-calendar-tab type="button">
              <span>Calendario</span>
            </button>
            <button class="project-tab-close" data-close-calendar-tab type="button" aria-label="Chiudi tab Calendario">×</button>
          </div>
        `
        : ""
    }
    ${ownerTabs
      .map(
        (owner) => `
          <div class="project-tab ${state.route === "owner" && state.ownerFilter === owner ? "active" : ""}">
            <button class="project-tab-main" data-tab-owner="${escapeHtml(owner)}" type="button">
              <span>${escapeHtml(owner)}</span>
            </button>
            <button class="project-tab-close" data-close-owner-tab="${escapeHtml(owner)}" type="button" aria-label="Chiudi tab ${escapeHtml(owner)}">×</button>
          </div>
        `,
      )
      .join("")}
    ${priorityTabs
      .map((priority) => {
        const option = priorityOption(priority, false);
        return `
          <div class="project-tab ${state.route === "priority" && state.priorityFilter === priority ? "active" : ""}">
            <button class="project-tab-main" data-tab-priority="${priority}" type="button">
              <span>${option.label}</span>
            </button>
            <button class="project-tab-close" data-close-priority-tab="${priority}" type="button" aria-label="Chiudi tab ${option.label}">×</button>
          </div>
        `;
      })
      .join("")}
    ${openTabs
      .map(
        (project) => `
          <div class="project-tab ${state.route === "project" && project.id === state.activeProjectId ? "active" : ""}">
            <button class="project-tab-main" data-tab-project="${project.id}" type="button">
              <span>${escapeHtml(project.name)}</span>
            </button>
            <button class="project-tab-close" data-close-project-tab="${project.id}" type="button" aria-label="Chiudi tab ${escapeHtml(project.name)}">×</button>
          </div>
        `,
      )
      .join("")}
  `;

  els.projectTabs.querySelector("[data-home-projects-tab]")?.addEventListener("click", openHomePage);
  els.projectTabs.querySelector("[data-archive-tab]")?.addEventListener("click", openArchivePage);
  els.projectTabs.querySelector("[data-all-deadlines-tab]")?.addEventListener("click", openAllProjectDeadlines);
  els.projectTabs.querySelector("[data-close-all-deadlines-tab]")?.addEventListener("click", closeAllProjectDeadlinesTab);
  els.projectTabs.querySelector("[data-calendar-tab]")?.addEventListener("click", openWorkspaceCalendar);
  els.projectTabs.querySelector("[data-close-calendar-tab]")?.addEventListener("click", closeWorkspaceCalendarTab);
  els.projectTabs.querySelectorAll("[data-tab-owner]").forEach((button) => {
    button.addEventListener("click", () => openOwnerView(button.dataset.tabOwner));
  });
  els.projectTabs.querySelectorAll("[data-close-owner-tab]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      closeOwnerTab(button.dataset.closeOwnerTab);
    });
  });
  els.projectTabs.querySelectorAll("[data-tab-priority]").forEach((button) => {
    button.addEventListener("click", () => openPriorityView(button.dataset.tabPriority));
  });
  els.projectTabs.querySelectorAll("[data-close-priority-tab]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      closePriorityTab(button.dataset.closePriorityTab);
    });
  });
  els.projectTabs.querySelectorAll("[data-tab-project]").forEach((button) => {
    button.addEventListener("click", () => openProjectTab(button.dataset.tabProject));
  });
  els.projectTabs.querySelectorAll("[data-close-project-tab]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      closeProjectTab(button.dataset.closeProjectTab);
    });
  });
}

function openHomePage() {
  state.route = "projects";
  state.deadlineFilter = "all";
  state.search = "";
  saveState();
  render();
}

function openArchivePage() {
  state.route = "archive";
  state.deadlineFilter = "all";
  state.search = "";
  saveState();
  render();
}

function openAllProjectDeadlines() {
  state.route = "all-deadlines";
  state.ui.allDeadlinesTabOpen = true;
  saveState();
  render();
}

function openDeadlinesPage() {
  state.deadlineFilter = state.deadlineFilter || "all";
  openAllProjectDeadlines();
}

function openOwnersPage() {
  const owner = state.ownerFilter && normalizeParticipants(state.ui.participants).includes(state.ownerFilter)
    ? state.ownerFilter
    : normalizeParticipants(state.ui.participants)[0] || "";
  if (owner) {
    openOwnerView(owner);
    return;
  }
  state.route = "owner";
  state.ownerFilter = "";
  state.deadlineFilter = "all";
  saveState();
  render();
}

function openPrioritiesPage() {
  const priority = priorityOption(state.priorityFilter, false)?.id || "high";
  openPriorityView(priority);
}

function closeAllProjectDeadlinesTab() {
  state.ui.allDeadlinesTabOpen = false;
  if (state.route === "all-deadlines") state.route = "projects";
  saveState();
  render();
}

function openWorkspaceCalendar() {
  state.route = "calendar";
  state.ui.calendarTabOpen = true;
  state.deadlineFilter = "all";
  saveState();
  render();
}

function closeWorkspaceCalendarTab() {
  state.ui.calendarTabOpen = false;
  if (state.route === "calendar") state.route = "projects";
  saveState();
  render();
}

function openProjectTab(projectId, view = "board") {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  if (!state.ui.openProjectTabs.includes(projectId)) state.ui.openProjectTabs.push(projectId);
  const enabledViews = projectEnabledViews(project);
  state.route = "project";
  state.activeProjectId = projectId;
  state.activeView = enabledViews.includes(view) ? view : enabledViews[0] || "board";
  state.deadlineFilter = "all";
  saveState();
  render();
}

function projectEnabledViews(project) {
  const configuredViews = CONFIGURABLE_VIEW_OPTIONS.filter((view) => project.enabledViews?.[view.id]).map((view) => view.id);
  return [...configuredViews, "dashboard"];
}

function toggleProjectView(projectId, viewId, enabled) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  project.enabledViews = {
    board: false,
    table: false,
    timeline: false,
    ...(project.enabledViews || {}),
    [viewId]: enabled,
  };

  if (state.activeProjectId === projectId && !projectEnabledViews(project).includes(state.activeView)) {
    state.activeView = projectEnabledViews(project)[0] || "board";
  }

  saveState();
  render();
}

function closeProjectTab(projectId) {
  state.ui.openProjectTabs = state.ui.openProjectTabs.filter((id) => id !== projectId);

  if (state.activeProjectId === projectId && state.route === "project") {
    const nextProjectId = state.ui.openProjectTabs.at(-1);
    if (nextProjectId) {
      state.activeProjectId = nextProjectId;
      state.activeView = "board";
    } else {
      state.route = "projects";
    }
  }

  saveState();
  render();
}

function closeOwnerTab(owner) {
  const cleanOwner = String(owner || "").trim();
  state.ui.openOwnerTabs = normalizeParticipants(state.ui.openOwnerTabs.filter((item) => item !== cleanOwner));

  if (state.route === "owner" && state.ownerFilter === cleanOwner) {
    state.route = "projects";
    state.ownerFilter = "";
  }

  saveState();
  render();
}

function closePriorityTab(priority) {
  const option = priorityOption(priority, false);
  if (!option) return;
  state.ui.openPriorityTabs = normalizePriorityTabs(state.ui.openPriorityTabs.filter((item) => item !== option.id));

  if (state.route === "priority" && state.priorityFilter === option.id) {
    state.route = "projects";
    state.priorityFilter = "";
  }

  saveState();
  render();
}

function toggleSidebarProject(projectId) {
  state.ui.openProjects[projectId] = state.ui.openProjects[projectId] === false;
  saveState();
  renderShell();
}

function openSidebarProject(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  openProjectTab(projectId, projectEnabledViews(project)[0] || "board");
}

function clampSidebarWidth(value) {
  const width = Number(value) || initialData.ui.sidebarWidth;
  return Math.min(440, Math.max(232, Math.round(width)));
}

function applySidebarWidth() {
  document.documentElement.style.setProperty("--sidebar-width", `${clampSidebarWidth(state.ui.sidebarWidth)}px`);
}

function startSidebarResize(event) {
  event.preventDefault();
  event.currentTarget.setPointerCapture?.(event.pointerId);
  document.body.classList.add("resizing-sidebar");

  const resize = (pointerEvent) => {
    state.ui.sidebarWidth = clampSidebarWidth(pointerEvent.clientX);
    applySidebarWidth();
  };

  const stop = () => {
    document.body.classList.remove("resizing-sidebar");
    window.removeEventListener("pointermove", resize);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
    saveState();
  };

  window.addEventListener("pointermove", resize);
  window.addEventListener("pointerup", stop, { once: true });
  window.addEventListener("pointercancel", stop, { once: true });
}

function applyFontScale() {
  document.documentElement.style.setProperty("--sidebar-font-scale", state.ui.sidebarFontScale / 100);
  document.documentElement.style.setProperty("--content-font-scale", state.ui.contentFontScale / 100);
  els.sidebarFontScaleValue.textContent = `${state.ui.sidebarFontScale}%`;
  els.contentFontScaleValue.textContent = `${state.ui.contentFontScale}%`;
}

function applyTheme() {
  document.documentElement.dataset.theme = state.ui.theme;
}

function applyAccent() {
  const accent = state.ui.accentColor || initialData.ui.accentColor;
  document.documentElement.style.setProperty("--accent", accent);
  updateAccentSelection();
}

function updateAccentSelection() {
  if (!els.accentPalette) return;
  els.accentPalette.querySelectorAll("[data-accent]").forEach((button) => {
    button.classList.toggle("active", button.dataset.accent.toLowerCase() === (state.ui.accentColor || initialData.ui.accentColor).toLowerCase());
  });
}

function renderCollapsibleSections() {
  const deadlineCollapsed = Boolean(state.ui.deadlinesCollapsed);
  const ownersCollapsed = Boolean(state.ui.ownersCollapsed);
  const priorityCollapsed = Boolean(state.ui.priorityCollapsed);
  const projectsCollapsed = Boolean(state.ui.projectsCollapsed);
  els.deadlineToggle.setAttribute("aria-expanded", String(!deadlineCollapsed));
  els.ownerToggle.setAttribute("aria-expanded", String(!ownersCollapsed));
  els.priorityToggle.setAttribute("aria-expanded", String(!priorityCollapsed));
  els.projectsToggle.setAttribute("aria-expanded", String(!projectsCollapsed));
  els.deadlineBody.hidden = deadlineCollapsed;
  els.ownerBody.hidden = ownersCollapsed;
  els.priorityBody.hidden = priorityCollapsed;
  els.projectsBody.hidden = projectsCollapsed;
  els.deadlineToggle.querySelector(".chevron").textContent = deadlineCollapsed ? "›" : "⌄";
  els.ownerToggle.querySelector(".chevron").textContent = ownersCollapsed ? "›" : "⌄";
  els.priorityToggle.querySelector(".chevron").textContent = priorityCollapsed ? "›" : "⌄";
  els.projectsToggle.querySelector(".chevron").textContent = projectsCollapsed ? "›" : "⌄";
}

function renderArchiveNav() {
  const archived = archivedProjects();
  const hasArchived = archived.length > 0;
  const collapsed = Boolean(state.ui.archiveCollapsed);
  els.archiveChevron.hidden = !hasArchived;
  els.archiveBody.hidden = !hasArchived || collapsed;
  els.archiveChevron.setAttribute("aria-expanded", String(hasArchived && !collapsed));
  els.archiveChevron.querySelector(".chevron").textContent = collapsed ? "›" : "⌄";
  if (!hasArchived) {
    els.archiveList.innerHTML = "";
    return;
  }
  els.archiveList.innerHTML = archived
    .map(
      (project) =>
        `<button class="deadline-link archive-project-link" data-archive-project="${escapeHtml(project.id)}" type="button">${escapeHtml(project.name || "Senza titolo")}</button>`,
    )
    .join("");
  els.archiveList.querySelectorAll("[data-archive-project]").forEach((button) => {
    button.addEventListener("click", () => openArchivePage());
  });
}

function renderOwnerList() {
  const participants = normalizeParticipants(state.ui.participants);
  els.ownerList.innerHTML = participants.length
    ? participants
        .map(
          (name) => `
            <button class="owner-link ${state.route === "owner" && state.ownerFilter === name ? "active" : ""}" data-owner-filter="${escapeHtml(name)}" type="button">
              ${escapeHtml(name)}
            </button>
          `,
        )
        .join("")
    : `<div class="sidebar-empty-note">Nessun partecipante</div>`;

  els.ownerList.querySelectorAll("[data-owner-filter]").forEach((button) => {
    button.addEventListener("click", () => openOwnerView(button.dataset.ownerFilter));
  });
}

function renderParticipantsConfig() {
  const participants = normalizeParticipants(state.ui.participants);
  els.participantsList.innerHTML = participants.length
    ? participants
        .map(
          (name) =>
            pendingRenameParticipant === name
              ? `
                <form class="participant-rename-form" data-rename-participant-form="${escapeHtml(name)}">
                  <input type="text" name="participantName" maxlength="50" autocomplete="off" value="${escapeHtml(name)}" />
                </form>
              `
              : `
                <button class="participant-chip participant-name-btn" type="button" data-rename-participant="${escapeHtml(name)}" title="Rinomina ${escapeHtml(name)}">${escapeHtml(name)}</button>
              `,
        )
        .join("")
    : `<div class="muted-empty compact">Nessun partecipante definito.</div>`;

  els.participantsList.querySelectorAll("[data-rename-participant]").forEach((button) => {
    button.addEventListener("click", () => {
      pendingRenameParticipant = button.dataset.renameParticipant;
      renderParticipantsConfig();
      els.participantsList.querySelector("[data-rename-participant-form] input")?.focus();
      els.participantsList.querySelector("[data-rename-participant-form] input")?.select();
    });
  });

  els.participantsList.querySelectorAll("[data-rename-participant-form]").forEach((form) => {
    const input = form.querySelector("input");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      renameParticipant(form.dataset.renameParticipantForm, input.value);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        pendingRenameParticipant = "";
        renderParticipantsConfig();
      }
    });
    input.addEventListener("blur", () => {
      if (pendingRenameParticipant === form.dataset.renameParticipantForm) renameParticipant(form.dataset.renameParticipantForm, input.value);
    });
  });

}

function renderWorkspaceSelect() {
  syncActiveWorkspace();
  els.workspaceSelect.hidden = true;
  els.workspaceSelect.innerHTML = "";
  els.workspaceSelect.value = state.activeWorkspaceId || "";
  els.workspaceCreateSlot.innerHTML = workspaceCreateOpen
    ? `
	      <form class="inline-project-form workspace-create-form" id="workspaceCreateForm">
	        <label>
	          Nome nuovo spazio
	          <input type="text" name="workspaceName" maxlength="70" autocomplete="off" required placeholder="Scrivi il nome dello spazio" />
	        </label>
	        <div class="popover-actions">
	          <button type="button" class="secondary-btn" data-cancel-workspace-create>Annulla</button>
	          <button type="submit" class="primary-btn">Crea spazio</button>
	        </div>
	      </form>
    `
    : state.workspaces.length
      ? `
        <div class="workspace-config-list">
          ${state.workspaces
            .map((workspace) => {
              const color = /^#[0-9a-f]{6}$/i.test(workspace.ui?.accentColor || "") ? workspace.ui.accentColor : initialData.ui.accentColor;
              return pendingRenameWorkspaceId === workspace.id
                ? `
                  <form class="workspace-rename-form" data-workspace-rename-form="${escapeHtml(workspace.id)}" style="--workspace-pill-accent: ${escapeHtml(color)};">
                    <input type="text" name="workspaceName" maxlength="70" autocomplete="off" value="${escapeHtml(workspace.name)}" />
                  </form>
                `
                : `
                  <button type="button" class="workspace-name-edit ${workspace.id === state.activeWorkspaceId ? "active" : ""}" data-workspace-config="${escapeHtml(workspace.id)}" style="--workspace-pill-accent: ${escapeHtml(color)};" title="Seleziona o rinomina spazio">
                    ${escapeHtml(workspace.name)}
                  </button>
                `;
            })
            .join("")}
        </div>
      `
      : `<div class="muted-empty compact">Nessuno spazio disponibile. Crea un nuovo spazio.</div>`;

  const form = els.workspaceCreateSlot.querySelector("#workspaceCreateForm");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = new FormData(form).get("workspaceName")?.toString().trim();
    if (!name) return;
    createWorkspaceFromName(name);
  });
  els.workspaceCreateSlot.querySelector("[data-cancel-workspace-create]")?.addEventListener("click", () => {
    workspaceCreateOpen = false;
    renderShell();
  });

  els.workspaceCreateSlot.querySelectorAll("[data-workspace-config]").forEach((button) => {
    button.addEventListener("click", () => {
      const workspaceId = button.dataset.workspaceConfig;
      if (workspaceId !== state.activeWorkspaceId) {
        loadWorkspace(workspaceId);
        return;
      }
      pendingRenameWorkspaceId = workspaceId;
      workspaceCreateOpen = false;
      renderWorkspaceSelect();
      els.workspaceCreateSlot.querySelector("[data-workspace-rename-form] input")?.focus();
      els.workspaceCreateSlot.querySelector("[data-workspace-rename-form] input")?.select();
    });
  });

  els.workspaceCreateSlot.querySelectorAll("[data-workspace-rename-form]").forEach((renameForm) => {
    const renameInput = renameForm.querySelector("input");
    const workspaceId = renameForm.dataset.workspaceRenameForm;
    renameForm.addEventListener("submit", (event) => {
      event.preventDefault();
      renameWorkspace(workspaceId, renameInput.value);
    });
    renameInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        pendingRenameWorkspaceId = "";
        renderWorkspaceSelect();
      }
    });
    renameInput.addEventListener("blur", () => {
      if (pendingRenameWorkspaceId === workspaceId) renameWorkspace(workspaceId, renameInput.value);
    });
  });
}

function renderWorkspaceDock() {
  syncActiveWorkspace();
  els.workspaceDock.innerHTML = state.workspaces
    .map((workspace) => {
      const color = /^#[0-9a-f]{6}$/i.test(workspace.ui?.accentColor || "") ? workspace.ui.accentColor : initialData.ui.accentColor;
      const initial = workspaceInitial(workspace.name);
      const active = workspace.id === state.activeWorkspaceId ? "active" : "";
      return `
        <button class="workspace-tag ${active}" data-workspace-tag="${escapeHtml(workspace.id)}" type="button" title="${escapeHtml(workspace.name)}" aria-label="Apri spazio ${escapeHtml(workspace.name)}" style="--workspace-color: ${color}">
          <span>${escapeHtml(workspaceShortName(workspace.name))}</span>
        </button>
      `;
    })
    .join("");

  els.workspaceDock.querySelectorAll("[data-workspace-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.workspaceTag === state.activeWorkspaceId) return;
      loadWorkspace(button.dataset.workspaceTag);
    });
  });
}

function uniqueParticipantName(baseName) {
  const cleanBase = String(baseName || "Nuovo partecipante").trim() || "Nuovo partecipante";
  const names = new Set(normalizeParticipants(state.ui.participants).map((participant) => participant.toLowerCase()));
  if (!names.has(cleanBase.toLowerCase())) return cleanBase;
  let index = 2;
  while (names.has(`${cleanBase} ${index}`.toLowerCase())) index += 1;
  return `${cleanBase} ${index}`;
}

function createEditableParticipant() {
  const name = uniqueParticipantName("Nuovo partecipante");
  state.ui.participants = normalizeParticipants([...state.ui.participants, name]);
  pendingRenameParticipant = name;
  saveState();
  renderShell();
  els.participantsList.querySelector("[data-rename-participant-form] input")?.focus();
  els.participantsList.querySelector("[data-rename-participant-form] input")?.select();
}

function addParticipant(name) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return;
  const participants = normalizeParticipants([...state.ui.participants, cleanName]);
  state.ui.participants = participants;
  saveState();
  renderShell();
}

function removeParticipant(name) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return;
  const previous = structuredClone({
    participants: state.ui.participants,
    openOwnerTabs: state.ui.openOwnerTabs,
    projects: state.projects,
    route: state.route,
    ownerFilter: state.ownerFilter,
  });
  pendingRenameParticipant = "";
  state.ui.participants = normalizeParticipants(state.ui.participants.filter((participant) => participant.toLowerCase() !== cleanName.toLowerCase()));
  state.ui.openOwnerTabs = normalizeParticipants(state.ui.openOwnerTabs.filter((participant) => participant.toLowerCase() !== cleanName.toLowerCase()));
  state.projects.forEach((project) => {
    project.tasks.forEach((task) => {
      if ((task.owner || "").trim().toLowerCase() === cleanName.toLowerCase()) task.owner = "";
      task.subtasks.forEach((subtask) => {
        if ((subtask.owner || "").trim().toLowerCase() === cleanName.toLowerCase()) subtask.owner = "";
      });
    });
  });
  if (state.route === "owner" && state.ownerFilter.toLowerCase() === cleanName.toLowerCase()) {
    state.route = "projects";
    state.ownerFilter = "";
  }
  saveState();
  render();
  registerUndo(`Partecipante "${cleanName}" cancellato.`, () => {
    state.ui.participants = previous.participants;
    state.ui.openOwnerTabs = previous.openOwnerTabs;
    state.projects = previous.projects;
    state.route = previous.route;
    state.ownerFilter = previous.ownerFilter;
    saveState();
    render();
  });
}

function renameParticipant(oldName, newName) {
  const cleanOldName = String(oldName || "").trim();
  const cleanNewName = String(newName || "").trim();
  if (!cleanOldName) return;
  pendingRenameParticipant = "";
  if (!cleanNewName) {
    removeParticipant(cleanOldName);
    return;
  }
  if (cleanOldName.toLowerCase() === cleanNewName.toLowerCase()) {
    renderParticipantsConfig();
    return;
  }
  if (state.ui.participants.some((participant) => participant.toLowerCase() === cleanNewName.toLowerCase())) {
    renderParticipantsConfig();
    return;
  }

  state.ui.participants = normalizeParticipants(state.ui.participants.map((participant) => (participant === cleanOldName ? cleanNewName : participant)));
  state.ui.openOwnerTabs = normalizeParticipants(state.ui.openOwnerTabs.map((participant) => (participant === cleanOldName ? cleanNewName : participant)));
  state.projects.forEach((project) => {
    project.tasks.forEach((task) => {
      if ((task.owner || "").trim() === cleanOldName) task.owner = cleanNewName;
      task.subtasks.forEach((subtask) => {
        if ((subtask.owner || "").trim() === cleanOldName) subtask.owner = cleanNewName;
      });
    });
  });
  if (state.route === "owner" && state.ownerFilter === cleanOldName) state.ownerFilter = cleanNewName;
  saveState();
  render();
}

function openOwnerView(owner) {
  const cleanOwner = String(owner || "").trim();
  if (!cleanOwner) return;
  if (!state.ui.openOwnerTabs.includes(cleanOwner)) state.ui.openOwnerTabs.push(cleanOwner);
  state.route = "owner";
  state.ownerFilter = cleanOwner;
  state.deadlineFilter = "all";
  saveState();
  render();
}

function openPriorityView(priority) {
  const option = priorityOption(priority, false);
  if (!option || option.id === "none") return;
  if (!state.ui.openPriorityTabs.includes(option.id)) state.ui.openPriorityTabs.push(option.id);
  state.route = "priority";
  state.priorityFilter = option.id;
  state.deadlineFilter = "all";
  saveState();
  render();
}

function workspaceInitial(name) {
  const trimmed = String(name || "S").trim();
  return (trimmed[0] || "S").toLocaleUpperCase("it-IT");
}

function workspaceShortName(name) {
  return String(name || "Spazio").trim().slice(0, 4).toLocaleUpperCase("it-IT");
}

function toggleSection(key) {
  state.ui[key] = !state.ui[key];
  saveState();
  renderShell();
}

function setActiveConfigPanel(panelName = "") {
  const target = document.querySelector(`[data-config-panel="${panelName}"]`) ? panelName : "";
  if (target) activeConfigPanel = target;
  document.querySelectorAll("[data-config-panel-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.configPanelTab === target);
  });
  document.querySelectorAll("[data-config-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.configPanel === target);
  });
}

function resetSetup() {
  state.ui.sidebarFontScale = initialData.ui.sidebarFontScale;
  state.ui.contentFontScale = initialData.ui.contentFontScale;
  state.ui.theme = initialData.ui.theme;
  state.ui.accentColor = initialData.ui.accentColor;
  els.sidebarFontScale.value = state.ui.sidebarFontScale;
  els.contentFontScale.value = state.ui.contentFontScale;
  els.themeMode.value = state.ui.theme;
  applyFontScale();
  applyTheme();
  applyAccent();
  saveState();
}
function renderContent() {
  if (state.route === "owner") {
    renderOwnerAssignments();
    return;
  }

  if (state.route === "priority") {
    renderPriorityAssignments();
    return;
  }

  if (state.route === "archive") {
    renderArchiveOverview();
    return;
  }

  if (state.route === "all-deadlines") {
    renderAllProjectDeadlines();
    return;
  }

  if (state.route === "calendar") {
    renderWorkspaceCalendar();
    return;
  }

  if (state.route === "projects" || !activeProject()) {
    renderProjectsOverview();
    return;
  }

  if (!projectEnabledViews(activeProject()).length) {
    els.content.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>Nessuna visualizzazione abilitata.</strong><br />
          Abilita Board, List o Timeline dalla Lista progetti.
        </div>
      </div>
    `;
    return;
  }

  const tasks = filteredTasks();

  if (state.activeView === "board") {
    renderBoard(tasks);
    return;
  }

  if (state.activeView === "dashboard") {
    renderProjectDashboard(tasks);
    return;
  }

  if (!tasks.length) {
    els.content.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>Nessuna attività in questa vista.</strong><br />
          Crea una nuova attività o cambia filtro scadenze.
        </div>
      </div>
    `;
    return;
  }

  if (state.activeView === "table") renderTable(tasks);
  else if (state.activeView === "timeline") renderTimeline(tasks);
}

function renderWorkspaceCalendar() {
  const term = state.search.trim().toLowerCase();
  const entries = activeProjects().flatMap((project) =>
    project.tasks
      .filter((task) => task.dueDate)
      .filter((task) => statusForTask(task.statusId, project)?.type !== "done")
      .filter((task) => {
        const haystack = [
          project.name,
          task.name,
          task.owner,
          task.notes,
          priorityOption(task.priority, true).label,
          statusForTask(task.statusId, project)?.name || "",
          ...normalizeAttachments(task.attachments).map((item) => `${item.name} ${item.path || ""}`),
          ...task.subtasks.map(subtaskSearchText),
        ]
          .join(" ")
          .toLowerCase();
        return !term || haystack.includes(term);
      })
      .map((task) => ({ project, task })),
  );
  const sortedEntries = entries.sort((a, b) => dateSortValue(a.task.dueDate) - dateSortValue(b.task.dueDate) || a.project.name.localeCompare(b.project.name) || a.task.name.localeCompare(b.task.name));
  const overdue = sortedEntries.filter(({ task, project }) => isTaskOverdue(task, project)).length;
  const todayCount = sortedEntries.filter(({ task }) => calendarBucketKey(task.dueDate) === calendarDateKey(today())).length;
  const next7 = sortedEntries.filter(({ task }) => {
    const diffDays = Math.floor((parseDate(task.dueDate) - startOfDay(today())) / 86400000);
    return diffDays >= 0 && diffDays <= 7;
  }).length;
  const projectsWithDeadlines = new Set(sortedEntries.map(({ project }) => project.id)).size;
  const groups = calendarGroups(sortedEntries);

  els.content.innerHTML = `
    <div class="workspace-calendar-view">
      <section class="dashboard-kpis calendar-kpis" aria-label="Indicatori calendario">
        ${dashboardKpi("Scadenze", sortedEntries.length)}
        ${dashboardKpi("Oggi", todayCount)}
        ${dashboardKpi("Prossimi 7 giorni", next7)}
        ${dashboardKpi("Scadute", overdue, overdue ? "danger" : "")}
        ${dashboardKpi("Progetti", projectsWithDeadlines)}
      </section>
      ${
        groups.length
          ? `
            <section class="calendar-board" aria-label="Attività per data di scadenza">
              ${groups.map(calendarGroupMarkup).join("")}
            </section>
          `
          : `
            <div class="empty-state">
              <div>
                <strong>Nessuna scadenza pianificata.</strong><br />
                Le attività con due date appariranno qui, raggruppate per giorno.
              </div>
            </div>
          `
      }
    </div>
  `;

  bindGroupedTaskActions();
}

function calendarGroups(entries) {
  const map = new Map();
  entries.forEach((entry) => {
    const key = calendarBucketKey(entry.task.dueDate);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  });
  return [...map.entries()].map(([date, items]) => ({ date, items }));
}

function calendarBucketKey(value) {
  return parseDate(value).toISOString().slice(0, 10);
}

function calendarDateKey(date) {
  const copy = startOfDay(date);
  return new Date(copy.getTime() - copy.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function calendarGroupMarkup(group) {
  const date = parseDate(group.date);
  const diffDays = Math.floor((date - startOfDay(today())) / 86400000);
  const tone = diffDays < 0 ? "overdue" : diffDays === 0 ? "today" : diffDays <= 7 ? "soon" : "";
  const label = diffDays < 0 ? "Scadute" : diffDays === 0 ? "Oggi" : diffDays === 1 ? "Domani" : diffDays <= 7 ? "Questa settimana" : "Pianificate";
  return `
    <article class="calendar-day ${tone}">
      <header>
        <div>
          <strong>${formatDate(group.date)}</strong>
          <span>${label}</span>
        </div>
        <span>${group.items.length}</span>
      </header>
      <div class="calendar-task-list">
        ${group.items
          .map(({ project, task }) => {
            return `
              <button class="calendar-task-card ${isTaskOverdue(task, project) ? "is-overdue" : ""}" data-open-task-project="${project.id}" data-open-task="${task.id}" type="button">
                <span class="calendar-task-project">${escapeHtml(project.name)}</span>
                <strong>${escapeHtml(task.name)}</strong>
                <span class="calendar-task-meta">
                  ${ownerBadge(task.owner) || ""}
                  ${priorityBadge(task.priority)}
                </span>
              </button>
            `;
          })
          .join("")}
      </div>
    </article>
  `;
}

function renderProjectsOverview() {
  const projects = activeProjects();
  if (!projects.length) {
    els.content.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>Nessun progetto attivo.</strong><br />
          Crea un nuovo progetto o apri l'Archivio per recuperare quelli archiviati.
        </div>
        ${
          projectCreateOpen
            ? projectCreateFormMarkup("empty")
            : `
              <div class="empty-actions">
                <button class="primary-action" id="emptyNewProjectBtn" type="button">Nuovo progetto</button>
              </div>
            `
        }
      </div>
    `;
    bindProjectOverviewActions();
    return;
  }

  els.content.innerHTML = `
    <div class="projects-page-actions">
      <button class="primary-action" id="overviewNewProjectBtn" type="button">Nuovo progetto</button>
      ${projectCreateOpen ? projectCreateFormMarkup("overview") : ""}
    </div>
    <div class="projects-overview" aria-label="Tutti i progetti">
      ${projects
        .map((project) => {
          const total = project.tasks.length;
          const doneStatusIds = project.statuses.filter((status) => status.type === "done").map((status) => status.id);
          const done = project.tasks.filter((task) => doneStatusIds.includes(task.statusId)).length;
          const overdue = project.tasks.filter((task) => task.dueDate && parseDate(task.dueDate) < startOfDay(today()) && !doneStatusIds.includes(task.statusId)).length;
          return `
            <article class="project-summary" tabindex="0">
              ${
                pendingRenameProjectId === project.id
                  ? `
                    <div class="project-summary-main">
                      <form class="inline-project-form rename-project-form" data-project-rename-form="${project.id}">
                        <label>
                          Nome progetto
                          <input type="text" name="projectName" maxlength="70" autocomplete="off" required value="${escapeHtml(project.name)}" />
                        </label>
                        <div class="popover-actions">
                          <button type="button" class="secondary-btn" data-cancel-project-rename>Chiudi</button>
                        </div>
                      </form>
                      <div class="project-summary-stats">
                        <span>${total} attività</span>
                        <span>${done} completate</span>
                        <span>${overdue} scadute</span>
                      </div>
                    </div>
                  `
                  : `
                    <div class="project-summary-main">
                      <button class="project-summary-title" data-open-project="${project.id}" type="button">
                        <strong>${escapeHtml(project.name)}</strong>
                      </button>
                      <span class="project-note-line ${project.note ? "" : "empty"}"${project.note ? "" : ' aria-hidden="true"'}>${project.note ? escapeHtml(project.note) : ""}</span>
                      <div class="project-summary-stats">
                        <span>${total} attività</span>
                        <span>${done} completate</span>
                        <span>${overdue} scadute</span>
                      </div>
                      <div class="project-quick-actions">
                        <button class="project-dashboard-btn" data-note-project="${project.id}" type="button">Nota</button>
                        <button class="project-dashboard-btn" data-open-project-dashboard="${project.id}" type="button">Dashboard</button>
                        <button class="project-dashboard-btn project-edit-btn" data-project-actions="${project.id}" type="button" aria-expanded="${pendingProjectActionsId === project.id}">Modifica</button>
                        ${
                          pendingProjectActionsId === project.id
                            ? `
                              <div class="project-actions-popover" data-project-actions-popover="${project.id}">
                                <button class="secondary-btn" data-archive-project="${project.id}" type="button">Archivia</button>
                                <button class="secondary-btn" data-rename-project="${project.id}" type="button">Rinomina</button>
                                <button class="danger-btn" data-delete-project="${project.id}" type="button" aria-label="Elimina progetto ${escapeHtml(project.name)}">Elimina</button>
                              </div>
                            `
                            : ""
                        }
                      </div>
                    </div>
                  `
              }
            </article>
          `;
        })
        .join("")}
    </div>
  `;

  bindProjectOverviewActions();
}

function renderArchiveOverview() {
  const projects = archivedProjects();
  els.content.innerHTML = `
    <div class="archive-page">
      ${
        projects.length
          ? `
            <div class="projects-overview" aria-label="Progetti archiviati">
              ${projects
                .map((project) => {
                  const total = project.tasks.length;
                  const doneStatusIds = project.statuses.filter((status) => status.type === "done").map((status) => status.id);
                  const done = project.tasks.filter((task) => doneStatusIds.includes(task.statusId)).length;
                  const archivedAt = project.archivedAt ? `Archiviato ${formatDateTime(project.archivedAt)}` : "Archiviato";
                  return `
                    <article class="project-summary archived-project-summary" tabindex="0">
                      <div class="project-summary-main">
                        <button class="project-summary-title" data-open-project="${project.id}" type="button">
                          <strong>${escapeHtml(project.name)}</strong>
                        </button>
                        <span class="project-note-line ${project.note ? "" : "empty"}"${project.note ? "" : ' aria-hidden="true"'}>${project.note ? escapeHtml(project.note) : ""}</span>
                        <div class="project-summary-stats">
                          <span>${total} attività</span>
                          <span>${done} completate</span>
                          <span>${archivedAt}</span>
                        </div>
                        <div class="project-quick-actions">
                          <button class="project-dashboard-btn" data-note-project="${project.id}" type="button">Nota</button>
                          <button class="project-dashboard-btn" data-open-project-dashboard="${project.id}" type="button">Dashboard</button>
                          <button class="project-dashboard-btn project-edit-btn" data-project-actions="${project.id}" type="button" aria-expanded="${pendingProjectActionsId === project.id}">Modifica</button>
                          ${
                            pendingProjectActionsId === project.id
                              ? `
                                <div class="project-actions-popover" data-project-actions-popover="${project.id}">
                                  <button class="secondary-btn" data-open-project="${project.id}" type="button">Apri</button>
                                  <button class="secondary-btn" data-restore-project="${project.id}" type="button">Ripristina</button>
                                  <button class="danger-btn" data-delete-project="${project.id}" type="button" aria-label="Elimina progetto ${escapeHtml(project.name)}">Elimina</button>
                                </div>
                              `
                              : ""
                          }
                        </div>
                      </div>
                    </article>
                  `;
                })
                .join("")}
            </div>
          `
          : `
            <div class="empty-state">
              <div>
                <strong>Archivio vuoto.</strong><br />
                I progetti archiviati appariranno qui e resteranno apribili.
              </div>
            </div>
          `
      }
    </div>
  `;
  bindProjectOverviewActions();
}

function renderProjectDashboard(tasks) {
  const project = activeProject();
  if (!project) return;
  const visibleTasks = Array.isArray(tasks) ? tasks : [];
  const total = visibleTasks.length;
  const doneStatusIds = project.statuses.filter((status) => status.type === "done").map((status) => status.id);
  const done = visibleTasks.filter((task) => doneStatusIds.includes(task.statusId)).length;
  const overdue = visibleTasks.filter((task) => isTaskOverdue(task, project)).length;
  const highPriority = visibleTasks.filter((task) => task.priority === "high").length;
  const unplanned = visibleTasks.filter((task) => !task.startDate && !task.dueDate).length;
  const progress = total ? Math.round((done / total) * 100) : 0;
  const upcoming = visibleTasks
    .filter((task) => task.dueDate && !isTaskOverdue(task, project) && !doneStatusIds.includes(task.statusId))
    .sort((a, b) => parseDate(a.dueDate) - parseDate(b.dueDate) || a.name.localeCompare(b.name))
    .slice(0, 6);

  els.content.innerHTML = `
    <div class="dashboard-view">
      <section class="dashboard-kpis" aria-label="Indicatori progetto">
        ${dashboardKpi("Attività", total)}
        ${dashboardKpi("Completamento", `${progress}%`)}
        ${dashboardKpi("Scadute", overdue, overdue ? "danger" : "")}
        ${dashboardKpi("Priorità alta", highPriority, highPriority ? "warning" : "")}
        ${dashboardKpi("Non pianificate", unplanned)}
      </section>
      <section class="dashboard-grid">
        <article class="dashboard-panel">
          <header>
            <h3>Stati</h3>
            <span>${total} attività</span>
          </header>
          <div class="dashboard-bars">
            ${project.statuses.map((status) => dashboardBar(status.name, visibleTasks.filter((task) => task.statusId === status.id).length, total, status)).join("")}
          </div>
        </article>
        <article class="dashboard-panel">
          <header>
            <h3>Responsabili</h3>
            <span>${ownerDashboardRows(visibleTasks).length}</span>
          </header>
          <div class="dashboard-bars">
            ${ownerDashboardRows(visibleTasks)
              .map((row) => dashboardBar(row.name, row.count, total))
              .join("") || `<div class="dashboard-empty">Nessun responsabile</div>`}
          </div>
        </article>
        <article class="dashboard-panel">
          <header>
            <h3>Priorità</h3>
            <span>${total} attività</span>
          </header>
          <div class="dashboard-bars">
            ${PRIORITY_OPTIONS.filter((option) => option.id !== "none")
              .map((option) => dashboardBar(option.label, visibleTasks.filter((task) => task.priority === option.id).length, total, null, option.className))
              .join("")}
          </div>
        </article>
        <article class="dashboard-panel dashboard-upcoming">
          <header>
            <h3>Prossime scadenze</h3>
            <span>${upcoming.length}</span>
          </header>
          <div class="deadline-task-list">
            ${
              upcoming
                .map(
                  (task) => `
                    <button class="deadline-task-row compact-dashboard-row" data-open-task-project="${project.id}" data-open-task="${task.id}" type="button">
                      <span class="deadline-task-name">${escapeHtml(task.name)}</span>
                      <span>${formatDate(task.dueDate)}</span>
                      <span>${ownerBadge(task.owner) || "-"}</span>
                    </button>
                  `,
                )
                .join("") || `<div class="dashboard-empty">Nessuna scadenza pianificata</div>`
            }
          </div>
        </article>
      </section>
    </div>
  `;

  bindGroupedTaskActions();
}

function dashboardKpi(label, value, tone = "") {
  return `
    <article class="dashboard-kpi ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function dashboardBar(label, count, total, status = null, className = "") {
  const percent = total ? Math.round((count / total) * 100) : 0;
  const style = status?.color ? ` style="--bar-color: ${status.color}; --bar-text: ${status.textColor || "#333"}"` : "";
  return `
    <div class="dashboard-bar ${className}"${style}>
      <div class="dashboard-bar-label">
        <span>${escapeHtml(label)}</span>
        <strong>${count}</strong>
      </div>
      <div class="dashboard-bar-track">
        <span style="width: ${percent}%"></span>
      </div>
    </div>
  `;
}

function ownerDashboardRows(tasks) {
  const owners = new Map();
  tasks.forEach((task) => {
    taskOwnersForTask(task).forEach((owner) => owners.set(owner, (owners.get(owner) || 0) + 1));
  });
  return [...owners.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function taskOwnersForTask(task) {
  return [
    ...new Set([String(task.owner || "").trim(), ...task.subtasks.map((subtask) => String(subtask.owner || "").trim())].filter(Boolean)),
  ];
}

function taskAssignedToOwner(task, owner) {
  return taskOwnersForTask(task).includes(owner);
}

function subtaskSearchText(item) {
  return `${item.name} ${item.owner || ""} ${item.dueDate || ""}`;
}

function renderOwnerAssignments() {
  const owner = String(state.ownerFilter || "").trim();
  const term = state.search.trim().toLowerCase();
  const groups = activeProjects()
    .map((project) => {
      const tasks = project.tasks.filter((task) => {
        const haystack = [
          project.name,
          task.name,
          task.owner,
          priorityOption(task.priority, true).label,
          task.notes,
          ...normalizeAttachments(task.attachments).map((item) => `${item.name} ${item.path || ""}`),
          ...task.subtasks.map(subtaskSearchText),
        ]
          .join(" ")
          .toLowerCase();
        return taskAssignedToOwner(task, owner) && (!term || haystack.includes(term));
      });
      return { project, tasks };
    })
    .filter((group) => group.tasks.length);

  if (!groups.length) {
    els.content.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>Nessuna attività assegnata.</strong><br />
          Non ci sono attività assegnate a ${escapeHtml(owner)} in questo spazio di lavoro.
        </div>
      </div>
    `;
    return;
  }

  els.content.innerHTML = `
    <div class="all-deadlines owner-assignments">
      ${groups
        .map(
          ({ project, tasks }) => `
            <section class="project-deadline-group">
              <header>
                <button class="project-group-title" data-open-project="${project.id}" type="button">${escapeHtml(project.name)}</button>
                <span>${tasks.length} attività</span>
              </header>
              <div class="deadline-task-list">
                ${tasks
                  .map((task) => {
                    const status = statusForTask(task.statusId, project) || { name: "No Status", type: "no-status" };
                    return `
                      <button class="deadline-task-row" data-open-task-project="${project.id}" data-open-task="${task.id}" type="button">
                        <span class="deadline-task-name">${escapeHtml(task.name)}</span>
                        <span>${formatDate(task.dueDate)}</span>
                        <span>${ownerBadge(task.owner) || "-"}</span>
                        <span class="status-pill ${status.type}" ${statusStyle(status)}>${escapeHtml(status.name)}</span>
                        ${priorityBadge(task.priority)}
                        ${isTaskOverdue(task, project) ? overdueBadge() : ""}
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </section>
          `,
        )
        .join("")}
    </div>
  `;

  bindGroupedTaskActions();
}

function renderPriorityAssignments() {
  const option = priorityOption(state.priorityFilter, false);
  const term = state.search.trim().toLowerCase();
  const groups = activeProjects()
    .map((project) => {
      const tasks = project.tasks.filter((task) => {
        const haystack = [
          project.name,
          task.name,
          task.owner,
          task.notes,
          priorityOption(task.priority, true).label,
          ...normalizeAttachments(task.attachments).map((item) => `${item.name} ${item.path || ""}`),
          ...task.subtasks.map(subtaskSearchText),
        ]
          .join(" ")
          .toLowerCase();
        return task.priority === option?.id && (!term || haystack.includes(term));
      });
      return { project, tasks };
    })
    .filter((group) => group.tasks.length);

  if (!groups.length) {
    els.content.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>Nessuna attività trovata.</strong><br />
          Non ci sono attività con priorità ${escapeHtml(option?.label || "")} in questo spazio di lavoro.
        </div>
      </div>
    `;
    return;
  }

  els.content.innerHTML = `
    <div class="all-deadlines priority-assignments">
      ${groups
        .map(
          ({ project, tasks }) => `
            <section class="project-deadline-group">
              <header>
                <button class="project-group-title" data-open-project="${project.id}" type="button">${escapeHtml(project.name)}</button>
                <span>${tasks.length} attività</span>
              </header>
              <div class="deadline-task-list">
                ${tasks
                  .map((task) => {
                    const status = statusForTask(task.statusId, project) || { name: "No Status", type: "no-status" };
                    return `
                      <button class="deadline-task-row" data-open-task-project="${project.id}" data-open-task="${task.id}" type="button">
                        <span class="deadline-task-name">${escapeHtml(task.name)}</span>
                        <span>${formatDate(task.dueDate)}</span>
                        <span>${ownerBadge(task.owner)}</span>
                        <span class="status-pill ${status.type}" ${statusStyle(status)}>${escapeHtml(status.name)}</span>
                        ${priorityBadge(task.priority)}
                        ${isTaskOverdue(task, project) ? overdueBadge() : ""}
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </section>
          `,
        )
        .join("")}
    </div>
  `;

  bindGroupedTaskActions();
}

function projectCreateFormMarkup(context) {
  return `
    <form class="inline-project-form" data-project-create-form="${context}">
      <label>
        Nome progetto
        <input type="text" name="projectName" maxlength="70" autocomplete="off" required />
      </label>
      <div class="popover-actions">
        <button type="button" class="secondary-btn" data-cancel-project-create>Annulla</button>
        <button type="submit" class="primary-btn">Crea</button>
      </div>
    </form>
  `;
}

function bindProjectOverviewActions() {
  els.content.querySelectorAll("#emptyNewProjectBtn, #overviewNewProjectBtn").forEach((button) => {
    button.addEventListener("click", () => {
      pendingRenameProjectId = null;
      pendingProjectActionsId = "";
      projectCreateOpen = true;
      render();
      els.content.querySelector(".inline-project-form input")?.focus();
    });
  });

  els.content.querySelectorAll("[data-project-create-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = new FormData(form).get("projectName")?.toString().trim();
      if (!name) return;
      projectCreateOpen = false;
      pendingProjectActionsId = "";
      createProject(name);
    });
  });

  els.content.querySelectorAll("[data-cancel-project-create]").forEach((button) => {
    button.addEventListener("click", () => {
      projectCreateOpen = false;
      render();
    });
  });

  els.content.querySelectorAll("[data-note-project]").forEach((button) => {
    button.addEventListener("click", () => {
      pendingProjectActionsId = "";
      openProjectNoteDialog(button.dataset.noteProject);
    });
  });

  els.content.querySelectorAll("[data-project-actions]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      pendingRenameProjectId = null;
      projectCreateOpen = false;
      pendingProjectActionsId = pendingProjectActionsId === button.dataset.projectActions ? "" : button.dataset.projectActions;
      render();
    });
  });

  els.content.querySelectorAll("[data-archive-project]").forEach((button) => {
    button.addEventListener("click", () => {
      pendingProjectActionsId = "";
      archiveProject(button.dataset.archiveProject);
    });
  });

  els.content.querySelectorAll("[data-restore-project]").forEach((button) => {
    button.addEventListener("click", () => {
      pendingProjectActionsId = "";
      restoreProject(button.dataset.restoreProject);
    });
  });

  els.content.querySelectorAll("[data-rename-project]").forEach((button) => {
    button.addEventListener("click", () => {
      pendingProjectActionsId = "";
      pendingRenameProjectId = button.dataset.renameProject;
      projectCreateOpen = false;
      render();
      els.content.querySelector("[data-project-rename-form] input")?.focus();
    });
  });

  els.content.querySelectorAll("[data-project-rename-form]").forEach((form) => {
    form.addEventListener("click", (event) => event.stopPropagation());
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = new FormData(form).get("projectName")?.toString().trim();
      if (!name) return;
      renameProject(form.dataset.projectRenameForm, name);
    });
  });

  els.content.querySelectorAll("[data-cancel-project-rename]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = button.closest("[data-project-rename-form]");
      const input = form?.querySelector("input");
      if (form && input?.value.trim()) {
        renameProject(form.dataset.projectRenameForm, input.value);
        return;
      }
      pendingRenameProjectId = null;
      render();
    });
  });

  els.content.querySelectorAll("[data-open-project]").forEach((button) => {
    button.addEventListener("click", () => {
      pendingProjectActionsId = "";
      openProjectTab(button.dataset.openProject, "board");
    });
  });
  els.content.querySelectorAll("[data-open-project-dashboard]").forEach((button) => {
    button.addEventListener("click", () => {
      pendingProjectActionsId = "";
      openProjectTab(button.dataset.openProjectDashboard, "dashboard");
    });
  });
  els.content.querySelectorAll("[data-delete-project]").forEach((button) => {
    button.addEventListener("click", () => {
      const projectId = button.dataset.deleteProject;
      pendingProjectActionsId = "";
      renderContent();
      openProjectDeleteDialog(projectId);
    });
  });
}

document.addEventListener("click", (event) => {
  if (!pendingProjectActionsId) return;
  if (event.target.closest("[data-project-actions], .project-actions-popover")) return;
  pendingProjectActionsId = "";
  render();
});

function renderAllProjectDeadlines() {
  const term = state.search.trim().toLowerCase();
  const groups = activeProjects()
    .map((project) => {
      const tasks = project.tasks.filter((task) => {
        const haystack = [
          project.name,
          task.name,
          task.owner,
          task.notes,
          ...normalizeAttachments(task.attachments).map((item) => `${item.name} ${item.path || ""}`),
          ...task.subtasks.map(subtaskSearchText),
        ]
          .join(" ")
          .toLowerCase();
        return matchDeadline(task, project) && (!term || haystack.includes(term));
      });
      return { project, tasks };
    })
    .filter((group) => group.tasks.length);

  if (!groups.length) {
    els.content.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>Nessuna attività trovata.</strong><br />
          Non ci sono attività per il filtro "${escapeHtml(deadlineFilterName(state.deadlineFilter))}".
        </div>
      </div>
    `;
    return;
  }

  els.content.innerHTML = `
    <div class="all-deadlines">
      ${groups
        .map(
          ({ project, tasks }) => `
            <section class="project-deadline-group">
              <header>
                <button class="project-group-title" data-open-project="${project.id}" type="button">${escapeHtml(project.name)}</button>
                <span>${tasks.length} attività</span>
              </header>
              <div class="deadline-task-list">
                ${tasks
                  .map((task) => {
                    const status = statusForTask(task.statusId, project) || { name: "No Status", type: "no-status" };
                    return `
                      <button class="deadline-task-row" data-open-task-project="${project.id}" data-open-task="${task.id}" type="button">
                        <span class="deadline-task-name">${escapeHtml(task.name)}</span>
                        <span>${formatDate(task.dueDate)}</span>
                        <span>${ownerBadge(task.owner) || "-"}</span>
                        <span class="status-pill ${status.type}" ${statusStyle(status)}>${escapeHtml(status.name)}</span>
                        ${priorityBadge(task.priority)}
                        ${isTaskOverdue(task, project) ? overdueBadge() : ""}
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </section>
          `,
        )
        .join("")}
    </div>
  `;

  bindGroupedTaskActions();
}

function bindGroupedTaskActions() {
  els.content.querySelectorAll("[data-open-project]").forEach((button) => {
    button.addEventListener("click", () => openProjectTab(button.dataset.openProject, "board"));
  });

  els.content.querySelectorAll("[data-open-task]").forEach((button) => {
    button.addEventListener("click", () => {
      openProjectTab(button.dataset.openTaskProject, "board");
      openTaskDialog(button.dataset.openTask);
    });
  });
}

function renderBoard(tasks) {
  const project = activeProject();
  const visibleStatuses = project.statuses.filter((status) => !status.hidden);
  els.content.innerHTML = `
    <div class="board">
      ${visibleStatuses
        .map((status, index) => {
          const columnTasks = tasks.filter((task) => task.statusId === status.id);
          const doneClass = status.type === "done" ? "done-column" : "";
          return `
            <section class="column ${status.type} ${doneClass}" ${columnStyle(status)} data-drop-status="${status.id}" data-status-id="${status.id}" data-status-index="${index}">
              <header class="column-head">
                <span class="status-pill ${status.type}" ${statusStyle(status)}>${escapeHtml(status.name)}</span>
                <button class="icon-btn status-menu-btn" data-status-menu="${status.id}" title="Opzioni stato" aria-label="Opzioni stato">…</button>
              </header>
              <div class="card-stack" data-drop-status="${status.id}">
                ${columnTasks.map(taskCard).join("")}
                <button class="add-card" data-new-status="${status.id}">+ <span>New</span></button>
              </div>
            </section>
          `;
        })
        .join("")}
    </div>
  `;

  // Click su card e pulsanti +/menu sono gestiti da bindContentDelegation() (delega su #content).
  bindBoardDragAndDrop();
  bindColumnReorder();
}

function openStatusSettings() {
  if (!activeProject()) return;
  renderStatusVisibilityList();
  els.statusDialog.showModal();
}

function renderStatusVisibilityList() {
  if (!activeProject()) {
    els.statusVisibilityList.innerHTML = "";
    return;
  }
  const statuses = activeProject().statuses;
  els.statusVisibilityList.innerHTML = statuses
    .map(
      (status) => `
        <label class="status-toggle-row">
          <span class="status-dot" ${statusStyle(status)}></span>
          <span>${escapeHtml(status.name)}</span>
          <input type="checkbox" data-status-visible="${status.id}" ${status.hidden ? "" : "checked"} />
        </label>
      `,
    )
    .join("");

  els.statusVisibilityList.querySelectorAll("[data-status-visible]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const status = activeProject().statuses.find((item) => item.id === checkbox.dataset.statusVisible);
      if (!status) return;
      status.hidden = !checkbox.checked;
      saveState();
      renderContent();
      renderStatusVisibilityList();
    });
  });
}

function openStatusMenu(statusId, anchor) {
  closeStatusMenu();
  const status = activeProject().statuses.find((item) => item.id === statusId);
  if (!status) return;

  const menu = document.createElement("div");
  menu.className = "status-menu";
  menu.innerHTML = `
    <button data-action="rename">Rinominare</button>
    <button data-action="hide">Nascondere</button>
    <button data-action="delete">Cancellare</button>
    <div class="menu-separator"></div>
    <div class="color-grid" aria-label="Colori standard">
      ${STATUS_COLORS.map(
        (color) => `
          <button class="color-choice" data-color="${color.value}" data-text-color="${color.text}" title="${color.name}" aria-label="${color.name}">
            <span style="background: ${color.value}; border-color: ${color.text}"></span>
          </button>
        `,
      ).join("")}
    </div>
  `;

  document.body.appendChild(menu);
  const rect = anchor.getBoundingClientRect();
  menu.style.left = `${Math.min(rect.left, window.innerWidth - 220)}px`;
  menu.style.top = `${rect.bottom + 6}px`;

  menu.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    const colorButton = event.target.closest("[data-color]");

    if (actionButton) runStatusAction(statusId, actionButton.dataset.action);
    if (colorButton) setStatusColor(statusId, colorButton.dataset.color, colorButton.dataset.textColor);
  });
}

function closeStatusMenu() {
  document.querySelector(".status-menu")?.remove();
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".status-menu") && !event.target.closest("[data-status-menu]")) closeStatusMenu();
});

function runStatusAction(statusId, action) {
  closeStatusMenu();
  if (action === "rename") renameStatus(statusId);
  if (action === "hide") hideStatus(statusId);
  if (action === "delete") openStatusDeleteDialog(statusId);
}

function renameStatus(statusId) {
  const status = activeProject().statuses.find((item) => item.id === statusId);
  if (!status) return;
  const name = prompt("Nuovo nome stato", status.name);
  if (!name?.trim()) return;
  status.name = name.trim();
  saveState();
  render();
}

function hideStatus(statusId) {
  const status = activeProject().statuses.find((item) => item.id === statusId);
  if (!status) return;
  status.hidden = true;
  saveState();
  render();
}

function openStatusDeleteDialog(statusId) {
  const status = activeProject()?.statuses.find((item) => item.id === statusId);
  if (!status) return;
  els.statusDeleteId.value = status.id;
  els.statusDeleteName.textContent = status.name;
  els.statusDeleteDialog.showModal();
}

function deleteStatus(statusId) {
  const project = activeProject();
  if (!project || project.statuses.length <= 1) return;
  const projectSnapshot = structuredClone(project);
  const deletedStatus = project.statuses.find((status) => status.id === statusId);
  const fallback = project.statuses.find((status) => status.id !== statusId && !status.hidden) || project.statuses.find((status) => status.id !== statusId);
  project.tasks.forEach((task) => {
    if (task.statusId === statusId && fallback) task.statusId = fallback.id;
  });
  project.statuses = project.statuses.filter((status) => status.id !== statusId);
  saveState();
  render();
  if (deletedStatus) {
    registerUndo(`Stato "${deletedStatus.name}" cancellato.`, () => {
      const index = state.projects.findIndex((item) => item.id === projectSnapshot.id);
      if (index < 0) return;
      state.projects.splice(index, 1, projectSnapshot);
      state.activeProjectId = projectSnapshot.id;
      state.route = "project";
      saveState();
      render();
    });
  }
}

function setStatusColor(statusId, color, textColor) {
  const status = activeProject().statuses.find((item) => item.id === statusId);
  if (!status) return;
  status.color = color;
  status.textColor = textColor;
  closeStatusMenu();
  saveState();
  render();
}

function statusStyle(status) {
  if (!status.color) return "";
  return `style="--status-color: ${status.color}; background: ${status.color}; color: ${status.textColor || "#333"}"`;
}

function columnStyle(status) {
  if (!status.color) return "";
  return `style="--status-color: ${status.color}"`;
}

function bindColumnReorder() {
  els.content.querySelectorAll(".column[data-status-id] .column-head").forEach((head) => {
    head.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button")) return;
      const column = head.closest(".column");
      const rect = column.getBoundingClientRect();
      columnDrag = {
        active: false,
        column,
        ghost: null,
        placeholder: null,
        statusId: column.dataset.statusId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
    });
  });
}

document.addEventListener("pointermove", (event) => {
  if (!columnDrag) return;

  const distance = Math.hypot(event.clientX - columnDrag.startX, event.clientY - columnDrag.startY);
  if (!columnDrag.active && distance < 8) return;
  if (!columnDrag.active) startColumnDrag(event);

  columnDrag.active = true;
  moveColumnGhost(event.clientX, event.clientY);
  placeColumnPlaceholder(event.clientX);
  event.preventDefault();
});

document.addEventListener("pointerup", () => {
  if (!columnDrag) return;
  const wasActive = columnDrag.active;
  const statusId = columnDrag.statusId;
  const nextStatusId = columnDrag.placeholder?.nextElementSibling?.dataset.statusId || null;
  cleanupColumnDrag();
  if (wasActive) reorderStatus(statusId, nextStatusId);
});

function startColumnDrag(event) {
  const rect = columnDrag.column.getBoundingClientRect();
  columnDrag.ghost = columnDrag.column.cloneNode(true);
  columnDrag.placeholder = document.createElement("section");
  columnDrag.placeholder.className = "column column-placeholder";
  columnDrag.placeholder.style.width = `${rect.width}px`;
  columnDrag.placeholder.style.height = `${rect.height}px`;

  columnDrag.ghost.classList.add("column-ghost");
  columnDrag.ghost.style.width = `${rect.width}px`;
  document.body.appendChild(columnDrag.ghost);
  columnDrag.column.parentElement.insertBefore(columnDrag.placeholder, columnDrag.column.nextSibling);
  columnDrag.column.classList.add("column-dragging");
  document.body.classList.add("dragging-column");
  moveColumnGhost(event.clientX, event.clientY);
}

function moveColumnGhost(x, y) {
  if (!columnDrag?.ghost) return;
  columnDrag.ghost.style.transform = `translate3d(${x - columnDrag.offsetX}px, ${y - columnDrag.offsetY}px, 0) rotate(0.5deg)`;
}

function placeColumnPlaceholder(x) {
  const board = els.content.querySelector(".board");
  if (!board || !columnDrag?.placeholder) return;
  const columns = [...board.querySelectorAll(".column[data-status-id]:not(.column-dragging)")];
  const beforeColumn = columns.find((column) => {
    const rect = column.getBoundingClientRect();
    return x < rect.left + rect.width / 2;
  });
  board.insertBefore(columnDrag.placeholder, beforeColumn || board.querySelector(".column.custom"));
}

function cleanupColumnDrag() {
  columnDrag?.column.classList.remove("column-dragging");
  columnDrag?.ghost?.remove();
  columnDrag?.placeholder?.remove();
  columnDrag = null;
  document.body.classList.remove("dragging-column");
}

function reorderStatus(statusId, nextStatusId) {
  const project = activeProject();
  const fromIndex = project.statuses.findIndex((status) => status.id === statusId);
  if (fromIndex < 0) return;
  const [status] = project.statuses.splice(fromIndex, 1);
  const toIndex = nextStatusId ? project.statuses.findIndex((item) => item.id === nextStatusId) : project.statuses.length;
  project.statuses.splice(toIndex < 0 ? project.statuses.length : toIndex, 0, status);
  saveState();
  renderContent();
}
// Listener delegati agganciati UNA sola volta al contenitore #content (stabile tra i render).
// Sostituiscono i listener riattaccati a ogni card/riga in renderBoard/renderTable/renderTimeline.
function bindContentDelegation() {
  els.content.addEventListener("click", (event) => {
    const statusMenu = event.target.closest("[data-status-menu]");
    if (statusMenu) {
      event.stopPropagation();
      openStatusMenu(statusMenu.dataset.statusMenu, statusMenu);
      return;
    }
    const newStatus = event.target.closest("[data-new-status]");
    if (newStatus) {
      event.stopPropagation();
      openTaskDialog(null, newStatus.dataset.newStatus);
      return;
    }
    const sortColumn = event.target.closest("[data-sort-column]");
    if (sortColumn) {
      sortTableBy(sortColumn.dataset.sortColumn);
      return;
    }
    const card = event.target.closest("[data-task]");
    if (card) {
      if (suppressNextTaskClick) {
        suppressNextTaskClick = false;
        return;
      }
      const taskId = card.dataset.task;
      if (!taskId) return;
      openTaskDialog(taskId);
    }
  });

  // Avvio drag con puntatore: solo sulle card della board.
  els.content.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const card = event.target.closest(".task-card");
    if (!card || !card.closest(".board")) return;
    pointerDrag = {
      active: false,
      card,
      ghost: null,
      placeholder: null,
      offsetX: 0,
      offsetY: 0,
      taskId: card.dataset.task,
      startX: event.clientX,
      startY: event.clientY,
    };
  });

  // Spostamento tra colonne da tastiera: solo sulle card della board.
  els.content.addEventListener("keydown", (event) => {
    if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    const card = event.target.closest(".task-card");
    if (!card || !card.closest(".board")) return;
    event.preventDefault();
    moveTaskByKeyboard(card.dataset.task, event.key === "ArrowRight" ? 1 : -1);
  });
}

function bindBoardDragAndDrop() {
  els.content.querySelectorAll("[data-drop-status]").forEach((dropZone) => {
    dropZone.addEventListener("dragover", (event) => {
      if (!draggedTaskId) return;
      event.preventDefault();
      event.stopPropagation();
      dropZone.closest(".column")?.classList.add("drop-target");
      event.dataTransfer.dropEffect = "move";
    });

    dropZone.addEventListener("dragleave", (event) => {
      const column = dropZone.closest(".column");
      if (!column || column.contains(event.relatedTarget)) return;
      column.classList.remove("drop-target");
    });

    dropZone.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const statusId = dropZone.dataset.dropStatus;
      moveTaskToStatus(event.dataTransfer.getData("text/plain") || draggedTaskId, statusId);
    });
  });
}

document.addEventListener("pointermove", (event) => {
  if (!pointerDrag) return;

  const distance = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY);
  if (!pointerDrag.active && distance < 7) return;

  if (!pointerDrag.active) startPointerDrag(event);

  pointerDrag.active = true;
  draggedTaskId = pointerDrag.taskId;
  moveDragGhost(event.clientX, event.clientY);
  highlightDropTarget(event.clientX, event.clientY);
  event.preventDefault();
});

document.addEventListener("pointerup", (event) => {
  if (!pointerDrag) return;

  const wasActive = pointerDrag.active;
  const taskId = pointerDrag.taskId;
  cleanupPointerDrag();

  if (!wasActive) return;

  const dropZone = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-drop-status]");
  if (dropZone) moveTaskToStatus(taskId, dropZone.dataset.dropStatus);
});

function highlightDropTarget(x, y) {
  els.content.querySelectorAll(".drop-target").forEach((column) => column.classList.remove("drop-target"));
  const column = document.elementFromPoint(x, y)?.closest(".column[data-drop-status]");
  column?.classList.add("drop-target");

  if (!pointerDrag?.placeholder) return;
  const stack = column?.querySelector(".card-stack");
  if (stack && pointerDrag.placeholder.parentElement !== stack) {
    stack.insertBefore(pointerDrag.placeholder, stack.querySelector(".add-card"));
  }
}

function startPointerDrag(event) {
  const rect = pointerDrag.card.getBoundingClientRect();
  pointerDrag.offsetX = event.clientX - rect.left;
  pointerDrag.offsetY = event.clientY - rect.top;
  pointerDrag.ghost = pointerDrag.card.cloneNode(true);
  pointerDrag.placeholder = document.createElement("div");
  pointerDrag.placeholder.className = "drop-placeholder";
  pointerDrag.placeholder.style.height = `${rect.height}px`;

  pointerDrag.ghost.classList.add("drag-ghost");
  pointerDrag.ghost.removeAttribute("data-task");
  pointerDrag.ghost.style.width = `${rect.width}px`;
  document.body.appendChild(pointerDrag.ghost);

  pointerDrag.card.classList.add("dragging");
  document.body.classList.add("dragging-task");
  suppressNextTaskClick = true;
}

function moveDragGhost(x, y) {
  if (!pointerDrag?.ghost) return;
  pointerDrag.ghost.style.transform = `translate3d(${x - pointerDrag.offsetX}px, ${y - pointerDrag.offsetY}px, 0) rotate(1deg)`;
}

function cleanupPointerDrag() {
  pointerDrag?.card.classList.remove("dragging");
  pointerDrag?.ghost?.remove();
  pointerDrag?.placeholder?.remove();
  pointerDrag = null;
  draggedTaskId = null;
  document.body.classList.remove("dragging-task");
  els.content.querySelectorAll(".drop-target").forEach((column) => column.classList.remove("drop-target"));
}

function moveTaskByKeyboard(taskId, direction) {
  const project = activeProject();
  if (!project) return;
  const task = project.tasks.find((item) => item.id === taskId);
  if (!task) return;
  const visibleStatuses = project.statuses.filter((status) => !status.hidden);
  const currentIndex = visibleStatuses.findIndex((status) => status.id === task.statusId);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= visibleStatuses.length) return;
  task.statusId = visibleStatuses[nextIndex].id;
  saveState();
  renderContent();
  const movedCard = els.content.querySelector(`.task-card[data-task="${CSS.escape(taskId)}"]`);
  movedCard?.focus();
}

function moveTaskToStatus(taskId, statusId) {
  const project = activeProject();
  const task = project.tasks.find((item) => item.id === taskId);
  if (!task || !statusId || task.statusId === statusId) {
    renderContent();
    return;
  }

  task.statusId = statusId;
  saveState();
  renderContent();
}
function renderTable(tasks) {
  const columns = [
    { key: "name", label: "Nome attività", width: 260 },
    { key: "startDate", label: "Inizio", width: 125 },
    { key: "dueDate", label: "Due date", width: 125 },
    { key: "owner", label: "Responsabile", width: 145 },
    { key: "priority", label: "Priorità", width: 110 },
    { key: "status", label: "Stato", width: 130 },
    { key: "notes", label: "Note", width: 240 },
    { key: "subtasks", label: "Sotto-attività", width: 210 },
    { key: "attachments", label: "Allegati", width: 170 },
    { key: "progress", label: "Avanzamento", width: 125 },
  ];
  const sortedTasks = sortedTableTasks(tasks);
  const columnWidth = (column) => state.ui.tableColumnWidths?.[column.key] || column.width;
  const totalWidth = columns.reduce((sum, column) => sum + columnWidth(column), 0);

  els.content.innerHTML = `
    <div class="table-wrap">
      <table style="width: ${totalWidth}px">
        <colgroup>
          ${columns.map((column) => `<col style="width: ${columnWidth(column)}px" />`).join("")}
        </colgroup>
        <thead>
          <tr>
            ${columns
              .map(
                (column) => `
                  <th data-column="${column.key}">
                    <button class="sort-header" data-sort-column="${column.key}" type="button">
                      <span>${column.label}</span>
                      <span class="sort-indicator">${sortIndicator(column.key)}</span>
                    </button>
                    <span class="column-resizer" data-resize-column="${column.key}" aria-hidden="true"></span>
                  </th>
                `,
              )
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${sortedTasks
            .map((task) => {
              const status = statusFor(task.statusId);
              return `
                <tr data-task="${task.id}">
                  <td>
                    <div class="table-task">
                      <strong>${escapeHtml(task.name)}</strong>
                    </div>
                  </td>
                  <td>${formatDate(task.startDate)}</td>
                  <td>${formatDate(task.dueDate)} ${isTaskOverdue(task) ? overdueBadge() : ""}</td>
                  <td>${ownerBadge(task.owner) || "-"}</td>
                  <td>${priorityBadge(task.priority) || "ND"}</td>
                  <td><span class="status-pill ${status.type}">${escapeHtml(status.name)}</span></td>
                  <td>${task.notes ? `<span class="table-note">${escapeHtml(task.notes)}</span>` : "-"}</td>
                  <td>${tableSubtasks(task)}</td>
                  <td>${tableAttachments(task)}</td>
                  <td>${completion(task)}%</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  // Click su riga e intestazioni di ordinamento: gestiti da bindContentDelegation() (delega su #content).
  bindTableColumnResize();
}

function renderTimeline(tasks) {
  const project = activeProject();
  const sortedTasks = [...tasks].sort((a, b) => timelineSortValue(a) - timelineSortValue(b) || a.name.localeCompare(b.name));
  const planned = sortedTasks.filter((task) => task.startDate || task.dueDate);
  const unplanned = sortedTasks.filter((task) => !task.startDate && !task.dueDate);

  els.content.innerHTML = `
    <div class="timeline-view">
      <div class="timeline-rail" aria-hidden="true"></div>
      ${planned.map((task) => timelineTaskRow(task, project)).join("")}
      ${
        unplanned.length
          ? `
            <section class="timeline-unplanned">
              <h3>Non pianificate</h3>
              <div class="timeline-unplanned-grid">
                ${unplanned.map((task) => timelineTaskRow(task, project, true)).join("")}
              </div>
            </section>
          `
          : ""
      }
    </div>
  `;
  // Click su righe timeline: gestito da bindContentDelegation() (delega su #content).
}

function timelineTaskRow(task, project, compact = false) {
  const status = statusForTask(task.statusId, project) || { name: "No Status", type: "no-status" };
  const overdue = isTaskOverdue(task, project);
  const start = task.startDate ? formatDate(task.startDate) : "";
  const due = task.dueDate ? formatDate(task.dueDate) : "";
  const dateLabel = due || start || "Senza data";
  const range = start && due && start !== due ? `${start} - ${due}` : dateLabel;
  const completionValue = completion(task);
  return `
    <button class="timeline-item ${compact ? "compact" : ""} ${overdue ? "is-overdue" : ""}" data-task="${task.id}" type="button">
      <span class="timeline-date">${escapeHtml(dateLabel)}</span>
      <span class="timeline-dot" aria-hidden="true"></span>
      <span class="timeline-card">
        <span class="timeline-card-head">
          <strong>${escapeHtml(task.name)}</strong>
          <span class="status-pill ${status.type}" ${statusStyle(status)}>${escapeHtml(status.name)}</span>
        </span>
        ${task.notes ? `<span class="timeline-note">${escapeHtml(task.notes)}</span>` : ""}
        <span class="timeline-meta">
          <span>${escapeHtml(range)}</span>
          ${overdue ? overdueBadge() : ""}
          ${taskOwnerBadges(task)}
          ${priorityBadge(task.priority)}
          ${attachmentBadge(task)}
          <span>${completionValue}%</span>
        </span>
      </span>
    </button>
  `;
}

function timelineSortValue(task) {
  return dateSortValue(task.dueDate || task.startDate);
}

function sortedTableTasks(tasks) {
  const sort = state.ui.tableSort || { key: "dueDate", direction: "asc" };
  const direction = sort.direction === "desc" ? -1 : 1;
  return [...tasks].sort((a, b) => compareTableValue(a, b, sort.key) * direction || a.name.localeCompare(b.name));
}

function compareTableValue(a, b, key) {
  if (key === "startDate") return dateSortValue(a.startDate) - dateSortValue(b.startDate);
  if (key === "dueDate") return dueDateSortValue(a) - dueDateSortValue(b);
  if (key === "status") return statusFor(a.statusId).name.localeCompare(statusFor(b.statusId).name);
  if (key === "priority") return prioritySortValue(a.priority) - prioritySortValue(b.priority);
  if (key === "subtasks") return a.subtasks.length - b.subtasks.length;
  if (key === "attachments") return normalizeAttachments(a.attachments).length - normalizeAttachments(b.attachments).length;
  if (key === "progress") return completion(a) - completion(b);
  return String(a[key] || "").localeCompare(String(b[key] || ""));
}

function prioritySortValue(priority) {
  return { high: 1, medium: 2, low: 3, none: 4 }[priorityOption(priority, true).id] || 4;
}

function sortTableBy(key) {
  const current = state.ui.tableSort || { key: "dueDate", direction: "asc" };
  state.ui.tableSort = {
    key,
    direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
  };
  saveState();
  renderContent();
}

function sortIndicator(key) {
  const sort = state.ui.tableSort || { key: "dueDate", direction: "asc" };
  if (sort.key !== key) return "↕";
  return sort.direction === "asc" ? "↑" : "↓";
}

function bindTableColumnResize() {
  els.content.querySelectorAll("[data-resize-column]").forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const column = handle.closest("th");
      const key = handle.dataset.resizeColumn;
      const startX = event.clientX;
      const startWidth = column.getBoundingClientRect().width;

      const table = column.closest("table");
      const onMove = (moveEvent) => {
        const width = Math.max(80, Math.round(startWidth + moveEvent.clientX - startX));
        state.ui.tableColumnWidths = { ...(state.ui.tableColumnWidths || {}), [key]: width };
        const index = [...column.parentElement.children].indexOf(column);
        const col = els.content.querySelectorAll("col")[index];
        if (col) col.style.width = `${width}px`;
        if (table) {
          const total = [...els.content.querySelectorAll("col")].reduce((sum, item) => sum + (parseFloat(item.style.width) || 0), 0);
          table.style.width = `${total}px`;
        }
      };

      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        saveState();
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  });
}

function taskCard(task) {
  const overdue = isTaskOverdue(task);
  return `
    <button class="task-card ${overdue ? "is-overdue" : ""}" data-task="${task.id}" type="button" aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight" title="Alt+← / Alt+→ per spostare tra le colonne">
      <h3>${escapeHtml(task.name)}</h3>
      ${task.notes ? `<div class="task-note">${escapeHtml(task.notes)}</div>` : ""}
      ${progressMarkup(task)}
      <div class="task-meta">
        ${task.dueDate ? `<span>${formatDate(task.dueDate)}</span>` : ""}
        ${overdue ? overdueBadge() : ""}
        ${taskOwnerBadges(task)}
        ${priorityBadge(task.priority)}
        ${attachmentBadge(task)}
        ${syncConflictBadge(task)}
      </div>
    </button>
  `;
}

function attachmentBadge(task) {
  const count = normalizeAttachments(task.attachments).length;
  if (!count) return "";
  return `<span class="attachment-badge">Allegati ${count}</span>`;
}

function syncConflictBadge(task) {
  if (!task?.syncConflict?.alternatives?.length) return "";
  return `<span class="sync-conflict-badge" title="Modifica concorrente rilevata durante la sincronizzazione. Apri l'attività per rivederla.">⚠︎ Conflitto sync</span>`;
}

function taskOwnerBadges(task) {
  const mainOwner = String(task.owner || "").trim();
  const subtaskOwners = [
    ...new Set(task.subtasks.map((subtask) => String(subtask.owner || "").trim()).filter(Boolean)),
  ].filter((owner) => owner !== mainOwner);
  return `${ownerBadge(mainOwner)}${subtaskOwners.map((owner) => `<span class="owner-badge subtask-owner-badge" title="Responsabile sotto-attività">${escapeHtml(owner)}</span>`).join("")}`;
}

function progressMarkup(task) {
  if (!task.subtasks.length) return "";

  const percent = completion(task);
  const segments = task.subtasks.map((subtask) => `<span class="${subtaskSegmentClass(subtask)}"></span>`).join("");

  return `
    <div class="progress-row">
      <div class="progress" style="--segments: ${task.subtasks.length}" aria-label="${task.subtasks.length} sotto-attività, ${percent}% completato">
        ${segments}
      </div>
      <span>${percent}%</span>
    </div>
  `;
}

function subtaskSegmentClass(subtask) {
  if (subtask.done) return "closed";
  if (isSubtaskOverdue(subtask)) return "overdue";
  return "open";
}

function isSubtaskOverdue(subtask) {
  return Boolean(subtask.dueDate && parseDate(subtask.dueDate) < startOfDay(today()));
}

function tableSubtasks(task) {
  if (!task.subtasks.length) return "";
  return `
    <div class="table-subtasks">
      ${task.subtasks
        .map((subtask) => `<span>${subtask.done ? "✓" : "□"} ${escapeHtml(subtask.name)}${subtask.owner ? ` · ${escapeHtml(subtask.owner)}` : ""}${subtask.dueDate ? ` · ${formatDate(subtask.dueDate)}` : ""}</span>`)
        .join("")}
    </div>
  `;
}

function tableAttachments(task) {
  const attachments = normalizeAttachments(task.attachments);
  if (!attachments.length) return "-";
  return `<div class="table-subtasks">${attachments.map((attachment) => `<span>${escapeHtml(attachment.name)}</span>`).join("")}</div>`;
}

function filteredTasks() {
  const project = activeProject();
  if (!project) return [];
  const term = state.search.trim().toLowerCase();
  return project.tasks.filter((task) => {
    const matchesDeadline = matchDeadline(task, project);
    const haystack = [
      task.name,
      task.owner,
      priorityOption(task.priority, true).label,
      task.notes,
      ...normalizeAttachments(task.attachments).map((item) => `${item.name} ${item.path || ""}`),
      ...task.subtasks.map(subtaskSearchText),
    ]
      .join(" ")
      .toLowerCase();
    return matchesDeadline && (!term || haystack.includes(term));
  });
}

function matchDeadline(task, project = activeProject()) {
  if (state.deadlineFilter === "all") return true;
  if (state.deadlineFilter === "planned") return Boolean(task.startDate || task.dueDate);
  if (state.deadlineFilter === "unplanned") return !task.startDate && !task.dueDate;
  if (!task.dueDate) return false;

  const due = parseDate(task.dueDate);
  const start = startOfDay(today());
  const diffDays = Math.floor((due - start) / 86400000);

  if (state.deadlineFilter === "overdue") return isTaskOverdue(task, project);
  if (state.deadlineFilter === "today") return diffDays === 0;
  if (state.deadlineFilter === "week") return diffDays >= 0 && diffDays <= 7;
  if (state.deadlineFilter === "month") return diffDays >= 0 && diffDays <= 30;
  return true;
}

function isTaskOverdue(task, project = activeProject()) {
  return Boolean(task?.dueDate && parseDate(task.dueDate) < startOfDay(today()) && statusForTask(task.statusId, project)?.type !== "done");
}
function openTaskDialog(taskId = null, statusId = null) {
  const project = activeProject();
  if (!project) return;
  const task = project.tasks.find((item) => item.id === taskId);
  if (taskId && !task) return;

  els.dialogTitle.textContent = task ? "Modifica attività" : "Nuova attività";
  els.taskId.value = task?.id || "";
  els.taskName.value = task?.name || "";
  els.taskStart.value = task?.startDate || "";
  els.taskDue.value = task?.dueDate || "";
  const participants = normalizeParticipants(state.ui.participants);
  const taskOwner = task?.owner || "";
  els.taskOwner.innerHTML = `
    <option value="">Nessun responsabile</option>
    ${participants.map((participant) => `<option value="${escapeHtml(participant)}">${escapeHtml(participant)}</option>`).join("")}
  `;
  els.taskOwner.value = participants.includes(taskOwner) ? taskOwner : "";
  els.taskPriority.value = priorityOption(task?.priority, true).id;
  els.taskNotes.value = task?.notes || "";
  els.taskReminderEnabled.checked = Boolean(task?.reminderEnabled);
  taskAttachmentDraft = normalizeAttachments(task?.attachments || []);
  renderAttachmentList();
  els.deleteTaskBtn.style.visibility = task ? "visible" : "hidden";

  els.taskStatus.innerHTML = project.statuses
    .map((status) => `<option value="${status.id}">${escapeHtml(status.name)}</option>`)
    .join("");
  els.taskStatus.value = task?.statusId || statusId || project.statuses[0].id;

  els.subtaskFields.innerHTML = "";
  (task?.subtasks || []).forEach((subtask) => addSubtaskField(subtask.name, subtask.done, subtask.dueDate || "", subtask.id, subtask.owner || ""));

  renderTaskConflictBanner(task);

  els.taskDialog.showModal();
  els.taskName.focus();
}

const SYNC_CONFLICT_FIELD_LABELS = {
  name: "Nome",
  owner: "Responsabile",
  statusId: "Stato",
  priority: "Priorità",
  startDate: "Inizio",
  dueDate: "Scadenza",
  notes: "Note",
  subtasks: "Sotto-attività",
};

function formatConflictValue(field, value) {
  if (field === "subtasks") {
    const list = Array.isArray(value) ? value : [];
    return list.length ? `${list.length} sotto-attività` : "nessuna";
  }
  const text = value == null ? "" : String(value);
  return text ? text : "(vuoto)";
}

function renderTaskConflictBanner(task) {
  const banner = els.taskConflictBanner;
  if (!banner) return;
  const conflict = task?.syncConflict;
  if (!conflict?.alternatives?.length) {
    banner.hidden = true;
    banner.innerHTML = "";
    return;
  }
  const rows = conflict.alternatives
    .flatMap((alt) =>
      (alt.fields || []).map(
        (field) =>
          `<li><strong>${escapeHtml(SYNC_CONFLICT_FIELD_LABELS[field] || field)}</strong>: versione concorrente «${escapeHtml(formatConflictValue(field, alt.values?.[field]))}»</li>`,
      ),
    )
    .join("");
  banner.innerHTML = `
    <p>⚠︎ Questa attività è stata modificata anche altrove durante la sincronizzazione. È stata tenuta la versione più recente; di seguito i valori concorrenti scartati:</p>
    <ul>${rows}</ul>
    <button type="button" class="secondary-btn" data-action="dismiss-sync-conflict">Ho capito, ignora l'avviso</button>
  `;
  banner.hidden = false;
}

function dismissTaskSyncConflict() {
  const project = activeProject();
  if (!project) return;
  const taskId = els.taskId.value;
  const task = project.tasks.find((item) => item.id === taskId);
  if (!task || !task.syncConflict) return;
  delete task.syncConflict;
  saveState();
  renderTaskConflictBanner(task);
  renderContent();
}

function addSubtaskField(name, done, dueDate = "", subtaskId = "", owner = "") {
  const row = document.createElement("div");
  const participants = normalizeParticipants(state.ui.participants);
  const selectedOwner = participants.includes(owner) ? owner : "";
  row.className = "subtask-field";
  row.dataset.subtaskId = subtaskId || crypto.randomUUID();
  row.innerHTML = `
    <input type="checkbox" ${done ? "checked" : ""} aria-label="Completata" />
    <textarea rows="2" placeholder="Nome sotto-attività" aria-label="Nome sotto-attività">${escapeHtml(name)}</textarea>
    <select aria-label="Responsabile sotto-attività">
      <option value="">Nessun responsabile</option>
      ${participants.map((participant) => `<option value="${escapeHtml(participant)}">${escapeHtml(participant)}</option>`).join("")}
    </select>
    <input type="date" value="${escapeHtml(dueDate)}" aria-label="Data sotto-attività" />
    <button type="button" class="icon-btn" aria-label="Rimuovi">×</button>
  `;
  row.querySelector("select").value = selectedOwner;
  row.querySelector("button").addEventListener("click", () => {
    row.remove();
    scheduleTaskAutosave();
  });
  els.subtaskFields.appendChild(row);
  scheduleTaskAutosave();
}

function saveTaskFromDialog({ close = true, renderPage = true } = {}) {
  const project = activeProject();
  if (!project) return null;
  const id = els.taskId.value || crypto.randomUUID();
  const subtasks = [...els.subtaskFields.querySelectorAll(".subtask-field")]
    .map((row) => ({
      id: row.dataset.subtaskId || crypto.randomUUID(),
      done: row.querySelector('input[type="checkbox"]').checked,
      name: row.querySelector("textarea").value.trim(),
      owner: normalizeParticipants(state.ui.participants).includes(row.querySelector("select").value) ? row.querySelector("select").value : "",
      dueDate: row.querySelector('input[type="date"]').value,
    }))
    .filter((subtask) => subtask.name);
  const name = els.taskName.value.trim();
  const attachments = normalizeAttachments(taskAttachmentDraft);
  const hasDraftContent = Boolean(
    name ||
      els.taskStart.value ||
      els.taskDue.value ||
      els.taskOwner.value ||
      els.taskNotes.value.trim() ||
      els.taskReminderEnabled.checked ||
      subtasks.length ||
      attachments.length ||
      els.taskId.value,
  );
  if (!hasDraftContent) return null;

  const nextTask = {
    id,
    name: name || "Senza titolo",
    startDate: els.taskStart.value,
    dueDate: els.taskDue.value,
    owner: normalizeParticipants(state.ui.participants).includes(els.taskOwner.value) ? els.taskOwner.value : "",
    priority: priorityOption(els.taskPriority.value, true).id,
    statusId: els.taskStatus.value,
    notes: els.taskNotes.value.trim(),
    reminderEnabled: Boolean(els.taskReminderEnabled.checked),
    subtasks,
    attachments,
  };

  const existingIndex = project.tasks.findIndex((task) => task.id === id);
  const existingTask = existingIndex >= 0 ? project.tasks[existingIndex] : null;
  if (existingTask?.completedAt) nextTask.completedAt = existingTask.completedAt;
  if (existingTask?.archivedAt) nextTask.archivedAt = existingTask.archivedAt;
  if (existingTask?.archivedFromProjectId) nextTask.archivedFromProjectId = existingTask.archivedFromProjectId;
  // Conserva l'avviso di conflitto finché l'utente non lo ignora esplicitamente (così
  // l'autosave all'apertura del dialog non lo cancella prima che venga visto).
  if (existingTask?.syncConflict) nextTask.syncConflict = existingTask.syncConflict;
  if (existingIndex >= 0) project.tasks.splice(existingIndex, 1, nextTask);
  else project.tasks.push(nextTask);
  els.taskId.value = id;
  els.deleteTaskBtn.style.visibility = "visible";

  saveState();
  if (close) els.taskDialog.close();
  if (renderPage) render();
  else renderContent();
  return nextTask;
}

function scheduleTaskAutosave() {
  if (!els.taskDialog.open) return;
  clearTimeout(taskAutosaveTimer);
  taskAutosaveTimer = setTimeout(() => {
    saveTaskFromDialog({ close: false, renderPage: false });
  }, 250);
}

function flushTaskAutosave() {
  clearTimeout(taskAutosaveTimer);
  if (!els.taskDialog.open) return null;
  return saveTaskFromDialog({ close: false, renderPage: true });
}

function deleteTaskFromDialog() {
  const project = activeProject();
  if (!project) return;
  const taskId = els.taskId.value;
  const taskIndex = project.tasks.findIndex((task) => task.id === taskId);
  const deletedTask = taskIndex >= 0 ? structuredClone(project.tasks[taskIndex]) : null;
  if (!deletedTask) return;
  project.tasks.splice(taskIndex, 1);
  saveState();
  els.taskDialog.close();
  render();
  registerUndo(`Attività "${deletedTask.name}" cancellata.`, () => {
    const targetProject = state.projects.find((item) => item.id === project.id);
    if (!targetProject || targetProject.tasks.some((task) => task.id === deletedTask.id)) return;
    targetProject.tasks.splice(Math.min(taskIndex, targetProject.tasks.length), 0, deletedTask);
    state.activeProjectId = targetProject.id;
    state.route = "project";
    saveState();
    render();
  });
}

function removeAttachmentFromDraft(attachmentId) {
  taskAttachmentDraft = taskAttachmentDraft.filter((attachment) => attachment.id !== attachmentId);
  renderAttachmentList();
  scheduleTaskAutosave();
}

function closeAttachmentRemovePopup() {
  document.querySelector(".attachment-remove-popup")?.remove();
}

function openAttachmentRemovePopup(attachmentId) {
  const attachment = taskAttachmentDraft.find((item) => item.id === attachmentId);
  if (!attachment) return;
  closeAttachmentRemovePopup();
  const popup = document.createElement("div");
  popup.className = "attachment-remove-popup";
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-modal", "true");
  popup.innerHTML = `
    <div class="attachment-remove-card">
      <h4>Rimuovere l'allegato?</h4>
      <p>
        Vuoi solo scollegare <strong>${escapeHtml(attachment.name)}</strong> dall'attività
        oppure spostare anche il file nel Cestino?
      </p>
      <small>${escapeHtml(attachment.path || "File non ancora collegato sul disco.")}</small>
      <div class="attachment-remove-actions">
        <button type="button" class="secondary-btn" data-attachment-remove-action="cancel">Annulla</button>
        <button type="button" class="small-btn" data-attachment-remove-action="remove">Rimuovi</button>
        <button type="button" class="danger-btn" data-attachment-remove-action="trash" ${attachment.path ? "" : "disabled"}>Elimina</button>
      </div>
    </div>
  `;
  popup.addEventListener("click", (event) => {
    if (event.target === popup) closeAttachmentRemovePopup();
  });
  popup.querySelectorAll("[data-attachment-remove-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.attachmentRemoveAction;
      if (action === "cancel") {
        closeAttachmentRemovePopup();
        return;
      }
      if (action === "remove") {
        removeAttachmentFromDraft(attachment.id);
        closeAttachmentRemovePopup();
        return;
      }
      if (action === "trash") {
        if (!attachment.path || !window.webkit?.messageHandlers?.trashTaskAttachment) {
          alert("L'eliminazione fisica è disponibile solo nell'app macOS.");
          return;
        }
        pendingAttachmentTrash = attachment.id;
        popup.querySelectorAll("button").forEach((item) => {
          item.disabled = true;
        });
        window.webkit.messageHandlers.trashTaskAttachment.postMessage({
          id: attachment.id,
          name: attachment.name,
          path: attachment.path,
        });
      }
    });
  });
  (els.taskDialog || document.body).appendChild(popup);
  popup.querySelector("[data-attachment-remove-action='cancel']")?.focus();
}

function renderAttachmentList() {
  if (!els.attachmentList) return;
  if (!taskAttachmentDraft.length) {
    els.attachmentList.innerHTML = `<div class="muted-empty compact">Nessun allegato.</div>`;
    return;
  }

  els.attachmentList.innerHTML = taskAttachmentDraft
    .map(
      (attachment) => `
        <div class="attachment-row" data-attachment-row="${escapeHtml(attachment.id)}">
          <button class="attachment-main" data-open-attachment="${escapeHtml(attachment.id)}" type="button" title="${escapeHtml(attachment.path || attachment.name)}">
            <span class="attachment-icon" aria-hidden="true">${attachment.kind === "markdown" ? "md" : "txt"}</span>
            <span>
              <strong>${escapeHtml(attachment.name)}</strong>
              <small>${escapeHtml(attachment.path || "File non ancora collegato")}</small>
            </span>
          </button>
          <div class="attachment-actions">
            <button type="button" class="small-btn" data-open-attachment="${escapeHtml(attachment.id)}">Apri</button>
            <button type="button" class="icon-btn" data-remove-attachment="${escapeHtml(attachment.id)}" aria-label="Rimuovi ${escapeHtml(attachment.name)}">×</button>
          </div>
        </div>
      `,
    )
    .join("");

  els.attachmentList.querySelectorAll("[data-open-attachment]").forEach((button) => {
    button.addEventListener("click", () => openTaskAttachment(button.dataset.openAttachment));
  });
  els.attachmentList.querySelectorAll("[data-remove-attachment]").forEach((button) => {
    button.addEventListener("click", () => {
      openAttachmentRemovePopup(button.dataset.removeAttachment);
    });
  });
}

function addTaskAttachment(attachment) {
  const normalized = normalizeAttachments([attachment])[0];
  if (!normalized) return;
  taskAttachmentDraft = normalizeAttachments([...taskAttachmentDraft, normalized]);
  renderAttachmentList();
  scheduleTaskAutosave();
}

function pickTaskAttachment() {
  if (window.webkit?.messageHandlers?.pickTaskAttachment) {
    window.webkit.messageHandlers.pickTaskAttachment.postMessage({
      attachmentDirectoryPath: state.ui.attachmentDirectoryPath || "",
    });
    return;
  }
  alert("La selezione di allegati su disco è disponibile nell'app macOS.");
}

function createTaskAttachment() {
  const suggestedBase = slugifyFilename(els.taskName.value.trim() || "nuovo-allegato");
  if (window.webkit?.messageHandlers?.createTaskAttachment) {
    window.webkit.messageHandlers.createTaskAttachment.postMessage({
      suggestedName: `${suggestedBase}.md`,
      editorName: state.ui.attachmentEditorName || "",
      editorPath: state.ui.attachmentEditorPath || "",
      attachmentDirectoryPath: state.ui.attachmentDirectoryPath || "",
    });
    return;
  }
  alert("La creazione di allegati su disco è disponibile nell'app macOS.");
}

function openTaskAttachment(attachmentId) {
  const attachment = taskAttachmentDraft.find((item) => item.id === attachmentId);
  if (!attachment?.path) return;
  if (window.webkit?.messageHandlers?.openTaskAttachment) {
    window.webkit.messageHandlers.openTaskAttachment.postMessage({
      path: attachment.path,
      editorName: state.ui.attachmentEditorName || "",
      editorPath: state.ui.attachmentEditorPath || "",
    });
    return;
  }
  alert("L'apertura diretta degli allegati è disponibile nell'app macOS.");
}

function selectAttachmentEditor() {
  if (window.webkit?.messageHandlers?.selectAttachmentEditor) {
    window.webkit.messageHandlers.selectAttachmentEditor.postMessage({});
    return;
  }
  alert("La scelta dell'editor è disponibile nell'app macOS.");
}

function clearAttachmentEditor() {
  state.ui.attachmentEditorName = "";
  state.ui.attachmentEditorPath = "";
  renderAttachmentConfig();
  saveState();
}

function selectAttachmentDirectory() {
  if (window.webkit?.messageHandlers?.selectAttachmentDirectory) {
    window.webkit.messageHandlers.selectAttachmentDirectory.postMessage({
      attachmentDirectoryPath: state.ui.attachmentDirectoryPath || "",
    });
    return;
  }
  alert("La scelta della cartella allegati è disponibile nell'app macOS.");
}

function clearAttachmentDirectory() {
  state.ui.attachmentDirectoryName = "";
  state.ui.attachmentDirectoryPath = "";
  renderAttachmentConfig();
  saveState();
}

function renderAttachmentConfig() {
  if (!els.attachmentEditorName) return;
  els.attachmentEditorName.textContent = state.ui.attachmentEditorName || "Predefinito macOS";
  els.attachmentEditorName.title = state.ui.attachmentEditorPath || "Apre con l'app predefinita di macOS";
  if (els.attachmentDirectoryName) {
    els.attachmentDirectoryName.textContent = state.ui.attachmentDirectoryName || "Non impostata";
    els.attachmentDirectoryName.title = state.ui.attachmentDirectoryPath || "Gli allegati restano nel loro percorso originale";
  }
}

window.receiveTaskAttachment = (attachment) => {
  addTaskAttachment(attachment);
};

window.receiveTaskAttachmentTrashResult = (result) => {
  const attachmentId = String(result?.id || pendingAttachmentTrash || "");
  pendingAttachmentTrash = null;
  if (result?.ok && attachmentId) {
    removeAttachmentFromDraft(attachmentId);
    closeAttachmentRemovePopup();
    return;
  }
  const message = String(result?.message || "Non sono riuscito a spostare il file nel Cestino.");
  alert(message);
  closeAttachmentRemovePopup();
};

window.receiveAttachmentEditor = (editor) => {
  state.ui.attachmentEditorName = String(editor?.name || "");
  state.ui.attachmentEditorPath = String(editor?.path || "");
  renderAttachmentConfig();
  saveState();
  renderWorkspaceSelect();
};

window.receiveAttachmentDirectory = (directory) => {
  state.ui.attachmentDirectoryName = String(directory?.name || "");
  state.ui.attachmentDirectoryPath = String(directory?.path || "");
  renderAttachmentConfig();
  saveState();
  renderWorkspaceSelect();
};

window.reportNativeAttachmentError = (message) => {
  alert(typeof message === "string" ? message : message?.message || "Operazione allegato non riuscita.");
};

function addStatus() {
  if (!activeProject()) return;
  const name = els.statusName.value.trim();
  if (!name) return;
  const id = slugify(name);
  activeProject().statuses.push({ id, name, type: "custom" });
  els.statusName.value = "";
  saveState();
  render();
  renderStatusVisibilityList();
}

function openProjectNamePopover(anchor) {
  closeProjectNamePopover();

  const popover = document.createElement("form");
  popover.className = "project-name-popover";
  popover.innerHTML = `
    <label>
      Nome progetto
      <input type="text" name="projectName" maxlength="70" autocomplete="off" required />
    </label>
    <div class="popover-actions">
      <button type="button" class="secondary-btn" data-cancel-project-popover>Annulla</button>
      <button type="submit" class="primary-btn">Crea</button>
    </div>
  `;

  document.body.appendChild(popover);
  const rect = anchor.getBoundingClientRect();
  popover.style.left = `${Math.min(rect.left, window.innerWidth - 320)}px`;
  popover.style.top = `${rect.bottom + 8}px`;

  popover.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = new FormData(popover).get("projectName")?.toString().trim();
    if (!name) return;
    createProject(name);
    closeProjectNamePopover();
  });

  popover.querySelector("[data-cancel-project-popover]").addEventListener("click", closeProjectNamePopover);
  popover.querySelector("input").focus();
}

function closeProjectNamePopover() {
  document.querySelector(".project-name-popover")?.remove();
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".project-name-popover") && !event.target.closest("#emptyNewProjectBtn, #overviewNewProjectBtn")) {
    closeProjectNamePopover();
  }
});

function createProject(name) {
  let id = slugify(name);
  if (!id) id = `progetto-${Date.now()}`;
  if (state.projects.some((project) => project.id === id)) id = `${id}-${Date.now()}`;
  state.projects.push({
    id,
    name,
    note: "",
    archived: false,
    archivedAt: "",
    statuses: defaultStatuses(),
    enabledViews: { board: true, table: true, timeline: true, dashboard: true },
    tasks: [],
  });
  state.ui.openProjects[id] = true;
  if (!state.ui.openProjectTabs.includes(id)) state.ui.openProjectTabs.push(id);
  state.activeProjectId = id;
  state.route = "project";
  saveState();
  render();
}

function archiveProject(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  project.archived = true;
  project.archivedAt = new Date().toISOString();
  state.ui.openProjectTabs = state.ui.openProjectTabs.filter((id) => id !== projectId);
  delete state.ui.openProjects[projectId];
  if (state.activeProjectId === projectId && state.route === "project") {
    state.activeProjectId = activeProjects()[0]?.id || archivedProjects()[0]?.id || "";
    state.route = activeProjects().length ? "projects" : "archive";
  }
  saveState();
  render();
  registerUndo(`Progetto "${project.name}" archiviato.`, () => {
    restoreProject(projectId);
  });
}

function restoreProject(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  project.archived = false;
  project.archivedAt = "";
  state.ui.openProjects[projectId] = true;
  state.route = "projects";
  saveState();
  render();
}

function renameProject(projectId, nextName) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  const cleanName = String(nextName || "").trim();
  if (!cleanName) return;
  const existing = findProjectByName(cleanName);
  project.name = existing && existing.id !== project.id ? uniqueProjectName(cleanName) : cleanName;
  pendingRenameProjectId = null;
  saveState();
  render();
}

function openProjectNoteDialog(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  els.projectNoteId.value = project.id;
  els.projectNoteText.value = project.note || "";
  els.projectNoteDialog.showModal();
  els.projectNoteText.focus();
}

function saveProjectNote({ close = true, renderPage = true } = {}) {
  const project = state.projects.find((item) => item.id === els.projectNoteId.value);
  if (!project) return;
  project.note = els.projectNoteText.value.trim();
  if (close) els.projectNoteDialog.close();
  saveState();
  if (renderPage) render();
}

function openProjectDeleteDialog(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  els.projectDeleteId.value = project.id;
  els.projectDeleteName.textContent = project.name;
  els.projectDeleteDialog.showModal();
}

function deleteProject(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  const projectIndex = state.projects.findIndex((item) => item.id === projectId);
  const deletedProject = structuredClone(project);
  const previousUi = structuredClone({
    openProjectTabs: state.ui.openProjectTabs,
    openProjects: state.ui.openProjects,
    activeProjectId: state.activeProjectId,
    route: state.route,
    activeView: state.activeView,
  });

  state.projects = state.projects.filter((item) => item.id !== projectId);
  state.ui.openProjectTabs = state.ui.openProjectTabs.filter((id) => id !== projectId);
  delete state.ui.openProjects[projectId];
  projectCreateOpen = false;

  if (state.activeProjectId === projectId) {
    state.activeProjectId = state.ui.openProjectTabs.find((id) => state.projects.some((item) => item.id === id)) || state.projects[0]?.id || "";
  }

  state.route = "projects";

  saveState();
  render();
  registerUndo(`Progetto "${deletedProject.name}" cancellato.`, () => {
    if (state.projects.some((item) => item.id === deletedProject.id)) return;
    state.projects.splice(Math.min(projectIndex, state.projects.length), 0, deletedProject);
    state.ui.openProjectTabs = previousUi.openProjectTabs;
    state.ui.openProjects = previousUi.openProjects;
    state.activeProjectId = previousUi.activeProjectId;
    state.route = previousUi.route;
    state.activeView = previousUi.activeView;
    saveState();
    render();
  });
}

function sortByDueDate() {
  if (!activeProject()) return;
  activeProject().tasks.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return a.name.localeCompare(b.name);
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return parseDate(a.dueDate) - parseDate(b.dueDate);
  });
  saveState();
  renderContent();
}

function exportProjectMarkdown() {
  const project = activeProject();
  if (!project) return;
  const headers = ["Nome attività", "Inizio", "Due date", "Responsabile", "Priorità", "Stato", "Sotto-attività", "Note", "Allegati", "Avanzamento"];
  const rows = project.tasks.map((task) => {
    const status = statusFor(task.statusId);
    const subtasks = task.subtasks.length
      ? task.subtasks
          .map((subtask) => `${subtask.done ? "[x]" : "[ ]"} ${subtask.name}${subtask.owner ? ` - ${subtask.owner}` : ""}${subtask.dueDate ? ` (${formatDate(subtask.dueDate)})` : ""}`)
          .join("<br>")
      : "";

    return [
      task.name,
      task.startDate || "",
      task.dueDate || "",
      task.owner || "",
      priorityOption(task.priority, true).label,
      status.name,
      subtasks,
      task.notes || "",
      (task.attachments || []).map((attachment) => `${attachment.name}${attachment.path ? ` (${attachment.path})` : ""}`).join("<br>"),
      `${completion(task)}%`,
    ];
  });

  const markdown = [
    `# ${project.name}`,
    "",
    `Esportazione attività progetto: ${project.name}`,
    "",
    markdownTable(headers, rows),
    "",
  ].join("\n");

  downloadTextFile(`${slugifyFilename(project.name)}.md`, markdown);
}
function exportProjectExcel() {
  const project = activeProject();
  if (!project) return;
  const workbook = createProjectExcelWorkbook(project);
  downloadBinaryFile(
    `${slugifyFilename(project.name)}-aggiornamento.xlsx`,
    workbook,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

function openProjectExcelImport() {
  if (!activeProject()) return;
  if (window.webkit?.messageHandlers?.importExcel) {
    window.webkit.messageHandlers.importExcel.postMessage({});
    return;
  }
  els.importExcelInput.value = "";
  els.importExcelInput.click();
}

function handleProjectExcelFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", async () => {
    try {
      await importProjectExcelUpdates(reader.result, file.name);
    } catch (error) {
      alert(`Import Excel non riuscito: ${error.message || error}`);
    } finally {
      els.importExcelInput.value = "";
    }
  });
  reader.readAsArrayBuffer(file);
}

window.loadExcelFromNative = async function loadExcelFromNative(base64, filename = "aggiornamento.xlsx") {
  try {
    await importProjectExcelUpdates(base64ToBytes(base64).buffer, filename);
  } catch (error) {
    alert(`Import Excel non riuscito: ${error.message || error}`);
  }
};

function createProjectExcelWorkbook(project) {
  const headers = [
    "Workspace ID",
    "Project ID",
    "Task ID",
    "Subtask ID",
    "Nome attività",
    "Inizio attività",
    "Due date attività",
    "Responsabile",
    "Priorità",
    "Stato",
    "Note",
    "Sotto-attività",
    "Responsabile sotto-attività",
    "Data sotto-attività",
    "Sotto-attività completata",
    "Avanzamento",
  ];
  const rows = [headers];
  project.tasks.forEach((task) => {
    const subtasks = task.subtasks.length ? task.subtasks : [{ id: "", name: "", dueDate: "", done: "" }];
    subtasks.forEach((subtask) => {
      rows.push([
        state.activeWorkspaceId,
        project.id,
        task.id,
        subtask.id || "",
        task.name,
        task.startDate || "",
        task.dueDate || "",
        task.owner || "",
        priorityOption(task.priority, true).label,
        statusForTask(task.statusId, project)?.name || "",
        task.notes || "",
        subtask.name || "",
        subtask.owner || "",
        subtask.dueDate || "",
        subtask.id ? (subtask.done ? "SI" : "NO") : "",
        `${completion(task)}%`,
      ]);
    });
  });

  return createXlsxFromRows(rows, sanitizeExcelSheetName(project.name));
}

async function importProjectExcelUpdates(buffer, filename = "") {
  const project = activeProject();
  if (!project) throw new Error("Apri prima il progetto da aggiornare.");
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const files = await unzipXlsx(bytes);
  const sharedStrings = parseSharedStrings(files.get("xl/sharedStrings.xml") || "");
  const sheetXml = files.get("xl/worksheets/sheet1.xml");
  if (!sheetXml) throw new Error("Il file non contiene il foglio atteso.");

  const rows = parseSheetRows(sheetXml, sharedStrings);
  if (rows.length < 2) throw new Error("Il file non contiene righe da importare.");
  const headerMap = excelHeaderMap(rows[0]);
  const required = ["Task ID", "Stato", "Note", "Subtask ID", "Sotto-attività completata"];
  const missing = required.filter((header) => headerMap[header] === undefined);
  if (missing.length) throw new Error(`Colonne mancanti: ${missing.join(", ")}`);

  const importedProjectIds = new Set(rows.slice(1).map((row) => cellByHeader(row, headerMap, "Project ID")).filter(Boolean));
  if (importedProjectIds.size && !importedProjectIds.has(project.id)) {
    const proceed = confirm("Il file Excel sembra appartenere a un altro progetto. Vuoi provare comunque a importarlo nel progetto aperto?");
    if (!proceed) return;
  }

  const taskById = new Map(project.tasks.map((task) => [task.id, task]));
  const statusByName = new Map(project.statuses.map((status) => [status.name.trim().toLowerCase(), status]));
  let updatedTasks = 0;
  let updatedSubtasks = 0;
  const skipped = [];

  rows.slice(1).forEach((row, index) => {
    const taskId = cellByHeader(row, headerMap, "Task ID");
    if (!taskId) return;
    const task = taskById.get(taskId);
    if (!task) {
      skipped.push(`riga ${index + 2}: attività non trovata`);
      return;
    }

    let changed = false;
    const nextNotes = cellByHeader(row, headerMap, "Note");
    if (task.notes !== nextNotes) {
      task.notes = nextNotes;
      changed = true;
    }

    const nextStatusName = cellByHeader(row, headerMap, "Stato").trim();
    if (nextStatusName) {
      const status = statusByName.get(nextStatusName.toLowerCase());
      if (status && task.statusId !== status.id) {
        task.statusId = status.id;
        changed = true;
      } else if (!status) {
        skipped.push(`riga ${index + 2}: stato "${nextStatusName}" non esiste`);
      }
    }

    const subtaskId = cellByHeader(row, headerMap, "Subtask ID");
    if (subtaskId) {
      const subtask = task.subtasks.find((item) => item.id === subtaskId);
      if (subtask) {
        const nextDone = parseExcelBoolean(cellByHeader(row, headerMap, "Sotto-attività completata"));
        if (nextDone !== null && subtask.done !== nextDone) {
          subtask.done = nextDone;
          updatedSubtasks += 1;
        }
      } else {
        skipped.push(`riga ${index + 2}: sotto-attività non trovata`);
      }
    }

    if (changed) updatedTasks += 1;
  });

  saveState();
  render();
  const message = [
    `Import completato${filename ? ` da ${filename}` : ""}.`,
    `${updatedTasks} attività aggiornate.`,
    `${updatedSubtasks} sotto-attività aggiornate.`,
    skipped.length ? `${skipped.length} righe saltate:\n${skipped.slice(0, 8).join("\n")}${skipped.length > 8 ? "\n..." : ""}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  alert(message);
}

function excelHeaderMap(headers) {
  return headers.reduce((map, header, index) => {
    map[String(header || "").trim()] = index;
    return map;
  }, {});
}

function cellByHeader(row, headerMap, header) {
  const index = headerMap[header];
  return index === undefined ? "" : String(row[index] || "").trim();
}

function parseExcelBoolean(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (["si", "sì", "yes", "true", "1", "x", "completata", "completato"].includes(normalized)) return true;
  if (["no", "false", "0", "aperta", "aperto", "non completata", "non completato"].includes(normalized)) return false;
  return null;
}

function createXlsxFromRows(rows, sheetName) {
  const files = new Map([
    ["[Content_Types].xml", xlsxContentTypes()],
    ["_rels/.rels", xlsxRootRels()],
    ["docProps/app.xml", xlsxAppProps()],
    ["docProps/core.xml", xlsxCoreProps()],
    ["xl/workbook.xml", xlsxWorkbookXml(sheetName)],
    ["xl/_rels/workbook.xml.rels", xlsxWorkbookRels()],
    ["xl/styles.xml", xlsxStylesXml()],
    ["xl/worksheets/sheet1.xml", xlsxSheetXml(rows)],
  ]);
  return zipStore(files);
}

function xlsxSheetXml(rows) {
  const editableColumns = new Set([10, 11, 15]);
  const rowXml = rows
    .map(
      (row, rowIndex) => `
        <row r="${rowIndex + 1}">
          ${row
            .map((value, colIndex) => {
              const ref = `${excelColumnName(colIndex + 1)}${rowIndex + 1}`;
              const editableStyle = rowIndex > 0 && editableColumns.has(colIndex + 1) ? ` s="1"` : "";
              return `<c r="${ref}"${editableStyle} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
            })
            .join("")}
        </row>`,
    )
    .join("");
  const lastRef = `${excelColumnName(rows[0]?.length || 1)}${rows.length || 1}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${lastRef}" />
  <sheetViews><sheetView workbookViewId="0" /></sheetViews>
  <sheetFormatPr defaultRowHeight="18" />
  <cols>
    <col min="1" max="4" width="14" hidden="1" customWidth="1" />
    <col min="5" max="5" width="32" customWidth="1" />
    <col min="6" max="9" width="18" customWidth="1" />
    <col min="10" max="10" width="18" customWidth="1" />
    <col min="11" max="11" width="46" customWidth="1" />
    <col min="12" max="14" width="24" customWidth="1" />
    <col min="15" max="15" width="24" customWidth="1" />
    <col min="16" max="16" width="14" customWidth="1" />
  </cols>
  <sheetData>${rowXml}</sheetData>
  <autoFilter ref="E1:P${rows.length || 1}" />
  <dataValidations count="1">
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="O2:O1048576"><formula1>"SI,NO"</formula1></dataValidation>
  </dataValidations>
</worksheet>`;
}

function xlsxWorkbookXml(sheetName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1" /></sheets>
</workbook>`;
}

function xlsxWorkbookRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml" />
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml" />
</Relationships>`;
}

function xlsxContentTypes() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="xml" ContentType="application/xml" />
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" />
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" />
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml" />
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml" />
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml" />
</Types>`;
}

function xlsxRootRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml" />
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml" />
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml" />
</Relationships>`;
}

function xlsxStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="0" />
  <fonts count="1"><font><name val="Calibri" /><family val="2" /><color theme="1" /><sz val="11" /><scheme val="minor" /></font></fonts>
  <fills count="3">
    <fill><patternFill /></fill>
    <fill><patternFill patternType="gray125" /></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="00FFD966" /></patternFill></fill>
  </fills>
  <borders count="1"><border><left /><right /><top /><bottom /><diagonal /></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" /></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" pivotButton="0" quotePrefix="0" xfId="0" />
    <xf numFmtId="0" fontId="0" fillId="2" borderId="0" applyProtection="1" pivotButton="0" quotePrefix="0" xfId="0"><protection locked="0" hidden="0" /></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0" hidden="0" /></cellStyles>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleLight16" />
</styleSheet>`;
}

function xlsxAppProps() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Gestore attività Kanban</Application>
</Properties>`;
}

function xlsxCoreProps() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>Gestore attività Kanban</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return [...doc.getElementsByTagName("si")].map((item) => [...item.getElementsByTagName("t")].map((text) => text.textContent || "").join(""));
}

function parseSheetRows(xml, sharedStrings) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const rows = [];
  [...doc.getElementsByTagName("row")].forEach((rowEl) => {
    const row = [];
    [...rowEl.getElementsByTagName("c")].forEach((cell) => {
      const ref = cell.getAttribute("r") || "";
      const colIndex = excelColumnIndex(ref.replace(/[0-9]/g, "")) - 1;
      row[colIndex] = readCellValue(cell, sharedStrings);
    });
    rows.push(row.map((value) => value || ""));
  });
  return rows;
}

function readCellValue(cell, sharedStrings) {
  const type = cell.getAttribute("t");
  if (type === "inlineStr") return cell.getElementsByTagName("t")[0]?.textContent || "";
  const value = cell.getElementsByTagName("v")[0]?.textContent || "";
  if (type === "s") return sharedStrings[Number(value)] || "";
  if (type === "b") return value === "1" ? "TRUE" : "FALSE";
  return value;
}

async function unzipXlsx(bytes) {
  const files = new Map();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let eocdOffset = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 66000); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("File XLSX non leggibile.");

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  let offset = centralOffset;
  for (let entry = 0; entry < entryCount; entry += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const filename = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength));

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    const contentBytes = method === 0 ? compressed : await inflateRaw(compressed, uncompressedSize);
    files.set(filename, new TextDecoder().decode(contentBytes));

    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (!files.size) throw new Error("File XLSX non leggibile.");
  return files;
}

async function inflateRaw(bytes, expectedSize = 0) {
  if (!("DecompressionStream" in window)) throw new Error("Import di file XLSX compressi non supportato da questo browser.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  files.forEach((content, filename) => {
    const nameBytes = encoder.encode(filename);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = concatBytes(
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(data.length),
      uint32(data.length),
      uint16(nameBytes.length),
      uint16(0),
      nameBytes,
      data,
    );
    chunks.push(local);
    central.push(
      concatBytes(
        uint32(0x02014b50),
        uint16(20),
        uint16(20),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(crc),
        uint32(data.length),
        uint32(data.length),
        uint16(nameBytes.length),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(0),
        uint32(offset),
        nameBytes,
      ),
    );
    offset += local.length;
  });
  const centralStart = offset;
  const centralBytes = concatBytes(...central);
  const end = concatBytes(
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.size),
    uint16(files.size),
    uint32(centralBytes.length),
    uint32(centralStart),
    uint16(0),
  );
  return concatBytes(...chunks, centralBytes, end);
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function uint16(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function uint32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function concatBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

function excelColumnName(index) {
  let name = "";
  while (index > 0) {
    index -= 1;
    name = String.fromCharCode(65 + (index % 26)) + name;
    index = Math.floor(index / 26);
  }
  return name;
}

function excelColumnIndex(name) {
  return String(name || "")
    .toUpperCase()
    .split("")
    .reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0);
}

function sanitizeExcelSheetName(value) {
  const clean = String(value || "Progetto")
    .replace(/[\[\]:*?/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);
  return clean || "Progetto";
}

function downloadBinaryFile(filename, bytes, mimeType) {
  if (window.webkit?.messageHandlers?.exportBinary) {
    window.webkit.messageHandlers.exportBinary.postMessage({ filename, mimeType, base64: bytesToBase64(bytes) });
    return;
  }

  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
function openBackupDialog() {
  renderBackupProjectList();
  els.backupDialog.showModal();
}

function renderBackupProjectList() {
  syncActiveWorkspace();
  els.backupWorkspaceList.innerHTML = `
    <div class="backup-list-title">Spazi di lavoro</div>
    ${state.workspaces
      .map(
        (workspace) => `
          <label class="project-check-row">
            <input type="checkbox" data-backup-workspace="${workspace.id}" ${workspace.id === state.activeWorkspaceId ? "checked" : ""} />
            <span>
              <strong>${escapeHtml(workspace.name)}</strong>
              <small>${workspace.projects.length} progetti</small>
            </span>
          </label>
        `,
      )
      .join("")}
  `;

  els.backupWorkspaceList.querySelectorAll("[data-backup-workspace]").forEach((input) => {
    input.addEventListener("change", renderBackupProjectsForSelectedWorkspaces);
  });

  renderBackupProjectsForSelectedWorkspaces();
}

function renderBackupProjectsForSelectedWorkspaces() {
  const selectedWorkspaceIds = selectedBackupWorkspaceIds();
  const selectedWorkspaces = state.workspaces.filter((workspace) => selectedWorkspaceIds.includes(workspace.id));

  if (!selectedWorkspaces.length) {
    els.backupProjectList.innerHTML = `<div class="backup-list-title">Progetti</div><div class="muted-empty">Seleziona almeno uno spazio di lavoro per vedere i suoi progetti.</div>`;
    return;
  }

  const hasProjects = selectedWorkspaces.some((workspace) => workspace.projects.length);
  if (!hasProjects) {
    els.backupProjectList.innerHTML = `<div class="backup-list-title">Progetti selezionati</div><div class="muted-empty">Gli spazi selezionati non contengono progetti.</div>`;
    return;
  }

  els.backupProjectList.innerHTML = `
    <div class="backup-list-title">Progetti degli spazi selezionati</div>
    ${selectedWorkspaces
      .map(
        (workspace) => `
          <section class="backup-workspace-projects">
            <div class="backup-space-name">${escapeHtml(workspace.name)}</div>
            ${
              workspace.projects.length
                ? workspace.projects
                    .map(
                      (project) => `
                        <label class="project-check-row">
                          <input type="checkbox" data-backup-project="${escapeHtml(project.id)}" data-backup-project-workspace="${escapeHtml(workspace.id)}" checked />
                          <span>
                            <strong>${escapeHtml(project.name)}</strong>
                            <small>${project.tasks.length} attività</small>
                          </span>
                        </label>
                      `,
                    )
                    .join("")
                : `<div class="muted-empty">Nessun progetto in questo spazio.</div>`
            }
          </section>
      `,
      )
      .join("")}
  `;
}

function selectedBackupWorkspaceIds() {
  return [...els.backupWorkspaceList.querySelectorAll("[data-backup-workspace]:checked")].map((input) => input.dataset.backupWorkspace);
}

function backupSelectedProjects() {
  syncActiveWorkspace();
  const selectedWorkspaceIds = selectedBackupWorkspaceIds();
  const projectCheckboxes = [...els.backupProjectList.querySelectorAll("[data-backup-project]")];
  const selectedProjectsByWorkspace = projectCheckboxes.reduce((map, input) => {
    const workspaceId = input.dataset.backupProjectWorkspace;
    if (!map.has(workspaceId)) map.set(workspaceId, new Set());
    if (input.checked) map.get(workspaceId).add(input.dataset.backupProject);
    return map;
  }, new Map());

  if (!selectedWorkspaceIds.length) {
    alert("Seleziona almeno uno spazio di lavoro da salvare nel backup.");
    return;
  }

  const workspaces = state.workspaces
    .filter((workspace) => selectedWorkspaceIds.includes(workspace.id))
    .map((workspace) => {
      const snapshot = structuredClone(workspace);
      if (selectedProjectsByWorkspace.has(snapshot.id)) {
        const selectedProjectIds = selectedProjectsByWorkspace.get(snapshot.id);
        snapshot.projects = snapshot.projects.filter((project) => selectedProjectIds.has(project.id));
      }
      return normalizeWorkspace(snapshot);
    });
  const { backup, attachmentFiles } = createBackupPackage(workspaces);

  downloadBackupZip(`backup-spazi-kanban-${new Date().toISOString().slice(0, 10)}.zip`, backup, attachmentFiles);
  els.backupDialog.close();
}

function createBackupPackage(workspaces, exportedAt = new Date().toISOString()) {
  const attachmentFiles = [];
  const backupWorkspaces = withBackupAttachmentPaths(workspaces, attachmentFiles);
  return {
    backup: {
      type: "kanban-workspace-backup",
      version: 4,
      exportedAt,
      activeWorkspaceId: state.activeWorkspaceId,
      workspaceName: state.ui.workspaceName || "default",
      configuration: configurationBackupPayload(),
      workspaces: backupWorkspaces,
    },
    attachmentFiles,
  };
}

function allWorkspaceBackupPackage() {
  syncActiveWorkspace();
  const workspaces = (Array.isArray(state.workspaces) ? state.workspaces : []).map((workspace) => normalizeWorkspace(structuredClone(workspace)));
  return createBackupPackage(workspaces);
}

function withBackupAttachmentPaths(workspaces, attachmentFiles) {
  return structuredClone(workspaces).map((workspace) => {
    workspace.projects.forEach((project) => {
      project.tasks.forEach((task) => {
        task.attachments = normalizeAttachments(task.attachments).map((attachment) => {
          if (!attachment.path) return attachment;
          const zipPath = [
            "attachments",
            safeZipSegment(`${workspace.name}-${workspace.id}`),
            safeZipSegment(`${project.name}-${project.id}`),
            safeZipSegment(task.id),
            `${safeZipSegment(attachment.id)}-${safeZipFilename(attachment.name)}`,
          ].join("/");
          attachmentFiles.push({ sourcePath: attachment.path, zipPath });
          return { ...attachment, backupPath: zipPath };
        });
      });
    });
    return workspace;
  });
}

function safeZipSegment(value) {
  return (
    String(value || "item")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item"
  );
}

function safeZipFilename(value) {
  const clean = safeZipSegment(value || "allegato.md");
  if (/\.(md|markdown|txt)$/i.test(clean)) return clean;
  return `${clean}.md`;
}

function downloadBackupZip(filename, backup, attachmentFiles = []) {
  const backupText = JSON.stringify(backup, null, 2);
  if (window.webkit?.messageHandlers?.exportBackupZip) {
    window.webkit.messageHandlers.exportBackupZip.postMessage({
      filename,
      backupText,
      directoryPath: state.ui.autoBackupDirectoryPath || "",
      directoryBookmark: state.ui.autoBackupDirectoryBookmark || "",
      files: attachmentFiles,
    });
    return;
  }

  const zipBytes = zipStore(new Map([["backup.json", backupText]]));
  const blob = new Blob([zipBytes], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function configurationBackupPayload() {
  return {
    ...workspaceUiSnapshot(),
    remoteSync: normalizeSyncSettings(state.sync),
  };
}

function scheduleAutoBackup() {
  if (suppressNextAutoBackup) {
    suppressNextAutoBackup = false;
    return;
  }
  queueAutoBackupByFrequency();
}

function queueAutoBackupByFrequency() {
  clearTimeout(autoBackupTimer);
  if (!state?.ui?.autoBackupDirectoryPath) return;
  if (!window.webkit?.messageHandlers?.autoBackupZip) return;
  if (!stateProjectCount(state)) return;
  autoBackupTimer = setTimeout(runAutoBackupNow, autoBackupDelayMs());
}

function autoBackupDelayMs() {
  const lastBackupMs = Date.parse(state.ui.lastAutoBackupAt || "");
  if (!Number.isFinite(lastBackupMs)) return 1600;
  const remainingMs = autoBackupFrequencyMs() - (Date.now() - lastBackupMs);
  return Math.max(1600, remainingMs);
}

function autoBackupFrequencyMs() {
  return normalizeAutoBackupFrequency(state.ui.autoBackupFrequencyHours) * 60 * 60 * 1000;
}

function runAutoBackupNow() {
  if (autoBackupInFlight || !state?.ui?.autoBackupDirectoryPath || !window.webkit?.messageHandlers?.autoBackupZip) return;
  autoBackupInFlight = true;
  const createdAt = new Date().toISOString();
  const { backup, attachmentFiles } = allWorkspaceBackupPackage();
  const backupText = JSON.stringify(backup, null, 2);
  window.webkit.messageHandlers.autoBackupZip.postMessage({
    directoryPath: state.ui.autoBackupDirectoryPath,
    directoryBookmark: state.ui.autoBackupDirectoryBookmark || "",
    filename: `backup-automatico-kanban-${autoBackupTimestamp(createdAt)}.zip`,
    backupText,
    files: attachmentFiles,
  });
}

function autoBackupTimestamp(value) {
  return value.replace(/[:.]/g, "-").slice(0, 19);
}

function selectAutoBackupDirectory() {
  if (window.webkit?.messageHandlers?.selectAutoBackupDirectory) {
    window.webkit.messageHandlers.selectAutoBackupDirectory.postMessage({
      autoBackupDirectoryPath: state.ui.autoBackupDirectoryPath || "",
    });
    return;
  }
  alert("La scelta della cartella per backup automatico è disponibile nell'app macOS.");
}

function clearAutoBackupDirectory() {
  state.ui.autoBackupDirectoryName = "";
  state.ui.autoBackupDirectoryPath = "";
  state.ui.autoBackupDirectoryBookmark = "";
  state.ui.lastAutoBackupError = "";
  clearTimeout(autoBackupTimer);
  renderAutoBackupConfig();
  renderDataSafetyCenter();
  suppressNextAutoBackup = true;
  saveState();
}

function renderAutoBackupConfig() {
  if (!els.autoBackupDirectoryName) return;
  els.autoBackupDirectoryName.textContent = state.ui.autoBackupDirectoryName || "Non impostata";
  els.autoBackupDirectoryName.title = state.ui.autoBackupDirectoryPath || "Il backup automatico è disattivato";
  if (els.autoBackupFrequency) els.autoBackupFrequency.value = String(normalizeAutoBackupFrequency(state.ui.autoBackupFrequencyHours));
}

function renderTaskArchiveConfig() {
  if (!els.autoArchiveDoneEnabled || !els.autoArchiveDoneDelay) return;
  state.ui.autoArchiveDoneDelayDays = normalizeAutoArchiveDoneDelay(state.ui.autoArchiveDoneDelayDays);
  els.autoArchiveDoneEnabled.checked = Boolean(state.ui.autoArchiveDoneEnabled);
  els.autoArchiveDoneDelay.value = String(state.ui.autoArchiveDoneDelayDays);
  els.autoArchiveDoneDelay.disabled = !state.ui.autoArchiveDoneEnabled;
}

function normalizeReminderListName(value) {
  return String(value || "").trim() || "kanban";
}

function renderRemindersConfig() {
  if (!els.syncRemindersEnabled || !els.remindersListName || !els.remindersSyncStatus) return;
  state.ui.remindersListName = normalizeReminderListName(state.ui.remindersListName);
  els.syncRemindersEnabled.checked = Boolean(state.ui.remindersEnabled);
  els.remindersListName.value = state.ui.remindersListName;
  if (els.syncRemindersNowBtn) els.syncRemindersNowBtn.disabled = !state.ui.remindersEnabled || remindersSyncInFlight;
  if (els.remindersListSelect) els.remindersListSelect.disabled = !state.ui.remindersEnabled;
  if (els.remindersListName) els.remindersListName.disabled = !state.ui.remindersEnabled;
  if (els.refreshRemindersListsBtn) els.refreshRemindersListsBtn.disabled = !state.ui.remindersEnabled;
  const status = state.ui.remindersEnabled ? state.ui.remindersLastSyncStatus || "Attivi" : "Disattivati";
  const detail = state.ui.remindersLastSyncError
    ? ` - ${state.ui.remindersLastSyncError}`
    : state.ui.remindersLastSyncAt
      ? ` - ultimo sync ${formatDateTime(state.ui.remindersLastSyncAt)}`
      : ` - lista ${state.ui.remindersListName}`;
  els.remindersSyncStatus.textContent = `${status}${detail}`;
  els.remindersSyncStatus.title = state.ui.remindersLastSyncError || state.ui.remindersListName;
}

function reminderTaskRecords() {
  const workspaceId = state.activeWorkspaceId || "workspace-default";
  const workspaceName = state.ui.workspaceName || "default";
  return activeProjects()
    .flatMap((project) =>
      (project.tasks || [])
        .filter((task) => task.reminderEnabled && task.dueDate && statusForTask(task.statusId, project)?.type !== "done")
        .map((task) => ({
          key: `${workspaceId}/${project.id}/${task.id}`,
          workspaceId,
          workspaceName,
          projectId: project.id,
          projectName: project.name,
          taskId: task.id,
          taskName: task.name || "Attività senza nome",
          title: task.name || "Attività senza nome",
          dueDate: task.dueDate,
          owner: task.owner || "",
          priority: task.priority || "none",
          notes: task.notes || "",
        })),
    );
}

function reminderSyncPayload() {
  syncActiveWorkspace();
  const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
  return {
    listName: normalizeReminderListName(state.ui.remindersListName),
    workspaceId: state.activeWorkspaceId || workspace?.id || "workspace-default",
    workspaceName: state.ui.workspaceName || workspace?.name || "default",
    reminders: reminderTaskRecords(),
  };
}

function refreshReminderLists({ silent = false } = {}) {
  if (!state.ui.remindersEnabled && silent) return;
  if (!window.webkit?.messageHandlers?.listReminderCalendars) {
    if (!silent) {
      state.ui.remindersLastSyncError = "Disponibile solo nell'app macOS.";
      renderRemindersConfig();
    }
    return;
  }
  if (!silent) {
    state.ui.remindersLastSyncStatus = "Carico liste";
    state.ui.remindersLastSyncError = "";
    renderRemindersConfig();
  }
  window.webkit.messageHandlers.listReminderCalendars.postMessage({});
}

function scheduleReminderSync({ immediate = false } = {}) {
  if (suppressNextReminderSync) {
    suppressNextReminderSync = false;
    return;
  }
  clearTimeout(remindersSyncTimer);
  if (!state.ui?.remindersEnabled) return;
  remindersSyncTimer = setTimeout(() => syncWorkspaceReminders({ silent: true }), immediate ? 80 : 1200);
}

function syncWorkspaceReminders({ manual = false, silent = false } = {}) {
  if (!state.ui.remindersEnabled || remindersSyncInFlight) return;
  const handler = window.webkit?.messageHandlers?.syncReminders;
  if (!handler) {
    if (!silent || manual) {
      state.ui.remindersLastSyncStatus = "Non disponibile";
      state.ui.remindersLastSyncError = "Apri l'app macOS per usare Promemoria Apple.";
      renderRemindersConfig();
    }
    return;
  }
  remindersSyncInFlight = true;
  state.ui.remindersListName = normalizeReminderListName(state.ui.remindersListName);
  state.ui.remindersLastSyncStatus = "Sync in corso";
  state.ui.remindersLastSyncError = "";
  renderRemindersConfig();
  handler.postMessage(reminderSyncPayload());
}

window.receiveReminderLists = (result) => {
  const lists = Array.isArray(result?.lists) ? result.lists.map((item) => String(item || "")).filter(Boolean) : [];
  if (els.remindersListSelect) {
    const current = normalizeReminderListName(state.ui.remindersListName);
    const options = [`<option value="">Scegli lista</option>`]
      .concat(lists.map((name) => `<option value="${escapeHtml(name)}" ${name === current ? "selected" : ""}>${escapeHtml(name)}</option>`))
      .join("");
    els.remindersListSelect.innerHTML = options;
  }
  if (result?.ok) {
    state.ui.remindersLastSyncError = "";
    if (!state.ui.remindersLastSyncStatus || state.ui.remindersLastSyncStatus === "Carico liste") state.ui.remindersLastSyncStatus = "Liste caricate";
  } else {
    state.ui.remindersLastSyncStatus = "Errore Promemoria";
    state.ui.remindersLastSyncError = String(result?.message || "Non posso leggere le liste.");
  }
  renderRemindersConfig();
};

window.receiveReminderSyncResult = (result) => {
  remindersSyncInFlight = false;
  if (result?.ok) {
    const synced = Number(result.synced) || 0;
    const removed = Number(result.removed) || 0;
    state.ui.remindersLastSyncAt = String(result.syncedAt || new Date().toISOString());
    state.ui.remindersLastSyncStatus = `${synced} promemoria aggiornati${removed ? `, ${removed} rimossi` : ""}`;
    state.ui.remindersLastSyncError = "";
  } else {
    state.ui.remindersLastSyncStatus = "Errore Promemoria";
    state.ui.remindersLastSyncError = String(result?.message || "Sincronizzazione non riuscita.");
  }
  renderRemindersConfig();
  suppressNextReminderSync = true;
  saveState();
};

function renderRemoteSyncConfig() {
  if (!els.remoteSyncEnabled || !els.remoteCouchUrl || !els.remoteSyncStatus) return;
  state.sync = normalizeSyncSettings(state.sync);
  els.remoteSyncEnabled.checked = Boolean(state.sync.remoteEnabled);
  els.remoteCouchUrl.value = state.sync.remoteUrl || DEFAULT_COUCH_REMOTE_URL;
  if (els.remoteCouchUser) els.remoteCouchUser.value = String(remoteSyncAuth?.username || "");
  if (els.remoteCouchPassword) els.remoteCouchPassword.value = String(remoteSyncAuth?.password || "");
  if (els.remoteSyncFrequency) els.remoteSyncFrequency.value = String(normalizeRemoteSyncFrequency(state.sync.remoteFrequencyHours));
  if (els.remoteSyncNowBtn) els.remoteSyncNowBtn.disabled = !state.sync.remoteEnabled;
  if (els.remoteSyncFrequency) els.remoteSyncFrequency.disabled = !state.sync.remoteEnabled;
  const status = state.sync.remoteEnabled ? state.sync.remoteStatus || "Replica remota attiva" : "Disattivata";
  const frequency = `ogni ${normalizeRemoteSyncFrequency(state.sync.remoteFrequencyHours)} ${normalizeRemoteSyncFrequency(state.sync.remoteFrequencyHours) === 1 ? "ora" : "ore"}`;
  const detail = state.sync.remoteError ? ` - ${state.sync.remoteError}` : state.sync.lastRemoteSyncAt ? ` - ultimo sync ${formatDateTime(state.sync.lastRemoteSyncAt)} - ${frequency}` : ` - ${frequency}`;
  els.remoteSyncStatus.textContent = `${status}${detail}`;
  els.remoteSyncStatus.title = state.sync.remoteError || state.sync.remoteUrl || "";
}

window.receiveAutoBackupDirectory = (directory) => {
  state.ui.autoBackupDirectoryName = String(directory?.name || "");
  state.ui.autoBackupDirectoryPath = String(directory?.path || "");
  state.ui.autoBackupDirectoryBookmark = String(directory?.bookmark || "");
  state.ui.lastAutoBackupError = "";
  renderAutoBackupConfig();
  renderDataSafetyCenter();
  saveState();
};

window.receiveAutoBackupResult = (result) => {
  autoBackupInFlight = false;
  if (result?.ok) {
    state.ui.lastAutoBackupAt = String(result.createdAt || new Date().toISOString());
    state.ui.lastAutoBackupPath = String(result.path || "");
    state.ui.lastAutoBackupError = result.missingCount ? `${result.missingCount} allegati non inclusi perché non trovati.` : "";
  } else {
    state.ui.lastAutoBackupError = String(result?.message || "Backup automatico non riuscito.");
  }
  renderDataSafetyCenter();
  suppressNextAutoBackup = true;
  saveState();
  if (result?.ok) queueAutoBackupByFrequency();
};

function verifyAllAttachments() {
  const attachments = allAttachmentRecords();
  if (!attachments.length) {
    state.ui.lastAttachmentCheckAt = new Date().toISOString();
    state.ui.missingAttachmentCount = 0;
    state.ui.missingAttachments = [];
    renderDataSafetyCenter();
    suppressNextAutoBackup = true;
    saveState();
    return;
  }
  if (window.webkit?.messageHandlers?.verifyAttachments) {
    els.attachmentCheckResult.textContent = "Verifica in corso...";
    window.webkit.messageHandlers.verifyAttachments.postMessage({ attachments });
    return;
  }
  els.attachmentCheckResult.textContent = "La verifica dei file su disco è disponibile nell'app macOS.";
}

function allAttachmentRecords() {
  syncActiveWorkspace();
  return (state.workspaces || []).flatMap((workspace) =>
    (workspace.projects || []).flatMap((project) =>
      (project.tasks || []).flatMap((task) =>
        normalizeAttachments(task.attachments).map((attachment) => ({
          id: attachment.id,
          name: attachment.name,
          path: attachment.path,
          workspaceName: workspace.name,
          projectName: project.name,
          taskName: task.name,
        })),
      ),
    ),
  );
}

window.receiveAttachmentVerification = (result) => {
  const missing = Array.isArray(result?.missing) ? result.missing : [];
  state.ui.lastAttachmentCheckAt = String(result?.checkedAt || new Date().toISOString());
  state.ui.missingAttachmentCount = missing.length;
  state.ui.missingAttachments = missing.slice(0, 30);
  renderDataSafetyCenter();
  suppressNextAutoBackup = true;
  saveState();
};

function renderDataSafetyCenter() {
  if (!els.dataSafetyCenter) return;
  const stats = workspaceDataStats();
  const nativeStatePath = decodeNativeBase64(window.KANBAN_NATIVE_STATE_PATH_BASE64);
  const localDatabase = typeof PouchDB !== "undefined" ? "PouchDB locale (IndexedDB)" : nativeStatePath || "localStorage browser";
  state.sync = normalizeSyncSettings(state.sync);
  const remoteSyncStatus = state.sync.remoteEnabled ? state.sync.remoteStatus || "Attiva" : "Disattivata";
  const remoteSyncDetail = state.sync.remoteError || state.sync.remoteUrl || "";
  const lastSave = state.updatedAt ? formatDateTime(state.updatedAt) : "Non ancora salvato";
  const lastBackup = state.ui.lastAutoBackupAt ? formatDateTime(state.ui.lastAutoBackupAt) : "Non eseguito";
  const backupFolder = state.ui.autoBackupDirectoryPath || "Non impostata";
  const backupFrequency = `${normalizeAutoBackupFrequency(state.ui.autoBackupFrequencyHours)} ore`;
  const attachmentStatus = state.ui.lastAttachmentCheckAt
    ? state.ui.missingAttachmentCount
      ? `${state.ui.missingAttachmentCount} mancanti`
      : "Tutti presenti"
    : "Non verificati";
  els.dataSafetyCenter.innerHTML = `
    ${dataSafetyRow("Ultimo salvataggio", lastSave)}
    ${dataSafetyRow("Database locale", localDatabase, nativeStatePath)}
    ${dataSafetyRow("Replica remota", remoteSyncStatus, remoteSyncDetail)}
    ${state.sync.lastRemoteSyncAt ? dataSafetyRow("Ultimo sync remoto", formatDateTime(state.sync.lastRemoteSyncAt), state.sync.remoteUrl) : ""}
    ${dataSafetyRow("Dati gestiti", `${stats.workspaces} spazi · ${stats.projects} progetti · ${stats.tasks} attività · ${stats.attachments} allegati`)}
    ${dataSafetyRow("Cartella backup automatico", shortenPath(backupFolder), backupFolder)}
    ${dataSafetyRow("Frequenza backup automatico", backupFrequency)}
    ${dataSafetyRow("Ultimo backup automatico", lastBackup, state.ui.lastAutoBackupPath || "")}
    ${dataSafetyRow("Verifica allegati", attachmentStatus)}
    ${state.ui.lastAutoBackupError ? `<div class="data-safety-warning">${escapeHtml(state.ui.lastAutoBackupError)}</div>` : ""}
    ${state.sync.remoteError ? `<div class="data-safety-warning">${escapeHtml(state.sync.remoteError)}</div>` : ""}
  `;
  renderAttachmentCheckResult();
}

function dataSafetyRow(label, value, title = "") {
  return `
    <div class="data-safety-row">
      <span>${escapeHtml(label)}</span>
      <strong title="${escapeHtml(title || value)}">${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderAttachmentCheckResult() {
  if (!els.attachmentCheckResult) return;
  const missing = Array.isArray(state.ui.missingAttachments) ? state.ui.missingAttachments : [];
  if (!state.ui.lastAttachmentCheckAt) {
    els.attachmentCheckResult.innerHTML = `<span>Allegati non ancora verificati.</span>`;
    return;
  }
  if (!missing.length) {
    els.attachmentCheckResult.innerHTML = `<span class="ok">Ultimo controllo: nessun allegato mancante.</span>`;
    return;
  }
  els.attachmentCheckResult.innerHTML = `
    <span class="warning">Mancano ${missing.length} allegati nell'ultimo controllo.</span>
    <div class="missing-attachment-list">
      ${missing
        .slice(0, 5)
        .map((item) => `<span title="${escapeHtml(item.path || "")}">${escapeHtml(item.projectName || "")} · ${escapeHtml(item.taskName || "")} · ${escapeHtml(item.name || item.path || "")}</span>`)
        .join("")}
    </div>
  `;
}

function workspaceDataStats() {
  const workspaces = Array.isArray(state.workspaces) && state.workspaces.length ? state.workspaces : [{ projects: state.projects || [] }];
  const projects = workspaces.flatMap((workspace) => workspace.projects || []);
  const tasks = projects.flatMap((project) => project.tasks || []);
  const attachments = tasks.flatMap((task) => normalizeAttachments(task.attachments));
  return { workspaces: workspaces.length, projects: projects.length, tasks: tasks.length, attachments: attachments.length };
}

function decodeNativeBase64(value) {
  if (!value) return "";
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function shortenPath(value) {
  const path = String(value || "");
  if (!path || path === "Non impostata") return path || "Non impostata";
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 3) return path;
  return `.../${parts.slice(-3).join("/")}`;
}

function restoreConfigurationFromBackup(parsed) {
  const config = parsed?.configuration || {};
  const workspaceName = config.workspaceName || parsed?.workspaceName;
  if (workspaceName) state.ui.workspaceName = String(workspaceName);
  if (config.theme === "dark" || config.theme === "light") state.ui.theme = config.theme;
  if (/^#[0-9a-f]{6}$/i.test(config.accentColor || "")) state.ui.accentColor = config.accentColor;
  if (Number(config.sidebarFontScale)) state.ui.sidebarFontScale = Number(config.sidebarFontScale);
  if (Number(config.contentFontScale)) state.ui.contentFontScale = Number(config.contentFontScale);
  if (typeof config.configCollapsed === "boolean") state.ui.configCollapsed = config.configCollapsed;
  if (typeof config.attachmentEditorName === "string") state.ui.attachmentEditorName = config.attachmentEditorName;
  if (typeof config.attachmentEditorPath === "string") state.ui.attachmentEditorPath = config.attachmentEditorPath;
  if (typeof config.attachmentDirectoryName === "string") state.ui.attachmentDirectoryName = config.attachmentDirectoryName;
  if (typeof config.attachmentDirectoryPath === "string") state.ui.attachmentDirectoryPath = config.attachmentDirectoryPath;
  if (typeof config.autoBackupDirectoryName === "string") state.ui.autoBackupDirectoryName = config.autoBackupDirectoryName;
  if (typeof config.autoBackupDirectoryPath === "string") state.ui.autoBackupDirectoryPath = config.autoBackupDirectoryPath;
  if (typeof config.autoBackupDirectoryBookmark === "string") state.ui.autoBackupDirectoryBookmark = config.autoBackupDirectoryBookmark;
  state.ui.autoBackupFrequencyHours = normalizeAutoBackupFrequency(config.autoBackupFrequencyHours ?? state.ui.autoBackupFrequencyHours);
  if (config.remoteSync) state.sync = normalizeSyncSettings(config.remoteSync);
  if (Array.isArray(config.participants)) state.ui.participants = normalizeParticipants(config.participants);
}

function handleRestoreFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (/\.zip$/i.test(file.name)) {
    alert("Il restore dei backup .zip con allegati è disponibile nell'app macOS.");
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    prepareRestorePreview(String(reader.result || ""));
  });
  reader.readAsText(file);
}

window.loadBackupFromNative = (base64Text) => {
  try {
    const text = decodeURIComponent(
      Array.from(atob(base64Text), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""),
    );
    prepareRestorePreview(text);
  } catch {
    alert("Non riesco a leggere questo file di backup.");
  }
};

function prepareRestorePreview(text) {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.workspaces)) {
      pendingRestoreKind = "workspaces";
      pendingRestoreWorkspaces = parsed.workspaces.map(normalizeImportedWorkspace).filter(Boolean);
      pendingRestoreProjects = [];
      if (!pendingRestoreWorkspaces.length) {
        alert("Il file non contiene spazi di lavoro validi da importare.");
        return;
      }
      renderRestoreWorkspaceList();
      els.restoreDialog.showModal();
      return;
    }

    pendingRestoreKind = "projects";
    pendingRestoreWorkspaces = [];
    const importedProjects = Array.isArray(parsed?.projects) ? parsed.projects : Array.isArray(parsed) ? parsed : [];
    pendingRestoreProjects = importedProjects.map(normalizeImportedProject).filter(Boolean);
    if (!pendingRestoreProjects.length) {
      alert("Il file non contiene spazi di lavoro o progetti validi da importare.");
      return;
    }
    renderRestoreProjectList();
    els.restoreDialog.showModal();
  } catch {
    alert("Non riesco a leggere questo file di backup. Controlla che sia un file JSON valido.");
  }
}

function restoreWorkspacesFromBackup() {
  syncActiveWorkspace();
  const restoredIds = [];
  const selectedWorkspaceIndexes = [...els.restoreProjectList.querySelectorAll("[data-restore-workspace]:checked")].map((input) => Number(input.dataset.restoreWorkspace));

  if (!selectedWorkspaceIndexes.length) {
    alert("Seleziona almeno uno spazio di lavoro da ripristinare.");
    return;
  }

  selectedWorkspaceIndexes.forEach((index) => {
    const workspace = pendingRestoreWorkspaces[index];
    if (!workspace) return;
    const imported = structuredClone(workspace);
    const selectedProjectIds = new Set(
      [...els.restoreProjectList.querySelectorAll(`[data-restore-workspace-project="${index}"]:checked`)].map((input) => input.dataset.restoreProject),
    );
    imported.projects = imported.projects.filter((project) => selectedProjectIds.has(project.id));
    const existing = findWorkspaceByName(imported.name);

    if (existing) {
      const replaceWorkspace = Boolean(els.restoreProjectList.querySelector(`[data-restore-replace-workspace="${index}"]`)?.checked);

      if (replaceWorkspace) {
        imported.id = existing.id;
        const existingIndex = state.workspaces.findIndex((item) => item.id === existing.id);
        state.workspaces.splice(existingIndex, 1, normalizeWorkspace(imported));
        restoredIds.push(imported.id);
        return;
      }

      const existingIndex = state.workspaces.findIndex((item) => item.id === existing.id);
      state.workspaces.splice(existingIndex, 1, mergeWorkspaceBackup(existing, imported));
      restoredIds.push(existing.id);
      return;
    }

    imported.id = uniqueWorkspaceId(imported.id || slugify(imported.name));
    state.workspaces.push(normalizeWorkspace(imported));
    restoredIds.push(imported.id);
  });

  pendingRestoreWorkspaces = [];
  pendingRestoreKind = "";
  if (restoredIds.length) {
    state.emptyWorkspaceList = false;
    const restoredWorkspace = state.workspaces.find((workspace) => workspace.id === restoredIds[0]);
    state.activeWorkspaceId = restoredWorkspace?.id || state.workspaces[0]?.id || "";
    if (restoredWorkspace) {
      state.ui = { ...structuredClone(initialData.ui), ...structuredClone(restoredWorkspace.ui), workspaceName: restoredWorkspace.name };
      state.projects = structuredClone(restoredWorkspace.projects);
      state.activeProjectId = state.projects[0]?.id || "";
      state.activeView = projectEnabledViews(state.projects[0] || {})[0] || "board";
      state.route = "projects";
    }
  }

  saveState();
  els.restoreDialog.close();
  render();
}

function renderRestoreWorkspaceList() {
  els.restoreProjectList.innerHTML = `
    <div class="backup-list-title">Contenuto del backup</div>
    ${pendingRestoreWorkspaces
      .map((workspace, index) => {
        const conflict = findWorkspaceByName(workspace.name);
        return `
          <section class="restore-workspace-block ${conflict ? "has-conflict" : ""}">
            <label class="project-check-row">
              <input type="checkbox" data-restore-workspace="${index}" checked />
              <span>
                <strong>${escapeHtml(workspace.name)}</strong>
                <small>${workspace.projects.length} progetti${conflict ? " · spazio gia presente" : ""}</small>
              </span>
            </label>
            ${
              conflict
                ? `
                  <label class="restore-option-row">
                    <input type="checkbox" data-restore-replace-workspace="${index}" />
                    <span>Sostituisci intero spazio esistente</span>
                  </label>
                  <p class="dialog-note">Se non selezionato, i progetti scelti aggiornano o si aggiungono allo spazio senza cancellare gli altri.</p>
                `
                : ""
            }
            <div class="restore-project-group">
              ${workspace.projects
                .map(
                  (project) => `
                    <label class="project-check-row compact-row">
                      <input type="checkbox" data-restore-workspace-project="${index}" data-restore-project="${escapeHtml(project.id)}" checked />
                      <span>
                        <strong>${escapeHtml(project.name)}</strong>
                        <small>${project.tasks.length} attività</small>
                      </span>
                    </label>
                  `,
                )
                .join("") || `<div class="muted-empty">Nessun progetto in questo spazio.</div>`}
            </div>
          </section>
        `;
      })
      .join("")}
  `;
}

function renderRestoreProjectList() {
  els.restoreProjectList.innerHTML = `
    <div class="backup-list-title">Progetti nel backup</div>
    <p class="dialog-note">Questi progetti verranno importati nello spazio attivo "${escapeHtml(state.ui.workspaceName || "default")}".</p>
    ${pendingRestoreProjects
      .map((project, index) => {
        const conflict = findProjectByName(project.name);
        return `
        <label class="project-check-row ${conflict ? "has-conflict" : ""}">
          <input type="checkbox" data-restore-index="${index}" checked />
          <span>
            <strong>${escapeHtml(project.name)}</strong>
            <small>${project.tasks.length} attività${conflict ? " · nome gia presente" : ""}</small>
          </span>
        </label>
        ${
          conflict
            ? `
              <label class="restore-option-row">
                <input type="checkbox" data-restore-project-overwrite="${index}" checked />
                <span>Sovrascrivi il progetto esistente</span>
              </label>
            `
            : ""
        }
      `;
      })
      .join("")}
  `;
}

function restoreSelectedBackup() {
  if (pendingRestoreKind === "workspaces") {
    restoreWorkspacesFromBackup();
    return;
  }
  restoreSelectedProjects();
}

function restoreSelectedProjects() {
  const selectedIndexes = [...els.restoreProjectList.querySelectorAll("[data-restore-index]:checked")].map((input) => Number(input.dataset.restoreIndex));

  if (!selectedIndexes.length) {
    alert("Seleziona almeno un progetto da importare.");
    return;
  }

  const restoredIds = [];

  selectedIndexes.forEach((index) => {
    const imported = structuredClone(pendingRestoreProjects[index]);
    const existing = findProjectByName(imported.name);

    if (existing) {
      const overwrite = Boolean(els.restoreProjectList.querySelector(`[data-restore-project-overwrite="${index}"]`)?.checked);

      if (overwrite) {
        imported.id = existing.id;
        state.projects.splice(state.projects.indexOf(existing), 1, imported);
        restoredIds.push(imported.id);
        return;
      }

      imported.name = uniqueProjectName(`${imported.name} copia`);
    }

    imported.id = uniqueProjectId(imported.id || slugify(imported.name));
    state.projects.push(imported);
    restoredIds.push(imported.id);
  });

  restoredIds.forEach((projectId) => {
    state.ui.openProjects[projectId] = true;
    if (!state.ui.openProjectTabs.includes(projectId)) state.ui.openProjectTabs.push(projectId);
  });

  if (restoredIds.length) {
    state.activeProjectId = restoredIds[0];
    state.route = "project";
    state.activeView = "board";
  }

  pendingRestoreProjects = [];
  pendingRestoreKind = "";
  els.restoreDialog.close();
  saveState();
  render();
}

function normalizeImportedProject(project) {
  if (!project || typeof project !== "object") return null;
  const name = String(project.name || "").trim();
  if (!name) return null;

  const statuses = Array.isArray(project.statuses) && project.statuses.length ? project.statuses : defaultStatuses();
  const normalizedStatuses = statuses.map((status, index) => ({
    id: String(status.id || `status-${index}`),
    name: String(status.name || "Stato"),
    type: String(status.type || "custom"),
    hidden: Boolean(status.hidden),
    color: status.color || "",
    textColor: status.textColor || "",
  }));
  const statusIds = new Set(normalizedStatuses.map((status) => status.id));
  const fallbackStatus = normalizedStatuses[0]?.id || "todo";

  return {
    id: String(project.id || slugify(name)),
    name,
    note: String(project.note || ""),
    archived: Boolean(project.archived),
    archivedAt: String(project.archivedAt || ""),
    archiveKind: String(project.archiveKind || ""),
    archiveSourceProjectId: String(project.archiveSourceProjectId || ""),
    statuses: normalizedStatuses,
    enabledViews: {
      board: project.enabledViews?.board !== false,
      table: project.enabledViews?.table !== false,
      timeline: (project.enabledViews?.timeline ?? project.enabledViews?.grid) !== false,
      dashboard: project.enabledViews?.dashboard !== false,
    },
    tasks: Array.isArray(project.tasks)
      ? project.tasks.map((task) => normalizeImportedTask(task, statusIds, fallbackStatus)).filter(Boolean)
      : [],
  };
}

function normalizeImportedWorkspace(workspace) {
  if (!workspace || typeof workspace !== "object") return null;
  const name = String(workspace.name || workspace.ui?.workspaceName || "").trim();
  if (!name) return null;

  const projects = Array.isArray(workspace.projects) ? workspace.projects.map(normalizeImportedProject).filter(Boolean) : [];
  return normalizeWorkspace({
    id: String(workspace.id || slugify(name)),
    name,
    ui: {
      ...workspaceUiSnapshot({ ...initialData.ui, ...(workspace.ui || {}), workspaceName: name }),
      workspaceName: name,
    },
    projects,
  });
}

function mergeWorkspaceBackup(existingWorkspace, importedWorkspace) {
  const merged = structuredClone(existingWorkspace);
  const importedProjects = Array.isArray(importedWorkspace.projects) ? importedWorkspace.projects : [];
  const projectIndex = new Map();
  merged.projects.forEach((project, index) => {
    projectIndex.set(`id:${project.id}`, index);
    projectIndex.set(`name:${project.name.trim().toLowerCase()}`, index);
  });

  importedProjects.forEach((project) => {
    const byId = projectIndex.get(`id:${project.id}`);
    const byName = projectIndex.get(`name:${project.name.trim().toLowerCase()}`);
    const targetIndex = byId ?? byName;
    if (targetIndex !== undefined) {
      const nextProject = { ...structuredClone(project), id: merged.projects[targetIndex].id };
      merged.projects.splice(targetIndex, 1, nextProject);
    } else {
      const nextProject = structuredClone(project);
      nextProject.id = uniqueProjectIdInWorkspace(nextProject.id || slugify(nextProject.name), merged.projects);
      merged.projects.push(nextProject);
    }
  });

  merged.ui = {
    ...workspaceUiSnapshot({ ...initialData.ui, ...(merged.ui || {}), workspaceName: merged.name }),
    participants: normalizeParticipants([
      ...(merged.ui?.participants || []),
      ...(importedWorkspace.ui?.participants || []),
      ...taskOwnersFromProjects(importedProjects),
    ]),
  };
  return normalizeWorkspace(merged);
}

function uniqueProjectIdInWorkspace(baseId, projects) {
  const cleanBase =
    String(baseId || "progetto")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "") || "progetto";
  let id = cleanBase;
  let counter = 2;
  while (projects.some((project) => project.id === id)) {
    id = `${cleanBase}-${counter}`;
    counter += 1;
  }
  return id;
}

function normalizeImportedTask(task, statusIds, fallbackStatus) {
  if (!task || typeof task !== "object") return null;
  const name = String(task.name || "").trim();
  if (!name) return null;

  return {
    id: String(task.id || crypto.randomUUID()),
    name,
    startDate: task.startDate || "",
    dueDate: task.dueDate || "",
    owner: task.owner || "",
    priority: priorityOption(task.priority, true).id,
    statusId: statusIds.has(task.statusId) ? task.statusId : fallbackStatus,
    reminderEnabled: Boolean(task.reminderEnabled),
    completedAt: String(task.completedAt || ""),
    archivedAt: String(task.archivedAt || ""),
    archivedFromProjectId: String(task.archivedFromProjectId || ""),
    notes: task.notes || "",
    attachments: normalizeAttachments(task.attachments),
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks
          .map((subtask) => ({
            id: String(subtask.id || crypto.randomUUID()),
            name: String(subtask.name || "").trim(),
            done: Boolean(subtask.done),
            dueDate: subtask.dueDate || "",
            owner: subtask.owner || "",
          }))
          .filter((subtask) => subtask.name)
      : [],
  };
}

function findProjectByName(name) {
  const normalizedName = name.trim().toLowerCase();
  return state.projects.find((project) => project.name.trim().toLowerCase() === normalizedName);
}

function findWorkspaceByName(name) {
  const normalizedName = String(name || "").trim().toLowerCase();
  return state.workspaces.find((workspace) => workspace.name.trim().toLowerCase() === normalizedName);
}

function uniqueWorkspaceName(baseName) {
  let name = baseName;
  let counter = 2;
  while (findWorkspaceByName(name)) {
    name = `${baseName} ${counter}`;
    counter += 1;
  }
  return name;
}

function uniqueWorkspaceId(baseId) {
  const cleanBase =
    String(baseId || "workspace")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "") || "workspace";
  let id = cleanBase;
  let counter = 2;
  while (state.workspaces.some((workspace) => workspace.id === id)) {
    id = `${cleanBase}-${counter}`;
    counter += 1;
  }
  return id;
}

function uniqueProjectName(baseName) {
  let name = baseName;
  let counter = 2;
  while (findProjectByName(name)) {
    name = `${baseName} ${counter}`;
    counter += 1;
  }
  return name;
}

function uniqueProjectId(baseId) {
  const cleanBase = String(baseId || "progetto")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "") || "progetto";
  let id = cleanBase;
  let counter = 2;
  while (state.projects.some((project) => project.id === id)) {
    id = `${cleanBase}-${counter}`;
    counter += 1;
  }
  return id;
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.map(markdownCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(markdownCell).join(" | ")} |`),
  ].join("\n");
}

function markdownCell(value) {
  return String(value)
    .replaceAll("|", "\\|")
    .replaceAll("\n", "<br>")
    .replaceAll("\r", "")
    .trim();
}

function downloadTextFile(filename, text) {
  if (window.webkit?.messageHandlers?.exportMarkdown) {
    window.webkit.messageHandlers.exportMarkdown.postMessage({ filename, text });
    return;
  }

  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slugifyFilename(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "progetto";
}

let searchRenderTimer = null;
function updateSearch(value) {
  state.search = value;
  if (els.searchInput.value !== value) els.searchInput.value = value;
  if (els.sidebarSearchInput.value !== value) els.sidebarSearchInput.value = value;
  clearTimeout(searchRenderTimer);
  searchRenderTimer = setTimeout(renderContent, 150);
}

function toggleSearch(target = "main") {
  if (target === "sidebar") {
    els.sidebarSearchPanel.classList.toggle("open");
    if (els.sidebarSearchPanel.classList.contains("open")) els.sidebarSearchInput.focus();
    return;
  }

  els.searchPanel.classList.toggle("open");
  if (els.searchPanel.classList.contains("open")) els.searchInput.focus();
}

function completion(task) {
  if (!task.subtasks.length) return task.statusId === "done" ? 100 : 0;
  return Math.round((task.subtasks.filter((item) => item.done).length / task.subtasks.length) * 100);
}

function statusFor(statusId) {
  return activeProject()?.statuses.find((status) => status.id === statusId) || { name: "No Status", type: "no-status" };
}

function statusForTask(statusId, project = activeProject()) {
  return project?.statuses.find((status) => status.id === statusId);
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(parseDate(value));
}

function parseDate(value) {
  return new Date(`${value}T12:00:00`);
}

function dateSortValue(value) {
  return value ? parseDate(value).getTime() : Number.POSITIVE_INFINITY;
}

function dueDateSortValue(task) {
  return dateSortValue(task.dueDate);
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function viewName(view) {
  return { board: "Board", table: "List", timeline: "Timeline", dashboard: "Dashboard" }[view] || "Board";
}

function deadlineFilterName(filter) {
  return (
    {
      all: "tutte le attività",
      today: "oggi",
      week: "questa settimana",
      month: "prossimo mese",
      planned: "pianificate",
      unplanned: "non pianificate",
      overdue: "attività scadute",
    }[filter] || "scadenze"
  );
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .concat("-", Math.random().toString(36).slice(2, 6));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function registerUndo(message, undo) {
  if (!els.undoToast || typeof undo !== "function") return;
  pendingUndo = { message, undo };
  renderUndoToast();
  clearTimeout(undoToastTimer);
  undoToastTimer = setTimeout(clearUndo, 12000);
}

function renderUndoToast() {
  if (!els.undoToast || !pendingUndo) return;
  els.undoToast.hidden = false;
  els.undoToast.innerHTML = `
    <span>${escapeHtml(pendingUndo.message)}</span>
    <button type="button" data-run-undo>Annulla</button>
  `;
  els.undoToast.querySelector("[data-run-undo]").addEventListener("click", runUndo);
}

function clearUndo() {
  pendingUndo = null;
  clearTimeout(undoToastTimer);
  if (!els.undoToast) return;
  els.undoToast.hidden = true;
  els.undoToast.innerHTML = "";
}

function runUndo() {
  const action = pendingUndo;
  clearUndo();
  action?.undo();
}
