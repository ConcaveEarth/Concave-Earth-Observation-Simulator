import {
  localTangentAtAngle,
  localUpAtAngle,
  pointAtSurfaceHeight,
  toObserverFrame,
} from "./geometry";
import {
  clamp,
  formatAngle,
  formatDistance,
  formatFraction,
  formatHeight,
  roundTo,
} from "./units";
import type {
  FocusedModel,
  SceneBounds,
  SceneLine,
  SceneSegment,
  SceneViewModel,
  SurfaceAnnotation,
  Vec2,
  VisibilitySolveResult,
} from "./types";

function collectBounds(points: Vec2[], paddingFactor = 0.06, minYPad = 180): SceneBounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xPad = Math.max((maxX - minX) * paddingFactor, 900);
  const yPad = Math.max((maxY - minY) * (paddingFactor * 2.3), minYPad);

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
          ? "The physical convex surface used by the globe interpretation."
          : "The physical concave shell used by the endospherical interpretation.",
      color: "#88d0ff",
    },
    {
      id: "observer-horizontal",
      label: "Observer Horizontal",
      description:
        "The straight local tangent through the observer. This is the geometric horizontal reference at the observation point.",
      color: "#9ba7ff",
    },
    {
      id: "observer-altitude-curve",
      label: "Observer Altitude Curve",
      description:
        "A constant-height reference curve carried along the active geometry at the observer's altitude. It bends with the model rather than remaining rectilinear.",
      color: "#bcd7ff",
    },
    {
      id: "geometric-sightline",
      label: "Direct Geometric Sightline",
      description:
        "The straight Euclidean line from observer to target top before any optical bending is applied.",
      color: "#d7d9de",
    },
    {
      id: "actual-ray",
      label: "Actual Ray Path",
      description:
        "The traced optical path under the active atmosphere and intrinsic curvature assumptions.",
      color: "#ffb85c",
    },
    {
      id: "apparent-line",
      label: "Apparent Line Of Sight",
      description:
        "The observer-facing straight line implied by the ray's tangent at the observation point.",
      color: "#ffd1e1",
    },
    {
      id: "horizon-optical",
      label: "Optical Horizon",
      description:
        "The traced grazing boundary under the current ray-curvature law.",
      color: "#9df0c2",
    },
    {
      id: "horizon-geometric",
      label: "Geometric Horizon",
      description:
        "The purely geometric tangent-to-surface horizon with no optical correction.",
      color: "#8f9fff",
    },
    {
      id: "hidden-height",
      label: "Hidden Height",
      description:
        "The obscured lower portion of the target under the active solve.",
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

function getVerticalExaggeration(focusDistanceM: number, samples: Vec2[]): number {
  const minY = Math.min(...samples.map((point) => point.y));
  const maxY = Math.max(...samples.map((point) => point.y));
  const rawSpan = Math.max(maxY - minY, 40);
  const targetSpan = focusDistanceM * 0.3;
  return clamp(targetSpan / rawSpan, 8, 70);
}

function createFocusBounds(result: VisibilitySolveResult, points: Vec2[]): SceneBounds {
  const forwardExtent = Math.max(
    result.scenario.surfaceDistanceM * 1.08,
    ...points.map((point) => point.x),
  );
  const focusForward = clamp(
    forwardExtent,
    Math.max(result.scenario.surfaceDistanceM * 0.96, 10_000),
    Math.max(result.scenario.surfaceDistanceM * 1.42, 44_000),
  );
  const focusBack = clamp(result.scenario.surfaceDistanceM * 0.12, 1_800, 14_000);
  const filtered = points.filter(
    (point) => point.x >= -focusBack && point.x <= focusForward,
  );

  return collectBounds(
    filtered.length ? filtered : points,
    0.09,
    Math.max(220, result.scenario.targetHeightM * 0.1),
  );
}

export function buildSceneViewModel(
  result: VisibilitySolveResult,
  title: string,
  sceneKey: FocusedModel,
): SceneViewModel {
  const rawTransform = getRawTransform(result);
  const horizonDistanceM = Math.max(
    result.scenario.surfaceDistanceM,
    result.opticalHorizon?.distanceM ?? 0,
    result.geometricHorizon?.distanceM ?? 0,
  );
  const forwardDistanceM = horizonDistanceM * 1.08;
  const backDistanceM = clamp(forwardDistanceM * 0.08, 1_500, 18_000);
  const surfaceMinAngle = -backDistanceM / result.scenario.radiusM;
  const surfaceMaxAngle = forwardDistanceM / result.scenario.radiusM;

  const rawSurfaceSamples = Array.from({ length: 200 }, (_, index) => {
    const angle =
      surfaceMinAngle +
      ((surfaceMaxAngle - surfaceMinAngle) * index) / 199;
    return rawTransform(
      pointAtSurfaceHeight(result.scenario.radiusM, angle, result.model.geometryMode, 0),
    );
  });

  const rawObserverAltitudeCurve = Array.from({ length: 200 }, (_, index) => {
    const angle =
      surfaceMinAngle +
      ((surfaceMaxAngle - surfaceMinAngle) * index) / 199;
    return rawTransform(
      pointAtSurfaceHeight(
        result.scenario.radiusM,
        angle,
        result.model.geometryMode,
        result.scenario.observerHeightM,
      ),
    );
  });

  const rawTargetBase = rawTransform(result.targetBasePoint);
  const rawTargetTop = rawTransform(result.targetTopPoint);
  const rawObserverBase = rawTransform(result.observerSurfacePoint);
  const rawOpticalHorizon = result.opticalHorizon
    ? rawTransform(result.opticalHorizon.point)
    : null;
  const rawGeometricHorizon = result.geometricHorizon
    ? rawTransform(result.geometricHorizon.point)
    : null;
  const rawGeometricSightline = [rawTransform(result.observerPoint), rawTargetTop];
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
  const rawRayPoints = result.primaryRay?.points.map(rawTransform) ?? [];

  const verticalExaggeration = getVerticalExaggeration(forwardDistanceM + backDistanceM, [
    ...rawSurfaceSamples,
    ...rawObserverAltitudeCurve,
    rawTargetBase,
    rawTargetTop,
    rawObserverBase,
    rawTargetVisibleStart,
    ...rawGeometricSightline,
    ...(rawOpticalHorizon ? [rawOpticalHorizon] : []),
    ...(rawGeometricHorizon ? [rawGeometricHorizon] : []),
    ...rawRayPoints,
  ]);

  const exaggerate = (point: Vec2): Vec2 => ({
    x: point.x,
    y: point.y * verticalExaggeration,
  });

  const surfaceSamples = rawSurfaceSamples.map(exaggerate);
  const observerAltitudeCurve = rawObserverAltitudeCurve.map(exaggerate);
  const targetBase = exaggerate(rawTargetBase);
  const targetTop = exaggerate(rawTargetTop);
  const observerBase = exaggerate(rawObserverBase);
  const targetVisibleStart = exaggerate(rawTargetVisibleStart);
  const opticalHorizonPoint = rawOpticalHorizon ? exaggerate(rawOpticalHorizon) : null;
  const geometricHorizonPoint = rawGeometricHorizon ? exaggerate(rawGeometricHorizon) : null;
  const geometricSightline = rawGeometricSightline.map(exaggerate);

  const fillDepth = Math.max(2_800, verticalExaggeration * 280);
  const surfaceFill = {
    id: "surface-fill",
    fill: "url(#surfaceFill)",
    opacity: 0.72,
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
          opacity: 0.42,
          points: [
            ...surfaceSamples,
            ...Array.from({ length: 200 }, (_, index) => {
              const angle =
                surfaceMaxAngle -
                ((surfaceMaxAngle - surfaceMinAngle) * index) / 199;
              return exaggerate(
                rawTransform(
                  pointAtSurfaceHeight(
                    result.scenario.radiusM,
                    angle,
                    result.model.geometryMode,
                    Math.max(2_500, result.scenario.observerHeightM + 1_000),
                  ),
                ),
              );
            }),
          ],
        }
      : undefined;

  const lines: SceneLine[] = [
    makePolyline("surface-line", "surface", "#83c4ff", surfaceSamples, 2.4, false, "Surface"),
    makePolyline(
      "observer-altitude-curve",
      "observer-altitude-curve",
      "#bed6ff",
      observerAltitudeCurve,
      1.4,
      true,
      "Observer Altitude Curve",
    ),
    makePolyline(
      "geometric-sightline",
      "geometric-sightline",
      "#d7d9de",
      geometricSightline,
      1.3,
      true,
      "Direct Geometric Sightline",
    ),
  ];

  if (result.primaryRay) {
    lines.push(
      makePolyline(
        "primary-ray",
        "actual-ray",
        "#ffb85c",
        result.primaryRay.points.map((point) => exaggerate(rawTransform(point))),
        2.8,
        false,
        "Actual Ray",
      ),
    );
  }

  if (result.opticalHorizon?.trace) {
    lines.push(
      makePolyline(
        "optical-horizon-trace",
        "horizon-optical",
        "#7fe8be",
        result.opticalHorizon.trace.points.map((point) => exaggerate(rawTransform(point))),
        1.9,
        true,
        "Optical Horizon Ray",
      ),
    );
  }

  const segments: SceneSegment[] = [
    {
      id: "observer-horizontal",
      featureId: "observer-horizontal",
      label: "Observer Horizontal",
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
      featureId: "hidden-height",
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
      featureId: "apparent-line",
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

  if (opticalHorizonPoint && !result.opticalHorizon?.trace) {
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
      featureId: "observer-horizontal",
      point: { x: 0, y: 0 },
      label: "Observer",
      color: "#d5e7ff",
      labelOffset: { x: 10, y: -18 },
    },
    {
      id: "target",
      featureId: "geometric-sightline",
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
      labelOffset: { x: 14, y: 20 },
    });
  }

  const labels = [
    {
      id: "distance-label",
      featureId: "surface",
      text: `Surface distance ${formatDistance(result.scenario.surfaceDistanceM)}`,
      point: {
        x: result.scenario.surfaceDistanceM * 0.42,
        y: -verticalExaggeration * 26,
      },
    },
    ...(result.hiddenHeightM > 0
      ? [
          {
            id: "hidden-height",
            featureId: "hidden-height",
            text: `Hidden ${formatHeight(result.hiddenHeightM)}`,
            point: {
              x: targetBase.x + 2_200,
              y: (targetBase.y + targetVisibleStart.y) / 2,
            },
          },
        ]
      : []),
    ...(result.primaryRay
      ? [
          {
            id: "ray-bend",
            featureId: "actual-ray",
            text: `Ray bend ${formatAngle(result.primaryRay.totalBendRad)}`,
            point: {
              x: Math.max(1_500, result.scenario.surfaceDistanceM * 0.16),
              y: verticalExaggeration * 22,
            },
          },
        ]
      : []),
    {
      id: "visibility-label",
      featureId: "hidden-height",
      text: `Visibility ${formatFraction(result.visibilityFraction)}`,
      point: {
        x: result.scenario.surfaceDistanceM * 0.58,
        y: verticalExaggeration * 22,
      },
    },
    {
      id: "vertical-exaggeration",
      featureId: "surface",
      text: `Vertical exaggeration x${roundTo(verticalExaggeration, 1)}`,
      point: {
        x: -backDistanceM * 0.18,
        y: -verticalExaggeration * 74,
      },
    },
  ];

  const relevantPoints = [
    ...surfaceSamples,
    ...observerAltitudeCurve,
    ...geometricSightline,
    ...segments.flatMap((segment) => [segment.from, segment.to]),
    ...markers.map((marker) => marker.point),
    ...lines.flatMap((line) => line.points),
  ];
  const bounds = collectBounds(relevantPoints);
  const focusBounds = createFocusBounds(result, relevantPoints);

  return {
    sceneKey,
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
