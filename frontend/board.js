/* ================================================================
   board.js — Board detail page (board.html)
   Handles task CRUD + HTML5 drag-and-drop column moves
   ================================================================ */

const API = "";
const params = new URLSearchParams(window.location.search);
const BOARD_ID = parseInt(params.get("id"), 10);  // Must be int for JSON body

let draggedTaskId = null;
let editingTaskId = null;
let allBoards = [];

/* ── Helpers ──────────────────────────────────────────────── */
function showToast(msg, isError = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast" + (isError ? " error" : "");
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => t.classList.remove("show"), 3000);
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function logout() {
    localStorage.removeItem("username");
    document.cookie = "user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "username=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "is_logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/login";
}

document.addEventListener("DOMContentLoaded", () => {
    const userDisplay = document.getElementById("userDisplay");
    const storedUsername = localStorage.getItem("username") || getCookie("username");
    if (userDisplay && storedUsername) {
        userDisplay.textContent = `Hi, ${storedUsername}`;
    }
});

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ── Load Board Bundle (Board + Tasks + All Boards) ───────── */
async function loadFullBoardData() {
  const cacheKeyBoard = `kanban_board_${BOARD_ID}`;
  const cacheKeyTasks = `kanban_tasks_${BOARD_ID}`;
  const cacheKeyAllBoards = `kanban_boards`;

  // 1. Try Cache First
  const cachedBoard = localStorage.getItem(cacheKeyBoard);
  const cachedTasks = localStorage.getItem(cacheKeyTasks);
  const cachedAllBoards = localStorage.getItem(cacheKeyAllBoards);

  if (cachedBoard) {
    const board = JSON.parse(cachedBoard);
    renderBoardInfo(board);
  }
  if (cachedTasks) {
    const tasks = JSON.parse(cachedTasks);
    renderTasks(tasks);
  }
  if (cachedAllBoards) {
    allBoards = JSON.parse(cachedAllBoards);
  }

  try {
    const url = `${API}/boards/${BOARD_ID}/bundle`;
    const res = await fetch(url);
    if (!res.ok) {
      if (!cachedBoard) window.location.href = "/";
      return;
    }
    const data = await res.json();

    // 2. Update Cache & UI
    if (JSON.stringify(data.board) !== cachedBoard) {
      localStorage.setItem(cacheKeyBoard, JSON.stringify(data.board));
      renderBoardInfo(data.board);
    }

    if (JSON.stringify(data.tasks) !== cachedTasks) {
      localStorage.setItem(cacheKeyTasks, JSON.stringify(data.tasks));
      renderTasks(data.tasks);
    }

    if (JSON.stringify(data.all_boards) !== cachedAllBoards) {
      localStorage.setItem(cacheKeyAllBoards, JSON.stringify(data.all_boards));
      allBoards = data.all_boards;
    }

  } catch (e) {
    console.warn("Puller failed", e);
  }
}

function renderBoardInfo(board) {
  document.getElementById("boardTitle").textContent = board.name;
  document.getElementById("boardDesc").textContent = board.description || "";
  document.title = `KanFlow — ${board.name}`;
}

function renderTasks(tasks) {
  // Clear all columns
  ["todo", "doing", "done"].forEach(s => {
    const list = document.getElementById(`tasks-${s}`);
    if (list) list.innerHTML = "";
    const count = document.getElementById(`count-${s}`);
    if (count) count.textContent = "0";
  });

  const counts = { todo: 0, doing: 0, done: 0 };

  tasks.forEach(task => {
    const status = task.status in counts ? task.status : "todo";
    counts[status]++;
    const el = buildTaskCard(task);
    const container = document.getElementById(`tasks-${status}`);
    if (container) container.appendChild(el);
  });

  Object.entries(counts).forEach(([s, n]) => {
    const el = document.getElementById(`count-${s}`);
    if (el) el.textContent = n;
  });
}

