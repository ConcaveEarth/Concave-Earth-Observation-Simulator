import {
  localTangentAtAngle,
  localUpAtAngle,
  pointAtSurfaceHeight,
  toObserverFrame,
} from "./geometry";
import {
  createGenericTargetProfile,
  getTerrainProfileByPresetId,
} from "./profiles";
import {
  clamp,
  formatAngle,
  formatDistance,
  formatFraction,
  formatHeight,
} from "./units";
import type {
  FocusedModel,
  SceneBounds,
  SceneLine,
  SceneSegment,
  SceneTerrainOverlay,
  SceneViewModel,
  SurfaceAnnotation,
  Vec2,
  VisibilitySolveResult,
} from "./types";

const featurePalette = {
  surface: "#72c8ff",
  observerHorizontal: "#9ca7ff",
  observerAltitudeCurve: "#7fd3d8",
  terrainProfile: "#dfb66d",
  geometricSightline: "#d8ddd7",
  actualRay: "#ffb347",
  apparentLine: "#ff89c7",
  opticalHorizon: "#68efb2",
  geometricHorizon: "#7a8cff",
  hiddenHeight: "#ff6e7d",
  observerStem: "#d2ebff",
  targetStem: "#f4d59f",
  observerMarker: "#f3f7ff",
  targetMarker: "#ffe4b2",
};

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

