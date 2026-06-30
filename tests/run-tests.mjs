import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

const stateSource = read("src/02_state.js");
assert.match(stateSource, /stateUpdatedAtValue/);
assert.match(stateSource, /stateRevisionValue/);
assert.match(stateSource, /const now = new Date\(\)\.toISOString\(\)/);
assert.match(stateSource, /state\.updatedAt = now/);
assert.match(stateSource, /state\.revision = stateRevisionValue\(state\) \+ 1/);
assert.match(stateSource, /function normalizeAttachments/);
assert.match(stateSource, /attachmentEditorPath/);
assert.match(stateSource, /attachmentDirectoryPath/);
assert.match(stateSource, /initializePouchPersistence/);
assert.match(stateSource, /queuePouchStateSave/);
assert.match(stateSource, /startRemoteReplication/);
assert.match(stateSource, /normalizeRemoteCouchUrl/);
assert.match(stateSource, /DEFAULT_COUCH_REMOTE_URL/);
assert.match(stateSource, /SYNC_AUTH_STORAGE_KEY/);
assert.match(stateSource, /remotePouchOptions/);
assert.match(stateSource, /function stateToKanbanDocs/);
assert.match(stateSource, /function kanbanDocsToState/);
assert.match(stateSource, /type: "kanban-task"/);
assert.match(stateSource, /visibleTo/);
assert.match(stateSource, /groupId/);
assert.match(stateSource, /normalizeRemoteSyncFrequency/);
assert.match(stateSource, /scheduleRemoteAutoSync/);
assert.match(stateSource, /remoteAutoSyncTimer/);
assert.match(stateSource, /archivedAt/);
assert.match(stateSource, /autoArchiveDoneEnabled/);
assert.match(stateSource, /normalizeAutoArchiveDoneDelay/);
assert.match(stateSource, /archiveCompletedTasksIfNeeded/);
assert.match(stateSource, /findOrCreateDoneArchiveProject/);
assert.match(stateSource, /remindersEnabled/);
assert.match(stateSource, /remindersListName/);
assert.match(stateSource, /reminderEnabled: Boolean\(task\.reminderEnabled\)/);
assert.match(stateSource, /deadlinesCollapsed: Boolean\(ui\.deadlinesCollapsed\)/);
assert.match(stateSource, /projectsCollapsed: Boolean\(ui\.projectsCollapsed\)/);

