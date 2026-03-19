/* ================================================================
   script.js — Boards list page (index.html)
   API base: relative paths → FastAPI serves frontend at root
   ================================================================ */

const API = "";   // same origin — FastAPI at localhost:8000
let editingBoardId = null;
let allBoardsData = [];

/* ── Helpers ──────────────────────────────────────────────── */
function showToast(msg, isError = false) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = "toast" + (isError ? " error" : "");
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => t.classList.remove("show"), 3000);
}

function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric"
    });
}

async function loadBoards() {
    const grid = document.getElementById("boardsGrid");
    grid.innerHTML = `<p style="color:var(--text-muted);padding:2rem 0">Loading boards…</p>`;
    try {
        const res = await fetch(`${API}/boards`);
        if (!res.ok) throw new Error("Failed to load boards");
        allBoardsData = await res.json();

        if (allBoardsData.length === 0) {
            grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"></div>
          <p>No boards yet — create your first one!</p>
        </div>`;
            return;
        }

        grid.innerHTML = allBoardsData.map(b => buildBoardCard(b)).join("");
    } catch (e) {
        grid.innerHTML = `<p style="color:var(--accent-danger)">${e.message}</p>`;
    }
}

/* ── Build Board Card ─────────────────────────────────────── */
function buildBoardCard(b) {
    return `
      <div class="board-card" id="board-${b.id}" onclick="goToBoard('${b.id}', event)">
        <div class="board-card-top">
          <div class=""></div>
          <div class="task-menu-container">
            <button class="menu-dots-btn" onclick="toggleBoardMenu(event, '${b.id}')">&#x22EE;</button>
            <div class="dropdown-menu" id="menu-${b.id}">
              <div class="menu-item" onclick="editBoard(event, '${b.id}')">Edit Board <span>&#x270E;</span></div>
              
              <div class="submenu-container">
                <div class="menu-item">Merge into... <span>&#x203A;</span></div>
                <div class="submenu">
                  ${allBoardsData.filter(ob => ob.id != b.id).map(ob => `
                    <div class="menu-item" onclick="mergeBoard(event, '${b.id}', '${ob.id}', '${escHtml(ob.name)}')">${escHtml(ob.name)}</div>
                  `).join('')}
                  ${allBoardsData.length <= 1 ? '<div class="menu-item" style="opacity:0.5; cursor:default;">No other boards</div>' : ''}
                </div>
              </div>

              <div class="menu-divider"></div>
              <div class="menu-item danger" onclick="deleteBoard(event, '${b.id}')">Delete Board <span>&#x2715;</span></div>
            </div>
          </div>
        </div>
        <div class="board-name">${escHtml(b.name)}</div>
        <div class="board-desc">${escHtml(b.description || "No description")}</div>
        <div class="board-footer">
          <span class="board-date">${formatDate(b.created_at)}</span>
        </div>
      </div>
    `;
}

/* ── Navigate to board detail ─────────────────────────────── */
function goToBoard(id, e) {
    if (e.target.closest(".task-menu-container")) return;
    window.location.href = `/board?id=${id}`;
}

/* ── Save Board (Create or Update) ────────────────────────── */
async function saveBoard() {
    const name = document.getElementById("boardName").value.trim();
    const desc = document.getElementById("boardDesc").value.trim();
    if (!name) { showToast("Board name is required", true); return; }

    const method = editingBoardId ? "PUT" : "POST";
    const url = editingBoardId ? `${API}/boards/${editingBoardId}` : `${API}/boards`;

    try {
        const res = await fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, description: desc || null })
        });
        if (!res.ok) throw new Error(`Failed to ${editingBoardId ? 'update' : 'create'} board`);
        const isEdit = !!editingBoardId;
        closeModal();
        showToast(isEdit ? "Changes saved" : "Board created successfully!");
        loadBoards();
    } catch (e) {
        showToast(e.message, true);
    }
}

/* ── Edit Board ───────────────────────────────────────────── */
function editBoard(e, id) {
    e.stopPropagation();
    const board = allBoardsData.find(b => b.id == id);
    if (!board) return;

    editingBoardId = id;
    document.getElementById("boardModalTitle").textContent = "Edit Board";
    document.getElementById("submitCreateBoard").textContent = "Save Changes";
    document.getElementById("boardName").value = board.name;
    document.getElementById("boardDesc").value = board.description || "";
    document.getElementById("createBoardModal").classList.add("active");
    document.getElementById("boardName").focus();
    closeAllBoardMenus();
}

/* ── Delete board ─────────────────────────────────────────── */
async function deleteBoard(e, id) {
    e.stopPropagation();
    const confirmed = await confirmAction("Delete Board?", "This will permanently delete this board and all its tasks.");
    if (!confirmed) return;

    try {
        const res = await fetch(`${API}/boards/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete board");
        showSuccessTick("Board Deleted");
        loadBoards();
    } catch (e) {
        showToast(e.message, true);
    }
    closeAllBoardMenus();
}

/* ── Merge Board ──────────────────────────────────────────── */
async function mergeBoard(e, sourceId, targetId, targetName) {
    e.stopPropagation();
    const confirmed = await confirmAction("Merge Boards?", `Move all tasks to "${targetName}" and delete this board?`, "Merge");
    if (!confirmed) return;

    try {
        const res = await fetch(`${API}/boards/${sourceId}/merge`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target_board_id: targetId })
        });
        if (!res.ok) throw new Error("Failed to merge boards");
        showSuccessTick("Boards Merged");
        loadBoards();
    } catch (e) {
        showToast(e.message, true);
    }
    closeAllBoardMenus();
}