function buildAnnotationMap(
  result: VisibilitySolveResult,
  terrainOverlay?: SceneTerrainOverlay,
): SurfaceAnnotation[] {
  return [
    {
      id: "surface",
      label: "Surface / Shell",
      description:
        result.model.geometryMode === "convex"
          ? "The physical convex surface used by the globe interpretation."
          : "The physical concave shell used by the endospherical interpretation.",
      color: featurePalette.surface,
    },
    {
      id: "observer-horizontal",
      label: "Observer Horizontal",
      description:
        "The straight local tangent through the observer. This is the geometric horizontal reference at the observation point.",
      color: featurePalette.observerHorizontal,
    },
    {
      id: "observer-altitude-curve",
      label: "Observer Altitude Curve",
      description:
        "A constant-height reference curve carried along the active geometry at the observer's altitude. It bends with the model rather than remaining rectilinear.",
      color: featurePalette.observerAltitudeCurve,
    },
    ...(terrainOverlay
      ? [
          {
            id: "terrain-profile",
            label: terrainOverlay.name,
            description: terrainOverlay.description,
            color: terrainOverlay.line.color,
          },
        ]
      : []),
    {
      id: "geometric-sightline",
      label: "Direct Geometric Sightline",
      description:
        "The straight Euclidean line from observer to target top before any optical bending is applied.",
      color: featurePalette.geometricSightline,
    },
    {
      id: "actual-ray",
      label: "Actual Ray Path",
      description:
        "The traced optical path under the active atmosphere and intrinsic curvature assumptions.",
      color: featurePalette.actualRay,
    },
    {
      id: "apparent-line",
      label: "Apparent Line Of Sight",
      description:
        "The observer-facing straight line implied by the ray's tangent at the observation point.",
      color: featurePalette.apparentLine,
    },
    {
      id: "horizon-optical",
      label: "Optical Horizon",
      description:
        "The traced grazing boundary under the current ray-curvature law.",
      color: featurePalette.opticalHorizon,
    },
    {
      id: "horizon-geometric",
      label: "Geometric Horizon",
      description:
        "The purely geometric tangent-to-surface horizon with no optical correction.",
      color: featurePalette.geometricHorizon,
    },
    {
      id: "hidden-height",
      label: "Hidden Height",
      description:
        "The obscured lower portion of the target under the active solve.",
      color: featurePalette.hiddenHeight,
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

function buildTerrainOverlay(
  result: VisibilitySolveResult,
  rawTransform: (point: Vec2) => Vec2,
  exaggerate: (point: Vec2) => Vec2,
): SceneTerrainOverlay | undefined {
  const terrainProfile =
    getTerrainProfileByPresetId(result.scenario.presetId) ??
    createGenericTargetProfile(
      result.scenario.presetId,
      result.scenario.surfaceDistanceM,
      result.scenario.targetHeightM,
    );

  const samples = terrainProfile.samples
    .filter((sample) => sample.distanceM >= 0)
    .sort((left, right) => left.distanceM - right.distanceM);

  if (samples.length < 2) {
    return undefined;
  }

  const profilePoints = samples.map((sample) =>
    exaggerate(
      rawTransform(
        pointAtSurfaceHeight(
          result.scenario.radiusM,
          sample.distanceM / result.scenario.radiusM,
          result.model.geometryMode,
          sample.heightM,
        ),
      ),
    ),
  );
  const baselinePoints = samples.map((sample) =>
    exaggerate(
      rawTransform(
        pointAtSurfaceHeight(
          result.scenario.radiusM,
          sample.distanceM / result.scenario.radiusM,
          result.model.geometryMode,
          0,
        ),
      ),
    ),
  );
  const maxHeightM = Math.max(...samples.map((sample) => sample.heightM));
  const spanDistanceM = samples[samples.length - 1].distanceM - samples[0].distanceM;

  return {
    id: `terrain-${terrainProfile.id}`,
    featureId: "terrain-profile",
    name: terrainProfile.name,
    description: `${terrainProfile.description} This overlay is illustrative and currently does not replace the solver's baseline surface-intersection mesh.`,
    maxHeightM,
    spanDistanceM,
    line: makePolyline(
      "terrain-profile-line",
      "terrain-profile",
      terrainProfile.strokeColor ?? featurePalette.terrainProfile,
      profilePoints,
      2.3,
      false,
      terrainProfile.name,
    ),
    fill: {
      id: "terrain-profile-fill",
      fill: terrainProfile.fillColor ?? "rgba(174, 132, 71, 0.24)",
      opacity: 0.94,
      points: [...profilePoints, ...baselinePoints.slice().reverse()],
    },
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

  const terrainOverlay = buildTerrainOverlay(result, rawTransform, exaggerate);

  const lines: SceneLine[] = [
    makePolyline(
      "surface-line",
      "surface",
      featurePalette.surface,
      surfaceSamples,
      2.5,
      false,
      "Surface",
    ),
    makePolyline(
      "observer-altitude-curve",
      "observer-altitude-curve",
      featurePalette.observerAltitudeCurve,
      observerAltitudeCurve,
      1.55,
      true,
      "Observer Altitude Curve",
    ),
    makePolyline(
      "geometric-sightline",
      "geometric-sightline",
      featurePalette.geometricSightline,
      geometricSightline,
      1.45,
      true,
      "Direct Geometric Sightline",
    ),
  ];

  if (result.primaryRay) {
    lines.push(
      makePolyline(
        "primary-ray",
        "actual-ray",
        featurePalette.actualRay,
        result.primaryRay.points.map((point) => exaggerate(rawTransform(point))),
        3.05,
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
        featurePalette.opticalHorizon,
        result.opticalHorizon.trace.points.map((point) => exaggerate(rawTransform(point))),
        2,
        true,
        "Optical Horizon Ray",
      ),
    );
  }

  if (terrainOverlay) {
    lines.splice(
      1,
      0,
      terrainOverlay.line,
    );
  }

  const segments: SceneSegment[] = [
    {
      id: "observer-horizontal",
      featureId: "observer-horizontal",
      label: "Observer Horizontal",
      color: featurePalette.observerHorizontal,
      width: 1.6,
      dashed: true,
      from: { x: -backDistanceM * 0.45, y: 0 },
      to: { x: forwardDistanceM, y: 0 },
    },
    {
      id: "observer-stem",
      featureId: "surface",
      color: featurePalette.observerStem,
      width: 3,
      from: observerBase,
      to: { x: 0, y: 0 },
    },
    {
      id: "target-stem",
      featureId: "surface",
      color: featurePalette.targetStem,
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
      color: featurePalette.hiddenHeight,
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
      color: featurePalette.apparentLine,
      width: 1.75,
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
      color: featurePalette.opticalHorizon,
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
      color: featurePalette.geometricHorizon,
      width: 1.75,
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
      color: featurePalette.observerMarker,
      labelOffset: { x: 10, y: -18 },
    },
    {
      id: "target",
      featureId: "geometric-sightline",
      point: targetTop,
      label: "Target",
      color: featurePalette.targetMarker,
      labelOffset: { x: 12, y: -14 },
    },
  ];

  if (opticalHorizonPoint) {
    markers.push({
      id: "optical-horizon",
      featureId: "horizon-optical",
      point: opticalHorizonPoint,
      label: "Optical Horizon",
      color: featurePalette.opticalHorizon,
      labelOffset: { x: 14, y: -18 },
    });
  }

  if (geometricHorizonPoint) {
    markers.push({
      id: "geometric-horizon",
      featureId: "horizon-geometric",
      point: geometricHorizonPoint,
      label: "Geometric Horizon",
      color: featurePalette.geometricHorizon,
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
    ...(terrainOverlay
      ? [
          {
            id: "terrain-profile-label",
            featureId: "terrain-profile",
            text: terrainOverlay.name,
            point: terrainOverlay.line.points.reduce((highest, point) =>
              point.y > highest.y ? point : highest,
            ),
          },
        ]
      : []),
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
    terrainOverlay,
    surfaceLine: lines[0],
    observerStem: segments[1],
    targetStem: segments[2],
    hiddenStem: segments.find((segment) => segment.id === "hidden-stem"),
    markers,
    labels,
    lines,
    segments,
    annotations: buildAnnotationMap(result, terrainOverlay),
  };
}
