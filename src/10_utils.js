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
