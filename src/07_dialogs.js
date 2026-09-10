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
