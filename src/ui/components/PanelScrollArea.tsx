import * as ScrollArea from "@radix-ui/react-scroll-area";
import type { PropsWithChildren } from "react";

interface PanelScrollAreaProps extends PropsWithChildren {
  className?: string;
  viewportClassName?: string;
}

export function PanelScrollArea({
  children,
  className,
  viewportClassName,
}: PanelScrollAreaProps) {
  return (
    <ScrollArea.Root className={className ? `panel-scroll-area ${className}` : "panel-scroll-area"}>
      <ScrollArea.Viewport
        className={
          viewportClassName
            ? `panel-scroll-area__viewport ${viewportClassName}`
            : "panel-scroll-area__viewport"
        }
      >
        {children}
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar className="panel-scroll-area__scrollbar" orientation="vertical">
        <ScrollArea.Thumb className="panel-scroll-area__thumb" />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner className="panel-scroll-area__corner" />
    </ScrollArea.Root>
  );
}
