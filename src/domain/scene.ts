import {
  localTangentAtAngle,
  localUpAtAngle,
  pointAtSurfaceHeight,
  toObserverFrame,
} from "./geometry";
import { clamp, formatAngle, formatDistance, formatFraction, formatHeight, roundTo } from "./units";
import type {
  SceneBounds,
  SceneLine,
  SceneSegment,
  SceneViewModel,
  SurfaceAnnotation,
  Vec2,
  VisibilitySolveResult,
} from "./types";

function collectBounds(points: Vec2[], paddingFactor = 0.05, minYPad = 180): SceneBounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xPad = Math.max((maxX - minX) * paddingFactor, 900);
  const yPad = Math.max((maxY - minY) * (paddingFactor * 2.4), minYPad);

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

function getRawTransform(result: VisibilitySolveResult) {
  const forwardAxis = localTangentAtAngle(0);
  const upAxis = localUpAtAngle(0, result.model.geometryMode);

  return (point: Vec2) =>
    toObserverFrame(point, result.observerPoint, forwardAxis, upAxis);
}

function getVerticalExaggeration(
  focusDistanceM: number,
  samples: Vec2[],
): number {
  const minY = Math.min(...samples.map((point) => point.y));
  const maxY = Math.max(...samples.map((point) => point.y));
  const rawSpan = Math.max(maxY - minY, 40);
  const targetSpan = focusDistanceM * 0.28;
  return clamp(targetSpan / rawSpan, 8, 65);
}

function createFocusBounds(result: VisibilitySolveResult, points: Vec2[]): SceneBounds {
  const forwardExtent = Math.max(
    result.scenario.surfaceDistanceM * 1.1,
    ...points.map((point) => point.x),
  );
  const focusForward = clamp(
    forwardExtent,
    result.scenario.surfaceDistanceM * 0.95,
    Math.max(result.scenario.surfaceDistanceM * 1.5, 40_000),
  );
  const focusBack = clamp(result.scenario.surfaceDistanceM * 0.12, 1_800, 14_000);
  const filtered = points.filter(
    (point) => point.x >= -focusBack && point.x <= focusForward,
  );

  return collectBounds(
    filtered.length ? filtered : points,
    0.08,
    Math.max(240, result.scenario.targetHeightM * 0.12),
  );
}

