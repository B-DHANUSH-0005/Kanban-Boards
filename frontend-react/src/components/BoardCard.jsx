import React from 'react';
import { formatDate } from '../constants/config';

const BoardCard = React.memo(({
  board,
  allBoards,
  isOpen,
  openSubMenuId,
  onNavigate,
  onPrefetch,
  onToggleMenu,
  onToggleSubMenu,
  onEdit,
  onMerge,
  onDelete
}) => {
  return (
    <article
      className="board-card"
      id={`board-${board.id}`}
      onClick={() => onNavigate(board.id)}
      onMouseEnter={() => onPrefetch(board.id)}
    >
      <div className="board-card-content">
        <div className="board-card-header">
          <h2 className="board-name">{board.name}</h2>
          <div className="menu-container" onClick={(e) => e.stopPropagation()}>
            <button
              className="menu-dots-btn btn-icon"
              onClick={(e) => {
                e.stopPropagation();
                onToggleMenu(board.id);
              }}
              aria-label="Board options"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1"/>
                <circle cx="12" cy="5" r="1"/>
                <circle cx="12" cy="19" r="1"/>
              </svg>
            </button>
            {isOpen && (
              <div className="dropdown-menu active" onClick={() => onToggleMenu(null)}>
                <div className="menu-content-wrapper" onClick={(e) => e.stopPropagation()}>
                  <div className="menu-header-mobile">Options</div>
                  <div className="menu-item" onClick={(e) => onEdit(board, e)}>
                    Edit
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </div>
                  <div
                    className="submenu-container"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSubMenu(`merge-${board.id}`);
                    }}
                  >
                    <div className="menu-item">
                      Merge into
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                    {openSubMenuId === `merge-${board.id}` && (
                      <div className="submenu show">
                        <div className="submenu-back" onClick={(e) => { e.stopPropagation(); onToggleSubMenu(null); }}>‹ Back</div>
                        {allBoards.filter((b) => b.id !== board.id).length === 0 ? (
                          <div className="menu-item disabled">No other boards</div>
                        ) : (
                          allBoards
                            .filter((b) => b.id !== board.id)
                            .map((target) => (
                              <div
                                key={target.id}
                                className="menu-item"
                                onClick={(e) => onMerge(board.id, target.id, target.name, e)}
                              >
                                {target.name}
                              </div>
                            ))
                        )}
                      </div>
                    )}
                  </div>
                  <div className="menu-divider" />
                  <div className="menu-item danger" onClick={(e) => onDelete(board, e)}>
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
        <p className="board-desc">{board.description || 'No description provided'}</p>
      </div>
      <div className="board-card-footer">
        <div className="board-divider" />
        <div className="board-footer-info">
          <span className="board-date">{formatDate(board.created_at)}</span>
        </div>
      </div>
    </article>
  );
});

export default BoardCard;
