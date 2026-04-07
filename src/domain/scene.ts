import {
  localTangentAtAngle,
  localUpAtAngle,
  pointAtSurfaceHeight,
  toObserverFrame,
} from "./geometry";
import { formatAngle, formatDistance, formatFraction, formatHeight } from "./units";
import type {
  SceneLine,
  SceneSegment,
  SceneViewModel,
  SurfaceAnnotation,
  Vec2,
  VisibilitySolveResult,
} from "./types";

function collectBounds(points: Vec2[]): SceneViewModel["bounds"] {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xPad = Math.max((maxX - minX) * 0.08, 1_200);
  const yPad = Math.max((maxY - minY) * 0.18, 120);

  return {
    minX: minX - xPad,
    maxX: maxX + xPad,
    minY: minY - yPad,
    maxY: maxY + yPad,
  };
}

function buildAnnotationMap(result: VisibilitySolveResult): SurfaceAnnotation[] {
  return [
    {
      id: "surface",
      label: "Surface / Shell",
      description:
        result.model.geometryMode === "convex"
          ? "The baseline surface curve for the convex-sphere interpretation."
          : "The inner shell surface used for the concave / endospherical interpretation.",
      color: "#88d0ff",
    },
    {
      id: "ray",
      label: "Actual Ray Path",
      description:
        "The traced optical path under the active geometry and curvature assumptions.",
      color: "#ffb85c",
    },
    {
      id: "apparent",
      label: "Apparent Line Of Sight",
      description:
        "The straight-line extension of the ray's tangent at the observer, representing perceived direction.",
      color: "#ffd1e1",
    },
    {
      id: "horizon-optical",
      label: "Optical Horizon",
      description:
        "The furthest traced surface interception found under the current ray-curvature law.",
      color: "#9df0c2",
    },
    {
      id: "horizon-geometric",
      label: "Geometric Horizon",
      description:
        "The straight-line tangent construction with no atmospheric or intrinsic optical bending.",
      color: "#8f9fff",
    },
    {
      id: "hidden",
      label: "Hidden Height",
      description:
        "The portion of the target with no traced path reaching the observer under the active model.",
      color: "#ff7c8f",
    },
  ];
}

function makePolyline(
  id: string,
  featureId: string,
  color: string,
  points: Vec2[],
  width = 2.2,
  dashed = false,
  label?: string,
): SceneLine {
  return {
    id,
    featureId,
    label,
    color,
    width,
    dashed,
    points,
  };
}

