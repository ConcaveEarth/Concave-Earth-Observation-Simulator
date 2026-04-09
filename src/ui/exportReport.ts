function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  downloadBlob(filename, blob);
}

export function downloadHtmlReport(
  filename: string,
  options: {
    title: string;
    generatedAt: string;
    sections: Array<{
      title: string;
      rows: Array<{ label: string; value: string }>;
    }>;
  },
) {
  const sectionsMarkup = options.sections
    .map(
      (section) => `
        <section class="report-section">
          <h2>${section.title}</h2>
          <dl>
            ${section.rows
              .map(
                (row) => `
                  <div class="report-row">
                    <dt>${row.label}</dt>
                    <dd>${row.value}</dd>
                  </div>
                `,
              )
              .join("")}
          </dl>
        </section>
      `,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${options.title}</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: "Segoe UI", system-ui, sans-serif;
      }
      body {
        margin: 0;
        padding: 32px;
        background: #08111a;
        color: #edf4ff;
      }
      .report-shell {
        max-width: 1080px;
        margin: 0 auto;
      }
      .report-header {
        margin-bottom: 28px;
        padding: 24px 28px;
        border-radius: 24px;
        background: linear-gradient(180deg, rgba(10, 24, 37, 0.96), rgba(7, 15, 25, 0.92));
        border: 1px solid rgba(141, 192, 255, 0.16);
      }
      .report-header h1 {
        margin: 0 0 8px;
        font-size: 2rem;
      }
      .report-header p {
        margin: 0;
        color: rgba(229, 238, 249, 0.76);
      }
      .report-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 20px;
      }
      .report-section {
        padding: 22px 24px;
        border-radius: 22px;
        background: linear-gradient(180deg, rgba(9, 20, 31, 0.88), rgba(7, 14, 22, 0.82));
        border: 1px solid rgba(141, 192, 255, 0.14);
      }
      .report-section h2 {
        margin: 0 0 14px;
        font-size: 1.05rem;
      }
      .report-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 16px;
        padding: 8px 0;
        border-top: 1px solid rgba(141, 192, 255, 0.08);
      }
      .report-row:first-child {
        border-top: 0;
        padding-top: 0;
      }
      dt {
        color: rgba(229, 238, 249, 0.7);
      }
      dd {
        margin: 0;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div class="report-shell">
      <header class="report-header">
        <h1>${options.title}</h1>
        <p>Generated ${options.generatedAt}</p>
      </header>
      <div class="report-grid">
        ${sectionsMarkup}
      </div>
    </div>
  </body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  downloadBlob(filename, blob);
}
