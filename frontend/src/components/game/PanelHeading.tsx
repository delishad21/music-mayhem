import { ReactNode } from 'react';

interface PanelHeadingProps {
  icon?: ReactNode;
  title: string;
  action?: ReactNode;
  className?: string;
}

export default function PanelHeading({ icon, title, action, className = '' }: PanelHeadingProps) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 items-center gap-2">
        {icon ? (
          <span className="panel-heading-icon flex flex-shrink-0 items-center justify-center" style={{ color: 'var(--mode-accent)' }}>
            {icon}
          </span>
        ) : null}
        <h3 className="panel-title truncate">{title}</h3>
      </div>
      {action}
    </div>
  );
}
