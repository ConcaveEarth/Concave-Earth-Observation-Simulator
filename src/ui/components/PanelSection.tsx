import * as Collapsible from "@radix-ui/react-collapsible";
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
  if (!collapsible) {
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
          </div>
        </header>
        <div className="panel-section__body">{children}</div>
      </section>
    );
  }

  return (
    <Collapsible.Root
      id={sectionId}
      className={className ? `panel-section ${className}` : "panel-section"}
      open={!collapsed}
      onOpenChange={() => onToggleCollapsed?.()}
    >
      <header className="panel-section__header">
        <div>
          {eyebrow ? <p className="panel-section__eyebrow">{eyebrow}</p> : null}
          <h3>{title}</h3>
        </div>
        <div className="panel-section__header-actions">
          {actions ? <div>{actions}</div> : null}
          <Collapsible.Trigger asChild>
            <button
              type="button"
              className="panel-section__toggle"
              aria-expanded={!collapsed}
              aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            >
              {collapsed ? "+" : "-"}
            </button>
          </Collapsible.Trigger>
        </div>
      </header>
      <Collapsible.Content className="panel-section__body">
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
