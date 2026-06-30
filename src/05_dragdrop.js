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
