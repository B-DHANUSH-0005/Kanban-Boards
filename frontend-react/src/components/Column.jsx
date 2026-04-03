import { memo } from 'react';
import TaskCard from './TaskCard';

/**
 * Column — Individual Kanban column.
 * Optimized with React.memo to prevent unnecessary re-renders.
 */
function Column({
  status,
  label,
  tasks = [],
  allBoards = [],
  boardId,
  columns = [],
  dragOver = false,
  draggedTaskId = null,
  openMenuId = null,
  openSubMenuId = null,
  editingColumn = null,
  editingColumnName = '',
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
  onEditColumn,
  onDeleteColumn,
  onRenameChange,
  onRenameBlur,
  onRenameKeyDown,
  onAddTask,
  onEditTask,
  onToggleMenu,
  onToggleSubMenu,
  onMoveTask,
  onTransferTask,
  onDeleteTask,
  statusLabel
}) {
  return (
    <div
      className={`column ${dragOver ? 'drag-over' : ''} ${tasks.some(t => t.id === openMenuId) ? 'column-with-open-menu' : ''}`}
      onDragOver={(e) => onDragOver(e, status)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, status)}
    >
      <div className="column-header">
        <div className="column-header-left">
          <div className="column-header-title">
            {editingColumn === status ? (
              <input
                type="text"
                className="col-rename-input"
                value={editingColumnName}
                autoFocus
                onChange={e => onRenameChange(e.target.value)}
                onBlur={() => onRenameBlur(status, editingColumnName)}
                onKeyDown={e => onRenameKeyDown(e, status, editingColumnName)}
              />
            ) : (
              <span className="column-label">{label}</span>
            )}
          </div>
          <span className="task-count-badge">{tasks.length}</span>
        </div>
        <div className="column-header-actions">
          <button
            className="btn-icon"
            onClick={() => onEditColumn(status, label)}
            title="Edit column name"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button
            className="btn-icon danger"
            onClick={(e) => onDeleteColumn(status, e)}
            title="Remove column"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="task-list scroll-thin">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            columns={columns}
            allBoards={allBoards}
            boardId={boardId}
            isDragging={draggedTaskId === task.id}
            isOpen={openMenuId === task.id}
            openSubMenuId={openSubMenuId}
            statusLabel={statusLabel}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onEditTask={onEditTask}
            onToggleMenu={onToggleMenu}
            onToggleSubMenu={onToggleSubMenu}
            onMoveTask={onMoveTask}
            onTransferTask={onTransferTask}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </div>

      <div className="column-footer">
        <button className="btn-add-task-full" onClick={() => onAddTask(status)}>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>+</span>
          <span>Add Task</span>
        </button>
      </div>
    </div>
  );
}

export default memo(Column);