/* ── Build a task card DOM element ───────────────────────── */
function buildTaskCard(task) {
  const div = document.createElement("div");
  
  // Sticky note styling
  const colors = ["color-green", "color-yellow", "color-blue"];
  const colorIndex = (typeof task.id === 'number' ? task.id : parseInt(task.id) || 0) % colors.length;
  const rotation = "rotate-none";
  
  div.className = `task-card ${colors[colorIndex]} ${rotation}`;
  div.setAttribute("draggable", "true");
  div.dataset.taskId = task.id;
  div.dataset.status = task.status;

  div.innerHTML = `
    <div class="task-card-title">${escHtml(task.title)}</div>
    ${task.description ? `<div class="task-card-desc">${escHtml(task.description)}</div>` : ""}
    <div class="task-card-footer">
      <div class="task-menu-container">
        <button class="menu-dots-btn" onclick="toggleTaskMenu(event, '${task.id}')">&#x22EE;</button>
        <div class="dropdown-menu" id="menu-${task.id}">
          <div class="menu-item" onclick="editTask('${task.id}')">Edit Task <span>&#x270E;</span></div>
          
          <div class="submenu-container">
            <div class="menu-item">Move to Status <span>&#x203A;</span></div>
            <div class="submenu">
              <div class="menu-item" onclick="moveTask('${task.id}', 'todo')">Todo</div>
              <div class="menu-item" onclick="moveTask('${task.id}', 'doing')">Doing</div>
              <div class="menu-item" onclick="moveTask('${task.id}', 'done')">Done</div>
            </div>
          </div>

          <div class="submenu-container">
            <div class="menu-item">Move to Board <span>&#x203A;</span></div>
            <div class="submenu">
              ${allBoards.filter(b => b.id != BOARD_ID).map(b => `
                <div class="menu-item" onclick="moveTaskToBoard('${task.id}', ${b.id})">${escHtml(b.name)}</div>
              `).join('')}
              ${allBoards.length <= 1 ? '<div class="menu-item" style="opacity:0.5; cursor:default;">No other boards</div>' : ''}
            </div>
          </div>

          <div class="menu-divider"></div>
          <div class="menu-item danger" onclick="deleteTask(event, '${task.id}')">Delete Task <span>&#x2715;</span></div>
        </div>
      </div>
    </div>`;

  // Drag events
  div.addEventListener("dragstart", e => {
    draggedTaskId = task.id;
    div.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  div.addEventListener("dragend", () => {
    div.classList.remove("dragging");
    draggedTaskId = null;
  });

  return div;
}

/* ── Save task (Create or Update) ─────────────────────────── */
async function saveTask() {
  const title = document.getElementById("taskTitle").value.trim();
  const desc = document.getElementById("taskDesc").value.trim();
  const status = document.getElementById("taskStatus").value;

  if (!title) { showToast("Task title is required", true); return; }

  const taskData = { board_id: BOARD_ID, title, description: desc || null, status };
  const method = editingTaskId ? "PUT" : "POST";
  const url = editingTaskId ? `${API}/tasks/${editingTaskId}` : `${API}/tasks`;

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskData)
    });
    if (!res.ok) throw new Error(`Failed to ${editingTaskId ? 'update' : 'create'} task`);
    const isEdit = !!editingTaskId;
    closeTaskModal();
    showToast(isEdit ? "Changes saved" : "Task added successfully!");
    loadFullBoardData();
  } catch (e) {
    showToast(e.message, true);
  }
}

/* ── Edit task ────────────────────────────────────────────── */
async function editTask(id) {
  try {
    const res = await fetch(`${API}/tasks/${id}`);
    if (!res.ok) throw new Error("Failed to load task details");
    const task = await res.json();
    if (!task) throw new Error("Task not found");

    editingTaskId = id;
    document.getElementById("taskModalTitle").textContent = "Edit Task";
    document.getElementById("submitAddTask").textContent = "Save Changes";
    document.getElementById("taskTitle").value = task.title;
    document.getElementById("taskDesc").value = task.description || "";
    document.getElementById("taskStatus").value = task.status;
    document.getElementById("addTaskModal").classList.add("active");
    document.getElementById("taskTitle").focus();
  } catch (e) {
    showToast(e.message, true);
  }
}

