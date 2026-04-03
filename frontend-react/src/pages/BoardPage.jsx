import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { tasksAPI } from '../services/api';
import { useBoard } from '../hooks/useBoard';
import BoardFormModal from '../components/BoardFormModal';
import TaskFormModal from '../components/TaskFormModal';
import Column from '../components/Column';
import Spinner from '../components/Spinner';

const statusLabel = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');

export default function BoardPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { showToast, showSuccess } = useToast();

  /* ── Board Data & Logic (Hook) ──────────────────────────── */
  const {
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
    refresh
  } = useBoard(boardId);

  /* ── Local UI State ─────────────────────────────────────── */
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [boardModalOpen, setBoardModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeStatus, setActiveStatus] = useState('todo');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [openSubMenuId, setOpenSubMenuId] = useState(null);
  const [editingColumn, setEditingColumn] = useState(null);
  const [editingColumnName, setEditingColumnName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editedDesc, setEditedDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // Drag & Drop
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  /* Handle errors from hook */
  useEffect(() => {
    if (error && !board) navigate('/');
  }, [error, board, navigate]);

  /* Set document title */
  useEffect(() => {
    if (board?.name) document.title = `KanBoards — ${board.name}`;
  }, [board?.name]);

  /* Close menus on outside click or scroll */
  useEffect(() => {
    const close = () => { setOpenMenuId(null); setOpenSubMenuId(null); };
    window.addEventListener('click', close);
    const onScroll = () => { if (openMenuId) close(); };
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [openMenuId]);

  /* ── Task Handlers ──────────────────────────────────────── */
  const handleOpenNewTask = useCallback((colStatus) => {
    setEditingTask(null);
    setActiveStatus(colStatus || (board?.columns?.[0] || 'todo'));
    setTaskModalOpen(true);
  }, [board?.columns]);

  const handleOpenEditTask = useCallback((task, e) => {
    e?.stopPropagation();
    setOpenMenuId(null);
    setEditingTask(task);
    setTaskModalOpen(true);
  }, []);

  const handleSaveTask = async (data) => {
    setSaving(true);
    const isEdit = !!editingTask;
    setTaskModalOpen(false);

    try {
      const savedTask = isEdit
        ? await tasksAPI.update(editingTask.id, data)
        : await tasksAPI.create(boardId, data.title, data.description, data.status);
      
      showToast(isEdit ? 'Task updated' : 'Task added');
      updateTasksState(prev => isEdit ? prev.map(t => t.id === savedTask.id ? savedTask : t) : [savedTask, ...prev]);
    } catch (err) {
      showToast(err.message, true);
      setTaskModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const handleTransferTask = useCallback(async (task, targetBoardId, targetBoardName, e) => {
    e?.stopPropagation();
    setOpenMenuId(null);
    
    // Logic moved here for specific page behavior if needed, or could be in useBoard
    try {
      await tasksAPI.update(task.id, { board_id: targetBoardId });
      showSuccess('Moved');
      updateTasksState(prev => prev.filter(t => t.id !== task.id));
    } catch(err) {
      showToast(err.message, true);
      refresh();
    }
  }, [showSuccess, showToast, updateTasksState, refresh]);

  /* ── Board Handlers ─────────────────────────────────────── */
  const handleSaveBoardInfo = async (data) => {
    setSaving(true);
    setBoardModalOpen(false);
    try {
      await updateBoard(data);
      showToast('Board updated');
    } catch {
      setBoardModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const handleStartEditName = () => {
    setEditedName(board.name);
    setIsEditingName(true);
  };

  const handleNameSave = async () => {
    const trimmed = editedName.trim();
    if (!trimmed || trimmed === board.name) {
      setIsEditingName(false);
      return;
    }
    setIsEditingName(false);
    try {
      await updateBoard({ name: trimmed });
      showToast('Name updated');
    } catch (err) {
      showToast(err.message, true);
    }
  };

  const handleDescSave = async () => {
    const trimmed = editedDesc.trim();
    if (trimmed === (board.description || '')) {
      setIsEditingDesc(false);
      return;
    }
    setIsEditingDesc(false);
    try {
      await updateBoard({ description: trimmed || null });
      showToast('Description updated');
    } catch (err) {
      showToast(err.message, true);
    }
  };

  const handleAddColumn = async () => {
    const currentCols = board.columns || [];
    const newColName = `Untitled ${currentCols.length + 1}`.replace(/\s+/g, '-').toLowerCase();
    let finalSlug = newColName;
    let counter = 1;
    while (currentCols.includes(finalSlug)) finalSlug = `${newColName}-${counter++}`;

    try {
      await addColumn(finalSlug);
      showToast('Column added');
    } catch (err) {
      showToast(err.message, true);
    }
  };

  const commitColumnRename = async (oldStatus, newName) => {
    setEditingColumn(null);
    const trimmed = newName.trim();
    if (!trimmed || trimmed === statusLabel(oldStatus)) return;

    const newSlug = trimmed.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!newSlug) return;

    if (board.columns.includes(newSlug) && newSlug !== oldStatus) {
      showToast(`Column "${trimmed}" already exists`, true);
      return;
    }

    const updatedColumns = board.columns.map(s => s === oldStatus ? newSlug : s);
    try {
      await updateBoard({ columns: updatedColumns });
      showToast('Column renamed');
      refresh();
    } catch { /* handled in hook */ }
  };

  /* ── Drag and Drop ──────────────────────────────────────── */
  const onDragStart = useCallback((e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  }, []);

  const onDragOver = useCallback((e, status) => {
    e.preventDefault();
    setDragOverColumn(status);
  }, []);

  const onDrop = useCallback((e, status) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (draggedTaskId) {
      const task = tasks.find(t => String(t.id) === String(draggedTaskId));
      if (task) moveTask(task, status);
    }
    setDraggedTaskId(null);
  }, [draggedTaskId, tasks, moveTask]);

  /* ── Memoized Data ──────────────────────────────────────── */
  const tasksByStatus = useMemo(() => {
    const grouped = {};
    const cols = board?.columns || [];
    cols.forEach(c => grouped[c] = []);
    tasks.forEach(t => {
      const cat = cols.includes(t.status) ? t.status : cols[0] || 'todo';
      if (grouped[cat]) grouped[cat].push(t);
    });
    return grouped;
  }, [tasks, board?.columns]);

  if (loading && !board) return <div style={{ padding: 40 }}><Spinner /></div>;
  if (!board) return null;

  return (
    <div className="board-page animate-in" style={{ paddingTop: 0 }}>
      <header className="board-header">
        <div className="board-info">
          <div className="board-title-wrapper">
            {isEditingName ? (
              <input
                className="board-title-input"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSave();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                autoFocus
              />
            ) : (
              <h1 className="board-title-text" id="boardTitle" onClick={handleStartEditName}>{board.name}</h1>
            )}
            <button className="btn-round" onClick={handleStartEditName} title="Edit board name">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
          {isEditingName || isEditingDesc ? null : (
            <p 
              className="board-subtitle" 
              id="boardDesc" 
              onClick={() => { setEditedDesc(board.description || ''); setIsEditingDesc(true); }}
              style={{ cursor: 'pointer' }}
            >
              {board.description || 'No project description provided.'}
            </p>
          )}
          {isEditingDesc && (
            <input
              className="board-desc-input"
              value={editedDesc}
              onChange={(e) => setEditedDesc(e.target.value)}
              onBlur={handleDescSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDescSave();
                if (e.key === 'Escape') setIsEditingDesc(false);
              }}
              autoFocus
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid #ccc',
                padding: '4px 0',
                fontSize: '1rem',
                outline: 'none',
                marginTop: '8px'
              }}
            />
          )}
        </div>
        <div className="board-actions">
          {/* Action buttons could go here */}
        </div>
      </header>

      <div className="columns-outer-wrapper scroll-thin">
        <div className="columns-wrapper">
          {board.columns.map(colStatus => (
            <Column
              key={colStatus}
              status={colStatus}
              label={statusLabel(colStatus)}
              tasks={tasksByStatus[colStatus]}
              allBoards={allBoards}
              boardId={boardId}
              columns={board.columns}
              dragOver={dragOverColumn === colStatus}
              draggedTaskId={draggedTaskId}
              openMenuId={openMenuId}
              openSubMenuId={openSubMenuId}
              editingColumn={editingColumn}
              editingColumnName={editingColumnName}
              onDragOver={onDragOver}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={onDrop}
              onDragStart={onDragStart}
              onDragEnd={() => { setDraggedTaskId(null); setDragOverColumn(null); }}
              onEditColumn={(s, l) => { setEditingColumn(s); setEditingColumnName(l); }}
              onDeleteColumn={deleteColumn}
              onRenameChange={setEditingColumnName}
              onRenameBlur={commitColumnRename}
              onRenameKeyDown={(e, s, n) => e.key === 'Enter' ? commitColumnRename(s, n) : e.key === 'Escape' && setEditingColumn(null)}
              onAddTask={handleOpenNewTask}
              onEditTask={handleOpenEditTask}
              onToggleMenu={setOpenMenuId}
              onToggleSubMenu={setOpenSubMenuId}
              onMoveTask={moveTask}
              onTransferTask={handleTransferTask}
              onDeleteTask={deleteTask}
              statusLabel={statusLabel}
            />
          ))}

          <div className="add-column-wrapper">
            <button className="btn-add-column-fab" onClick={handleAddColumn} title="Add new column">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <TaskFormModal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onSubmit={handleSaveTask}
        initialData={editingTask}
        columns={board.columns}
        activeStatus={activeStatus}
        loading={saving}
        statusLabel={statusLabel}
      />

      <BoardFormModal
        isOpen={boardModalOpen}
        onClose={() => setBoardModalOpen(false)}
        initialData={board}
        onSubmit={handleSaveBoardInfo}
        loading={saving}
      />
    </div>
  );
}