/* ── Menu Handlers ────────────────────────────────────────── */
function toggleBoardMenu(e, boardId) {
    e.stopPropagation();
    const menu = document.getElementById(`menu-${boardId}`);
    const card = document.getElementById(`board-${boardId}`);
    const isActive = menu.classList.contains("active");
    closeAllBoardMenus();
    if (!isActive) {
        menu.classList.add("active");
        card.classList.add("menu-active");
    }
}

function closeAllBoardMenus() {
    document.querySelectorAll(".dropdown-menu").forEach(m => m.classList.remove("active"));
    document.querySelectorAll(".board-card").forEach(c => c.classList.remove("menu-active"));
}

window.addEventListener("click", closeAllBoardMenus);

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
        
        // Reset classes
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
    
    // Restart animation
    const svg = overlay.querySelector(".tick-svg");
    const newSvg = svg.cloneNode(true);
    svg.parentNode.replaceChild(newSvg, svg);

    setTimeout(() => {
        overlay.classList.remove("active");
    }, 2000);
}

/* ── Modal helpers ────────────────────────────────────────── */
function openModal() {
    editingBoardId = null;
    document.getElementById("boardModalTitle").textContent = "Create New Board";
    document.getElementById("submitCreateBoard").textContent = "Create Board";
    document.getElementById("boardName").value = "";
    document.getElementById("boardDesc").value = "";
    document.getElementById("createBoardModal").classList.add("active");
    document.getElementById("boardName").focus();
}
function closeModal() {
    document.getElementById("createBoardModal").classList.remove("active");
    editingBoardId = null;
}

/* ── Escape HTML ──────────────────────────────────────────── */
function escHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ── Event listeners ──────────────────────────────────────── */
document.getElementById("openCreateBoard").addEventListener("click", openModal);
document.getElementById("cancelCreateBoard").addEventListener("click", closeModal);
document.getElementById("submitCreateBoard").addEventListener("click", saveBoard);

document.getElementById("createBoardModal").addEventListener("click", e => {
    if (e.target === document.getElementById("createBoardModal")) closeModal();
});

document.getElementById("boardName").addEventListener("keydown", e => {
    if (e.key === "Enter") saveBoard();
});

/* ── Init ─────────────────────────────────────────────────── */
loadBoards();
