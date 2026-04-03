import { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';
import { VALIDATION, validateField } from '../constants/config';

/**
 * BoardFormModal — Reusable for creating and editing boards.
 */
export default function BoardFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  loading = false,
}) {
  const [boardName, setBoardName] = useState('');
  const [boardDesc, setBoardDesc] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setBoardName(initialData?.name || '');
      setBoardDesc(initialData?.description || '');
      setFieldErrors({});
    }
  }, [isOpen, initialData]);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    if (loading) return;

    const errors = {};
    const nameErr = validateField(VALIDATION.BOARD_NAME, boardName);
    const descErr = validateField(VALIDATION.BOARD_DESC, boardDesc);
    if (nameErr) errors.name = nameErr;
    if (descErr) errors.desc = descErr;

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    await onSubmit({
      name: boardName.trim(),
      description: boardDesc.trim() || null,
    });
  }, [boardName, boardDesc, loading, onSubmit]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Board' : 'New Board'}
      footer={
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
            type="button"
          >
            {loading ? 'Saving…' : initialData ? 'Save Changes' : 'Create Board'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="board-name">Board Name</label>
          <input
            id="board-name"
            type="text"
            className={`input ${fieldErrors.name ? 'input-error' : ''}`}
            value={boardName}
            onChange={(e) => {
              setBoardName(e.target.value);
              if (fieldErrors.name) setFieldErrors((f) => ({ ...f, name: '' }));
            }}
            placeholder="My Project"
            maxLength={VALIDATION.BOARD_NAME.maxLength}
            autoFocus
          />
          {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
        </div>
        <div className="form-group">
          <label htmlFor="board-desc">Description (optional)</label>
          <textarea
            id="board-desc"
            className={`input textarea ${fieldErrors.desc ? 'input-error' : ''}`}
            value={boardDesc}
            onChange={(e) => {
              setBoardDesc(e.target.value);
              if (fieldErrors.desc) setFieldErrors((f) => ({ ...f, desc: '' }));
            }}
            placeholder="What is this board for?"
            maxLength={VALIDATION.BOARD_DESC.maxLength}
            rows={3}
          />
          {fieldErrors.desc && <span className="field-error">{fieldErrors.desc}</span>}
        </div>
      </form>
    </Modal>
  );
}
