import React, { CSSProperties, KeyboardEvent } from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'bordered' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
}

const INTERACTIVE_TAGS = new Set(['INPUT', 'BUTTON', 'A', 'TEXTAREA', 'SELECT']);

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  onClick,
}) => {
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10',
  };

  const variantStyles: Record<NonNullable<CardProps['variant']>, CSSProperties> = {
    default: { boxShadow: 'var(--shadow-sm)' },
    bordered: { border: `1px solid var(--border-color)` },
    elevated: { boxShadow: 'var(--shadow-lg)' },
  };

  const classes = [
    'transition-all duration-200',
    paddings[padding],
    onClick && 'cursor-pointer hover:-translate-y-0.5',
    onClick && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-500)] focus-visible:ring-offset-2',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const style: CSSProperties = {
    backgroundColor: 'var(--card-background)',
    color: 'var(--foreground)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid transparent',
    ...variantStyles[variant],
  };

  const handleKeyDown = onClick
    ? (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter') {
          onClick();
        } else if (e.key === ' ') {
          const target = e.target as HTMLElement;
          if (!INTERACTIVE_TAGS.has(target.tagName)) {
            e.preventDefault();
            onClick();
          }
        }
      }
    : undefined;

  return (
    <div
      className={classes}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={style}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  className = '',
  actions,
}) => {
  return (
    <div
      className={`flex items-center justify-between pb-4 border-b mb-4 ${className}`}
      style={{ borderColor: 'var(--border-color)' }}
    >
      <div className="flex-1">{children}</div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
};

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export const CardTitle: React.FC<CardTitleProps> = ({
  children,
  className = '',
  as: Component = 'h3',
}) => {
  return (
    <Component
      className={`text-xl font-semibold ${className}`}
      style={{ color: 'var(--foreground)' }}
    >
      {children}
    </Component>
  );
};

interface CardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export const CardDescription: React.FC<CardDescriptionProps> = ({
  children,
  className = '',
}) => {
  return (
    <p
      className={`text-sm mt-2 ${className}`}
      style={{ color: 'var(--muted-foreground)' }}
    >
      {children}
    </p>
  );
};

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CardContent: React.FC<CardContentProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`text-base leading-relaxed ${className}`} style={{ color: 'var(--foreground)' }}>
      {children}
    </div>
  );
};

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center justify-end gap-3 pt-4 border-t mt-4 ${className}`}
      style={{ borderColor: 'var(--border-color)' }}
    >
      {children}
    </div>
  );
};