/* ── Delete task ──────────────────────────────────────────── */
async function deleteTask(e, id) {
  e.stopPropagation();
  const confirmed = await confirmAction("Delete Task?", "Are you sure you want to remove this task permanently?");
  if (!confirmed) return;
  try {
    const res = await fetch(`${API}/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete task");
    showSuccessTick("Task Deleted");
    loadFullBoardData();
  } catch (e) {
    showToast(e.message, true);
  }
}

/* ── Move task (drag & drop) ──────────────────────────────── */
async function moveTask(taskId, newStatus) {
  // Optimistic UI Update
  const card = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
  const oldStatus = card.dataset.status;
  const oldParent = card.parentElement;

  if (oldStatus === newStatus) return;

  const targetList = document.getElementById(`tasks-${newStatus}`);
  targetList.appendChild(card);
  card.dataset.status = newStatus;

  // Update counts
  document.getElementById(`count-${oldStatus}`).textContent =
    parseInt(document.getElementById(`count-${oldStatus}`).textContent) - 1;
  document.getElementById(`count-${newStatus}`).textContent =
    parseInt(document.getElementById(`count-${newStatus}`).textContent) + 1;

  try {
    const res = await fetch(`${API}/tasks/${taskId}/move`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error("Move failed on server");
  } catch (e) {
    showToast(e.message, true);
    // Rollback
    oldParent.appendChild(card);
    card.dataset.status = oldStatus;
    document.getElementById(`count-${oldStatus}`).textContent =
      parseInt(document.getElementById(`count-${oldStatus}`).textContent) + 1;
    document.getElementById(`count-${newStatus}`).textContent =
      parseInt(document.getElementById(`count-${newStatus}`).textContent) - 1;
  }
  closeAllMenus();
}

/* ── Move task to other Board ────────────────────────────── */
async function moveTaskToBoard(taskId, newBoardId) {
  const confirmed = await confirmAction("Move Task?", "Move this task to another board?", "Move");
  if (!confirmed) return;
  try {
    const res = await fetch(`${API}/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ board_id: newBoardId })
    });
    if (!res.ok) throw new Error("Failed to transfer task");
    showSuccessTick("Task Moved");
    loadFullBoardData();
  } catch (e) {
    showToast(e.message, true);
  }
  closeAllMenus();
}

/* ── Menu Handlers ────────────────────────────────────────── */
function toggleTaskMenu(e, taskId) {
  e.stopPropagation();
  const menu = document.getElementById(`menu-${taskId}`);
  const btn = e.currentTarget;
  const isActive = menu.classList.contains("active");
  closeAllMenus();
  if (!isActive) {
    // Move menu to body to escape overflow/scroll containers
    document.body.appendChild(menu);
    menu.classList.add("active");
    positionMenu(menu, btn);
    menu.dataset.taskId = taskId;
    // Update card active state
    const card = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
    if (card) card.classList.add("menu-active");
  }
}

function positionMenu(menu, btn) {
  const rect = btn.getBoundingClientRect();
  menu.style.position = "fixed";
  menu.style.top = (rect.bottom + 4) + "px";
  menu.style.left = "auto";
  // Position so right edge of menu aligns with right edge of button
  const menuWidth = 180;
  let left = rect.right - menuWidth;
  if (left < 8) left = 8; // clamp to viewport edge
  menu.style.right = "auto";
  menu.style.left = left + "px";
  menu.style.zIndex = "9999";
}

function closeAllMenus() {
  // Return any floating menus back to their original card footer containers
  document.querySelectorAll(".dropdown-menu.active").forEach(menu => {
    const taskId = menu.dataset.taskId || menu.id.replace("menu-", "");
    const card = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
    if (card) {
      const container = card.querySelector(".task-menu-container");
      if (container) container.appendChild(menu);
      card.classList.remove("menu-active");
    }
    menu.classList.remove("active");
    // Reset inline positioning
    menu.style.position = "";
    menu.style.top = "";
    menu.style.left = "";
    menu.style.right = "";
    menu.style.zIndex = "";
  });
  document.querySelectorAll(".task-card").forEach(c => c.classList.remove("menu-active"));
}

