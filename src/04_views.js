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
