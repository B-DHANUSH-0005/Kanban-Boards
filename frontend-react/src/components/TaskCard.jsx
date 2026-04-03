import React from 'react';

const TaskCard = React.memo(({
  task,
  columns,
  allBoards,
  boardId,
  isDragging,
  isOpen,
  openSubMenuId,
  statusLabel,
  onDragStart,
  onDragEnd,
  onEditTask,
  onToggleMenu,
  onToggleSubMenu,
  onMoveTask,
  onTransferTask,
  onDeleteTask
}) => {
  return (
    <article
      className={`task-card ${isDragging ? 'dragging' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        if (!e.target.closest('.task-menu-container')) {
          onEditTask(task);
        }
      }}
    >
      <div className="task-card-header">
        <h3 className="task-card-title">{task.title}</h3>
        <div className="task-menu-container">
          <button 
            className="menu-dots-btn btn-icon" 
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu(task.id);
            }}
            aria-label="Task options"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1.5"/>
              <circle cx="12" cy="5" r="1.5"/>
              <circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>
          
          {isOpen && (
            <div className="dropdown-menu active" onClick={() => onToggleMenu(null)}>
              <div className="menu-content-wrapper" onClick={(e) => e.stopPropagation()}>
                <div className="menu-header-mobile">Task Options</div>
                <div className="menu-item" onClick={(e) => onEditTask(task, e)}>
                  Edit
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </div>
                
                <div className="submenu-container" onClick={(e) => { e.stopPropagation(); onToggleSubMenu(`move-${task.id}`); }}>
                  <div className="menu-item">
                    Move to
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                  {openSubMenuId === `move-${task.id}` && (
                    <div className="submenu show">
                      <div className="submenu-back" onClick={(e) => { e.stopPropagation(); onToggleSubMenu(null); }}>‹ Back</div>
                      {columns.filter(s => s !== task.status).map(s => (
                        <div key={s} className="menu-item" onClick={(e) => onMoveTask(task, s, e)}>{statusLabel(s)}</div>
                      ))}
                      {columns.length <= 1 && <div className="menu-item disabled">No other columns</div>}
                    </div>
                  )}
                </div>
                
                <div className="submenu-container" onClick={(e) => { e.stopPropagation(); onToggleSubMenu(`transfer-${task.id}`); }}>
                  <div className="menu-item">
                    Transfer
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                  {openSubMenuId === `transfer-${task.id}` && (
                    <div className="submenu show">
                      <div className="submenu-back" onClick={(e) => { e.stopPropagation(); onToggleSubMenu(null); }}>‹ Back</div>
                      {allBoards.filter(b => b.id !== Number(boardId)).map(b => (
                        <div key={b.id} className="menu-item" onClick={(e) => onTransferTask(task, b.id, b.name, e)}>{b.name}</div>
                      ))}
                      {allBoards.length <= 1 && <div className="menu-item disabled">No other boards</div>}
                    </div>
                  )}
                </div>
                
                <div className="menu-divider"></div>
                <div className="menu-item danger" onClick={(e) => onDeleteTask(task, e)}>
                  Delete
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {task.description && <div className="task-card-desc" style={{ marginTop: 8 }}>{task.description}</div>}
    </article>
  );
});

export default TaskCard;
