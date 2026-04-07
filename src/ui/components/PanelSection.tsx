import type { PropsWithChildren, ReactNode } from "react";

interface PanelSectionProps extends PropsWithChildren {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  sectionId?: string;
}

export function PanelSection({
  title,
  eyebrow,
  actions,
  sectionId,
  children,
}: PanelSectionProps) {
  return (
    <section id={sectionId} className="panel-section">
      <header className="panel-section__header">
        <div>
          {eyebrow ? <p className="panel-section__eyebrow">{eyebrow}</p> : null}
          <h3>{title}</h3>
        </div>
        {actions ? <div>{actions}</div> : null}
      </header>
      <div className="panel-section__body">{children}</div>
    </section>
  );
}
