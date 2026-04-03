import { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';
import { VALIDATION, validateField } from '../constants/config';

/**
 * TaskFormModal — for adding and editing tasks.
 */
export default function TaskFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  columns = [],
  activeStatus = 'todo',
  loading = false,
  statusLabel = (s) => s
}) {
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskStatus, setTaskStatus] = useState('todo');
  const [taskErrors, setTaskErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTaskTitle(initialData.title || '');
        setTaskDesc(initialData.description || '');
        setTaskStatus(initialData.status || 'todo');
      } else {
        setTaskTitle('');
        setTaskDesc('');
        setTaskStatus(activeStatus);
      }
      setTaskErrors({});
    }
  }, [isOpen, initialData, activeStatus]);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    if (loading) return;

    const errors = {};
    const tErr = validateField(VALIDATION.TASK_TITLE, taskTitle);
    const dErr = validateField(VALIDATION.TASK_DESC, taskDesc);
    if (tErr) errors.title = tErr;
    if (dErr) errors.desc = dErr;

    setTaskErrors(errors);
    if (Object.keys(errors).length > 0) return;

    await onSubmit({
      title: taskTitle.trim(),
      description: taskDesc.trim() || null,
      status: taskStatus,
    });
  }, [taskTitle, taskDesc, taskStatus, loading, onSubmit]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Task' : `Add to ${statusLabel(activeStatus)}`}
      footer={
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving…' : initialData ? 'Save Changes' : 'Add Task'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="task-title">Title</label>
          <input
            id="task-title"
            type="text"
            className={`input ${taskErrors.title ? 'input-error' : ''}`}
            value={taskTitle}
            onChange={e => { setTaskTitle(e.target.value); if(taskErrors.title) setTaskErrors(f=>({...f, title: ''})); }}
            autoFocus
            maxLength={VALIDATION.TASK_TITLE.maxLength}
          />
          {taskErrors.title && <span className="field-error">{taskErrors.title}</span>}
        </div>
        <div className="form-group">
          <label htmlFor="task-desc">Description (optional)</label>
          <textarea
            id="task-desc"
            className={`input textarea ${taskErrors.desc ? 'input-error' : ''}`}
            value={taskDesc}
            onChange={e => { setTaskDesc(e.target.value); if(taskErrors.desc) setTaskErrors(f=>({...f, desc: ''})); }}
            rows={3}
            maxLength={VALIDATION.TASK_DESC.maxLength}
          />
          {taskErrors.desc && <span className="field-error">{taskErrors.desc}</span>}
        </div>

        {initialData && (
          <div className="form-group">
            <label htmlFor="task-status">Status</label>
            <select
              id="task-status"
              className="input select-input"
              value={taskStatus}
              onChange={e => setTaskStatus(e.target.value)}
            >
              {columns.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </div>
        )}
      </form>
    </Modal>
  );
}
