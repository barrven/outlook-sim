import { useEffect, useState, type ReactElement } from 'react'
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

// A lightweight right-hand column (feature 046): every currently-flagged
// email (derived from MailMessage.isFlagged, not stored here) plus
// freestanding tasks with their own persisted store. Deliberately has no
// dependency on the active Mail folder or Calendar view (AC6) — it always
// lists every flagged message across all folders and every freestanding
// task, regardless of navigation elsewhere in the app.
function TasksPanel({ messagesVersion }: TasksPanelProps): ReactElement {
  const [flaggedMessages, setFlaggedMessages] = useState<MailMessage[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTaskText, setNewTaskText] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')

  function refreshTasks(): void {
    window.api.data.tasks.list().then(setTasks)
  }

  useEffect(() => {
    refreshTasks()
  }, [])

  useEffect(() => {
    window.api.data.messages.list().then((all) => setFlaggedMessages(all.filter((message) => message.isFlagged)))
  }, [messagesVersion])

  async function handleAddTask(): Promise<void> {
    const text = newTaskText.trim()
    if (!text) return
    await window.api.data.tasks.create({
      text,
      done: false,
      dueAt: newTaskDue ? new Date(newTaskDue).getTime() : null
    })
    setNewTaskText('')
    setNewTaskDue('')
    refreshTasks()
  }

  async function handleToggleDone(task: Task): Promise<void> {
    await window.api.data.tasks.update(task.id, { done: !task.done })
    refreshTasks()
  }

  async function handleRemoveTask(id: string): Promise<void> {
    await window.api.data.tasks.delete(id)
    refreshTasks()
  }

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
                {message.subject || '(no subject)'}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="tasks-panel-section">
        <h3 className="tasks-panel-heading">Tasks</h3>
        {/* Kept above the list (not below) so it stays in a fixed spot as
            the task count grows, rather than being pushed further down the
            panel on every add. */}
        <div className="tasks-panel-add-row">
          <input
            type="text"
            placeholder="Add a task…"
            aria-label="New task"
            value={newTaskText}
            onChange={(event) => setNewTaskText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleAddTask()
            }}
          />
          <input
            type="date"
            aria-label="Due date"
            value={newTaskDue}
            onChange={(event) => setNewTaskDue(event.target.value)}
          />
          <button type="button" onClick={handleAddTask} disabled={!newTaskText.trim()}>
            Add
          </button>
        </div>
        {tasks.length === 0 ? (
          <p className="tasks-panel-empty">No tasks yet.</p>
        ) : (
          <ul className="tasks-panel-list">
            {tasks.map((task) => (
              <li key={task.id} className={`tasks-panel-task${task.done ? ' done' : ''}`}>
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
                  className="tasks-panel-remove"
                  aria-label={`Remove "${task.text}"`}
                  onClick={() => handleRemoveTask(task.id)}
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default TasksPanel
