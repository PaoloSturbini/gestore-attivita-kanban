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
