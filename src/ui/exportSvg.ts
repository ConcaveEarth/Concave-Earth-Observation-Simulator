export async function downloadSvgAsPng(
  svg: SVGSVGElement,
  filename: string,
): Promise<void> {
  const serializer = new XMLSerializer();
  const svgMarkup = serializer.serializeToString(svg);
  const svgBlob = new Blob([svgMarkup], {
    type: "image/svg+xml;charset=utf-8",
  });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to load generated SVG image."));
      img.src = svgUrl;
    });

    const viewBox = svg.viewBox.baseVal;
    const width = viewBox.width || svg.clientWidth || 1600;
    const height = viewBox.height || svg.clientHeight || 900;
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("PNG export could not access a canvas context.");
    }

    context.scale(2, 2);
    context.drawImage(image, 0, 0, width, height);

    const pngUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = filename;
    link.click();
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

