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
