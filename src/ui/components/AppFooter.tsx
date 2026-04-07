import { t, type LanguageMode } from "../../i18n";

interface AppFooterProps {
  language: LanguageMode;
}

export function AppFooter({ language }: AppFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer" aria-label="Site footer">
      <span>
        {t(language, "createdBy")}{" "}
        <a
          href="https://www.youtube.com/@TRUEMODELOFTHEWORLD"
          target="_blank"
          rel="noreferrer"
        >
          @TRUEMODELOFTHEWORLD
        </a>
      </span>
      <span>© {year}</span>
    </footer>
  );
}
