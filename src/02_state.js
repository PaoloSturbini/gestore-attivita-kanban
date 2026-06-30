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
  remoteSyncTimer = null;
  remoteAutoSyncTimer = null;
  remoteBackoffTimer = null;
  remoteSyncFailureCount = 0;
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
  clearTimeout(remoteSyncTimer);
  remoteSyncTimer = setTimeout(runRemoteSyncNow, 80);
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
  if (remoteSyncInFlight) return;
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
    if (resolvedLocal) await applyRemoteKanbanDocs();
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
    if (docs.some((doc) => isKanbanDataDocId(doc?._id))) applyRemoteKanbanDocs();
    docs.forEach(applyRemoteStateDoc);
  }
  renderRemoteSyncStatus();
}

async function applyRemoteKanbanDocs() {
  const db = getPouchDb();
  if (!db) return;
  try {
    const remoteState = await readKanbanDocsState(db);
    if (!remoteState || compareStateFreshness(remoteState, state) <= 0) return;
    state = normalizeState(remoteState);
    pouchPersistenceInitialized = true;
    suppressNextAutoBackup = true;
    persistStateSnapshot(JSON.stringify(state));
    render();
  } catch (error) {
    console.error("Applicazione documenti remoti non riuscita", error);
  }
}

function applyRemoteStateDoc(doc) {
  if (!doc || doc._id !== POUCH_STATE_DOC_ID || !doc.stateText) return;
  const remoteState = safeParseState(doc.stateText);
  if (!remoteState || compareStateFreshness(remoteState, state) <= 0) return;
  state = normalizeState(remoteState);
  pouchPersistenceInitialized = true;
  suppressNextAutoBackup = true;
  persistStateSnapshot(JSON.stringify(state));
  queuePouchStateSave(JSON.stringify(state));
  render();
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
