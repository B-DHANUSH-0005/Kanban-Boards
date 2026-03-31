/**
 * board.js — Board detail page
 *
 * Architecture:
 *  - All API calls go through apiFetch() from utils.js (JWT, 401 guard)
 *  - Single /boards/{id}/bundle endpoint loads board + tasks + boards list
 *  - Optimistic UI for move/delete (immediate DOM update, rollback on fail)
 *  - Background puller syncs every 15s only when tab is visible
 *  - Status is pre-set by which column's "+ Add task" button was clicked
 */

"use strict";

// ── Guard & constants ─────────────────────────────────────────
requireAuth();

const BOARD_ID = parseInt(new URLSearchParams(window.location.search).get("id"), 10);
if (!BOARD_ID || isNaN(BOARD_ID)) { window.location.replace("/"); }

// ── Dynamic Statuses (Updated from board bundle) ─────────────
let STATUSES = ["todo", "doing", "done"];
let DELETED_STATUSES = [];
const STATUS_LABEL = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");

// ── Mutable state ─────────────────────────────────────────────
let allBoards = [];       // [{id, name}, …] for "move to board" menu
let editingTaskId = null;     // null = create mode
let activeStatus = "todo";   // which column was clicked for new task
let draggedTaskId = null;
let pullerTimer = null;
let isSaving = false;    // prevent double-submit

// ── Cache keys ────────────────────────────────────────────────
const KEY_BOARD = `kb_board_${BOARD_ID}`;
const KEY_TASKS = `kb_tasks_${BOARD_ID}`;
const KEY_BOARDS = `kb_all_boards`;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setUserDisplay();

  // Wire up modal controls
  document.getElementById("cancelAddTask").addEventListener("click", closeTaskModal);
  document.getElementById("submitAddTask").addEventListener("click", saveTask);

  document.getElementById("addTaskModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("addTaskModal")) closeTaskModal();
  });

  document.getElementById("taskTitle").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveTask(); }
  });

  // Edit Board Info
  document.getElementById("openEditBoard")?.addEventListener("click", openBoardEditModal);
  document.getElementById("cancelEditBoard")?.addEventListener("click", closeBoardEditModal);
  document.getElementById("submitEditBoard")?.addEventListener("click", saveBoardInfo);

  // Wire up column controls
  document.getElementById("addColumnBtn")?.addEventListener("click", addColumn);

  // Live validation
  attachLiveValidation(document.getElementById("taskTitle"), "taskTitle");
  attachLiveValidation(document.getElementById("taskDesc"), "taskDesc");

  // Show cached data immediately (instant paint) then fetch fresh
  paintFromCache();
  fetchBundle();
  startPuller();

  // Visibility sync
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { fetchBundle(); startPuller(); }
    else { stopPuller(); }
  });
});

// ── Cache-first render ────────────────────────────────────────
function paintFromCache() {
  const board = readCache(KEY_BOARD);
  const tasks = readCache(KEY_TASKS);
  const boards = readCache(KEY_BOARDS);

  if (board) renderBoardInfo(board);
  if (tasks) renderTasks(tasks);
  else showColumnSkeletons();
  if (boards) allBoards = boards;
}

// ── Fetch bundle from server ──────────────────────────────────
async function fetchBundle() {
  try {
    const res = await apiFetch(`/boards/${BOARD_ID}/bundle`);
    if (!res) return;
    if (!res.ok) {
      if (!readCache(KEY_BOARD)) window.location.replace("/");
      return;
    }

    const data = await res.json();

    // Only re-render if data actually changed (avoids flicker)
    const boardStr = JSON.stringify(data.board);
    const tasksStr = JSON.stringify(data.tasks);
    const boardsStr = JSON.stringify(data.all_boards);

    if (boardStr !== localStorage.getItem(KEY_BOARD)) { saveCache(KEY_BOARD, boardStr); renderBoardInfo(data.board); }
    if (tasksStr !== localStorage.getItem(KEY_TASKS)) { saveCache(KEY_TASKS, tasksStr); renderTasks(data.tasks); }
    if (boardsStr !== localStorage.getItem(KEY_BOARDS)) { saveCache(KEY_BOARDS, boardsStr); allBoards = data.all_boards; }

  } catch (err) {
    console.warn("[board] fetchBundle error:", err);
  }
}

