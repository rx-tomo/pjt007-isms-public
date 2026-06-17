import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  rounded?: boolean;
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  rounded = false,
  dot = false,
  className = '',
}) => {
  const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
    default: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
    primary: 'bg-primary-50 text-primary-700',
    secondary: 'bg-secondary-50 text-[var(--color-neutral-700)]',
    success: 'bg-[var(--color-success-50)] text-[var(--color-success-700)]',
    warning: 'bg-[var(--color-warning-50)] text-[var(--color-warning-700)]',
    danger: 'bg-[var(--color-error-50)] text-[var(--color-error-700)]',
    info: 'bg-secondary-100 text-secondary-700',
  };

  const sizes = {
    sm: 'text-xs px-2 py-1 gap-1',
    md: 'text-sm px-3 py-0.5 gap-1',
    lg: 'text-base px-4 py-2 gap-2',
  };

  const classes = [
    'inline-flex items-center font-medium transition-all duration-200 whitespace-nowrap',
    rounded ? 'rounded-full' : 'rounded-md',
    variantClasses[variant],
    sizes[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
};

// Status Badge Component
interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'approved' | 'rejected' | 'draft' | 'published';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const statusConfig = {
    active: { variant: 'success' as const, label: 'Active' },
    inactive: { variant: 'default' as const, label: 'Inactive' },
    pending: { variant: 'warning' as const, label: 'Pending' },
    approved: { variant: 'success' as const, label: 'Approved' },
    rejected: { variant: 'danger' as const, label: 'Rejected' },
    draft: { variant: 'secondary' as const, label: 'Draft' },
    published: { variant: 'primary' as const, label: 'Published' },
  };

  const config = statusConfig[status];

  return (
    <Badge
      variant={config.variant}
      size={size}
      dot
      className={className}
    >
      {config.label}
    </Badge>
  );
};

// Count Badge Component
interface CountBadgeProps {
  count: number;
  max?: number;
  variant?: BadgeProps['variant'];
  size?: BadgeProps['size'];
  className?: string;
}

export const CountBadge: React.FC<CountBadgeProps> = ({
  count,
  max = 99,
  variant = 'primary',
  size = 'sm',
  className = '',
}) => {
  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <Badge
      variant={variant}
      size={size}
      rounded
      className={`min-w-[20px] justify-center ${className}`}
    >
      {displayCount}
    </Badge>
  );
};

// Badge Group Component
interface BadgeGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const BadgeGroup: React.FC<BadgeGroupProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`inline-flex flex-wrap gap-2 ${className}`}>
      {children}
    </div>
  );
};