export function buildSceneViewModel(
  result: VisibilitySolveResult,
  title = result.model.label,
): SceneViewModel {
  const rawTransform = getRawTransform(result);
  const horizonDistanceM = Math.max(
    result.scenario.surfaceDistanceM,
    result.opticalHorizon?.distanceM ?? 0,
    result.geometricHorizon?.distanceM ?? 0,
  );
  const forwardDistanceM = horizonDistanceM * 1.06;
  const backDistanceM = clamp(forwardDistanceM * 0.08, 1_500, 18_000);
  const surfaceMinAngle = -backDistanceM / result.scenario.radiusM;
  const surfaceMaxAngle = forwardDistanceM / result.scenario.radiusM;

  const rawSurfaceSamples = Array.from({ length: 180 }, (_, index) => {
    const angle =
      surfaceMinAngle +
      ((surfaceMaxAngle - surfaceMinAngle) * index) / 179;
    return rawTransform(
      pointAtSurfaceHeight(result.scenario.radiusM, angle, result.model.geometryMode, 0),
    );
  });

  const rawTargetBase = rawTransform(result.targetBasePoint);
  const rawTargetTop = rawTransform(result.targetTopPoint);
  const rawObserverBase = rawTransform(result.observerSurfacePoint);
  const targetVisibleStartHeight =
    result.visibleHeightM > 0 ? result.hiddenHeightM : result.scenario.targetHeightM;
  const rawTargetVisibleStart = rawTransform(
    pointAtSurfaceHeight(
      result.scenario.radiusM,
      result.targetAngleRad,
      result.model.geometryMode,
      targetVisibleStartHeight,
    ),
  );
  const rawOpticalHorizon = result.opticalHorizon
    ? rawTransform(result.opticalHorizon.point)
    : null;
  const rawGeometricHorizon = result.geometricHorizon
    ? rawTransform(result.geometricHorizon.point)
    : null;
  const rawRayPoints = result.primaryRay?.points.map(rawTransform) ?? [];

  const verticalExaggeration = getVerticalExaggeration(forwardDistanceM + backDistanceM, [
    ...rawSurfaceSamples,
    rawTargetBase,
    rawTargetTop,
    rawObserverBase,
    rawTargetVisibleStart,
    ...(rawOpticalHorizon ? [rawOpticalHorizon] : []),
    ...(rawGeometricHorizon ? [rawGeometricHorizon] : []),
    ...rawRayPoints,
  ]);
  const exaggerate = (point: Vec2): Vec2 => ({
    x: point.x,
    y: point.y * verticalExaggeration,
  });

  const surfaceSamples = rawSurfaceSamples.map(exaggerate);
  const targetBase = exaggerate(rawTargetBase);
  const targetTop = exaggerate(rawTargetTop);
  const observerBase = exaggerate(rawObserverBase);
  const targetVisibleStart = exaggerate(rawTargetVisibleStart);
  const opticalHorizonPoint = rawOpticalHorizon ? exaggerate(rawOpticalHorizon) : null;
  const geometricHorizonPoint = rawGeometricHorizon ? exaggerate(rawGeometricHorizon) : null;

  const fillDepth = Math.max(2_600, verticalExaggeration * 260);
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
            ...Array.from({ length: 180 }, (_, index) => {
              const angle =
                surfaceMaxAngle -
                ((surfaceMaxAngle - surfaceMinAngle) * index) / 179;
              return exaggerate(
                rawTransform(
                  pointAtSurfaceHeight(
                    result.scenario.radiusM,
                    angle,
                    result.model.geometryMode,
                    2_500,
                  ),
                ),
              );
            }),
          ],
        }
      : undefined;

  const lines: SceneLine[] = [
    makePolyline("surface-line", "surface", "#83c4ff", surfaceSamples, 2.4, false, "Surface"),
  ];

  if (result.primaryRay) {
    lines.push(
      makePolyline(
        "primary-ray",
        "ray",
        "#ffb85c",
        result.primaryRay.points.map((point) => exaggerate(rawTransform(point))),
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
      from: { x: -backDistanceM * 0.45, y: 0 },
      to: { x: forwardDistanceM, y: 0 },
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
        x: Math.cos(result.apparentElevationRad) * forwardDistanceM,
        y: Math.sin(result.apparentElevationRad) * forwardDistanceM * verticalExaggeration,
      },
    });
  }

  if (opticalHorizonPoint) {
    segments.push({
      id: "optical-horizon-ray",
      featureId: "horizon-optical",
      label: "Optical Horizon",
      color: "#7fe8be",
      width: 1.8,
      dashed: true,
      from: { x: 0, y: 0 },
      to: opticalHorizonPoint,
    });
  }

  if (geometricHorizonPoint) {
    segments.push({
      id: "geometric-horizon-ray",
      featureId: "horizon-geometric",
      label: "Geometric Horizon",
      color: "#8392ff",
      width: 1.5,
      dashed: true,
      from: { x: 0, y: 0 },
      to: geometricHorizonPoint,
    });
  }

  const markers = [
    {
      id: "observer",
      featureId: "surface",
      point: { x: 0, y: 0 },
      label: "Observer",
      color: "#d5e7ff",
      labelOffset: { x: 10, y: -18 },
    },
    {
      id: "target",
      featureId: "surface",
      point: targetTop,
      label: "Target",
      color: "#ffdfa8",
      labelOffset: { x: 12, y: -14 },
    },
  ];

  if (opticalHorizonPoint) {
    markers.push({
      id: "optical-horizon",
      featureId: "horizon-optical",
      point: opticalHorizonPoint,
      label: "Optical Horizon",
      color: "#7fe8be",
      labelOffset: { x: 14, y: -18 },
    });
  }

  if (geometricHorizonPoint) {
    markers.push({
      id: "geometric-horizon",
      featureId: "horizon-geometric",
      point: geometricHorizonPoint,
      label: "Geometric Horizon",
      color: "#8392ff",
      labelOffset: { x: 14, y: 22 },
    });
  }

  const labels = [
    {
      id: "distance-label",
      featureId: "apparent",
      text: `Surface distance ${formatDistance(result.scenario.surfaceDistanceM)}`,
      point: {
        x: result.scenario.surfaceDistanceM * 0.42,
        y: -verticalExaggeration * 22,
      },
    },
    {
      id: "visibility-label",
      featureId: result.visible ? "ray" : "hidden",
      text: `Visibility ${formatFraction(result.visibilityFraction)}`,
      point: {
        x: result.scenario.surfaceDistanceM * 0.6,
        y: verticalExaggeration * 18,
      },
    },
    ...(result.hiddenHeightM > 0
      ? [
          {
            id: "hidden-height",
            featureId: "hidden",
            text: `Hidden ${formatHeight(result.hiddenHeightM)}`,
            point: {
              x: targetBase.x + 2_400,
              y: (targetBase.y + targetVisibleStart.y) / 2,
            },
          },
        ]
      : []),
    {
      id: "apparent-angle",
      featureId: "apparent",
      text: `Apparent elev. ${formatAngle(result.apparentElevationRad)}`,
      point: {
        x: Math.max(1_400, result.scenario.surfaceDistanceM * 0.1),
        y: verticalExaggeration * 18,
      },
    },
    {
      id: "vertical-exaggeration",
      featureId: "surface",
      text: `Vertical exaggeration x${roundTo(verticalExaggeration, 1)}`,
      point: {
        x: -backDistanceM * 0.2,
        y: -verticalExaggeration * 70,
      },
    },
  ];

  const relevantPoints = [
    ...surfaceSamples,
    ...segments.flatMap((segment) => [segment.from, segment.to]),
    ...markers.map((marker) => marker.point),
    ...lines.flatMap((line) => line.points),
    ...labels.map((label) => label.point),
  ];
  const bounds = collectBounds(relevantPoints);
  const focusBounds = createFocusBounds(result, relevantPoints);

  return {
    title,
    subtitle: `${result.model.label} | hidden ${formatHeight(result.hiddenHeightM)} | apparent ${formatAngle(result.apparentElevationRad)}`,
    bounds,
    focusBounds,
    suggestedVerticalScale: verticalExaggeration,
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
