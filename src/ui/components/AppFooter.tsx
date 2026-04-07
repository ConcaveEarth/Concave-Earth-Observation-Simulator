export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer" aria-label="Site footer">
      <span>
        Created by{" "}
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