// ── Render helpers ────────────────────────────────────────────
function renderBoardInfo(board) {
  document.getElementById("boardTitle").textContent = board.name;
  document.getElementById("boardDesc").textContent = board.description || "";
  document.title = `KanBoards — ${board.name}`;

  // Update dynamic statuses
  if (board.columns && board.columns.length > 0) {
    STATUSES = board.columns;
    renderColumns(STATUSES);
  }
  if (board.deleted_columns) {
    DELETED_STATUSES = board.deleted_columns;
  }
  
  // Re-render task status dropdown options
  renderStatusOptions();
}

/**
 * Dynamically create column containers in the DOM.
 */
function renderColumns(columns) {
  const container = document.getElementById("columnsContainer");
  if (!container) return;

  container.innerHTML = columns.map(s => `
    <div class="column" id="col-${s}" data-status="${s}" ondragover="handleDragOver(event)"
      ondragleave="handleDragLeave(event)" ondrop="handleDrop(event,'${s}')">
      <div class="column-header">
        <span class="column-label" id="label-${s}"><span class="dot"></span>${STATUS_LABEL(s)}</span>
        <div class="column-header-actions">
          <span class="task-count" id="count-${s}">0</span>
          <button class="btn-column-edit" onclick="editColumn(event,'${s}')" title="Rename Column">&#x270E;</button>
          <button class="btn-column-delete" onclick="deleteColumn(event,'${s}')" title="Delete Column">&#x2715;</button>
        </div>
      </div>
      <div class="tasks-list" id="tasks-${s}"></div>
      <div class="column-footer">
        <button class="btn-add-task" onclick="openTaskModal('${s}')" id="add-${s}">
          + Add task
        </button>
      </div>
    </div>
  `).join("");
}

function renderStatusOptions() {
  const select = document.getElementById("taskStatus");
  if (!select) return;
  select.innerHTML = STATUSES.map(s => `
    <option value="${s}">${STATUS_LABEL(s)}</option>
  `).join("");
}

function renderTasks(tasks) {
  // Clear task lists
  STATUSES.forEach((s) => {
    const list = document.getElementById(`tasks-${s}`);
    if (list) list.innerHTML = "";
  });

  const counts = {};
  STATUSES.forEach(s => counts[s] = 0);

  (tasks || []).forEach((task) => {
    const status = counts.hasOwnProperty(task.status) ? task.status : STATUSES[0];
    counts[status]++;
    document.getElementById(`tasks-${status}`)?.appendChild(buildTaskCard(task));
  });

  STATUSES.forEach((s) => {
    const countEl = document.getElementById(`count-${s}`);
    if (countEl) countEl.textContent = counts[s];

    // Show empty hint if no tasks
    const list = document.getElementById(`tasks-${s}`);
    if (list && counts[s] === 0) {
      list.innerHTML = `<div class="column-empty">No tasks yet</div>`;
    }
  });
}

function showColumnSkeletons() {
  STATUSES.forEach((s) => {
    const list = document.getElementById(`tasks-${s}`);
    if (list) list.innerHTML = `
      <div class="skeleton skeleton-card"></div>
      <div class="skeleton skeleton-card" style="height:60px"></div>`;
  });
}

