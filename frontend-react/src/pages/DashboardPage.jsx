import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { boardsAPI } from '../services/api';
import {
  PAGE_SIZE,
  POLL_INTERVALS,
  STORAGE_KEYS
} from '../constants/config';
import BoardFormModal from '../components/BoardFormModal';
import Pagination from '../components/Pagination';
import BoardCard from '../components/BoardCard';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { showToast, showSuccess, showConfirm } = useToast();

  /* ── Board list state ───────────────────────────────────── */
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const searchTimerRef = useRef(null);
  const pullerRef = useRef(null);

  /* ── Modal state ────────────────────────────────────────── */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState(null);
  const [saving, setSaving] = useState(false);

  /* ── Menu state ─────────────────────────────────────────── */
  const [openMenuId, setOpenMenuId] = useState(null);
  const [openSubMenuId, setOpenSubMenuId] = useState(null);

  /* ── Load boards ────────────────────────────────────────── */
  const loadBoards = useCallback(async (page = currentPage, searchTerm = search, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await boardsAPI.list(page, PAGE_SIZE, searchTerm);
      setBoards(data.items);
      setTotalPages(data.total_pages);
      try {
        localStorage.setItem(STORAGE_KEYS.BOARDS_CACHE, JSON.stringify(data.items));
      } catch { /* quota exceeded — ignore */ }
    } catch (err) {
      console.warn('[boards] load failed:', err);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [currentPage, search]);

  /* Initial load + cache-first paint */
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEYS.BOARDS_CACHE));
      if (cached?.length) { setBoards(cached); setLoading(false); }
    } catch { /* no cache */ }
    loadBoards(1, '', false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Background poller */
  useEffect(() => {
    const start = () => {
      clearInterval(pullerRef.current);
      pullerRef.current = setInterval(() => {
        if (!document.hidden) loadBoards(currentPage, search, true);
      }, POLL_INTERVALS.DASHBOARD);
    };
    start();

    const onVisibility = () => {
      if (!document.hidden) { loadBoards(currentPage, search, true); start(); }
      else clearInterval(pullerRef.current);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(pullerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadBoards, currentPage, search]);

  /* ── Search (debounced) ─────────────────────────────────── */
  const handleSearch = (value) => {
    setSearch(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setCurrentPage(1);
      loadBoards(1, value);
    }, 300);
  };

  /* ── Pagination ─────────────────────────────────────────── */
  const handlePageChange = (page) => {
    setCurrentPage(page);
    loadBoards(page, search);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── Close menus on outside click ───────────────────────── */
  useEffect(() => {
    const close = () => { setOpenMenuId(null); setOpenSubMenuId(null); };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  /* ── Save board (create or edit) ────────────────────────── */
  const openCreateModal = useCallback(() => {
    setEditingBoard(null);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((board, e) => {
    e?.stopPropagation();
    setOpenMenuId(null);
    setEditingBoard(board);
    setModalOpen(true);
  }, []);

  const handleSaveBoard = async (data) => {
    setSaving(true);
    const isEdit = !!editingBoard;
    const previousBoards = [...boards];

    // Optimistic UI Update
    if (isEdit) {
      setBoards(prev => prev.map(b => b.id === editingBoard.id ? { ...b, ...data } : b));
    }
    setModalOpen(false);

    try {
      const saved = isEdit
        ? await boardsAPI.update(editingBoard.id, data)
        : await boardsAPI.create(data.name, data.description);

      showToast(isEdit ? 'Board updated' : 'Board created');

      if (!isEdit) {
        // Navigate to new board immediately
        navigate(`/board/${saved.id}`);
      } else {
        setBoards(prev => prev.map(b => b.id === saved.id ? saved : b));
      }
    } catch (err) {
      showToast(err.message, true);
      setBoards(previousBoards); // Rollback
      if (!isEdit) setModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete board ───────────────────────────────────────── */
  const handleDeleteBoard = useCallback(async (board, e) => {
    e?.stopPropagation();
    setOpenMenuId(null);

    const ok = await showConfirm(
      'Delete board?',
      'All tasks in this board will be deleted. This action cannot be undone.',
      'Delete'
    );
    if (!ok) return;

    const previousBoards = [...boards];
    // Optimistic UI Update (Immediate)
    setBoards((prev) => prev.filter((b) => b.id !== board.id));

    try {
      await boardsAPI.delete(board.id);
      showSuccess('Board Deleted');
    } catch (err) {
      showToast(err.message, true);
      setBoards(previousBoards); // Rollback
    }
  }, [showConfirm, showSuccess, showToast, boards]);

  /* ── Merge board ────────────────────────────────────────── */
  const handleMergeBoard = useCallback(async (sourceId, targetId, targetName, e) => {
    e?.stopPropagation();
    setOpenMenuId(null);

    const ok = await showConfirm(
      'Merge boards?',
      `All tasks and columns will move to "${targetName}". The current board will be deleted.`,
      'Merge'
    );
    if (!ok) return;

    const previousBoards = [...boards];
    // Optimistic UI Update (Immediate)
    setBoards((prev) => prev.filter((b) => b.id !== sourceId));

    try {
      await boardsAPI.merge(sourceId, targetId);
      showSuccess('Merged');
      // If we are on the dashboard, we might want to refresh the target board's meta if needed,
      // but usually the board list is enough.
    } catch (err) {
      showToast(err.message, true);
      setBoards(previousBoards); // Rollback
    }
  }, [showConfirm, showSuccess, showToast, boards]);

  /* ── Prefetch board on hover ────────────────────────────── */
  const handlePrefetch = useCallback(async (boardId) => {
    const key = `pfetch_${boardId}`;
    const last = sessionStorage.getItem(key);
    if (last && Date.now() - Number(last) < 12000) return;

    try {
      const data = await boardsAPI.bundle(boardId);
      localStorage.setItem(`kb_board_${boardId}`, JSON.stringify(data.board));
      localStorage.setItem(`kb_tasks_${boardId}`, JSON.stringify(data.tasks));
      sessionStorage.setItem(key, Date.now());
    } catch { /* silent */ }
  }, []);

  const handleNavigate = useCallback((id) => {
    navigate(`/board/${id}`);
  }, [navigate]);

  const handleToggleMenu = useCallback((id) => {
    setOpenMenuId(prev => prev === id ? null : id);
    setOpenSubMenuId(null);
  }, []);

  const handleToggleSubMenu = useCallback((id) => {
    setOpenSubMenuId(prev => prev === id ? null : id);
  }, []);

  /* ── Listen for New Board events from Navbar ───────────── */
  useEffect(() => {
    const handleOpenModal = () => openCreateModal();
    window.addEventListener('open-create-board-modal', handleOpenModal);
    return () => window.removeEventListener('open-create-board-modal', handleOpenModal);
  }, [openCreateModal]);

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="dashboard-page animate-in">
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <h1 className="dashboard-title">My Boards</h1>
          <p className="dashboard-subtitle">Click a board to open it</p>
        </div>
        
        <div className="dashboard-header-right">
          <div className="search-container no-icon">
            <input
              type="text"
              className="search-input-field dashboard-search-long"
              placeholder="Search boards..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              id="board-search"
            />
          </div>
        </div>
      </header>

      {loading ? (
        <div className="boards-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div className="board-card skeleton-card" key={i}>
              <div className="skeleton-pulse" style={{ height: 24, width: '40%', borderRadius: 8, marginBottom: 16 }} />
              <div className="skeleton-pulse" style={{ height: 16, width: '90%', borderRadius: 6, marginBottom: 10 }} />
              <div className="skeleton-pulse" style={{ height: 16, width: '70%', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className="empty-state-container">
          <div className="empty-state-visual">⊞</div>
          <h2 className="empty-state-title">No Projects Found</h2>
          <p className="empty-state-text">
            {search
              ? `We couldn't find any projects matching "${search}".`
              : "You haven't created any projects yet. Start by creating a new board."}
          </p>
          {!search && (
            <button className="btn btn-outline" onClick={openCreateModal}>
              Create your first board
            </button>
          )}
        </div>
      ) : (
        <div className="dashboard-content">
          <div className="boards-grid">
            {boards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                allBoards={boards}
                isOpen={openMenuId === board.id}
                openSubMenuId={openSubMenuId}
                onNavigate={handleNavigate}
                onPrefetch={handlePrefetch}
                onToggleMenu={handleToggleMenu}
                onToggleSubMenu={handleToggleSubMenu}
                onEdit={openEditModal}
                onMerge={handleMergeBoard}
                onDelete={handleDeleteBoard}
              />
            ))}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      <BoardFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editingBoard}
        onSubmit={handleSaveBoard}
        loading={saving}
      />
    </div>
  );
}
