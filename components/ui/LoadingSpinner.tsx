'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  const t = useTranslations('common');
  const sizeMap = {
    sm: { width: 16, height: 16 },
    md: { width: 32, height: 32 },
    lg: { width: 48, height: 48 },
  };

  const { width, height } = sizeMap[size];

  return (
    <svg
      className="loading-spinner"
      width={width}
      height={height}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="status"
      aria-label={t('loading')}
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
          color: var(--primary);
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </svg>
  );
}
