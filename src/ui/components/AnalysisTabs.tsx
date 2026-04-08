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
    { value: "profile-visibility", label: t(language, "profileVisibility") },
    { value: "sweep", label: t(language, "sweep") },
  ];

  return (
    <div className="analysis-tabs" role="tablist" aria-label="Analysis views">
      {tabOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={
            value === option.value ? "analysis-tabs__tab analysis-tabs__tab--active" : "analysis-tabs__tab"
          }
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
