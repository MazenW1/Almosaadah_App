import { useState, useCallback } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface UseToastReturn {
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error') => void;
  removeToast: (id: string) => void;
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
}

// Toast Container Component
interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="toast-container" role="region" aria-live="polite" aria-label="إشعارات">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast ${toast.type}`}
          role="alert"
          aria-live="polite"
          onClick={() => onRemove(toast.id)}
        >
          <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} />
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
