import type { PropsWithChildren, ReactNode } from "react";

interface PanelSectionProps extends PropsWithChildren {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  sectionId?: string;
  className?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function PanelSection({
  title,
  eyebrow,
  actions,
  sectionId,
  className,
  collapsible = false,
  collapsed = false,
  onToggleCollapsed,
  children,
}: PanelSectionProps) {
  return (
    <section
      id={sectionId}
      className={className ? `panel-section ${className}` : "panel-section"}
    >
      <header className="panel-section__header">
        <div>
          {eyebrow ? <p className="panel-section__eyebrow">{eyebrow}</p> : null}
          <h3>{title}</h3>
        </div>
        <div className="panel-section__header-actions">
          {actions ? <div>{actions}</div> : null}
          {collapsible ? (
            <button
              type="button"
              className="panel-section__toggle"
              onClick={onToggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            >
              {collapsed ? "+" : "−"}
            </button>
          ) : null}
        </div>
      </header>
      {!collapsed ? <div className="panel-section__body">{children}</div> : null}
    </section>
  );
}
