import * as Tabs from "@radix-ui/react-tabs";
import type { AnalysisTab } from "../../domain/analysis";
import { t, type LanguageMode } from "../../i18n";

interface AnalysisTabsProps {
  value: AnalysisTab;
  onChange: (value: AnalysisTab) => void;
  language: LanguageMode;
}

export function AnalysisTabs({ value, onChange, language }: AnalysisTabsProps) {
  const tabOptions: Array<{ value: AnalysisTab; label: string }> = [
    { value: "cross-section", label: t(language, "crossSection") },
    { value: "ray-bundle", label: t(language, "rayBundle") },
    { value: "observer-view", label: t(language, "observerView") },
    { value: "profile-visibility", label: t(language, "profileVisibility") },
    { value: "route-map", label: t(language, "routeMap") },
    { value: "sky-wrap", label: t(language, "skyWrap") },
    { value: "inversion-lab", label: t(language, "inversionLab") },
    { value: "sweep", label: t(language, "sweep") },
  ];

  return (
    <Tabs.Root
      className="analysis-tabs"
      value={value}
      onValueChange={(nextValue) => onChange(nextValue as AnalysisTab)}
    >
      <Tabs.List className="analysis-tabs__list" aria-label="Analysis views">
        {tabOptions.map((option) => (
          <Tabs.Trigger
            key={option.value}
            value={option.value}
            className={
              value === option.value
                ? "analysis-tabs__tab analysis-tabs__tab--active"
                : "analysis-tabs__tab"
            }
          >
            {option.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
