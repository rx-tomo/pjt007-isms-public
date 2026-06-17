import React, { CSSProperties } from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'bordered' | 'striped';
  size?: 'sm' | 'md' | 'lg';
  responsive?: boolean;
  ariaLabel?: string;
}

export const Table: React.FC<TableProps> = ({
  children,
  className = '',
  variant = 'default',
  size = 'md',
  responsive = true,
  ariaLabel,
}) => {
  const variantClasses = {
    default: 'border-t',
    bordered: 'border',
    striped: 'border-t',
  };

  const variantStyles: Record<NonNullable<TableProps['variant']>, CSSProperties> = {
    default: { borderColor: 'var(--border-color)' },
    bordered: { borderColor: 'var(--border-color)' },
    striped: { borderColor: 'var(--border-color)' },
  };

  const sizes = {
    sm: 'text-sm',
    md: 'text-sm',
    lg: 'text-base',
  };

  const tableClasses = [
    'w-full border-collapse',
    variantClasses[variant],
    sizes[size],
    variant === 'striped' && 'table-striped',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const tableContent = (
    <>
      <table className={tableClasses} style={variantStyles[variant]}>
        {children}
      </table>
      {variant === 'striped' && (
        <style jsx>{`
          :global(.table-striped tbody tr:nth-child(odd):not(.selected-row)) {
            background-color: var(--muted);
          }

          :global(.table-striped tbody tr:hover) {
            background-color: var(--color-neutral-200);
          }
        `}</style>
      )}
    </>
  );

  if (responsive) {
    return (
      <div
        className="overflow-x-auto -webkit-overflow-scrolling-touch"
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
      >
        <div className="min-w-[650px]">
          {tableContent}
        </div>
      </div>
    );
  }

  return tableContent;
};

interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const TableHeader: React.FC<TableHeaderProps> = ({
  children,
  className = '',
}) => {
  return (
    <thead
      className={`border-b-2 ${className}`}
      style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border-color)' }}
    >
      {children}
    </thead>
  );
};

interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const TableBody: React.FC<TableBodyProps> = ({
  children,
  className = '',
}) => {
  const bodyClass = ['table-body', className].filter(Boolean).join(' ');

  return (
    <tbody className={bodyClass}>
      {children}
      <style jsx>{`
        :global(.table-body tr + tr) {
          border-top: 1px solid var(--border-color);
        }
      `}</style>
    </tbody>
  );
};

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  className = '',
  onClick,
  selected = false,
}) => {
  const classes = [
    'transition-colors duration-200',
    onClick && 'cursor-pointer',
    selected && 'bg-primary-50 selected-row',
    selected ? 'hover:bg-primary-100' : 'hover:bg-[var(--muted)]',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <tr className={classes} onClick={onClick}>
      {children}
    </tr>
  );
};

interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  sorted?: 'asc' | 'desc' | null;
  onSort?: () => void;
}

export const TableHead: React.FC<TableHeadProps> = ({
  children,
  className = '',
  align = 'left',
  sortable = false,
  sorted = null,
  onSort,
}) => {
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  const sizeClass = 'px-4 py-3'; // Default to md size padding

  const classes = [
    'font-semibold whitespace-nowrap',
    alignClass[align],
    sizeClass,
    sortable && 'cursor-pointer select-none hover:bg-[var(--muted)]',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <th
      className={classes}
      onClick={sortable ? onSort : undefined}
      style={{ color: 'var(--foreground)' }}
    >
      <div className="flex items-center gap-2">
        {children}
        {sortable && (
          <span className="text-xs text-text-muted">
            {sorted === 'asc' && '↑'}
            {sorted === 'desc' && '↓'}
            {!sorted && '↕'}
          </span>
        )}
      </div>
    </th>
  );
};

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  nowrap?: boolean;
}

export const TableCell: React.FC<TableCellProps> = ({
  children,
  className = '',
  align = 'left',
  nowrap = false,
}) => {
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  const sizeClass = 'px-4 py-3'; // Default to md size padding

  const classes = [
    'text-[var(--foreground)]',
    alignClass[align],
    sizeClass,
    nowrap && 'whitespace-nowrap',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <td className={classes}>
      {children}
    </td>
  );
};

// Empty State Component
interface TableEmptyProps {
  message?: string;
  icon?: React.ReactNode;
}

export const TableEmpty: React.FC<TableEmptyProps> = ({
  message = 'No data available',
  icon,
}) => {
  return (
    <tr>
      <td colSpan={100} className="py-16 px-4 text-center">
        <div className="flex flex-col items-center gap-4">
          {icon && <div className="opacity-50 text-[var(--muted-foreground)]">{icon}</div>}
          <p className="text-sm m-0 text-[var(--muted-foreground)]">{message}</p>
        </div>
      </td>
    </tr>
  );
};

// Loading State Component
interface TableLoadingProps {
  rows?: number;
  columns?: number;
}

export const TableLoading: React.FC<TableLoadingProps> = ({
  rows = 5,
  columns = 4,
}) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="animate-pulse">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="px-4 py-3">
              <div className="h-4 rounded bg-[var(--color-neutral-200)]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};