export function buildSceneViewModel(
  result: VisibilitySolveResult,
  title = result.model.label,
): SceneViewModel {
  const forwardAxis = localTangentAtAngle(0);
  const upAxis = localUpAtAngle(0, result.model.geometryMode);
  const transform = (point: Vec2) =>
    toObserverFrame(point, result.observerPoint, forwardAxis, upAxis);

  const surfaceMaxAngle = Math.max(
    result.targetAngleRad * 1.18,
    (result.opticalHorizon?.surfaceAngleRad ?? 0) * 1.08,
    (result.geometricHorizon?.surfaceAngleRad ?? 0) * 1.08,
    0.045,
  );
  const surfaceMinAngle = -0.04;
  const surfaceSamples = Array.from({ length: 140 }, (_, index) => {
    const angle =
      surfaceMinAngle +
      ((surfaceMaxAngle - surfaceMinAngle) * index) / 139;
    return transform(
      pointAtSurfaceHeight(result.scenario.radiusM, angle, result.model.geometryMode, 0),
    );
  });
  const fillDepth = Math.max(
    result.scenario.observerHeightM + result.scenario.targetHeightM,
    2_800,
  );
  const surfaceFill = {
    id: "surface-fill",
    fill: "url(#surfaceFill)",
    opacity: 0.7,
    points: [
      ...surfaceSamples,
      ...surfaceSamples
        .slice()
        .reverse()
        .map((point) => ({ x: point.x, y: point.y - fillDepth })),
    ],
  };

  const atmosphereFill =
    result.model.atmosphere.mode === "simpleCoefficient"
      ? {
          id: "atmosphere-fill",
          fill: "url(#atmosphereFill)",
          opacity: 0.45,
          points: [
            ...surfaceSamples,
            ...Array.from({ length: 140 }, (_, index) => {
              const angle =
                surfaceMaxAngle -
                ((surfaceMaxAngle - surfaceMinAngle) * index) / 139;
              return transform(
                pointAtSurfaceHeight(
                  result.scenario.radiusM,
                  angle,
                  result.model.geometryMode,
                  2_500,
                ),
              );
            }),
          ],
        }
      : undefined;

  const targetVisibleStartHeight =
    result.visibleHeightM > 0 ? result.hiddenHeightM : result.scenario.targetHeightM;
  const targetBase = transform(result.targetBasePoint);
  const targetTop = transform(result.targetTopPoint);
  const targetVisibleStart = transform(
    pointAtSurfaceHeight(
      result.scenario.radiusM,
      result.targetAngleRad,
      result.model.geometryMode,
      targetVisibleStartHeight,
    ),
  );
  const observerBase = transform(result.observerSurfacePoint);

  const lines: SceneLine[] = [
    makePolyline("surface-line", "surface", "#83c4ff", surfaceSamples, 2.4, false, "Surface"),
  ];

  if (result.primaryRay) {
    lines.push(
      makePolyline(
        "primary-ray",
        "ray",
        "#ffb85c",
        result.primaryRay.points.map((point) => transform(point)),
        2.8,
        false,
        "Actual Ray",
      ),
    );
  }

  const segments: SceneSegment[] = [
    {
      id: "observer-tangent",
      featureId: "apparent",
      label: "Observer Tangent",
      color: "#9ba7ff",
      width: 1.35,
      dashed: true,
      from: { x: -20_000, y: 0 },
      to: { x: result.scenario.surfaceDistanceM * 1.08, y: 0 },
    },
    {
      id: "observer-stem",
      featureId: "surface",
      color: "#a8e1ff",
      width: 3,
      from: observerBase,
      to: { x: 0, y: 0 },
    },
    {
      id: "target-stem",
      featureId: "surface",
      color: "#f4d7a1",
      width: 3,
      from: targetBase,
      to: targetTop,
    },
  ];

  if (result.visibleHeightM < result.scenario.targetHeightM) {
    segments.push({
      id: "hidden-stem",
      featureId: "hidden",
      label: "Hidden Height",
      color: "#ff7c8f",
      width: 4,
      from: targetBase,
      to: targetVisibleStart,
    });
  }

  if (result.apparentElevationRad != null) {
    segments.push({
      id: "apparent-line",
      featureId: "apparent",
      label: "Apparent Line",
      color: "#ffd1e1",
      width: 1.5,
      dashed: true,
      from: { x: 0, y: 0 },
      to: {
        x: Math.cos(result.apparentElevationRad) * result.scenario.surfaceDistanceM * 1.05,
        y: Math.sin(result.apparentElevationRad) * result.scenario.surfaceDistanceM * 1.05,
      },
    });
  }

  if (result.opticalHorizon) {
    segments.push({
      id: "optical-horizon-ray",
      featureId: "horizon-optical",
      label: "Optical Horizon",
      color: "#7fe8be",
      width: 1.8,
      dashed: true,
      from: { x: 0, y: 0 },
      to: transform(result.opticalHorizon.point),
    });
  }

  if (result.geometricHorizon) {
    segments.push({
      id: "geometric-horizon-ray",
      featureId: "horizon-geometric",
      label: "Geometric Horizon",
      color: "#8392ff",
      width: 1.5,
      dashed: true,
      from: { x: 0, y: 0 },
      to: transform(result.geometricHorizon.point),
    });
  }

  const markers = [
    {
      id: "observer",
      featureId: "surface",
      point: { x: 0, y: 0 },
      label: "Observer",
      color: "#d5e7ff",
    },
    {
      id: "target",
      featureId: "surface",
      point: targetTop,
      label: "Target",
      color: "#ffdfa8",
    },
  ];

  if (result.opticalHorizon) {
    markers.push({
      id: "optical-horizon",
      featureId: "horizon-optical",
      point: transform(result.opticalHorizon.point),
      label: "Optical Horizon",
      color: "#7fe8be",
    });
  }

  if (result.geometricHorizon) {
    markers.push({
      id: "geometric-horizon",
      featureId: "horizon-geometric",
      point: transform(result.geometricHorizon.point),
      label: "Geometric Horizon",
      color: "#8392ff",
    });
  }

  const labels = [
    {
      id: "observer-height",
      featureId: "surface",
      text: `Observer ${formatHeight(result.scenario.observerHeightM)}`,
      point: { x: observerBase.x + 1_500, y: observerBase.y + result.scenario.observerHeightM * 0.5 },
    },
    {
      id: "target-height",
      featureId: "surface",
      text: `Target ${formatHeight(result.scenario.targetHeightM)}`,
      point: {
        x: targetTop.x + 1_500,
        y: (targetTop.y + targetBase.y) / 2,
      },
    },
    {
      id: "distance-label",
      featureId: "apparent",
      text: `Surface distance ${formatDistance(result.scenario.surfaceDistanceM)}`,
      point: {
        x: result.scenario.surfaceDistanceM * 0.44,
        y: -800,
      },
    },
    {
      id: "visibility-label",
      featureId: result.visible ? "ray" : "hidden",
      text: `Visibility ${formatFraction(result.visibilityFraction)}`,
      point: {
        x: result.scenario.surfaceDistanceM * 0.66,
        y: 320,
      },
    },
    {
      id: "apparent-angle",
      featureId: "apparent",
      text: `Apparent elev. ${formatAngle(result.apparentElevationRad)}`,
      point: {
        x: result.scenario.surfaceDistanceM * 0.14,
        y: 320,
      },
    },
  ];

  const bounds = collectBounds([
    ...surfaceSamples,
    ...segments.flatMap((segment) => [segment.from, segment.to]),
    ...markers.map((marker) => marker.point),
    ...lines.flatMap((line) => line.points),
  ]);

  return {
    title,
    subtitle: `${result.model.label} • hidden ${formatHeight(result.hiddenHeightM)} • apparent ${formatAngle(result.apparentElevationRad)}`,
    bounds,
    surfaceFill,
    atmosphereFill,
    surfaceLine: lines[0],
    observerStem: segments[1],
    targetStem: segments[2],
    hiddenStem: segments.find((segment) => segment.id === "hidden-stem"),
    markers,
    labels,
    lines,
    segments,
    annotations: buildAnnotationMap(result),
  };
}

