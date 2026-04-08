import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { languageOptions, t, type LanguageMode } from "../../i18n";
import type { ThemeMode, WorkspaceMode } from "../../state/appState";

interface NavLink {
  label: string;
  href: string;
}

const moreCeLinks: NavLink[] = [
  {
    label: "Concave Earth Forums",
    href: "https://concaveearth.net",
  },
  {
    label: "CE Discord",
    href: "https://discord.gg/VjNBQ8QFEt",
  },
  {
    label: "CE Instagram",
    href: "https://instagram.com/truemodeloftheworld",
  },
  {
    label: "Concave Earth V4 Free 3D Model",
    href: "https://cgtrader.com/free-3d-models/science/other/concave-earth-model-v4-by-truemodeloftheworld",
  },
  {
    label: "15GB Concave Mega Research",
    href: "https://drive.google.com/open?id=1-gbaQ10CVCZoJ4EVBseGkUsZALbcXYCx",
  },
  {
    label: "CE Telegram Russian",
    href: "https://t.me/savestudiochat",
  },
  {
    label: "CE Telegram DB",
    href: "https://t.me/CELLULAR369",
  },
  {
    label: "JoeDubs Concave Earth",
    href: "https://joedubs.com/concave-earth",
  },
  {
    label: "SAVEe Studio Concave Earth",
    href: "https://youtube.com/@savestudio369/videos",
  },
  {
    label: "LSC CE Essentials Playlist",
    href: "https://youtube.com/playlist?list=PLqK9xlmjLeDeVYLnCWmQ7Eg6aYF6BKsHx",
  },
];

function NavAnchor({
  href,
  label,
  secondary = false,
}: NavLink & { secondary?: boolean }) {
  return (
    <a
      className={secondary ? "top-nav__link top-nav__link--secondary" : "top-nav__link"}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {label}
    </a>
  );
}

interface TopNavProps {
  theme: ThemeMode;
  language: LanguageMode;
  workspaceMode: WorkspaceMode;
  onThemeChange: (value: ThemeMode) => void;
  onLanguageChange: (value: LanguageMode) => void;
  onWorkspaceModeChange: (value: WorkspaceMode) => void;
}

export function TopNav({
  theme,
  language,
  workspaceMode,
  onThemeChange,
  onLanguageChange,
  onWorkspaceModeChange,
}: TopNavProps) {
  return (
    <header className="top-nav panel">
      <div className="top-nav__brand">
        <p className="top-nav__eyebrow">{t(language, "appEyebrow")}</p>
        <strong>{t(language, "simulatorTitle")}</strong>
      </div>

      <nav className="top-nav__actions" aria-label="Primary">
        <a className="top-nav__link" href={import.meta.env.BASE_URL}>
          {t(language, "home")}
        </a>
        <NavAnchor label={t(language, "forums")} href="https://concaveearth.net" />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="top-nav__link">
              {t(language, "moreCE")}
              <span className="top-nav__caret">v</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="top-nav__dropdown"
              sideOffset={10}
              align="end"
              collisionPadding={20}
            >
              <DropdownMenu.Label className="top-nav__dropdown-title">
                {t(language, "communityResearchLinks")}
              </DropdownMenu.Label>
              <div className="top-nav__dropdown-list">
                {moreCeLinks.map((link) => (
                  <DropdownMenu.Item key={link.href} asChild>
                    <NavAnchor label={link.label} href={link.href} secondary />
                  </DropdownMenu.Item>
                ))}
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </nav>

      <div className="top-nav__utilities">
        <label className="top-nav__control">
          <span>{t(language, "theme")}</span>
          <select
            value={theme}
            onChange={(event) => onThemeChange(event.target.value as ThemeMode)}
          >
            <option value="night-lab">{t(language, "themeNightLab")}</option>
            <option value="blueprint">{t(language, "themeBlueprint")}</option>
            <option value="paper-light">{t(language, "themePaperLight")}</option>
          </select>
        </label>

        <label className="top-nav__control">
          <span>{t(language, "language")}</span>
          <select
            value={language}
            onChange={(event) => onLanguageChange(event.target.value as LanguageMode)}
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="top-nav__control">
          <span>{t(language, "workspace")}</span>
          <select
            value={workspaceMode}
            onChange={(event) =>
              onWorkspaceModeChange(event.target.value as WorkspaceMode)
            }
          >
            <option value="professional">{t(language, "workspaceProfessional")}</option>
            <option value="simple">{t(language, "workspaceSimple")}</option>
          </select>
        </label>
      </div>
    </header>
  );
}
