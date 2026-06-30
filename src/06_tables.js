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