// ── Build task card ───────────────────────────────────────────
function buildTaskCard(task) {
  const card = document.createElement("article");
  card.className = "task-card";
  card.draggable = true;
  card.dataset.taskId = task.id;
  card.dataset.status = task.status;

  // Build board move items
  const boardItems = allBoards
    .filter((b) => b.id !== BOARD_ID)
    .map((b) => `<div class="menu-item" onclick="moveTaskToBoard(event,'${task.id}',${b.id})">${escHtml(b.name)}</div>`)
    .join("") || `<div class="menu-item" style="opacity:.5;cursor:default">No other boards</div>`;

  card.innerHTML = `
    <div class="task-card-title">${escHtml(task.title)}</div>
    ${task.description ? `<div class="task-card-desc">${escHtml(task.description)}</div>` : ""}
    <div class="task-card-footer">
      <div class="task-menu-container">
        <button class="menu-dots-btn" onclick="toggleTaskMenu(event,'${task.id}')" aria-label="Task options">&#x22EE;</button>
        <div class="dropdown-menu" id="menu-${task.id}">
          <div class="menu-item" onclick="openEditTask('${task.id}')">Edit <span>&#x270E;</span></div>
          <div class="submenu-container">
            <div class="menu-item">Move to <span>&#x203A;</span></div>
            <div class="submenu">
              ${STATUSES.filter((s) => s !== task.status).map((s) =>
    `<div class="menu-item" onclick="moveTask(event,'${task.id}','${s}')">${STATUS_LABEL(s)}</div>`
  ).join("")}
            </div>
          </div>
          <div class="submenu-container">
            <div class="menu-item">Transfer <span>&#x203A;</span></div>
            <div class="submenu">${boardItems}</div>
          </div>
          <div class="menu-divider"></div>
          <div class="menu-item danger" onclick="deleteTask(event,'${task.id}')">Delete <span>&#x2715;</span></div>
        </div>
      </div>
    </div>`;

  // Drag handlers
  card.addEventListener("dragstart", (e) => {
    draggedTaskId = task.id;
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    draggedTaskId = null;
  });

  return card;
}

// ── Modal open/close ──────────────────────────────────────────
/**
 * Open the modal for creating a new task.
 * @param {string} status - the column that was clicked ('todo'|'doing'|'done')
 */
function openTaskModal(status) {
  editingTaskId = null;
  activeStatus = status || STATUSES[0];

  document.getElementById("taskModalTitle").textContent = `Add to ${STATUS_LABEL(activeStatus)}`;
  document.getElementById("submitAddTask").textContent = "Add Task";
  document.getElementById("taskTitle").value = "";
  document.getElementById("taskDesc").value = "";
  setFieldError(document.getElementById("taskTitle"), null);
  setFieldError(document.getElementById("taskDesc"), null);

  // Hide status dropdown when creating (it's set by column button)
  document.getElementById("statusGroup").style.display = "none";

  document.getElementById("addTaskModal").classList.add("active");
  setTimeout(() => document.getElementById("taskTitle").focus(), 60);
}

/**
 * Open the modal for editing an existing task.
 * Shows the status dropdown so users can change columns.
 */
async function openEditTask(id) {
  closeAllMenus();

  // Try local DOM first for speed
  const card = document.querySelector(`.task-card[data-task-id="${id}"]`);
  const cachedTasks = readCache(KEY_TASKS);
  const localTask = cachedTasks?.find?.((t) => String(t.id) === String(id));

  if (localTask) {
    populateEditModal(localTask);
  } else {
    // Fallback: fetch from server
    try {
      const res = await apiFetch(`/tasks/${id}`);
      if (!res || !res.ok) { showToast("Could not load task", true); return; }
      populateEditModal(await res.json());
    } catch {
      showToast("Network error", true);
      return;
    }
  }
}

function populateEditModal(task) {
  editingTaskId = task.id;
  activeStatus = task.status;

  document.getElementById("taskModalTitle").textContent = "Edit Task";
  document.getElementById("submitAddTask").textContent = "Save Changes";
  document.getElementById("taskTitle").value = task.title;
  document.getElementById("taskDesc").value = task.description || "";
  document.getElementById("taskStatus").value = task.status;
  setFieldError(document.getElementById("taskTitle"), null);
  setFieldError(document.getElementById("taskDesc"), null);

  // Show status dropdown in edit mode
  document.getElementById("statusGroup").style.display = "";

  document.getElementById("addTaskModal").classList.add("active");
  setTimeout(() => document.getElementById("taskTitle").focus(), 60);
}

