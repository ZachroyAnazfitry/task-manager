import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '../components/AppHeader';
import { TaskModal } from '../components/TaskModal';
import * as tasksApi from '../api/tasks';
import { getErrorMessage } from '../api/client';
import { showSuccess, showError } from '../utils/toast';
import type { Task, TaskFormData, TaskStatus } from '../types';

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'todo':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'in_progress':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'done':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'low':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'medium':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'high':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [modalTask, setModalTask] = useState<Task | null | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<Task | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await tasksApi.fetchTasks({
        page,
        per_page: 15,
        ...(statusFilter && { status: statusFilter }),
        ...(priorityFilter && { priority: priorityFilter }),
      });
      setTasks(res.data);
      setLastPage(res.last_page);
      setTotal(res.total);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, priorityFilter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function handleCreate(data: TaskFormData) {
    try {
      await tasksApi.createTask(data);
      showSuccess('Task created.');
      loadTasks();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  }

  async function handleUpdate(data: TaskFormData) {
    if (!modalTask) return;
    try {
      await tasksApi.updateTask(modalTask.id, data);
      showSuccess('Task updated.');
      setModalTask(undefined);
      loadTasks();
    } catch (err) {
      showError(getErrorMessage(err));
    }
  }

  async function handleDelete(t: Task) {
    try {
      await tasksApi.deleteTask(t.id);
      showSuccess('Task deleted.');
      setDeleteConfirm(null);
      loadTasks();
    } catch (err) {
      setError(getErrorMessage(err));
      showError(getErrorMessage(err));
    }
  }

  async function markDone(t: Task) {
    try {
      await tasksApi.updateTask(t.id, { status: 'done' as TaskStatus });
      showSuccess('Task marked as done.');
      loadTasks();
    } catch (err) {
      setError(getErrorMessage(err));
      showError(getErrorMessage(err));
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/50">
      <AppHeader />

      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">My tasks</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Filter, create, and manage your tasks.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100" role="alert">
            {error}
          </div>
        )}

        {/* Filters + New task */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="todo">Todo</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
            aria-label="Filter by priority"
          >
            <option value="">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button
            onClick={() => setModalTask(null)}
            className="ml-auto px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium shadow-sm transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New task
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 animate-pulse"
                aria-hidden
              >
                <div className="h-5 bg-slate-200 rounded w-2/3 mb-2" />
                <div className="h-4 bg-slate-100 rounded w-1/2" />
                <div className="flex gap-2 mt-3">
                  <div className="h-6 bg-slate-100 rounded w-16" />
                  <div className="h-6 bg-slate-100 rounded w-14" />
                </div>
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-sm p-10 sm:p-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 mb-4" aria-hidden>
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-1">No tasks yet</h2>
            <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
              Create your first task to get started and keep track of what matters.
            </p>
            <button
              onClick={() => setModalTask(null)}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium transition-colors"
            >
              Create task
            </button>
          </div>
        ) : (
          <ul className="space-y-3" role="list">
            {tasks.map((t) => (
              <li
                key={t.id}
                className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`font-semibold ${t.status === 'done' ? 'line-through text-slate-500' : 'text-slate-800'}`}
                      >
                        {t.title}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-lg border ${statusBadgeClass(t.status)}`}
                      >
                        {t.status.replace('_', ' ')}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-lg border ${priorityBadgeClass(t.priority)}`}
                      >
                        {t.priority}
                      </span>
                      {t.due_date && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Due {new Date(t.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-sm text-slate-600 mt-1 line-clamp-2">{t.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {t.status !== 'done' && (
                      <button
                        onClick={() => markDone(t)}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        Mark done
                      </button>
                    )}
                    <button
                      onClick={() => setModalTask(t)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(t)}
                      className="text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {lastPage > 1 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600">
              Page {page} of {lastPage} <span className="text-slate-400">·</span> {total} total
            </span>
            <button
              disabled={page >= lastPage}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </main>

      {modalTask !== undefined && (
        <TaskModal
          task={modalTask}
          onClose={() => setModalTask(undefined)}
          onSubmit={modalTask ? handleUpdate : handleCreate}
        />
      )}

      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setDeleteConfirm(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full border border-slate-200/80"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0" aria-hidden>
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h2 id="delete-dialog-title" className="text-lg font-semibold text-slate-800">
                  Delete task?
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  &ldquo;{deleteConfirm.title}&rdquo; will be removed. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
