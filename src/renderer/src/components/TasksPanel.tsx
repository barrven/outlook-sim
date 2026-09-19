import { Fragment, useEffect, useState, type ReactElement } from 'react'
import type { MailMessage, Task } from '../../../shared/data-types'

interface TasksPanelProps {
  // Bumped by App.tsx on every `data:messages-changed` broadcast — the same
  // signal MessageListPane/ReadingPane already refetch on, so a flag
  // toggled anywhere else in the app (ribbon, context menu, Reading Pane)
  // updates the flagged-mail list here too (AC2).
  messagesVersion: number
}

function formatDue(dueAt: number): string {
  return new Date(dueAt).toLocaleDateString()
}

// `handleSaveTask` below writes a due date via `new Date(value).getTime()`,
// which parses a plain "YYYY-MM-DD" `<input type="date">` value as UTC
// midnight (pre-existing behavior from feature 046, left unchanged per
// AC7 — a real UTC-vs-local fix is out of this feature's scope). Reading a
// stored `dueAt` back into the edit form's date input has to invert that
// same parse — using local getters here instead would silently shift the
// displayed date by a day in most timezones the moment you open Edit,
// even without touching the date.
function dueAtToDateInputValue(dueAt: number): string {
  const date = new Date(dueAt)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// A lightweight right-hand column (feature 046): every currently-flagged
// email (derived from MailMessage.isFlagged, not stored here) plus
// freestanding tasks with their own persisted store. Deliberately has no
// dependency on the active Mail folder or Calendar view (AC6) — it always
// lists every flagged message across all folders and every freestanding
// task, regardless of navigation elsewhere in the app.
function TasksPanel({ messagesVersion }: TasksPanelProps): ReactElement {
  const [flaggedMessages, setFlaggedMessages] = useState<MailMessage[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  // The add/edit form is shared between creating a new task and editing an
  // existing one (feature 057) — `editingTaskId` distinguishes which,
  // mirroring `PersonasSettings.tsx`'s `creating`/`editingId` pattern.
  const [creating, setCreating] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [taskFormText, setTaskFormText] = useState('')
  const [taskFormDue, setTaskFormDue] = useState('')

  function refreshTasks(): void {
    window.api.data.tasks.list().then(setTasks)
  }

  useEffect(() => {
    refreshTasks()
  }, [])

  useEffect(() => {
    window.api.data.messages.list().then((all) => setFlaggedMessages(all.filter((message) => message.isFlagged)))
  }, [messagesVersion])

  function openCreateTask(): void {
    setTaskFormText('')
    setTaskFormDue('')
    setCreating(true)
    setEditingTaskId(null)
  }

  function openEditTask(task: Task): void {
    setTaskFormText(task.text)
    setTaskFormDue(task.dueAt !== null ? dueAtToDateInputValue(task.dueAt) : '')
    setEditingTaskId(task.id)
    setCreating(false)
  }

  function closeTaskForm(): void {
    setCreating(false)
    setEditingTaskId(null)
  }

  async function handleSaveTask(): Promise<void> {
    const text = taskFormText.trim()
    if (!text) return
    const dueAt = taskFormDue ? new Date(taskFormDue).getTime() : null
    if (editingTaskId) {
      await window.api.data.tasks.update(editingTaskId, { text, dueAt })
    } else {
      await window.api.data.tasks.create({ text, done: false, dueAt })
    }
    closeTaskForm()
    refreshTasks()
  }

  async function handleToggleDone(task: Task): Promise<void> {
    await window.api.data.tasks.update(task.id, { done: !task.done })
    refreshTasks()
  }

  async function handleRemoveTask(id: string): Promise<void> {
    await window.api.data.tasks.delete(id)
    if (editingTaskId === id) closeTaskForm()
    refreshTasks()
  }

  // AC2: no local refetch needed here — the same `db:messages:update`
  // broadcast every other flag toggle in the app already relies on
  // (MessageListPane, ReadingPane, ribbon) bumps `messagesVersion` in
  // App.tsx, which this component's own effect above is already keyed on.
  function handleUnflagMessage(message: MailMessage): void {
    window.api.data.messages.update(message.id, { isFlagged: false })
  }

  const isTaskFormOpen = creating || editingTaskId !== null

  // AC6: undated tasks first (newest-created first among themselves), then
  // dated tasks ascending by due date. A new array — the underlying
  // `tasks` state (and its create-order) stays untouched.
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.dueAt === null && b.dueAt === null) return b.createdAt - a.createdAt
    if (a.dueAt === null) return -1
    if (b.dueAt === null) return 1
    return a.dueAt - b.dueAt
  })

  // Shared between the two placements this form can appear in — below the
  // header when creating, or inline under a specific task when editing
  // (feature 057) — same `editorForm`-as-a-variable technique feature 050
  // used for the Persona editor, so its inputs keep normal DOM identity
  // wherever it's rendered.
  const taskForm = (
    <div className="tasks-panel-form">
      <input
        type="text"
        placeholder="Add a task…"
        aria-label={editingTaskId ? 'Edit task text' : 'New task'}
        value={taskFormText}
        onChange={(event) => setTaskFormText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') handleSaveTask()
        }}
      />
      <input
        type="date"
        aria-label="Due date"
        value={taskFormDue}
        onChange={(event) => setTaskFormDue(event.target.value)}
      />
      <div className="tasks-panel-form-actions">
        <button type="button" onClick={handleSaveTask} disabled={!taskFormText.trim()}>
          {editingTaskId ? 'Save' : 'Add'}
        </button>
        <button type="button" onClick={closeTaskForm}>
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <div className="tasks-panel">
      <div className="tasks-panel-section">
        <h3 className="tasks-panel-heading">Flagged Mail</h3>
        {flaggedMessages.length === 0 ? (
          <p className="tasks-panel-empty">No flagged messages.</p>
        ) : (
          <ul className="tasks-panel-list">
            {flaggedMessages.map((message) => (
              <li key={message.id} className="tasks-panel-flagged-item">
                <button
                  type="button"
                  className="tasks-panel-flagged-subject"
                  onDoubleClick={() => window.api.messagePopout.open(message.id)}
                >
                  {message.subject || '(no subject)'}
                </button>
                <button
                  type="button"
                  className="tasks-panel-flagged-unflag"
                  aria-label={`Unflag "${message.subject || '(no subject)'}"`}
                  onClick={() => handleUnflagMessage(message)}
                >
                  ⚑
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="tasks-panel-section">
        <div className="tasks-panel-section-header">
          <h3 className="tasks-panel-heading">Tasks</h3>
          {!isTaskFormOpen && (
            <button type="button" className="tasks-panel-add-btn" onClick={openCreateTask}>
              Add
            </button>
          )}
        </div>
        {creating && taskForm}
        {sortedTasks.length === 0 ? (
          !isTaskFormOpen && <p className="tasks-panel-empty">No tasks yet.</p>
        ) : (
          <ul className="tasks-panel-list">
            {sortedTasks.map((task) => (
              <Fragment key={task.id}>
                <li className={`tasks-panel-task${task.done ? ' done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={task.done}
                    aria-label={`Mark "${task.text}" ${task.done ? 'incomplete' : 'complete'}`}
                    onChange={() => handleToggleDone(task)}
                  />
                  <span className="tasks-panel-task-text">{task.text}</span>
                  {task.dueAt !== null && <span className="tasks-panel-task-due">{formatDue(task.dueAt)}</span>}
                  <button
                    type="button"
                    className="tasks-panel-edit"
                    aria-label={`Edit "${task.text}"`}
                    onClick={() => openEditTask(task)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="tasks-panel-remove"
                    aria-label={`Remove "${task.text}"`}
                    onClick={() => handleRemoveTask(task.id)}
                  >
                    &times;
                  </button>
                </li>
                {editingTaskId === task.id && <li className="tasks-panel-form-row">{taskForm}</li>}
              </Fragment>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default TasksPanel
