/**
 * script.js — Boards list page (index.html)
 *
 * Fast flow:
 *  1. Paint boards from localStorage immediately (zero-wait render)
 *  2. Fetch fresh list in background — only re-render if changed
 *  3. Background puller every 30s when tab is visible
 */

"use strict";

// ── Guard ─────────────────────────────────────────────────────
requireAuth();

// ── State ─────────────────────────────────────────────────────
let allBoardsData  = [];
let editingBoardId = null;
let currentPage    = 1;
let totalBoards    = 0;
let currentSearch  = "";
let isSaving       = false;
let pullerTimer    = null;

const PAGE_SIZE  = 12;
const CACHE_KEY  = "kb_boards_list";
const PULL_MS    = 30_000;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setUserDisplay();

  // Restore cached boards for instant display
  paintFromCache();

  // Fetch fresh
  loadBoards();
  startPuller();

  // Buttons
  document.getElementById("openCreateBoard").addEventListener("click",   openModal);
  document.getElementById("cancelCreateBoard").addEventListener("click", closeModal);
  document.getElementById("submitCreateBoard").addEventListener("click", saveBoard);

  // Modal close on backdrop click
  document.getElementById("createBoardModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("createBoardModal")) closeModal();
  });

  // Submit on Enter in name field
  document.getElementById("boardName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveBoard();
  });

  // Live validation
  attachLiveValidation(document.getElementById("boardName"), "boardName");
  attachLiveValidation(document.getElementById("boardDesc"), "boardDesc");

  // Search — debounced so we don't spam the API
  const searchEl = document.getElementById("boardSearch");
  if (searchEl) {
    let debounce;
    searchEl.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        currentSearch = searchEl.value.trim();
        currentPage   = 1;
        loadBoards();
      }, 280);
    });
  }

  // Visibility sync
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { loadBoards(); startPuller(); }
    else { stopPuller(); }
  });

  window.addEventListener("click", closeAllBoardMenus);
});

// ── Cache-first instant paint ─────────────────────────────────
function paintFromCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached && cached.length) {
      allBoardsData = cached;
      renderBoardGrid(cached);
    } else {
      renderGridSkeleton();
    }
  } catch {
    renderGridSkeleton();
  }
}

// ── Load boards from API (paginated) ─────────────────────────
async function loadBoards() {
  const params = new URLSearchParams({
    page:      currentPage,
    page_size: PAGE_SIZE,
  });
  if (currentSearch) params.set("search", currentSearch);

  try {
    const res = await apiFetch(`/boards?${params}`);
    if (!res || !res.ok) return;

    const data = await res.json();

    totalBoards   = data.total;
    allBoardsData = data.items;

    // Persist in cache for next page load
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(allBoardsData)); } catch {}

    renderBoardGrid(allBoardsData);
    renderPagination();

  } catch (err) {
    // Keep cached content visible — just warn
    console.warn("[boards] load failed:", err);
  }
}