function closeTaskModal() {
  document.getElementById("addTaskModal").classList.remove("active");
  editingTaskId = null;
  isSaving = false;
}

// ── Save task (create or update) ──────────────────────────────
async function saveTask() {
  if (isSaving) return;

  const titleEl = document.getElementById("taskTitle");
  const descEl = document.getElementById("taskDesc");
  const statusEl = document.getElementById("taskStatus");

  const titleErr = validateField("taskTitle", titleEl.value);
  const descErr = validateField("taskDesc", descEl.value);
  setFieldError(titleEl, titleErr);
  setFieldError(descEl, descErr);
  if (titleErr || descErr) { titleEl.focus(); return; }

  // Status: from dropdown (edit) or from which column was clicked (create)
  const status = editingTaskId ? statusEl.value : activeStatus;
  const title = titleEl.value.trim();
  const desc = descEl.value.trim() || null;

  const isEdit = !!editingTaskId;
  const method = isEdit ? "PUT" : "POST";
  const url = isEdit ? `/tasks/${editingTaskId}` : `/tasks`;
  const body = isEdit
    ? { title, description: desc, status }
    : { board_id: BOARD_ID, title, description: desc, status };

  // Loading state
  isSaving = true;
  const btn = document.getElementById("submitAddTask");
  btn.classList.add("btn-loading");
  btn.disabled = true;

  try {
    const res = await apiFetch(url, { method, body: JSON.stringify(body) });
    if (!res) return;

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.detail || "Save failed", true);
      return;
    }

    const saved = await res.json();
    closeTaskModal();

    if (isEdit) {
      // Patch the existing card in-place (no full re-render)
      patchTaskCard(saved);
      showToast("Task updated");
    } else {
      // Prepend new card to correct column
      addTaskCardToColumn(saved);
      showToast("Task added");
    }

    // Invalidate cache so next puller gets fresh data
    invalidateTaskCache();

  } catch {
    showToast("Network error — please try again", true);
  } finally {
    isSaving = false;
    btn.classList.remove("btn-loading");
    btn.disabled = false;
  }
}

// ── Optimistic DOM helpers ────────────────────────────────────
function addTaskCardToColumn(task) {
  const list = document.getElementById(`tasks-${task.status}`);
  if (!list) return;

  // Remove empty placeholder
  list.querySelector(".column-empty")?.remove();

  // Prepend new card
  list.insertBefore(buildTaskCard(task), list.firstChild);

  // Increment count
  const countEl = document.getElementById(`count-${task.status}`);
  if (countEl) countEl.textContent = parseInt(countEl.textContent || "0") + 1;
}

function patchTaskCard(task) {
  const card = document.querySelector(`.task-card[data-task-id="${task.id}"]`);
  if (!card) { fetchBundle(); return; }   // fallback: full refresh

  const oldStatus = card.dataset.status;
  const newStatus = task.status;

  // Update text content
  card.querySelector(".task-card-title").textContent = task.title;
  const descEl = card.querySelector(".task-card-desc");
  if (task.description) {
    if (descEl) descEl.textContent = task.description;
    else {
      const d = document.createElement("div");
      d.className = "task-card-desc";
      d.textContent = task.description;
      card.querySelector(".task-card-title").insertAdjacentElement("afterend", d);
    }
  } else {
    descEl?.remove();
  }

  // Move column if status changed
  if (oldStatus !== newStatus) {
    const newList = document.getElementById(`tasks-${newStatus}`);
    if (newList) {
      newList.querySelector(".column-empty")?.remove();
      newList.insertBefore(card, newList.firstChild);
      card.dataset.status = newStatus;

      // Update counts
      adjustCount(oldStatus, -1);
      adjustCount(newStatus, +1);
    }
  }
}