window.addEventListener("click", closeAllMenus);

// Close menu on scroll of any container EXCEPT the dropdown itself
window.addEventListener("scroll", (e) => {
  const openMenu = document.querySelector(".dropdown-menu.active");
  if (openMenu && !openMenu.contains(e.target)) {
    closeAllMenus();
  }
}, true);

/* ── Custom Dialog Helpers ───────────────────────────────── */
function confirmAction(title, msg, okText = "Delete") {
  return new Promise((resolve) => {
    const modal = document.getElementById("customConfirmModal");
    const titleEl = document.getElementById("confirmTitle");
    const msgEl = document.getElementById("confirmMsg");
    const okBtn = document.getElementById("confirmOkBtn");
    const cancelBtn = document.getElementById("confirmCancelBtn");

    titleEl.textContent = title;
    msgEl.textContent = msg;
    okBtn.textContent = okText;

    okBtn.className = "btn " + (okText === "Delete" ? "btn-danger" : "btn-primary");

    const close = (res) => {
      modal.classList.remove("active");
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      resolve(res);
    };

    okBtn.onclick = () => close(true);
    cancelBtn.onclick = () => close(false);
    modal.classList.add("active");
  });
}

function showSuccessTick(msg) {
  const overlay = document.getElementById("successOverlay");
  const msgEl = document.getElementById("successMsg");
  msgEl.textContent = msg;
  overlay.classList.add("active");

  const svg = overlay.querySelector(".tick-svg");
  const newSvg = svg.cloneNode(true);
  svg.parentNode.replaceChild(newSvg, svg);

  setTimeout(() => {
    overlay.classList.remove("active");
  }, 2000);
}

/* ── Drag & Drop column handlers ──────────────────────────── */
function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add("drag-over");
  e.dataTransfer.dropEffect = "move";
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}

function handleDrop(e, status) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");
  if (draggedTaskId !== null) {
    moveTask(draggedTaskId, status);
  }
}

/* ── Modal helpers ────────────────────────────────────────── */
function openTaskModal() {
  editingTaskId = null;
  document.getElementById("taskModalTitle").textContent = "Add Task";
  document.getElementById("submitAddTask").textContent = "Add Task";
  document.getElementById("taskTitle").value = "";
  document.getElementById("taskDesc").value = "";
  document.getElementById("taskStatus").value = "todo";
  document.getElementById("addTaskModal").classList.add("active");
  document.getElementById("taskTitle").focus();
}
function closeTaskModal() {
  document.getElementById("addTaskModal").classList.remove("active");
  editingTaskId = null;
}

/* ── Event listeners ──────────────────────────────────────── */
document.getElementById("openAddTask").addEventListener("click", openTaskModal);
document.getElementById("cancelAddTask").addEventListener("click", closeTaskModal);
document.getElementById("submitAddTask").addEventListener("click", saveTask);

document.getElementById("addTaskModal").addEventListener("click", e => {
  if (e.target === document.getElementById("addTaskModal")) closeTaskModal();
});

document.getElementById("taskTitle").addEventListener("keydown", e => {
  if (e.key === "Enter") saveTask();
});

/* ── Puller (Background Sync) ──────────────────────────────── */
const PULL_INTERVAL = 10000; // 10 seconds for tasks
let pullerTimer = null;

function startPuller() {
  stopPuller();
  pullerTimer = setInterval(() => {
    if (!document.hidden) loadFullBoardData();
  }, PULL_INTERVAL);
}

function stopPuller() {
  if (pullerTimer) clearInterval(pullerTimer);
}

/* ── Init ─────────────────────────────────────────────────── */
async function init() {
  if (!BOARD_ID || isNaN(BOARD_ID)) { window.location.href = "/"; return; }
  await loadFullBoardData();
  startPuller();
}

// Restart puller when tab becomes visible
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        loadFullBoardData(); // Immediate refresh
        startPuller();
    } else {
        stopPuller();
    }
});

init();