const coreSource = read("src/01_core.js");
const viewsSource = read("src/04_views.js");
const shellSource = read("src/03_shell.js");
const indexSource = read("assets/index.html");
const stylesSource = read("assets/styles.css");
const dialogsSource = read("src/07_dialogs.js");
const swiftSource = read("macos/GestoreKanban/main.swift");
const couchInitSource = read("deploy/couchdb/init-kanban-db.sh");
const portalServerSource = read("deploy/portal/server.mjs");
const portalAppSource = read("deploy/portal/public/app.js");
const portalIndexSource = read("deploy/portal/public/index.html");
const portalStylesSource = read("deploy/portal/public/styles.css");
assert.match(coreSource, /id: "dashboard"/);
assert.match(coreSource, /id: "timeline"/);
assert.match(coreSource, /CONFIGURABLE_VIEW_OPTIONS/);
assert.match(coreSource, /attachmentList/);
assert.match(coreSource, /calendarToggle/);
assert.match(coreSource, /undoToast/);
assert.match(viewsSource, /renderProjectDashboard/);
assert.match(viewsSource, /renderArchiveOverview/);
assert.match(viewsSource, /data-archive-project/);
assert.match(viewsSource, /data-restore-project/);
assert.match(viewsSource + read("src/06_tables.js"), /renderTimeline/);
assert.match(viewsSource, /renderWorkspaceCalendar/);
assert.match(shellSource, /data-open-project-view/);
assert.match(shellSource, /openWorkspaceCalendar/);
assert.match(shellSource, /openArchivePage/);
assert.match(shellSource, /openDeadlinesPage/);
assert.match(shellSource, /openOwnersPage/);
assert.match(shellSource, /openPrioritiesPage/);
assert.match(shellSource, /els\.deadlineTitleBtn\.addEventListener\("click", openDeadlinesPage\)/);
assert.match(shellSource, /els\.deadlineToggle\.addEventListener\("click", \(\) => toggleSection\("deadlinesCollapsed"\)\)/);
assert.match(shellSource, /els\.projectsTitleBtn\.addEventListener\("click", openHomePage\)/);
assert.match(shellSource, /els\.projectsToggle\.addEventListener\("click", \(\) => toggleSection\("projectsCollapsed"\)\)/);
assert.doesNotMatch(shellSource, /if \(!state\.ui\.projectsCollapsed\)/);
assert.match(indexSource, /id="projectsTitleBtn"/);
assert.match(indexSource, /id="deadlineTitleBtn"/);
assert.match(indexSource, /section-chevron-btn/);
assert.match(shellSource, /const deadlineCollapsed = Boolean/);
assert.match(shellSource, /els\.deadlineBody\.hidden = deadlineCollapsed/);
assert.match(shellSource, /state\.ui\.openProjects\[item\.id\] === true/);
assert.match(shellSource, /function openSidebarProject\(projectId\) \{\n  const project = state\.projects\.find\(\(item\) => item\.id === projectId\);\n  if \(!project\) return;\n  openProjectTab\(projectId, projectEnabledViews\(project\)\[0\] \|\| "board"\);\n\}/);
assert.match(shellSource, /CONFIGURABLE_VIEW_OPTIONS\.map/);
assert.doesNotMatch(shellSource, /(?<!CONFIGURABLE_)VIEW_OPTIONS\.map/);
assert.doesNotMatch(indexSource, /data-view="dashboard"/);
assert.match(viewsSource, /data-open-project-dashboard/);
assert.match(indexSource, /app\.bundle\.js/);
assert.match(indexSource, /pouchdb\.min\.js/);
assert.match(indexSource, /id="calendarToggle"/);
assert.match(indexSource, /id="undoToast"/);
assert.doesNotMatch(indexSource, /id="saveTaskBtn"/);
assert.doesNotMatch(indexSource, /Tutte le attività/);
assert.match(indexSource, /id="attachFileBtn"/);
assert.match(indexSource, /id="selectAttachmentEditorBtn"/);
assert.match(indexSource, /id="selectAttachmentDirectoryBtn"/);
assert.match(indexSource, /id="selectAutoBackupDirectoryBtn"/);
assert.match(indexSource, /id="autoBackupFrequency"/);
assert.match(indexSource, /data-config-panel-tab="tasks"/);
assert.match(indexSource, /data-config-panel-tab="attachments"/);
assert.match(indexSource, /data-config-panel="workspace"/);
assert.match(indexSource, /Attività e promemoria/);
assert.match(indexSource, /config-section-menu[\s\S]*config-support-panel/);
assert.match(shellSource, /function setActiveConfigPanel/);
// Configurazione: selezione persistente al clic (niente più flyout in hover).
assert.match(shellSource, /setActiveConfigPanel\(activeConfigPanel \|\| "workspace"\)/);
assert.doesNotMatch(shellSource, /mouseenter", \(\) => setActiveConfigPanel/);
assert.doesNotMatch(shellSource, /mouseleave", \(\) => setActiveConfigPanel/);
assert.match(coreSource, /let activeConfigPanel = ""/);
assert.match(indexSource, /config-group-label/);
assert.match(indexSource, /config-tab-icon/);
// Sidebar: icone SVG uniformi e archivio collassabile con freccia condizionale.
assert.match(indexSource, /section-icon" aria-hidden="true"><svg/);
assert.match(indexSource, /id="archiveChevron"/);
assert.match(indexSource, /id="archiveBody"/);
assert.match(indexSource, /id="archiveList"/);
assert.match(shellSource, /function renderArchiveNav/);
assert.match(shellSource, /toggleSection\("archiveCollapsed"\)/);
assert.match(stateSource, /archiveCollapsed: ui\.archiveCollapsed === undefined \? true : Boolean/);
assert.match(indexSource, /id="autoArchiveDoneEnabled"/);
assert.match(indexSource, /id="autoArchiveDoneDelay"/);
assert.match(indexSource, /id="syncRemindersEnabled"/);
assert.match(indexSource, /id="remindersListSelect"/);
assert.match(indexSource, /id="remindersListName"/);
assert.match(indexSource, /id="syncRemindersNowBtn"/);
assert.match(indexSource, /Promemoria Apple/);
assert.match(indexSource, /id="taskReminderEnabled"/);
assert.match(indexSource, /id="remoteCouchUrl"/);
assert.match(indexSource, /id="remoteCouchUser"/);
assert.match(indexSource, /id="remoteCouchPassword"/);
assert.match(indexSource, /id="remoteSyncFrequency"/);
assert.match(indexSource, /id="remoteSyncEnabled"/);
assert.match(indexSource, /id="remoteSyncNowBtn"/);
assert.match(indexSource, /id="remoteSyncConfigTitle"/);
assert.match(indexSource, /<option value="1">1 ora<\/option>/);
assert.match(indexSource, /<option value="24">24 ore<\/option>/);
assert.match(indexSource, /id="dataSafetyCenter"/);
assert.match(indexSource, /data-safety-subsection/);
assert.match(indexSource, /\.zip/);
assert.match(coreSource + shellSource + read("src/09_backup.js"), /receiveReminderSyncResult/);
assert.match(coreSource + shellSource + read("src/09_backup.js"), /listReminderCalendars/);
assert.match(coreSource + stateSource + read("src/09_backup.js"), /scheduleReminderSync/);
assert.match(read("src/09_backup.js"), /task\.reminderEnabled && task\.dueDate/);
assert.match(swiftSource, /import EventKit/);
assert.match(swiftSource, /syncReminders/);
assert.match(read("macos/Info.plist"), /NSRemindersUsageDescription/);
assert.match(stylesSource, /grid-template-columns: repeat\(3, max-content\)/);
assert.match(stylesSource, /config-section-menu/);
assert.match(stylesSource, /config-panel-stage/);
assert.match(stylesSource, /position: absolute/);
assert.match(stylesSource, /#configDialog/);
// Nuovo dialog di configurazione: modale centrato a due colonne, non più popover laterale.
assert.match(stylesSource, /#configDialog \{\s*inset: 0;\s*margin: auto;/);
assert.match(stylesSource, /grid-template-columns: 214px minmax\(0, 1fr\)/);
assert.match(stylesSource, /\.config-section-tab\.active \{[\s\S]*background: var\(--accent-soft\)/);
assert.match(stylesSource, /\.config-group-label \{/);
assert.match(stylesSource, /\.config-tab-icon \{/);
assert.doesNotMatch(stylesSource, /inset: auto auto 136px 54px/);
assert.doesNotMatch(stylesSource, /left: calc\(100% - 2px\)/);
assert.match(stylesSource, /outline: 0/);
assert.match(stylesSource, /grid-template-columns: repeat\(6, 24px\)/);
assert.match(stylesSource, /font-size: calc\(17px \* var\(--font-scale\)\)/);
assert.match(stylesSource, /font-size: calc\(13\.5px \* var\(--font-scale\)\)/);
assert.match(stylesSource, /font-size: calc\(15\.5px \* var\(--font-scale\)\)/);
assert.match(stylesSource, /font-size: calc\(11\.5px \* var\(--font-scale\)\)/);
assert.match(stylesSource, /overflow: visible/);
assert.match(stylesSource, /attachment-row/);
assert.match(stylesSource, /compact-select-field/);
assert.match(stylesSource, /project-quick-actions/);
assert.match(viewsSource, /project-quick-actions/);
assert.match(dialogsSource, /pickTaskAttachment/);
assert.match(dialogsSource, /function archiveProject/);
assert.match(dialogsSource, /function restoreProject/);
assert.match(dialogsSource, /createTaskAttachment/);
assert.match(dialogsSource, /receiveAttachmentEditor/);
assert.match(dialogsSource, /receiveAttachmentDirectory/);
assert.match(coreSource + stateSource + read("src/09_backup.js"), /autoBackupFrequencyHours/);
assert.match(coreSource + stateSource + read("src/09_backup.js"), /remoteSync/);
assert.match(indexSource, /Replica CouchDB/);
assert.match(read("src/09_backup.js"), /Replica remota/);
assert.match(read("src/09_backup.js"), /autoBackupDelayMs/);
assert.match(read("src/09_backup.js"), /Frequenza backup automatico/);
assert.match(couchInitSource, /tasks_by_owner/);
assert.match(couchInitSource, /tasks_by_group/);
assert.match(couchInitSource, /tasks_by_visible_to/);
assert.match(portalServerSource, /visibleSubtasksForUser/);
assert.match(portalServerSource, /publicTaskChangeKey/);
assert.match(portalServerSource, /revision: task\._rev/);
assert.match(portalServerSource, /isDoneTask/);
assert.match(portalServerSource, /archived/);
assert.match(portalServerSource, /tasks_by_owner/);
assert.match(portalServerSource, /canSeeTask/);
assert.match(portalServerSource, /SESSION_SECRET/);
assert.match(portalServerSource, /PORTAL_USERS_FILE/);
assert.match(portalServerSource, /kanban-portal-user/);
assert.match(portalServerSource, /listAssignableVisibleAs/);
assert.match(portalServerSource, /role: "admin"/);
assert.match(portalServerSource, /effectiveVisibleAs/);
// Le funzioni pure sono ora in lib.mjs (testabili in isolamento).
const portalLibSource = read("deploy/portal/lib.mjs");
assert.match(portalLibSource, /TEAM_VISIBLE_AS = "Team"/);
assert.match(portalLibSource, /effectiveVisibleAs\(user\)\.includes\(owner\)/);
assert.match(portalLibSource, /export function hashPassword/);
assert.match(portalLibSource, /scrypt\$/);
// Niente più password in chiaro: né salvate, né restituite, né mostrate.
assert.doesNotMatch(portalServerSource, /passwordSha256: sha256/);
assert.doesNotMatch(portalServerSource, /password: doc\.password/);
assert.match(portalServerSource, /hashPassword\(password\)/);
assert.match(portalServerSource, /hasPassword/);
// Rate limit e hardening del login.
assert.match(portalServerSource, /loginRetryAfter/);
assert.match(portalServerSource, /too_many_attempts/);
assert.match(portalServerSource, /MAX_BODY_BYTES/);
// Replica desktop filtrata: i documenti del portale non vengono scaricati sui Mac.
assert.match(stateSource, /remoteReplicationFilter/);
assert.match(stateSource, /SYNC_DOC_TYPES/);
// Backoff e conflitti non distruttivi.
assert.match(stateSource, /scheduleRemoteBackoffRetry/);
assert.match(stateSource, /REMOTE_SYNC_MAX_FAILURES/);
assert.match(stateSource, /function annotateTaskConflict/);
assert.match(stateSource, /function normalizeSyncConflict/);
// Credenziali sync via Keychain nativo.
assert.match(stateSource, /KANBAN_SYNC_AUTH_BASE64/);
assert.match(swiftSource, /import Security/);
assert.match(swiftSource, /saveSyncAuth/);
assert.match(swiftSource, /syncAuthKeychainWrite/);
assert.match(portalAppSource, /PATCH/);
assert.match(portalAppSource, /subtask\.editable === false/);
assert.match(portalAppSource, /\[data-subtask\]:not\(:disabled\)/);
assert.match(portalAppSource, /knownTaskUpdates/);
assert.match(portalAppSource, /TASK_UPDATE_STORAGE_PREFIX/);
assert.match(portalAppSource, /loadKnownTaskUpdates/);
assert.match(portalAppSource, /localStorage\?\.setItem/);
assert.match(portalAppSource, /taskChangeKey/);
assert.match(portalAppSource, /revision: task\.revision/);
assert.match(portalAppSource, /changeKey: task\.changeKey/);
assert.match(portalAppSource, /subtasks: \(task\.subtasks \|\| \[\]\)\.map/);
assert.match(portalAppSource, /new-pill/);
assert.match(portalAppSource, /api\/admin\/users/);
assert.match(portalAppSource, /api\/admin\/visible-as/);
assert.match(portalAppSource, /function showPortalPage/);
assert.match(portalAppSource, /currentPage === "users"/);
assert.match(portalAppSource, /currentPage === "tasks"/);
assert.match(portalAppSource, /taskList\.hidden = currentPage !== "tasks"/);
assert.match(portalAppSource, /filtersPanel\.hidden = currentPage !== "tasks"/);
assert.match(portalAppSource, /user\.hasPassword/);
assert.doesNotMatch(portalAppSource, /value = user\.password/);
assert.match(portalAppSource, /data-field="statusId"/);
assert.match(portalIndexSource, /id="loginForm"/);
assert.match(portalIndexSource, /id="taskList"/);
assert.match(portalIndexSource, /id="adminPanel"/);
assert.match(portalIndexSource, /id="adminTasksBtn"/);
assert.match(portalIndexSource, /id="filtersPanel"/);
assert.match(portalAppSource, /Tutte le attività/);
assert.match(portalIndexSource, />Attività<\/button>/);
assert.match(portalStylesSource, /\[hidden\]\s*\{\s*display: none !important;/);
assert.match(portalIndexSource, /Responsabile/);
assert.match(portalIndexSource, /Aggiornamento/);
assert.ok(portalIndexSource.indexOf("Priorità") < portalIndexSource.indexOf("Aggiornamento"), "Priorità deve precedere Aggiornamento nella scheda portale");
assert.match(portalIndexSource, /footer-left/);
assert.match(portalStylesSource, /\.meta-pill\.due,\s*\.meta-pill\.updated\s*\{/);
assert.match(portalStylesSource, /white-space: nowrap/);
assert.match(portalStylesSource, /align-items: center/);
assert.match(portalStylesSource, /position: absolute/);
assert.match(dialogsSource, /Responsabile sotto-attività/);
assert.match(dialogsSource, /<textarea rows="2"/);
assert.doesNotMatch(dialogsSource, /subtask-detail-row/);
assert.match(stateSource, /subtask\.owner/);
assert.match(read("src/06_tables.js"), /taskOwnerBadges/);
assert.match(read("src/06_tables.js"), /subtask-owner-badge/);
assert.match(swiftSource, /selectAttachmentEditor/);
assert.match(swiftSource, /selectAttachmentDirectory/);
assert.match(swiftSource, /pickTaskAttachment/);
assert.match(swiftSource, /createTaskAttachment/);
assert.match(swiftSource, /openTaskAttachment/);
assert.match(swiftSource, /exportBackupZip/);
assert.match(swiftSource, /autoBackupZip/);
assert.match(swiftSource, /verifyAttachments/);
assert.match(swiftSource, /openBackupZip/);
assert.match(swiftSource, /rewriteRestoredAttachmentPaths/);
assert.match(swiftSource, /attachment\["path"\] = restoredURL\.path/);
assert.match(swiftSource, /rewriteAttachmentDirectoryConfig/);

assert.equal(fs.existsSync(new URL("assets/pouchdb.min.js", root)), true);

for (const path of ["assets/index.html", "src/01_core.js", "src/03_shell.js", "src/04_views.js", "macos/GestoreKanban/main.swift"]) {
  const source = read(path);
  assert.doesNotMatch(source, /csv|Csv|CSV/, `${path} contiene ancora riferimenti CSV`);
}

assert.equal(fs.existsSync(new URL("src/08_csv.js", root)), false);

const backupContext = {
  alert() {},
  console,
  crypto: webcrypto,
  DEFAULT_COUCH_DATABASE: "gestore-attivita-kanban",
  DEFAULT_COUCH_REMOTE_URL: "https://pstdb.pst.my/gestore-attivita-kanban",
  structuredClone,
  window: {},
};
vm.createContext(backupContext);
vm.runInContext(stateSource, backupContext);
vm.runInContext(read("src/09_backup.js"), backupContext);

const migrationContext = {
  console,
  crypto: webcrypto,
  structuredClone,
  PRIORITY_OPTIONS: [
    { id: "high", label: "Alto", className: "priority-high" },
    { id: "medium", label: "Medio", className: "priority-medium" },
    { id: "low", label: "Basso", className: "priority-low" },
    { id: "none", label: "ND", className: "priority-none" },
  ],
  initialData: {
    sync: {
      remoteEnabled: true,
      remoteUrl: "https://pstdb.pst.my/gestore-attivita-kanban",
    },
    ui: {
      sidebarFontScale: 88,
      contentFontScale: 88,
      sidebarWidth: 318,
      theme: "light",
      workspaceName: "default",
      accentColor: "#9365f4",
      participants: [],
      tableSort: { key: "dueDate", direction: "asc" },
      tableColumnWidths: {},
      openProjects: {},
      openProjectTabs: [],
      openOwnerTabs: [],
      openPriorityTabs: [],
    },
  },
  DEFAULT_COUCH_DATABASE: "gestore-attivita-kanban",
  DEFAULT_COUCH_REMOTE_URL: "https://pstdb.pst.my/gestore-attivita-kanban",
  POUCH_META_DOC_ID: "kanban-meta",
  DOC_ID_SEPARATOR: "::",
  WORKSPACE_DOC_PREFIX: "workspace",
  PROJECT_DOC_PREFIX: "project",
  TASK_DOC_PREFIX: "task",
  clampSidebarWidth(value) {
    return Number(value) || 318;
  },
};
vm.createContext(migrationContext);
vm.runInContext(stateSource, migrationContext);
const migratedWorkspace = migrationContext.normalizeWorkspace({
  name: "Legacy",
  projects: [
    {
      name: "Progetto storico",
      statuses: [{ name: "Da fare" }],
      tasks: [
        {
          name: "Attivita senza id",
          statusId: "",
          subtasks: [{ name: "Sottoattivita senza id", done: true, owner: "Elena" }],
        },
      ],
    },
  ],
});
const migratedProject = migratedWorkspace.projects[0];
const migratedTask = migratedProject.tasks[0];
assert.ok(migratedProject.id, "La migrazione deve assegnare un id al progetto");
assert.ok(migratedTask.id, "La migrazione deve assegnare un id alle attività esistenti");
assert.equal(migratedTask.statusId, migratedProject.statuses[0].id, "Le attività con stato mancante devono puntare allo stato di fallback");
assert.ok(migratedTask.subtasks[0].id, "La migrazione deve assegnare un id alle sotto-attività");
assert.equal(migratedTask.subtasks[0].owner, "Elena", "La migrazione deve preservare il responsabile della sotto-attività");
assert.ok(migratedWorkspace.ui.participants.includes("Elena"), "I responsabili delle sotto-attività devono entrare tra i partecipanti");
assert.equal(migratedTask.workspaceId, migratedWorkspace.id, "Ogni task deve indicare il workspace di appartenenza");
assert.equal(migratedTask.projectId, migratedProject.id, "Ogni task deve indicare il progetto di appartenenza");
assert.equal(migratedTask.groupId, migratedWorkspace.id, "Ogni task deve indicare il gruppo di lavoro");
assert.deepEqual(Array.from(migratedTask.visibleTo), ["Elena"], "La visibilità deve includere i responsabili della task e delle sotto-attività");
assert.equal(typeof migratedTask.updatedAt, "string", "Ogni task deve avere updatedAt");

const separatedDocsState = migrationContext.normalizeState({
  ...structuredClone(migrationContext.initialData),
  schemaVersion: 5,
  revision: 7,
  updatedAt: "2026-06-25T10:00:00.000Z",
  activeWorkspaceId: migratedWorkspace.id,
  activeProjectId: migratedProject.id,
  workspaces: [migratedWorkspace],
});
const separatedDocs = migrationContext.stateToKanbanDocs(separatedDocsState);
assert.ok(separatedDocs.some((doc) => doc.type === "kanban-meta"), "Il nuovo modello deve creare un documento metadati");
assert.ok(separatedDocs.some((doc) => doc.type === "kanban-workspace"), "Il nuovo modello deve creare documenti workspace");
assert.ok(separatedDocs.some((doc) => doc.type === "kanban-project"), "Il nuovo modello deve creare documenti progetto");
const separatedTaskDoc = separatedDocs.find((doc) => doc.type === "kanban-task");
assert.equal(separatedTaskDoc.workspaceId, migratedWorkspace.id);
assert.equal(separatedTaskDoc.projectId, migratedProject.id);
assert.equal(separatedTaskDoc.groupId, migratedWorkspace.id);
assert.deepEqual(Array.from(separatedTaskDoc.visibleTo), ["Elena"]);
assert.equal(separatedTaskDoc.updatedAt, "2026-06-25T10:00:00.000Z");
const rebuiltState = migrationContext.kanbanDocsToState(separatedDocs);
assert.equal(rebuiltState.workspaces[0].projects[0].tasks[0].id, migratedTask.id, "I documenti separati devono ricostruire lo stato applicativo");

if (!fs.existsSync("/usr/bin/ditto")) {
  console.log("(skip) test backup allegati: /usr/bin/ditto non disponibile su questa piattaforma");
} else {
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kanban-backup-attachments-"));
try {
  const sourceDirectory = path.join(tempRoot, "origine-allegati");
  const sourcePath = path.join(sourceDirectory, "verbale staff.md");
  fs.mkdirSync(sourceDirectory, { recursive: true });
  fs.writeFileSync(sourcePath, "# Verbale\n\nContenuto da preservare.\n");

  const workspace = {
    id: "ws-360",
    name: "360Welfare",
    ui: {
      workspaceName: "360Welfare",
      attachmentDirectoryName: "origine-allegati",
      attachmentDirectoryPath: sourceDirectory,
    },
    projects: [
      {
        id: "staff-meeting",
        name: "Staff Meeting",
        statuses: [{ id: "todo", name: "To Do" }],
        enabledViews: { board: true, table: true, timeline: true, dashboard: true },
        tasks: [
          {
            id: "task-verbale",
            name: "Preparare verbale",
            statusId: "todo",
            attachments: [
              {
                id: "att-verbale",
                name: "verbale staff.md",
                path: sourcePath,
                kind: "markdown",
                addedAt: "2026-06-22T10:00:00.000Z",
              },
            ],
            subtasks: [],
          },
        ],
      },
    ],
  };

  const attachmentFiles = [];
  const backupWorkspaces = backupContext.withBackupAttachmentPaths([workspace], attachmentFiles);
  assert.equal(attachmentFiles.length, 1);
  assert.equal(attachmentFiles[0].sourcePath, sourcePath);

  const backupAttachment = backupWorkspaces[0].projects[0].tasks[0].attachments[0];
  assert.equal(backupAttachment.path, sourcePath);
  assert.match(backupAttachment.backupPath, /^attachments\/360Welfare-ws-360\/Staff-Meeting-staff-meeting\/task-verbale\/att-verbale-verbale-staff\.md$/);

  const backupPayload = {
    type: "kanban-workspace-backup",
    version: 4,
    exportedAt: "2026-06-22T10:00:00.000Z",
    activeWorkspaceId: "ws-360",
    configuration: workspace.ui,
    workspaces: backupWorkspaces,
  };

  const stagingRoot = path.join(tempRoot, "staging");
  fs.mkdirSync(stagingRoot, { recursive: true });
  fs.writeFileSync(path.join(stagingRoot, "backup.json"), JSON.stringify(backupPayload, null, 2));
  for (const file of attachmentFiles) {
    const destination = path.join(stagingRoot, cleanRelativePathForTest(file.zipPath));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(file.sourcePath, destination);
  }

  const zipPath = path.join(tempRoot, "backup.zip");
  execFileSync("/usr/bin/ditto", ["-c", "-k", "--norsrc", stagingRoot, zipPath]);

  fs.rmSync(sourceDirectory, { recursive: true, force: true });
  assert.equal(fs.existsSync(sourcePath), false);

  const extractedRoot = path.join(tempRoot, "estratto");
  fs.mkdirSync(extractedRoot, { recursive: true });
  execFileSync("/usr/bin/ditto", ["-x", "-k", zipPath, extractedRoot]);
  const extractedPayload = JSON.parse(fs.readFileSync(path.join(extractedRoot, "backup.json"), "utf8"));
  const restoreRoot = path.join(tempRoot, "ripartenza-da-zero", "Restored Attachments");
  const restoredAny = rewriteRestoredAttachmentPathsForTest(extractedPayload, extractedRoot, restoreRoot);
  if (restoredAny) rewriteAttachmentDirectoryConfigForTest(extractedPayload, restoreRoot);

  const restoredAttachment = extractedPayload.workspaces[0].projects[0].tasks[0].attachments[0];
  assert.equal(restoredAny, true);
  assert.ok(restoredAttachment.path.startsWith(restoreRoot), "Il percorso ripristinato deve puntare alla nuova cartella locale");
  assert.equal(fs.readFileSync(restoredAttachment.path, "utf8"), "# Verbale\n\nContenuto da preservare.\n");
  assert.equal(extractedPayload.workspaces[0].ui.attachmentDirectoryPath, restoreRoot);
  assert.equal(extractedPayload.workspaces[0].ui.attachmentDirectoryName, path.basename(restoreRoot));

  const normalizedAttachment = backupContext.normalizeAttachments([restoredAttachment])[0];
  assert.equal(normalizedAttachment.path, restoredAttachment.path);
  assert.equal(Object.hasOwn(normalizedAttachment, "backupPath"), false);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
}

function sanitizedFilenameForTest(value) {
  const clean = String(value || "allegato.md")
    .replace(/[\/\\?%*|"<>:]+/g, "-")
    .trim();
  return clean || "allegato.md";
}

function cleanRelativePathForTest(value) {
  const components = String(value || "")
    .split("/")
    .filter((component) => component && component !== "." && component !== "..")
    .map(sanitizedFilenameForTest);
  return components.length ? components.join("/") : "attachments/allegato.md";
}

function uniqueFilePathForTest(directory, preferredName) {
  const cleanName = sanitizedFilenameForTest(preferredName || "allegato.md");
  const basePath = path.join(directory, cleanName);
  if (!fs.existsSync(basePath)) return basePath;
  const extension = path.extname(cleanName);
  const stem = extension ? cleanName.slice(0, -extension.length) : cleanName;
  let counter = 2;
  while (true) {
    const candidate = path.join(directory, extension ? `${stem}-${counter}${extension}` : `${stem}-${counter}`);
    if (!fs.existsSync(candidate)) return candidate;
    counter += 1;
  }
}

function rewriteRestoredAttachmentPathsForTest(backup, extractedRoot, destinationRoot) {
  let restoredAnyAttachment = false;
  for (const workspace of backup.workspaces || []) {
    for (const project of workspace.projects || []) {
      for (const task of project.tasks || []) {
        for (const attachment of task.attachments || []) {
          if (!attachment.backupPath) continue;
          const cleanPath = cleanRelativePathForTest(attachment.backupPath);
          const source = path.join(extractedRoot, cleanPath);
          if (!fs.existsSync(source)) continue;
          const destination = path.join(destinationRoot, cleanPath);
          const finalPath = uniqueFilePathForTest(path.dirname(destination), path.basename(destination));
          fs.mkdirSync(path.dirname(finalPath), { recursive: true });
          fs.copyFileSync(source, finalPath);
          attachment.path = finalPath;
          attachment.name = path.basename(finalPath);
          restoredAnyAttachment = true;
        }
      }
    }
  }
  return restoredAnyAttachment;
}

function rewriteAttachmentDirectoryConfigForTest(backup, destinationRoot) {
  const directoryName = path.basename(destinationRoot);
  backup.configuration = {
    ...(backup.configuration || {}),
    attachmentDirectoryName: directoryName,
    attachmentDirectoryPath: destinationRoot,
  };
  for (const workspace of backup.workspaces || []) {
    workspace.ui = {
      ...(workspace.ui || {}),
      attachmentDirectoryName: directoryName,
      attachmentDirectoryPath: destinationRoot,
    };
  }
}

// --- Test comportamentali: funzioni pure del portale (lib.mjs) ---
const portalLib = await import(new URL("deploy/portal/lib.mjs", root));

// KDF: l'hash è in formato scrypt$salt$hash, verifica corretta e password errata rifiutata.
const storedHash = portalLib.hashPassword("password-corretta");
assert.match(storedHash, /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/, "L'hash deve essere in formato scrypt con salt");
assert.equal(portalLib.verifyScrypt(storedHash, "password-corretta"), true, "La password corretta deve verificare");
assert.equal(portalLib.verifyScrypt(storedHash, "password-sbagliata"), false, "La password errata deve fallire");
assert.notEqual(portalLib.hashPassword("x"), portalLib.hashPassword("x"), "Due hash della stessa password devono differire (salt casuale)");

// passwordMatches: scrypt prioritario, compatibilità con formati storici.
assert.equal(portalLib.passwordMatches({ passwordHash: storedHash }, "password-corretta"), true);
assert.equal(portalLib.passwordMatches({ password: "vecchia" }, "vecchia"), true, "Compatibilità con password in chiaro storiche");
assert.equal(portalLib.passwordMatches({ passwordSha256: portalLib.sha256("legacy") }, "legacy"), true, "Compatibilità con SHA-256 storico");
assert.equal(portalLib.passwordMatches({}, "qualsiasi"), false, "Senza credenziali nessun accesso");

// canSeeTask: admin vede tutto; responsabile vede solo le proprie e quelle del Team.
const admin = { role: "admin", visibleAs: ["Admin"] };
const elena = { role: "user", visibleAs: ["Elena"] };
assert.equal(portalLib.canSeeTask(admin, { owner: "Chiunque" }), true);
assert.equal(portalLib.canSeeTask(elena, { owner: "Elena" }), true);
assert.equal(portalLib.canSeeTask(elena, { owner: "Team" }), true, "Il responsabile vede le attività del Team");
assert.equal(portalLib.canSeeTask(elena, { owner: "Marco" }), false, "Il responsabile non vede le attività altrui");

// mergeSubtasks: aggiorna solo il flag done di sotto-attività esistenti, ignora id sconosciuti.
const mergedSubtasks = portalLib.mergeSubtasks(
  [{ id: "s1", name: "A", done: false }, { id: "s2", name: "B", done: false }],
  [{ id: "s1", done: true }, { id: "ignota", done: true }],
);
assert.equal(mergedSubtasks.find((s) => s.id === "s1").done, true);
assert.equal(mergedSubtasks.find((s) => s.id === "s2").done, false);
assert.equal(mergedSubtasks.length, 2, "mergeSubtasks non deve aggiungere sotto-attività non esistenti");

// visibleSubtasksForUser: editabilità per responsabile.
const subtaskView = portalLib.visibleSubtasksForUser(elena, [{ id: "s1", owner: "Elena" }, { id: "s2", owner: "Marco" }]);
assert.equal(subtaskView[0].editable, true);
assert.equal(subtaskView[1].editable, false);

// Sanitizzazione input.
assert.equal(portalLib.allowedPriority("alta-inesistente"), "none");
assert.equal(portalLib.allowedPriority("high"), "high");
assert.equal(portalLib.cleanDate("2026-06-26"), "2026-06-26");
assert.equal(portalLib.cleanDate("non-una-data"), "");

// --- Test comportamentali: conflitti non distruttivi (02_state.js in vm) ---
const winnerDoc = {
  _id: "task::ws::pr::t1",
  _rev: "3-new",
  type: "kanban-task",
  taskId: "t1",
  name: "Attività",
  owner: "Elena",
  statusId: "doing",
  priority: "high",
  notes: "Versione desktop",
  updatedAt: "2026-06-26T12:00:00.000Z",
  subtasks: [],
};
const loserDoc = {
  ...structuredClone(winnerDoc),
  _rev: "3-old",
  statusId: "done",
  notes: "Versione portale",
  updatedAt: "2026-06-26T11:00:00.000Z",
};

const conflictFields = Array.from(migrationContext.describeTaskConflictFields(winnerDoc, loserDoc)).sort();
assert.deepEqual(conflictFields, ["notes", "statusId"], "Deve rilevare i campi divergenti");

const annotated = migrationContext.annotateTaskConflict(structuredClone(winnerDoc), [loserDoc]);
assert.ok(annotated.syncConflict, "Il documento vincente deve riportare il conflitto");
assert.equal(annotated.syncConflict.alternatives.length, 1);
assert.equal(annotated.syncConflict.alternatives[0].values.statusId, "done", "I valori scartati non devono andare persi");
assert.equal(annotated.syncConflict.alternatives[0].values.notes, "Versione portale");
assert.equal(migrationContext.annotateTaskConflict(structuredClone(winnerDoc), [structuredClone(winnerDoc)]), null, "Revisioni identiche non generano avvisi");

// normalizeSyncConflict scarta marcatori vuoti/non validi.
assert.equal(migrationContext.normalizeSyncConflict(null), null);
assert.equal(migrationContext.normalizeSyncConflict({ alternatives: [{ fields: [] }] }), null);

// resolveKanbanDocConflicts annota il vincitore e rimuove le revisioni perdenti (fake db PouchDB).
function makeConflictDb(winner, losers) {
  const byRev = new Map(losers.map((l) => [l._rev, l]));
  byRev.set(winner._rev, winner);
  const db = {
    _puts: [],
    _removed: [],
    async allDocs() {
      const doc = structuredClone(winner);
      doc._conflicts = losers.map((l) => l._rev);
      return { rows: [{ id: doc._id, doc }] };
    },
    async get(id, { rev } = {}) {
      const found = byRev.get(rev);
      if (!found) {
        const error = new Error("missing");
        error.status = 404;
        throw error;
      }
      return structuredClone(found);
    },
    async put(doc) {
      db._puts.push(structuredClone(doc));
      return { ok: true, id: doc._id, rev: "4-merged" };
    },
    async remove(id, rev) {
      db._removed.push(rev);
      return { ok: true };
    },
  };
  return db;
}

const conflictDb = makeConflictDb(winnerDoc, [loserDoc]);
const resolved = await migrationContext.resolveKanbanDocConflicts(conflictDb);
assert.equal(resolved, true, "Deve segnalare che ha risolto conflitti");
assert.equal(conflictDb._puts.length, 1, "Deve riscrivere il documento vincente annotato");
assert.ok(conflictDb._puts[0].syncConflict, "Il documento riscritto deve contenere il marcatore di conflitto");
assert.deepEqual(conflictDb._removed, ["3-old"], "Deve rimuovere la revisione perdente dopo averla preservata");

// Round-trip: syncConflict sopravvive a stato->documenti->stato e alla normalizzazione.
const conflictState = migrationContext.normalizeState({
  ...structuredClone(migrationContext.initialData),
  schemaVersion: 5,
  activeWorkspaceId: "ws-rt",
  workspaces: [
    {
      id: "ws-rt",
      name: "RT",
      ui: { workspaceName: "RT" },
      projects: [
        {
          id: "pr-rt",
          name: "Progetto",
          statuses: [{ id: "todo", name: "To Do" }, { id: "done", name: "Done", type: "done" }],
          tasks: [
            {
              id: "t-rt",
              name: "Con conflitto",
              statusId: "todo",
              subtasks: [],
              syncConflict: { detectedAt: "2026-06-26T12:00:00.000Z", alternatives: [{ rev: "3-old", updatedAt: "", fields: ["statusId"], values: { statusId: "done" } }] },
            },
          ],
        },
      ],
    },
  ],
});
const conflictTaskAfterNormalize = conflictState.workspaces[0].projects[0].tasks[0];
assert.ok(conflictTaskAfterNormalize.syncConflict, "normalizeState deve preservare syncConflict");
const conflictDocs = migrationContext.stateToKanbanDocs(conflictState);
const conflictTaskDoc = conflictDocs.find((doc) => doc.type === "kanban-task");
assert.ok(conflictTaskDoc.syncConflict, "stateToKanbanDocs deve preservare syncConflict");
const conflictRebuilt = migrationContext.kanbanDocsToState(conflictDocs);
assert.ok(conflictRebuilt.workspaces[0].projects[0].tasks[0].syncConflict, "kanbanDocsToState deve preservare syncConflict");

console.log("Tests OK");
