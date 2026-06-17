import { useTranslations } from 'next-intl';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorMessage({ message, onRetry, retryLabel }: ErrorMessageProps): React.ReactElement {
  const t = useTranslations('common');
  const label = retryLabel ?? t('retry');

  return (
    <div role="alert" className="border border-red-200 bg-red-50 text-red-700 rounded-lg p-4 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-100 rounded transition-colors dark:text-red-200 dark:hover:bg-red-900"
        >
          {label}
        </button>
      )}
    </div>
  );
}

export default ErrorMessage;