function removeTaskCard(taskId) {
  const card = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
  if (!card) return;
  const status = card.dataset.status;
  card.remove();
  adjustCount(status, -1);

  // Show empty hint if column is now empty
  const list = document.getElementById(`tasks-${status}`);
  if (list && !list.querySelector(".task-card")) {
    list.innerHTML = `<div class="column-empty">No tasks yet</div>`;
  }
}

function adjustCount(status, delta) {
  const el = document.getElementById(`count-${status}`);
  if (el) el.textContent = Math.max(0, parseInt(el.textContent || "0") + delta);
}

// ── Delete task ───────────────────────────────────────────────
async function deleteTask(e, id) {
  e.stopPropagation();
  closeAllMenus();

  const confirmed = await confirmAction("Delete task?", "This cannot be undone.");
  if (!confirmed) return;

  // Optimistic remove
  const card = document.querySelector(`.task-card[data-task-id="${id}"]`);
  const status = card?.dataset.status;
  card?.remove();
  if (status) adjustCount(status, -1);

  try {
    const res = await apiFetch(`/tasks/${id}`, { method: "DELETE" });
    if (!res || !res.ok) throw new Error("Delete failed");
    showSuccessTick("Deleted");
    invalidateTaskCache();
  } catch (err) {
    showToast(err.message, true);
    fetchBundle();   // restore if it failed
  }
}

