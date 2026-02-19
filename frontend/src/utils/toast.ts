import toast from 'react-hot-toast';

const defaultDuration = 3000;

/**
 * Reusable toast helpers for consistent success/error feedback across the app.
 * Use for auth, tasks, and any other user actions.
 */
export const showSuccess = (message: string, duration = defaultDuration) => {
  return toast.success(message, { duration });
};

export const showError = (message: string, duration = defaultDuration) => {
  return toast.error(message, { duration });
};

export { toast };
