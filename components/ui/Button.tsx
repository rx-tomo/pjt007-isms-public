'use client';

import React, { ButtonHTMLAttributes } from 'react';
import { useTranslations } from 'next-intl';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  ...props
}) => {
  const t = useTranslations('common');
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
    success: 'btn-success',
  };

  const sizes = {
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg',
  };

  const classes = [
    'btn',
    variants[variant],
    sizes[size],
    fullWidth && 'btn-full-width',
    isLoading && 'btn-loading',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <LoadingSpinner />
          <span className="btn-loading-text">{t('loading')}</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="btn-icon-left">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="btn-icon-right">{rightIcon}</span>}
        </>
      )}
      <style jsx>{`
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 500;
          border-radius: var(--radius-md);
          transition: all 200ms ease;
          cursor: pointer;
          border: 1px solid transparent;
          outline: none;
          position: relative;
          white-space: nowrap;
          text-decoration: none;
        }

        .btn:focus-visible {
          box-shadow: 0 0 0 3px rgba(37, 137, 255, 0.2);
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Sizes */
        .btn-sm {
          font-size: var(--font-size-sm);
          height: 32px;
          padding: 0 var(--spacing-3);
          gap: var(--spacing-1);
        }

        .btn-md {
          font-size: var(--font-size-sm);
          height: 40px;
          padding: 0 var(--spacing-4);
          gap: var(--spacing-2);
        }

        .btn-lg {
          font-size: var(--font-size-base);
          height: 48px;
          padding: 0 var(--spacing-6);
          gap: var(--spacing-2);
        }

        /* Variants */
        .btn-primary {
          background-color: var(--primary);
          color: var(--primary-foreground);
        }

        .btn-primary:hover:not(:disabled) {
          background-color: var(--btn-primary-hover);
        }

        .btn-primary:active:not(:disabled) {
          background-color: var(--color-primary-800);
        }

        .btn-secondary {
          background-color: var(--secondary);
          color: var(--secondary-foreground);
        }

        .btn-secondary:hover:not(:disabled) {
          background-color: var(--color-secondary-200);
        }

        .btn-secondary:active:not(:disabled) {
          background-color: var(--color-secondary-300);
        }

        .btn-outline {
          background-color: transparent;
          color: var(--foreground);
          border-color: var(--border-color);
        }

        .btn-outline:hover:not(:disabled) {
          background-color: var(--muted);
        }

        .btn-outline:active:not(:disabled) {
          background-color: var(--color-neutral-200);
        }

        .btn-ghost {
          background-color: transparent;
          color: var(--foreground);
        }

        .btn-ghost:hover:not(:disabled) {
          background-color: var(--muted);
        }

        .btn-ghost:active:not(:disabled) {
          background-color: var(--color-neutral-200);
        }

        .btn-danger {
          background-color: var(--destructive);
          color: var(--destructive-foreground);
        }

        .btn-danger:hover:not(:disabled) {
          background-color: var(--btn-danger-hover);
        }

        .btn-danger:active:not(:disabled) {
          background-color: var(--color-error-800);
        }

        .btn-success {
          background-color: var(--color-success-600);
          color: white;
        }

        .btn-success:hover:not(:disabled) {
          background-color: var(--btn-success-hover);
        }

        .btn-success:active:not(:disabled) {
          background-color: var(--color-success-800);
        }

        /* Full Width */
        .btn-full-width {
          width: 100%;
        }

        /* Loading State */
        .btn-loading {
          color: transparent;
        }

        .btn-loading-text {
          position: absolute;
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          color: var(--primary-foreground);
        }

        /* Icons */
        .btn-icon-left,
        .btn-icon-right {
          display: flex;
          align-items: center;
        }

        /* Dark mode adjustments */
        @media (prefers-color-scheme: dark) {
          .btn-outline:hover:not(:disabled) {
            background-color: var(--color-neutral-800);
          }

          .btn-outline:active:not(:disabled) {
            background-color: var(--btn-neutral-active);
          }

          .btn-ghost:hover:not(:disabled) {
            background-color: var(--color-neutral-800);
          }

          .btn-ghost:active:not(:disabled) {
            background-color: var(--btn-neutral-active);
          }
        }
      `}</style>
    </button>
  );
};

const LoadingSpinner: React.FC = () => {
  return (
    <svg
      className="loading-spinner"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <path
        d="M14 8a6 6 0 01-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <style jsx>{`
        .loading-spinner {
          animation: spin 1s linear infinite;
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
        }

        @keyframes spin {
          from {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }
      `}</style>
    </svg>
  );
};

// Button Group Component
interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`button-group ${className}`}>
      {children}
      <style jsx>{`
        .button-group {
          display: inline-flex;
          gap: var(--spacing-2);
        }

        .button-group > :global(.btn) {
          margin: 0;
        }
      `}</style>
    </div>
  );
};

// Icon Button Component
interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: React.ReactNode;
  label: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  size = 'md',
  ...props
}) => {
  const iconSizes = {
    sm: 'icon-btn-sm',
    md: 'icon-btn-md',
    lg: 'icon-btn-lg',
  };

  return (
    <Button
      {...props}
      size={size}
      className={`icon-btn ${iconSizes[size]} ${props.className || ''}`}
      aria-label={label}
    >
      {icon}
      <style jsx global>{`
        .icon-btn {
          padding: 0 !important;
          aspect-ratio: 1;
        }

        .icon-btn-sm {
          width: 32px;
        }

        .icon-btn-md {
          width: 40px;
        }

        .icon-btn-lg {
          width: 48px;
        }
      `}</style>
    </Button>
  );
};