// ── Move task status (optimistic) ────────────────────────────
async function moveTask(e, taskId, newStatus) {
  e?.stopPropagation();
  closeAllMenus();

  const card = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
  if (!card) return;
  const oldStatus = card.dataset.status;
  if (oldStatus === newStatus) return;

  // Optimistic move
  const oldList = document.getElementById(`tasks-${oldStatus}`);
  const newList = document.getElementById(`tasks-${newStatus}`);
  newList?.querySelector(".column-empty")?.remove();
  if (newList) newList.insertBefore(card, newList.firstChild);
  card.dataset.status = newStatus;
  adjustCount(oldStatus, -1);
  adjustCount(newStatus, +1);

  // Empty hint for old column
  if (oldList && !oldList.querySelector(".task-card")) {
    oldList.innerHTML = `<div class="column-empty">No tasks yet</div>`;
  }

  try {
    const res = await apiFetch(`/tasks/${taskId}/move`, {
      method: "PUT",
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res || !res.ok) throw new Error("Move failed");
    invalidateTaskCache();
  } catch (err) {
    showToast(err.message, true);
    // Rollback
    oldList?.querySelector(".column-empty")?.remove();
    if (oldList) oldList.insertBefore(card, oldList.firstChild);
    card.dataset.status = oldStatus;
    adjustCount(newStatus, -1);
    adjustCount(oldStatus, +1);
  }
}

// ── Move task to another board ────────────────────────────────
async function moveTaskToBoard(e, taskId, newBoardId) {
  e?.stopPropagation();
  closeAllMenus();

  const confirmed = await confirmAction("Move task?", "Move this task to another board?", "Move");
  if (!confirmed) return;

  // Optimistic remove from current board
  removeTaskCard(taskId);

  try {
    const res = await apiFetch(`/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify({ board_id: newBoardId }),
    });
    if (!res || !res.ok) throw new Error("Move failed");
    showSuccessTick("Moved");
    invalidateTaskCache();
  } catch (err) {
    showToast(err.message, true);
    fetchBundle();   // restore
  }
}

// ── Menu handlers ─────────────────────────────────────────────
function toggleTaskMenu(e, taskId) {
  e.stopPropagation();
  const menu = document.getElementById(`menu-${taskId}`);
  const btn = e.currentTarget;
  const isOpen = menu.classList.contains("active");

  closeAllMenus();

  if (!isOpen) {
    // Teleport menu to body so it escapes overflow:hidden
    document.body.appendChild(menu);
    menu.classList.add("active");
    menu.dataset.taskId = taskId;
    positionMenu(menu, btn);
  }
}

function positionMenu(menu, btn) {
  const rect = btn.getBoundingClientRect();
  const menuW = 186;
  let left = rect.right - menuW;
  if (left < 8) left = 8;

  menu.style.cssText =
    `position:fixed;top:${rect.bottom + 4}px;left:${left}px;right:auto;z-index:9999`;
}

function closeAllMenus() {
  document.querySelectorAll(".dropdown-menu.active").forEach((menu) => {
    const taskId = menu.dataset.taskId;
    if (taskId) {
      const card = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
      card?.querySelector(".task-menu-container")?.appendChild(menu);
    }
    menu.classList.remove("active");
    menu.style.cssText = "";
  });
}

window.addEventListener("click", closeAllMenus);
window.addEventListener("scroll", () => { if (document.querySelector(".dropdown-menu.active")) closeAllMenus(); }, true);

// ── Drag & drop ───────────────────────────────────────────────
function handleDragOver(e) { e.preventDefault(); e.currentTarget.classList.add("drag-over"); e.dataTransfer.dropEffect = "move"; }
function handleDragLeave(e) { e.currentTarget.classList.remove("drag-over"); }
function handleDrop(e, status) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");
  if (draggedTaskId !== null) moveTask(null, draggedTaskId, status);
}

// ── Background puller ─────────────────────────────────────────
const PULL_MS = 15_000;   // 15 s — generous interval; DOM is cheap to diff

function startPuller() {
  stopPuller();
  pullerTimer = setInterval(() => { if (!document.hidden) fetchBundle(); }, PULL_MS);
}
function stopPuller() {
  if (pullerTimer) { clearInterval(pullerTimer); pullerTimer = null; }
}

// ── Column management ─────────────────────────────────────────
async function addColumn() {
  const newColName = `Untitled ${STATUSES.length + 1}`.replace(/\s+/g, '-').toLowerCase();
  
  // Make sure it's unique
  let finalName = newColName;
  let counter = 1;
  while (STATUSES.includes(finalName)) {
    finalName = `${newColName}-${counter++}`;
  }

  const updatedColumns = [...STATUSES, finalName];
  
  try {
    const res = await apiFetch(`/boards/${BOARD_ID}`, {
      method: "PUT",
      body: JSON.stringify({ columns: updatedColumns }),
    });
    if (!res || !res.ok) throw new Error("Could not add column");

    const board = await res.json();
    STATUSES = board.columns;
    renderColumns(STATUSES);
    fetchBundle(); // Refresh tasks to populate labels correctly
    showToast("Column added");
  } catch (err) {
    showToast(err.message, true);
  }
}

async function deleteColumn(e, status) {
  e.stopPropagation();
  
  const confirmed = await confirmAction(
    `Delete "${STATUS_LABEL(status)}" column?`,
    "",
    "Delete"
  );
  if (!confirmed) return;

  const updatedColumns = STATUSES.filter(s => s !== status);
  const updatedDeleted = [...DELETED_STATUSES, status];

  try {
    const res = await apiFetch(`/boards/${BOARD_ID}`, {
      method: "PUT",
      body: JSON.stringify({ 
        columns: updatedColumns,
        deleted_columns: updatedDeleted
      }),
    });
    if (!res || !res.ok) throw new Error("Could not delete column");

    const board = await res.json();
    STATUSES = board.columns;
    DELETED_STATUSES = board.deleted_columns;
    
    renderColumns(STATUSES);
    fetchBundle(); // Full refresh tasks to handle orphan/hidden tasks
    showToast("Column deleted");
  } catch (err) {
    showToast(err.message, true);
  }
}

// ── Edit (rename) a column inline ────────────────────────────
async function editColumn(e, status) {
  e.stopPropagation();

  const labelEl = document.getElementById(`label-${status}`);
  if (!labelEl) return;

  // Build an inline input replacing the label text
  const currentName = STATUS_LABEL(status);
  const dotHtml = '<span class="dot"></span>';
  labelEl.innerHTML = `${dotHtml}<input class="col-rename-input" id="rename-${status}" type="text"
    value="${currentName}" maxlength="40" autocomplete="off" />`;

  const input = document.getElementById(`rename-${status}`);
  input.focus();
  input.select();

  const commit = async () => {
    const newName = input.value.trim();
    if (!newName || newName === currentName) {
      // Revert to original label without saving
      labelEl.innerHTML = `${dotHtml}${currentName}`;
      return;
    }

    // Build updated column list replacing old slug with new slug
    const newSlug = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!newSlug) { labelEl.innerHTML = `${dotHtml}${currentName}`; return; }

    // Prevent duplicate column slugs
    if (STATUSES.includes(newSlug) && newSlug !== status) {
      showToast(`Column "${newName}" already exists`, true);
      labelEl.innerHTML = `${dotHtml}${currentName}`;
      return;
    }

    const updatedColumns = STATUSES.map(s => s === status ? newSlug : s);

    try {
      const res = await apiFetch(`/boards/${BOARD_ID}`, {
        method: "PUT",
        body: JSON.stringify({ columns: updatedColumns }),
      });
      if (!res || !res.ok) throw new Error("Rename failed");

      const board = await res.json();
      STATUSES = board.columns;
      renderColumns(STATUSES);
      fetchBundle();
      showToast("Column renamed");
    } catch (err) {
      showToast(err.message, true);
      labelEl.innerHTML = `${dotHtml}${currentName}`;
    }
  };

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") { ev.preventDefault(); input.blur(); }
    if (ev.key === "Escape") {
      input.removeEventListener("blur", commit);
      labelEl.innerHTML = `${dotHtml}${currentName}`;
    }
  });
}

// ── Board Info Editing ────────────────────────────────────────
function openBoardEditModal() {
  const currentTitle = document.getElementById("boardTitle").textContent;
  const currentDesc  = document.getElementById("boardDesc").textContent;
  
  document.getElementById("boardNameInput").value = currentTitle === "Loading…" ? "" : currentTitle;
  document.getElementById("boardDescInput").value = currentDesc;
  document.getElementById("editBoardModal").classList.add("active");
  setTimeout(() => document.getElementById("boardNameInput").focus(), 60);
}

function closeBoardEditModal() {
  document.getElementById("editBoardModal").classList.remove("active");
}

async function saveBoardInfo() {
  const nameInput = document.getElementById("boardNameInput");
  const descInput = document.getElementById("boardDescInput");
  
  if (!nameInput.value.trim()) {
    showToast("Board name is required", true);
    nameInput.focus();
    return;
  }

  const name = nameInput.value.trim();
  const description = descInput.value.trim() || null;
  
  const btn = document.getElementById("submitEditBoard");
  btn.classList.add("btn-loading");
  btn.disabled = true;

  try {
    const res = await apiFetch(`/boards/${BOARD_ID}`, {
      method: "PUT",
      body: JSON.stringify({ name, description })
    });
    if (!res || !res.ok) throw new Error("Save failed");

    const board = await res.json();
    document.getElementById("boardTitle").textContent = board.name;
    document.getElementById("boardDesc").textContent  = board.description || "";
    document.title = `KanBoards — ${board.name}`;
    
    closeBoardEditModal();
    showToast("Board updated");
    // Also save to cache for boards list
    saveCache(KEY_BOARD, JSON.stringify(board));
  } catch (err) {
    showToast(err.message, true);
  } finally {
    btn.classList.remove("btn-loading");
    btn.disabled = false;
  }
}

// ── Cache helpers ─────────────────────────────────────────────
function readCache(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function saveCache(key, jsonStr) {
  try { localStorage.setItem(key, jsonStr); } catch { }
}
function invalidateTaskCache() {
  localStorage.removeItem(KEY_TASKS);
}
