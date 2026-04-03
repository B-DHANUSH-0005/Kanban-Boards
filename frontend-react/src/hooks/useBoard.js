import { useState, useEffect, useCallback, useRef } from 'react';
import { boardsAPI, tasksAPI } from '../services/api';
import { POLL_INTERVALS } from '../constants/config';
import { useToast } from '../contexts/ToastContext';

/**
 * useBoard — Encapsulates board fetching, polling and CRUD logic.
 * Enhanced with full optimistic UI updates for "fast and smooth" performance.
 */
export function useBoard(boardId) {
  const { showToast, showSuccess, showConfirm } = useToast();
  const [board, setBoard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [allBoards, setAllBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pullerRef = useRef(null);

  const fetchBundle = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await boardsAPI.bundle(boardId);
      setBoard(data.board);
      setTasks(data.tasks);
      setAllBoards(data.all_boards);

      // Cache data
      localStorage.setItem(`kb_board_${boardId}`, JSON.stringify(data.board));
      localStorage.setItem(`kb_tasks_${boardId}`, JSON.stringify(data.tasks));
      setError(null);
    } catch (err) {
      console.warn('[useBoard] fetchBundle failed:', err);
      setError(err.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [boardId]);

  // Initial load from cache then fetch
  useEffect(() => {
    try {
      const cachedBoard = localStorage.getItem(`kb_board_${boardId}`);
      const cachedTasks = localStorage.getItem(`kb_tasks_${boardId}`);
      if (cachedBoard) setBoard(JSON.parse(cachedBoard));
      if (cachedTasks) setTasks(JSON.parse(cachedTasks));
      if (cachedBoard && cachedTasks) setLoading(false);
    } catch { /* ignore cache error */ }

    fetchBundle();
  }, [boardId, fetchBundle]);

  // Poller logic
  useEffect(() => {
    const start = () => {
      clearInterval(pullerRef.current);
      pullerRef.current = setInterval(() => {
        if (!document.hidden) fetchBundle(true);
      }, POLL_INTERVALS.BOARD);
    };
    start();
    const onVis = () => {
      if (!document.hidden) {
        fetchBundle(true);
        start();
      } else {
        clearInterval(pullerRef.current);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(pullerRef.current);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [fetchBundle]);

  /* ── Board Actions ──────────────────────────────────────── */
  const updateBoard = async (data) => {
    const previousBoard = { ...board };
    // Optimistic update
    setBoard(prev => ({ ...prev, ...data }));
    try {
      const updated = await boardsAPI.update(boardId, data);
      setBoard(updated);
      localStorage.setItem(`kb_board_${boardId}`, JSON.stringify(updated));
      return updated;
    } catch (err) {
      setBoard(previousBoard);
      showToast(err.message, true);
      throw err;
    }
  };

  const addColumn = async (name) => {
    const currentCols = board.columns || [];
    const updatedColumns = [...currentCols, name];
    return updateBoard({ columns: updatedColumns });
  };

  const deleteColumn = async (status) => {
    const confirmed = await showConfirm(
      'Delete column?',
      `All tasks in "${status}" will be deleted.`
    );
    if (!confirmed) return;

    const updatedColumns = board.columns.filter(s => s !== status);
    const updatedDeleted = [...(board.deleted_columns || []), status];
    return updateBoard({ columns: updatedColumns, deleted_columns: updatedDeleted });
  };

  /* ── Task Actions ───────────────────────────────────────── */
  const updateTasksState = useCallback((updater) => {
    setTasks(prev => {
      const newTasks = typeof updater === 'function' ? updater(prev) : updater;
      localStorage.setItem(`kb_tasks_${boardId}`, JSON.stringify(newTasks));
      return newTasks;
    });
  }, [boardId]);

  const moveTask = async (task, newStatus) => {
    if (task.status === newStatus) return;
    const oldStatus = task.status;
    
    // Optimistic UI Update (Immediate)
    updateTasksState(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    
    try {
      await tasksAPI.move(task.id, newStatus);
    } catch (err) {
      // Revert on failure
      showToast(err.message, true);
      updateTasksState(prev => prev.map(t => t.id === task.id ? { ...t, status: oldStatus } : t));
    }
  };

  const deleteTask = async (taskId) => {
    const ok = await showConfirm('Delete task?', 'This action cannot be undone.');
    if (!ok) return;

    const previousTasks = [...tasks];
    // Optimistic UI Update (Immediate)
    updateTasksState(prev => prev.filter(t => t.id !== taskId));
    
    try {
      await tasksAPI.delete(taskId);
      showSuccess('Deleted');
    } catch (err) {
      // Revert on failure
      showToast(err.message, true);
      updateTasksState(previousTasks);
    }
  };

  return {
    board,
    tasks,
    allBoards,
    loading,
    error,
    updateBoard,
    addColumn,
    deleteColumn,
    moveTask,
    deleteTask,
    updateTasksState,
    refresh: fetchBundle
  };
}