// ── Render board grid ─────────────────────────────────────────
function renderBoardGrid(boards) {
  const grid = document.getElementById("boardsGrid");

  if (!boards || boards.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#9744;</div>
        <p>${currentSearch ? `No boards match "${escHtml(currentSearch)}"` : "No boards yet — create your first one!"}</p>
      </div>`;
    return;
  }

  grid.innerHTML = boards.map(buildBoardCard).join("");
}

function renderGridSkeleton() {
  const grid = document.getElementById("boardsGrid");
  grid.innerHTML = Array.from({ length: 3 }, () => `
    <div style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:20px">
      <div class="skeleton" style="height:14px;width:60%;margin-bottom:10px"></div>
      <div class="skeleton" style="height:11px;width:90%;margin-bottom:6px"></div>
      <div class="skeleton" style="height:11px;width:70%"></div>
    </div>`).join("");
}

// ── Build board card HTML ─────────────────────────────────────
function buildBoardCard(b) {
  const mergeItems = allBoardsData
    .filter((o) => o.id !== b.id)
    .map((o) => `<div class="menu-item" onclick="mergeBoard(event,'${b.id}','${o.id}','${escHtml(o.name)}')">${escHtml(o.name)}</div>`)
    .join("") || `<div class="menu-item" style="opacity:.5;cursor:default">No other boards</div>`;

  return `
    <div class="board-card" id="board-${b.id}"
         onclick="goToBoard('${b.id}',event)"
         onmouseenter="prefetchBoard('${b.id}')">
      <div class="board-card-top">
        <div></div>
        <div class="task-menu-container">
          <button class="menu-dots-btn" onclick="toggleBoardMenu(event,'${b.id}')" aria-label="Board options">&#x22EE;</button>
          <div class="dropdown-menu" id="menu-${b.id}">
            <div class="menu-item" onclick="editBoard(event,'${b.id}')">Edit <span>&#x270E;</span></div>
            <div class="submenu-container">
              <div class="menu-item">Merge into <span>&#x203A;</span></div>
              <div class="submenu">${mergeItems}</div>
            </div>
            <div class="menu-divider"></div>
            <div class="menu-item danger" onclick="deleteBoard(event,'${b.id}')">Delete <span>&#x2715;</span></div>
          </div>
        </div>
      </div>
      <div class="board-name">${escHtml(b.name)}</div>
      <div class="board-desc">${escHtml(b.description || "No description")}</div>
      <div class="board-footer">
        <span class="board-date">${formatDate(b.created_at)}</span>
      </div>
    </div>`;
}

// ── Navigate ──────────────────────────────────────────────────
function goToBoard(id, e) {
  if (e.target.closest(".task-menu-container")) return;
  window.location.href = `/board?id=${id}`;
}

// ── Prefetch on hover ─────────────────────────────────────────
async function prefetchBoard(id) {
  const lastFetch = sessionStorage.getItem(`pfetch_${id}`);
  if (lastFetch && Date.now() - Number(lastFetch) < 12_000) return;

  try {
    const res = await apiFetch(`/boards/${id}/bundle`);
    if (res && res.ok) {
      const data = await res.json();
      localStorage.setItem(`kb_board_${id}`,  JSON.stringify(data.board));
      localStorage.setItem(`kb_tasks_${id}`,  JSON.stringify(data.tasks));
      sessionStorage.setItem(`pfetch_${id}`, Date.now());
    }
  } catch { /* silent */ }
}

// ── Save board (create or update) ────────────────────────────
async function saveBoard() {
  if (isSaving) return;

  const nameEl = document.getElementById("boardName");
  const descEl = document.getElementById("boardDesc");

  const nameErr = validateField("boardName", nameEl.value);
  const descErr = validateField("boardDesc",  descEl.value);
  setFieldError(nameEl, nameErr);
  setFieldError(descEl,  descErr);
  if (nameErr || descErr) { nameEl.focus(); return; }

  const name   = nameEl.value.trim();
  const desc   = descEl.value.trim() || null;
  const isEdit = !!editingBoardId;
  const method = isEdit ? "PUT" : "POST";
  const url    = isEdit ? `/boards/${editingBoardId}` : `/boards`;

  isSaving = true;
  const btn = document.getElementById("submitCreateBoard");
  btn.classList.add("btn-loading");
  btn.disabled = true;

  try {
    const res = await apiFetch(url, { method, body: JSON.stringify({ name, description: desc }) });
    if (!res) return;

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.detail || "Save failed", true);
      return;
    }

    closeModal();
    showToast(isEdit ? "Board updated" : "Board created");
    loadBoards();

  } catch {
    showToast("Network error", true);
  } finally {
    isSaving = false;
    btn.classList.remove("btn-loading");
    btn.disabled = false;
  }
}

// ── Edit board ────────────────────────────────────────────────
function editBoard(e, id) {
  e.stopPropagation();
  const board = allBoardsData.find((b) => b.id == id);
  if (!board) return;

  editingBoardId = id;
  document.getElementById("boardModalTitle").textContent   = "Edit Board";
  document.getElementById("submitCreateBoard").textContent = "Save Changes";
  document.getElementById("boardName").value = board.name;
  document.getElementById("boardDesc").value = board.description || "";
  setFieldError(document.getElementById("boardName"), null);
  setFieldError(document.getElementById("boardDesc"), null);
  document.getElementById("createBoardModal").classList.add("active");
  document.getElementById("boardName").focus();
  closeAllBoardMenus();
}

// ── Delete board ──────────────────────────────────────────────
async function deleteBoard(e, id) {
  e.stopPropagation();
  closeAllBoardMenus();

  const confirmed = await confirmAction("Delete board?", "All tasks in this board will be deleted. This cannot be undone.");
  if (!confirmed) return;

  // Optimistic remove
  document.getElementById(`board-${id}`)?.remove();
  allBoardsData = allBoardsData.filter((b) => b.id != id);

  try {
    const res = await apiFetch(`/boards/${id}`, { method: "DELETE" });
    if (!res || !res.ok) throw new Error("Delete failed");
    showSuccessTick("Board Deleted");
    if (allBoardsData.length === 0 && currentPage > 1) currentPage--;
    loadBoards();
  } catch (err) {
    showToast(err.message, true);
    loadBoards();   // restore
  }
}

// ── Merge board ───────────────────────────────────────────────
async function mergeBoard(e, sourceId, targetId, targetName) {
  e.stopPropagation();
  closeAllBoardMenus();

  const confirmed = await confirmAction(
    "Merge boards?",
    `All tasks will move to "${targetName}". The current board will be deleted.`,
    "Merge"
  );
  if (!confirmed) return;

  try {
    const res = await apiFetch(`/boards/${sourceId}/merge`, {
      method: "POST",
      body:   JSON.stringify({ target_board_id: Number(targetId) }),
    });
    if (!res || !res.ok) throw new Error("Merge failed");
    showSuccessTick("Merged");
    loadBoards();
  } catch (err) {
    showToast(err.message, true);
  }
}

// ── Menu handlers ─────────────────────────────────────────────
function toggleBoardMenu(e, boardId) {
  e.stopPropagation();
  const menu   = document.getElementById(`menu-${boardId}`);
  const isOpen = menu.classList.contains("active");
  closeAllBoardMenus();
  if (!isOpen) menu.classList.add("active");
}

function closeAllBoardMenus() {
  document.querySelectorAll(".board-card .dropdown-menu").forEach((m) => m.classList.remove("active"));
}

// ── Modal helpers ─────────────────────────────────────────────
function openModal() {
  editingBoardId = null;
  document.getElementById("boardModalTitle").textContent   = "New Board";
  document.getElementById("submitCreateBoard").textContent = "Create Board";
  document.getElementById("boardName").value = "";
  document.getElementById("boardDesc").value = "";
  setFieldError(document.getElementById("boardName"), null);
  setFieldError(document.getElementById("boardDesc"), null);
  document.getElementById("createBoardModal").classList.add("active");
  document.getElementById("boardName").focus();
}

function closeModal() {
  document.getElementById("createBoardModal").classList.remove("active");
  editingBoardId = null;
  isSaving       = false;
}

// ── Pagination ────────────────────────────────────────────────
function renderPagination() {
  const container = document.getElementById("boardsPagination");
  if (!container) return;

  const totalPages = Math.ceil(totalBoards / PAGE_SIZE) || 1;
  if (totalPages <= 1) { container.innerHTML = ""; return; }

  const btn = (label, page, disabled = false, active = false) =>
    `<button class="page-btn${active ? ' active' : ''}" data-page="${page}" ${disabled ? 'disabled' : ''}>${label}</button>`;

  let html = `<div class="pagination">`;
  html += btn("&lsaquo;", currentPage - 1, currentPage <= 1);

  const start = Math.max(1, currentPage - 2);
  const end   = Math.min(totalPages, currentPage + 2);

  if (start > 1) {
    html += btn("1", 1);
    if (start > 2) html += `<span class="page-ellipsis">&hellip;</span>`;
  }

  for (let i = start; i <= end; i++) {
    html += btn(i, i, false, i === currentPage);
  }

  if (end < totalPages) {
    if (end < totalPages - 1) html += `<span class="page-ellipsis">&hellip;</span>`;
    html += btn(totalPages, totalPages);
  }

  html += btn("&rsaquo;", currentPage + 1, currentPage >= totalPages);
  html += `</div>`;
  container.innerHTML = html;

  // Single delegated listener
  container.querySelector(".pagination").addEventListener("click", (e) => {
    const pageBtn = e.target.closest(".page-btn");
    if (!pageBtn || pageBtn.disabled) return;
    const p = parseInt(pageBtn.dataset.page, 10);
    if (!isNaN(p) && p >= 1) {
      currentPage = p;
      loadBoards();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
}

// ── Background puller ─────────────────────────────────────────
function startPuller() {
  stopPuller();
  pullerTimer = setInterval(() => { if (!document.hidden) loadBoards(); }, PULL_MS);
}
function stopPuller() {
  if (pullerTimer) { clearInterval(pullerTimer); pullerTimer = null; }
}
