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
let workspaceCreateOpen = false;
let pendingRenameParticipant = "";
let workspaceRenameOpen = false;
let pendingRenameWorkspaceId = "";
let taskAttachmentDraft = [];
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
