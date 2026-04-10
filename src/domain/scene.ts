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
  getObserverTotalHeightM,
  getTargetTopElevationM,
} from "./scenario";
import { traceRayForDisplay } from "./raytrace";
import {
  clamp,
  formatAngle,
  formatDistance,
  formatFraction,
  formatHeight,
} from "./units";
import type { UnitPreferences } from "./units";
import { getModelLabel, t, type LanguageMode } from "../i18n";
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
  surface: "#6fc2ff",
  observerHorizontal: "#9da5ff",
  observerAltitudeCurve: "#56d8d1",
  terrainProfile: "#9bae74",
  geometricSightline: "#f0f3ea",
  sourceGeometricPath: "#f0d463",
  actualRay: "#ff9553",
  sourceLightPath: "#ff6b5b",
  apparentLine: "#ff7fc5",
  opticalHorizon: "#73f0a8",
  geometricHorizon: "#6f80ff",
  hiddenHeight: "#ff7185",
  observerStem: "#d2ebff",
  targetStem: "#ffd39a",
  observerMarker: "#f3f7ff",
  targetMarker: "#ffe4b2",
};

function pointAlongSegment(from: Vec2, to: Vec2, t: number): Vec2 {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

function pointOnPolyline(points: Vec2[], t: number): Vec2 {
  if (!points.length) {
    return { x: 0, y: 0 };
  }

  if (points.length === 1) {
    return points[0];
  }

  const clampedT = clamp(t, 0, 1);
  const segmentLengths = points.slice(1).map((point, index) =>
    Math.hypot(point.x - points[index].x, point.y - points[index].y),
  );
  const totalLength = segmentLengths.reduce((sum, value) => sum + value, 0);

  if (totalLength <= 0) {
    return points[Math.round(clampedT * (points.length - 1))];
  }

  let traveled = 0;
  const targetLength = totalLength * clampedT;

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index];

    if (traveled + segmentLength >= targetLength) {
      const segmentT = (targetLength - traveled) / Math.max(segmentLength, 1);
      return pointAlongSegment(points[index], points[index + 1], segmentT);
    }

    traveled += segmentLength;
  }

  return points[points.length - 1];
}

function pointsOnPolyline(points: Vec2[], fractions: number[]): Vec2[] {
  return fractions.map((fraction) => pointOnPolyline(points, fraction));
}

interface FeatureDefinition {
  label: string;
  description: string;
}

function getFeatureDefinitions(
  result: VisibilitySolveResult,
  terrainOverlay?: SceneTerrainOverlay,
  language: LanguageMode = "en",
): Record<string, FeatureDefinition> {
  const resolvedReferenceConstruction =
    result.model.lineBehavior.referenceConstruction === "auto"
      ? result.model.geometryMode === "convex"
        ? "curved-altitude"
        : "curvilinear-tangent"
      : result.model.lineBehavior.referenceConstruction;
  const resolvedObjectLightPathMode =
    result.model.lineBehavior.objectLightPath === "auto"
      ? "traced"
      : result.model.lineBehavior.objectLightPath;
  const resolvedApparentDirectionMode =
    result.model.lineBehavior.apparentDirection === "auto"
      ? result.visible
        ? "target"
        : "horizon"
      : result.model.lineBehavior.apparentDirection;
  const apparentLabel = result.visible
    ? resolvedApparentDirectionMode === "horizon"
      ? t(language, "featureApparentHorizonDirection")
      : t(language, "featureApparentLineOfSight")
    : t(language, "featureApparentHorizonDirection");
  const actualRayLabel =
    result.primaryRay?.targetCrossing != null
      ? t(language, "featureActualRayPath")
      : result.opticalHorizon?.trace
        ? t(language, "featureOpticalHorizonReferenceRay")
        : t(language, "featureActualRayPath");
  const curvedRayRole =
    result.primaryRay?.targetCrossing != null
      ? result.model.geometryMode === "convex"
        ? "The physical observation ray. Under the convex model this is the refracted sight path when atmosphere is enabled."
        : "The physical observation ray. Under the concave model this is the endospherical sight path, bending toward the shell center under the active curvature law."
      : "No target-reaching ray is currently solved, so this line is the grazing horizon reference ray under the active curvature law.";
  const curvedReferenceRole =
    resolvedReferenceConstruction === "straight-horizontal"
      ? "A straight Euclidean horizontal carried as the alternate reference construction through the observer."
      : result.model.geometryMode === "convex"
      ? "A curved constant-altitude reference carried along the convex surface at the observer height. It stays tied to the geometry instead of remaining rectilinear."
      : "The concave model's curvilinear tangent-style reference carried along the shell at the observer height. It curves upward toward the shell center rather than staying straight.";
  const referenceLabel =
    resolvedReferenceConstruction === "straight-horizontal"
      ? t(language, "featureStraightHorizontalReference")
      : result.model.geometryMode === "convex"
        ? t(language, "featureCurvedAltitudeReference")
        : t(language, "featureCurvilinearTangent");

  return {
    surface: {
      label:
        result.model.geometryMode === "convex"
          ? t(language, "featureSurfaceSea")
          : t(language, "featureSurfaceGround"),
      description:
        result.model.geometryMode === "convex"
          ? "The physical convex surface curve used by the globe interpretation."
          : "The physical concave shell curve used by the endospherical interpretation.",
    },
    "observer-horizontal": {
      label: t(language, "featureObserverHorizontal"),
      description:
        "The straight local tangent through the observer. This is the Euclidean horizontal reference construction at the observation point.",
    },
    "observer-altitude-curve": {
      label: referenceLabel,
      description: curvedReferenceRole,
    },
    "observer-height": {
      label: t(language, "featureObserverHeight"),
      description:
        "The observer's vertical height construction from the local surface/shell to the observation point.",
    },
    "target-height": {
      label: t(language, "featureTargetHeight"),
      description:
        "The target's vertical height construction from the target base on the surface/shell to its top.",
    },
    "terrain-profile": {
      label: terrainOverlay?.name ?? t(language, "featureTerrainOverlay"),
      description:
        terrainOverlay?.description ??
        "A terrain or structure overlay aligned to the current preset distances.",
    },
    "geometric-sightline": {
      label: t(language, "featureDirectGeometricSightline"),
      description:
        "The straight Euclidean line from observer to target top before any optical bending is applied.",
    },
    "source-geometric-path": {
      label: t(language, "featureObjectToObserverGeometricPath"),
      description:
        "The straight Euclidean path from the currently referenced source point on the object to the observer. Under the convex model this line can be geometrically obstructed by the surface even when a curved optical path still reaches the observer.",
    },
    "actual-ray": {
      label: actualRayLabel,
      description: curvedRayRole,
    },
    "source-light-path": {
      label: t(language, "featureObjectToObserverLightPath"),
      description:
        resolvedObjectLightPathMode === "straight"
          ? "A straight chord construction from the referenced source point on the object to the observer, used as an alternate comparison against the traced optical path."
          : result.model.geometryMode === "convex"
          ? "The curved physical light path from the referenced source point on the object to the observer under the active atmospheric bending."
          : "The curved physical light path from the referenced source point on the object to the observer under the intrinsic concave bending law plus any atmospheric modification.",
    },
    "apparent-line": {
      label: apparentLabel,
      description:
        result.visible
          ? "The straight apparent direction at the observer implied by the incoming tangent of the solved ray."
          : "The straight apparent direction associated with the solved grazing horizon ray when no target-reaching ray is available.",
    },
    "horizon-optical": {
      label: t(language, "featureOpticalHorizon"),
      description:
        "The traced grazing boundary under the active intrinsic-plus-atmospheric curvature law.",
    },
    "horizon-geometric": {
      label:
        result.model.geometryMode === "convex"
          ? t(language, "featureGeometricHorizonTangent")
          : t(language, "featureGeometricHorizonConstruction"),
      description:
        "The purely geometric tangent-to-surface horizon with no optical correction.",
    },
    "hidden-height": {
      label: t(language, "featureHiddenHeight"),
      description:
        "The obscured lower portion of the target under the active solve.",
    },
  };
}

interface BoundsPaddingOptions {
  xPaddingFactor?: number;
  minXPad?: number;
  topPaddingFactor?: number;
  bottomPaddingFactor?: number;
  minTopPad?: number;
  minBottomPad?: number;
}

function collectBounds(
  points: Vec2[],
  {
    xPaddingFactor = 0.06,
    minXPad = 900,
    topPaddingFactor = 0.16,
    bottomPaddingFactor = 0.24,
    minTopPad = 180,
    minBottomPad = 220,
  }: BoundsPaddingOptions = {},
): SceneBounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const xPad = Math.max(spanX * xPaddingFactor, minXPad);
  const topPad = Math.max(spanY * topPaddingFactor, minTopPad);
  const bottomPad = Math.max(spanY * bottomPaddingFactor, minBottomPad);

  return {
    minX: minX - xPad,
    maxX: maxX + xPad,
    minY: minY - bottomPad,
    maxY: maxY + topPad,
  };
}

function buildAnnotationMap(
  result: VisibilitySolveResult,
  terrainOverlay?: SceneTerrainOverlay,
  language: LanguageMode = "en",
): SurfaceAnnotation[] {
  const definitions = getFeatureDefinitions(result, terrainOverlay, language);

  return [
    {
      id: "surface",
      label: definitions.surface.label,
      description: definitions.surface.description,
      color: featurePalette.surface,
    },
    {
      id: "observer-horizontal",
      label: definitions["observer-horizontal"].label,
      description: definitions["observer-horizontal"].description,
      color: featurePalette.observerHorizontal,
    },
    {
      id: "observer-altitude-curve",
      label: definitions["observer-altitude-curve"].label,
      description: definitions["observer-altitude-curve"].description,
      color: featurePalette.observerAltitudeCurve,
    },
    {
      id: "observer-height",
      label: definitions["observer-height"].label,
      description: definitions["observer-height"].description,
      color: featurePalette.observerStem,
    },
    {
      id: "target-height",
      label: definitions["target-height"].label,
      description: definitions["target-height"].description,
      color: featurePalette.targetStem,
    },
    ...(terrainOverlay
      ? [
          {
            id: "terrain-profile",
            label: definitions["terrain-profile"].label,
            description: definitions["terrain-profile"].description,
            color: terrainOverlay.line.color,
          },
        ]
      : []),
    {
      id: "geometric-sightline",
      label: definitions["geometric-sightline"].label,
      description: definitions["geometric-sightline"].description,
      color: featurePalette.geometricSightline,
    },
    {
      id: "source-geometric-path",
      label: definitions["source-geometric-path"].label,
      description: definitions["source-geometric-path"].description,
      color: featurePalette.sourceGeometricPath,
    },
    {
      id: "actual-ray",
      label: definitions["actual-ray"].label,
      description: definitions["actual-ray"].description,
      color: featurePalette.actualRay,
    },
    {
      id: "source-light-path",
      label: definitions["source-light-path"].label,
      description: definitions["source-light-path"].description,
      color: featurePalette.sourceLightPath,
    },
    {
      id: "apparent-line",
      label: definitions["apparent-line"].label,
      description: definitions["apparent-line"].description,
      color: featurePalette.apparentLine,
    },
    {
      id: "horizon-optical",
      label: definitions["horizon-optical"].label,
      description: definitions["horizon-optical"].description,
      color: featurePalette.opticalHorizon,
    },
    {
      id: "horizon-geometric",
      label: definitions["horizon-geometric"].label,
      description: definitions["horizon-geometric"].description,
      color: featurePalette.geometricHorizon,
    },
    {
      id: "hidden-height",
      label: definitions["hidden-height"].label,
      description: definitions["hidden-height"].description,
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
      getTargetTopElevationM(result.scenario),
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
      3.25,
      false,
      terrainProfile.name,
    ),
    fill: {
      id: "terrain-profile-fill",
      fill: terrainProfile.fillColor ?? "rgba(188, 140, 77, 0.34)",
      opacity: 0.98,
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

  return collectBounds(filtered.length ? filtered : points, {
    xPaddingFactor: 0.1,
    minXPad: Math.max(1_100, result.scenario.surfaceDistanceM * 0.016),
    topPaddingFactor: 0.24,
    bottomPaddingFactor: 0.24,
    minTopPad: Math.max(260, getTargetTopElevationM(result.scenario) * 0.22),
    minBottomPad: Math.max(260, getTargetTopElevationM(result.scenario) * 0.22),
  });
}

function offsetSurfaceBand(points: Vec2[], thickness: number) {
  return points.map((point) => ({
    x: point.x,
    y: point.y + thickness,
  }));
}

function placeLabel(
  labels: SceneViewModel["labels"],
  id: string,
  featureId: string,
  text: string,
  anchors: Vec2 | Vec2[],
  preferredOffsets: Vec2[],
  minDx: number,
  minDy: number,
  placementBounds: SceneBounds,
  density: "adaptive" | "full" = "adaptive",
  avoidPoints: Vec2[] = [],
) {
  const horizontalPadding = minDx * 0.2;
  const verticalPadding = minDy * 0.14;
  const anchorList = Array.isArray(anchors) ? anchors : [anchors];
  let bestCandidate:
    | {
        point: Vec2;
        textAnchor: "start" | "middle" | "end";
        score: number;
      }
    | null = null;

  for (const anchor of anchorList) {
    for (const offset of preferredOffsets) {
      const point = {
        x: clamp(
          anchor.x + offset.x,
          placementBounds.minX + horizontalPadding,
          placementBounds.maxX - horizontalPadding,
        ),
        y: clamp(
          anchor.y + offset.y,
          placementBounds.minY + verticalPadding,
          placementBounds.maxY - verticalPadding,
        ),
      };
      const textAnchor =
        offset.x < -minDx * 0.05
          ? "end"
          : Math.abs(offset.x) <= minDx * 0.05
            ? "middle"
            : "start";
      const overlapsExisting = labels.some(
        (label) =>
          Math.abs(label.point.x - point.x) < minDx &&
          Math.abs(label.point.y - point.y) < minDy,
      );
      const overlapsObstacle = avoidPoints.some(
        (obstacle) =>
          Math.abs(obstacle.x - point.x) < minDx * 0.72 &&
          Math.abs(obstacle.y - point.y) < minDy * 0.72,
      );
      const nearestExistingDistance = labels.reduce((nearest, label) => {
        const dx = label.point.x - point.x;
        const dy = label.point.y - point.y;
        return Math.min(nearest, Math.hypot(dx, dy));
      }, Number.POSITIVE_INFINITY);
      const nearestObstacleDistance = avoidPoints.reduce((nearest, obstacle) => {
        const dx = obstacle.x - point.x;
        const dy = obstacle.y - point.y;
        return Math.min(nearest, Math.hypot(dx, dy));
      }, Number.POSITIVE_INFINITY);
      const boundsDistance = Math.min(
        point.x - placementBounds.minX,
        placementBounds.maxX - point.x,
        point.y - placementBounds.minY,
        placementBounds.maxY - point.y,
      );
      const anchorDrift = Math.hypot(point.x - anchor.x, point.y - anchor.y);
      const score =
        (Number.isFinite(nearestExistingDistance) ? nearestExistingDistance : minDx * 2) * 1.25 +
        (Number.isFinite(nearestObstacleDistance) ? nearestObstacleDistance : minDx * 1.5) * 0.95 +
        boundsDistance * 0.18 -
        anchorDrift * 0.12;

      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = { point, textAnchor, score };
      }

      if (!overlapsExisting && !overlapsObstacle) {
        labels.push({ id, featureId, text, point, textAnchor, density });
        return;
      }
    }
  }

  labels.push({
    id,
    featureId,
    text,
    point:
      bestCandidate?.point ?? {
        x: anchorList[0].x + preferredOffsets[0].x,
        y: anchorList[0].y + preferredOffsets[0].y,
      },
    textAnchor: bestCandidate?.textAnchor ?? "start",
    density,
  });
}

function refineDisplayTracePoints(
  result: VisibilitySolveResult,
  rawTransform: (point: Vec2) => Vec2,
  launchAngleRad: number,
  targetAngleRad: number | null,
  maxArcLengthM: number,
) {
  const refinedTrace = traceRayForDisplay({
    scenario: result.scenario,
    model: result.model,
    terrainProfile: result.terrainProfile,
    launchAngleRad,
    targetAngleRad,
    maxArcLengthM,
  });

  return refinedTrace.points.map(rawTransform);
}

export function buildSceneViewModel(
  result: VisibilitySolveResult,
  title: string,
  sceneKey: FocusedModel,
  unitPreferences: UnitPreferences,
  language: LanguageMode = "en",
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
        getObserverTotalHeightM(result.scenario),
      ),
    );
  });

  const rawTargetBase = rawTransform(result.targetBasePoint);
  const rawTargetTop = rawTransform(result.targetTopPoint);
  const rawObserverBase = rawTransform(result.observerSurfacePoint);
  const rawOpticalHorizon = result.opticalHorizon
    ? rawTransform(result.opticalHorizon.point)
    : null;
  const rawOpticalHorizonTrace = result.opticalHorizon?.trace
    ? refineDisplayTracePoints(
        result,
        rawTransform,
        result.opticalHorizon.trace.launchAngleRad,
        null,
        result.opticalHorizon.trace.points[result.opticalHorizon.trace.points.length - 1]?.s ??
          result.opticalHorizon.distanceM,
      )
    : [];
  const rawGeometricHorizon = result.geometricHorizon
    ? rawTransform(result.geometricHorizon.point)
    : null;
  const rawGeometricSightline = [rawTransform(result.observerPoint), rawTargetTop];
  const visibleSamples = result.targetSamples.filter(
    (sample) => sample.visible && sample.trace?.targetCrossing,
  );
  const referenceVisibleSample = visibleSamples.length
    ? result.hiddenHeightM > 0
      ? visibleSamples[0]
      : visibleSamples[visibleSamples.length - 1]
    : null;
  const rawReferenceTargetPoint = referenceVisibleSample
    ? rawTransform(
        pointAtSurfaceHeight(
          result.scenario.radiusM,
          result.targetAngleRad,
          result.model.geometryMode,
          referenceVisibleSample.absoluteHeightM,
        ),
      )
    : null;
  const rawReferenceLightPath =
    referenceVisibleSample?.trace
      ? refineDisplayTracePoints(
          result,
          rawTransform,
          referenceVisibleSample.trace.launchAngleRad,
          referenceVisibleSample.targetAngleRad,
          referenceVisibleSample.trace.points[
            referenceVisibleSample.trace.points.length - 1
          ]?.s ?? result.scenario.surfaceDistanceM,
        )
      : [];
  const targetVisibleStartHeight =
    result.visibleHeightM > 0
      ? result.scenario.targetBaseElevationM + result.hiddenHeightM
      : getTargetTopElevationM(result.scenario);
  const rawTargetVisibleStart = rawTransform(
    pointAtSurfaceHeight(
      result.scenario.radiusM,
      result.targetAngleRad,
      result.model.geometryMode,
      targetVisibleStartHeight,
    ),
  );
  const rawRayPoints = result.primaryRay
    ? refineDisplayTracePoints(
        result,
        rawTransform,
        result.primaryRay.launchAngleRad,
        result.primaryRay.targetCrossing ? result.targetAngleRad : null,
        result.primaryRay.points[result.primaryRay.points.length - 1]?.s ??
          result.scenario.surfaceDistanceM,
      )
    : [];
  const highestVisibleSample = visibleSamples[visibleSamples.length - 1] ?? null;
  const resolvedReferenceConstruction =
    result.model.lineBehavior.referenceConstruction === "auto"
      ? result.model.geometryMode === "convex"
        ? "curved-altitude"
        : "curvilinear-tangent"
      : result.model.lineBehavior.referenceConstruction;
  const resolvedObjectLightPathMode =
    result.model.lineBehavior.objectLightPath === "auto"
      ? "traced"
      : result.model.lineBehavior.objectLightPath;
  const resolvedOpticalHorizonRayMode =
    result.model.lineBehavior.opticalHorizonRay === "auto"
      ? "traced"
      : result.model.lineBehavior.opticalHorizonRay;
  const resolvedApparentDirectionMode =
    result.model.lineBehavior.apparentDirection === "auto"
      ? result.visible
        ? "target"
        : "horizon"
      : result.model.lineBehavior.apparentDirection;

  const verticalExaggeration = getVerticalExaggeration(forwardDistanceM + backDistanceM, [
    ...rawSurfaceSamples,
    ...rawObserverAltitudeCurve,
    rawTargetBase,
    rawTargetTop,
    rawObserverBase,
    rawTargetVisibleStart,
    ...(rawReferenceTargetPoint ? [rawReferenceTargetPoint] : []),
    ...rawGeometricSightline,
    ...(rawOpticalHorizon ? [rawOpticalHorizon] : []),
    ...rawOpticalHorizonTrace,
    ...(rawGeometricHorizon ? [rawGeometricHorizon] : []),
    ...rawRayPoints,
    ...rawReferenceLightPath,
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
  const referenceTargetPoint = rawReferenceTargetPoint
    ? exaggerate(rawReferenceTargetPoint)
    : null;
  const referenceLightPath = rawReferenceLightPath.map(exaggerate);
  const opticalHorizonTrace = rawOpticalHorizonTrace.map(exaggerate);
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
                      Math.max(2_500, getObserverTotalHeightM(result.scenario) + 1_000),
                    ),
                  ),
                );
            }),
          ],
        }
      : undefined;

  const terrainOverlay = buildTerrainOverlay(result, rawTransform, exaggerate);
  const featureDefinitions = getFeatureDefinitions(result, terrainOverlay, language);
  const referenceConstructionLabel = featureDefinitions["observer-altitude-curve"].label;
  const referenceConstructionPoints =
    resolvedReferenceConstruction === "straight-horizontal"
      ? [
          { x: -backDistanceM * 0.45, y: 0 },
          { x: forwardDistanceM, y: 0 },
        ]
      : observerAltitudeCurve;
  const sourceLightPathPoints =
    resolvedObjectLightPathMode === "straight" && referenceTargetPoint
      ? [referenceTargetPoint, { x: 0, y: 0 }]
      : referenceLightPath.length > 1
        ? referenceLightPath.slice().reverse()
        : [];
  const apparentElevationForDisplay =
    resolvedApparentDirectionMode === "hidden"
      ? null
      : resolvedApparentDirectionMode === "horizon"
        ? result.opticalHorizon?.apparentElevationRad ?? result.apparentElevationRad
      : resolvedApparentDirectionMode === "target"
          ? highestVisibleSample?.apparentElevationRad ?? result.apparentElevationRad
          : result.apparentElevationRad;
  const visibilityPolygons: SceneViewModel["visibilityPolygons"] = [];
  if (result.model.geometryMode === "concave" && opticalHorizonPoint) {
    const bandThickness = clamp(
      getTargetTopElevationM(result.scenario) * verticalExaggeration * 0.02,
      Math.max(18, verticalExaggeration * 0.3),
      Math.max(220, verticalExaggeration * 4.5),
    );
    const visibleSurfaceArc = [
      observerBase,
      ...surfaceSamples.filter(
        (point) => point.x > observerBase.x && point.x < opticalHorizonPoint.x,
      ),
      opticalHorizonPoint,
    ];

    if (visibleSurfaceArc.length >= 2) {
      const visibleBandTop = offsetSurfaceBand(visibleSurfaceArc, bandThickness);
      visibilityPolygons.push({
        id: "visible-surface-region",
        fill: "rgba(241, 215, 108, 0.18)",
        opacity: 1,
        points: [...visibleBandTop, ...visibleSurfaceArc.slice().reverse()],
      });
    }

    const shadowExtentX = clamp(
      targetBase?.x ?? forwardDistanceM * 0.94,
      opticalHorizonPoint.x + 60,
      forwardDistanceM * 0.97,
    );
    if (shadowExtentX > opticalHorizonPoint.x + 50) {
      const hiddenSurfaceArc = [
        opticalHorizonPoint,
        ...surfaceSamples.filter(
          (point) => point.x > opticalHorizonPoint.x && point.x < shadowExtentX,
        ),
        pointOnPolyline(surfaceSamples, 0.94),
      ].filter((point, index, points) =>
        index === 0 ||
        index === points.length - 1 ||
        Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y) > 1,
      );

      if (hiddenSurfaceArc.length >= 2) {
        const shadowBandTop = offsetSurfaceBand(hiddenSurfaceArc, bandThickness * 0.92);
        visibilityPolygons.push({
          id: "shadow-surface-region",
          fill: "rgba(117, 208, 255, 0.12)",
          opacity: 1,
          points: [...shadowBandTop, ...hiddenSurfaceArc.slice().reverse()],
        });
      }
    }
  }

  const lines: SceneLine[] = [
    makePolyline(
      "surface-line",
      "surface",
      featurePalette.surface,
      surfaceSamples,
      2.5,
      false,
      featureDefinitions.surface.label,
    ),
    makePolyline(
      "geometric-sightline",
      "geometric-sightline",
      featurePalette.geometricSightline,
      geometricSightline,
      1.45,
      true,
      featureDefinitions["geometric-sightline"].label,
    ),
  ];

  if (resolvedReferenceConstruction !== "hidden") {
    lines.splice(
      1,
      0,
      makePolyline(
        "observer-altitude-curve",
        "observer-altitude-curve",
        featurePalette.observerAltitudeCurve,
        referenceConstructionPoints,
        1.55,
        true,
        referenceConstructionLabel,
      ),
    );
  }

  if (referenceTargetPoint && result.model.lineBehavior.showSourceGeometricPath) {
    lines.push(
      makePolyline(
        "source-geometric-path",
        "source-geometric-path",
        featurePalette.sourceGeometricPath,
        [referenceTargetPoint, { x: 0, y: 0 }],
        1.8,
        true,
        featureDefinitions["source-geometric-path"].label,
      ),
    );
  }

  if (sourceLightPathPoints.length > 1 && resolvedObjectLightPathMode !== "hidden") {
    lines.push(
      makePolyline(
        "source-light-path",
        "source-light-path",
        featurePalette.sourceLightPath,
        sourceLightPathPoints,
        3.05,
        false,
        featureDefinitions["source-light-path"].label,
      ),
    );
  }

  if (result.primaryRay && !result.primaryRay.targetCrossing) {
    lines.push(
      makePolyline(
        "primary-ray",
        "actual-ray",
        featurePalette.actualRay,
        rawRayPoints.map(exaggerate),
        2.4,
        false,
        featureDefinitions["actual-ray"].label,
      ),
    );
  }

  if (resolvedOpticalHorizonRayMode === "traced" && opticalHorizonTrace.length > 1) {
    lines.push(
      makePolyline(
        "optical-horizon-trace",
        "horizon-optical",
        featurePalette.opticalHorizon,
        opticalHorizonTrace,
        2,
        true,
        `${featureDefinitions["horizon-optical"].label} Ray`,
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
      id: "observer-stem",
      featureId: "observer-height",
      label: featureDefinitions["observer-height"].label,
      color: featurePalette.observerStem,
      width: 3,
      from: observerBase,
      to: { x: 0, y: 0 },
    },
    {
      id: "target-stem",
      featureId: "target-height",
      label: featureDefinitions["target-height"].label,
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
      label: featureDefinitions["hidden-height"].label,
      color: featurePalette.hiddenHeight,
      width: 4,
      from: targetBase,
      to: targetVisibleStart,
    });
  }

  if (result.model.lineBehavior.showObserverHorizontal) {
    segments.unshift({
      id: "observer-horizontal",
      featureId: "observer-horizontal",
      label: featureDefinitions["observer-horizontal"].label,
      color: featurePalette.observerHorizontal,
      width: 1.6,
      dashed: true,
      from: { x: -backDistanceM * 0.45, y: 0 },
      to: { x: forwardDistanceM, y: 0 },
    });
  }

  if (apparentElevationForDisplay != null) {
    segments.push({
      id: "apparent-line",
      featureId: "apparent-line",
      label: featureDefinitions["apparent-line"].label,
      color: featurePalette.apparentLine,
      width: 1.75,
      dashed: true,
      from: { x: 0, y: 0 },
      to: {
        x: Math.cos(apparentElevationForDisplay) * forwardDistanceM,
        y: Math.sin(apparentElevationForDisplay) * forwardDistanceM * verticalExaggeration,
      },
    });
  }

  if (
    opticalHorizonPoint &&
    resolvedOpticalHorizonRayMode === "straight" &&
    result.opticalHorizon
  ) {
    segments.push({
      id: "optical-horizon-ray",
      featureId: "horizon-optical",
      label: `${featureDefinitions["horizon-optical"].label} Ray`,
      color: featurePalette.opticalHorizon,
      width: 1.8,
      dashed: true,
      from: { x: 0, y: 0 },
      to: opticalHorizonPoint,
    });
  }

  if (geometricHorizonPoint && result.model.lineBehavior.showGeometricHorizon) {
    segments.push({
      id: "geometric-horizon-ray",
      featureId: "horizon-geometric",
      label: featureDefinitions["horizon-geometric"].label,
      color: featurePalette.geometricHorizon,
      width: 1.75,
      dashed: true,
      from: { x: 0, y: 0 },
      to: geometricHorizonPoint,
    });
  }

  const markers: SceneViewModel["markers"] = [
    {
      id: "observer",
      featureId: "observer-horizontal",
      point: { x: 0, y: 0 },
      label: t(language, "observer"),
      color: featurePalette.observerMarker,
      labelOffset: { x: 12, y: -24 },
    },
    {
      id: "target",
      featureId: "geometric-sightline",
      point: targetTop,
      label: t(language, "target"),
      color: featurePalette.targetMarker,
      labelOffset: { x: 18, y: -20 },
    },
  ];

  if (referenceTargetPoint && resolvedObjectLightPathMode !== "hidden") {
    markers.push({
      id: "source-point",
      featureId: "source-light-path",
      point: referenceTargetPoint,
      label: result.hiddenHeightM > 0 ? t(language, "sightedPoint") : t(language, "sourcePoint"),
      color: featurePalette.sourceLightPath,
      labelOffset: { x: 18, y: -18 },
      density: "full",
    });
  }

  if (opticalHorizonPoint) {
    markers.push({
      id: "optical-horizon",
      featureId: "horizon-optical",
      point: opticalHorizonPoint,
      label: featureDefinitions["horizon-optical"].label,
      color: featurePalette.opticalHorizon,
      labelOffset: { x: 18, y: -26 },
    });
  }

  if (geometricHorizonPoint && result.model.lineBehavior.showGeometricHorizon) {
    markers.push({
      id: "geometric-horizon",
      featureId: "horizon-geometric",
      point: geometricHorizonPoint,
      label: featureDefinitions["horizon-geometric"].label,
      color: featurePalette.geometricHorizon,
      labelOffset: { x: 18, y: 28 },
    });
  }

  const labelPlacementBounds = collectBounds([
    ...surfaceSamples,
    ...referenceConstructionPoints,
    ...geometricSightline,
    ...segments.flatMap((segment) => [segment.from, segment.to]),
    ...lines.flatMap((line) => line.points),
    ...markers.map((marker) => marker.point),
  ]);

  const labels: SceneViewModel["labels"] = [];
  const labelObstaclePoints: Vec2[] = [
    { x: 0, y: 0 },
    observerBase,
    targetBase,
    targetTop,
    targetVisibleStart,
    ...segments.flatMap((segment) => [
      segment.from,
      segment.to,
      pointAlongSegment(segment.from, segment.to, 0.5),
    ]),
    ...markers.map((marker) => marker.point),
    ...(referenceTargetPoint ? [referenceTargetPoint] : []),
    ...(opticalHorizonPoint ? [opticalHorizonPoint] : []),
    ...(geometricHorizonPoint ? [geometricHorizonPoint] : []),
  ];
  const mediumOffsetX = clamp(result.scenario.surfaceDistanceM * 0.06, 1_600, 8_200);
  const shortOffsetX = clamp(result.scenario.surfaceDistanceM * 0.03, 900, 4_200);
  const labelRise = clamp(verticalExaggeration * 26, 260, 2_200);
  const labelDrop = -labelRise * 0.84;
  const labelMinDx = clamp(result.scenario.surfaceDistanceM * 0.12, 3_000, 18_000);
  const labelMinDy = clamp(verticalExaggeration * 44, 360, 3_400);

  placeLabel(
    labels,
    "surface-line-label",
    "surface",
    featureDefinitions.surface.label,
    pointsOnPolyline(surfaceSamples, result.model.geometryMode === "convex" ? [0.72, 0.58, 0.82] : [0.66, 0.54, 0.78]),
    [
      { x: mediumOffsetX * 0.12, y: labelDrop },
      { x: -mediumOffsetX * 0.18, y: labelDrop * 0.9 },
      { x: mediumOffsetX * 0.12, y: labelRise * 0.45 },
    ],
    labelMinDx,
    labelMinDy,
    labelPlacementBounds,
    "adaptive",
    labelObstaclePoints,
  );

  if (result.model.lineBehavior.showObserverHorizontal) {
    placeLabel(
      labels,
      "observer-horizontal-label",
      "observer-horizontal",
      featureDefinitions["observer-horizontal"].label,
      [
        pointAlongSegment({ x: -backDistanceM * 0.45, y: 0 }, { x: forwardDistanceM, y: 0 }, 0.66),
        pointAlongSegment({ x: -backDistanceM * 0.45, y: 0 }, { x: forwardDistanceM, y: 0 }, 0.78),
        pointAlongSegment({ x: -backDistanceM * 0.45, y: 0 }, { x: forwardDistanceM, y: 0 }, 0.54),
      ],
      [
        { x: 0, y: labelRise * 1.18 },
        { x: mediumOffsetX * 0.22, y: labelRise * 1.12 },
        { x: -mediumOffsetX * 0.16, y: labelRise * 1.04 },
      ],
      labelMinDx,
      labelMinDy,
      labelPlacementBounds,
      "adaptive",
      labelObstaclePoints,
    );
  }

  if (resolvedReferenceConstruction !== "hidden") {
    placeLabel(
      labels,
      "observer-altitude-curve-label",
      "observer-altitude-curve",
      referenceConstructionLabel,
      pointsOnPolyline(
        referenceConstructionPoints,
        resolvedReferenceConstruction === "straight-horizontal"
          ? [0.58, 0.72, 0.42]
          : result.model.geometryMode === "convex"
            ? [0.7, 0.58, 0.82]
            : [0.74, 0.62, 0.84],
      ),
      [
        { x: shortOffsetX * 0.12, y: labelRise * 0.78 },
        { x: mediumOffsetX * 0.24, y: labelRise * 0.66 },
        { x: -mediumOffsetX * 0.12, y: labelDrop * 0.88 },
      ],
      labelMinDx,
      labelMinDy,
      labelPlacementBounds,
      "adaptive",
      labelObstaclePoints,
    );
  }

  placeLabel(
    labels,
    "geometric-sightline-label",
    "geometric-sightline",
    featureDefinitions["geometric-sightline"].label,
    pointsOnPolyline(geometricSightline, result.model.geometryMode === "convex" ? [0.58, 0.72, 0.44] : [0.64, 0.78, 0.5]),
    [
      { x: shortOffsetX * 0.18, y: labelDrop * 0.96 },
      { x: mediumOffsetX * 0.26, y: labelDrop * 1.08 },
      { x: -mediumOffsetX * 0.18, y: labelRise * 0.7 },
    ],
    labelMinDx,
    labelMinDy,
    labelPlacementBounds,
    "adaptive",
    labelObstaclePoints,
  );

  if (referenceTargetPoint && result.model.lineBehavior.showSourceGeometricPath) {
    placeLabel(
      labels,
      "source-geometric-path-label",
      "source-geometric-path",
      featureDefinitions["source-geometric-path"].label,
      [
        pointAlongSegment(referenceTargetPoint, { x: 0, y: 0 }, 0.66),
        pointAlongSegment(referenceTargetPoint, { x: 0, y: 0 }, 0.52),
        pointAlongSegment(referenceTargetPoint, { x: 0, y: 0 }, 0.78),
      ],
      [
        { x: shortOffsetX * 0.18, y: labelDrop * 0.88 },
        { x: mediumOffsetX * 0.26, y: labelDrop * 1.02 },
        { x: -mediumOffsetX * 0.12, y: labelRise * 0.68 },
      ],
      labelMinDx,
      labelMinDy,
      labelPlacementBounds,
      "adaptive",
      labelObstaclePoints,
    );
  }

  if (sourceLightPathPoints.length > 1 && resolvedObjectLightPathMode !== "hidden") {
    placeLabel(
      labels,
      "source-light-path-label",
      "source-light-path",
      featureDefinitions["source-light-path"].label,
      pointsOnPolyline(
        sourceLightPathPoints,
        resolvedObjectLightPathMode === "straight"
          ? [0.56, 0.7, 0.42]
          : result.model.geometryMode === "convex"
            ? [0.66, 0.52, 0.8]
            : [0.74, 0.6, 0.84],
      ),
      [
        { x: shortOffsetX * 0.12, y: labelRise * 0.82 },
        { x: mediumOffsetX * 0.24, y: labelRise * 0.94 },
        { x: -mediumOffsetX * 0.14, y: labelDrop * 0.78 },
      ],
      labelMinDx,
      labelMinDy,
      labelPlacementBounds,
      "adaptive",
      labelObstaclePoints,
    );
  }

  if (result.primaryRay) {
    const primaryRayPoints = rawRayPoints.map(exaggerate);
    const curvedPathForLabel =
      result.primaryRay.targetCrossing && sourceLightPathPoints.length > 1
        ? sourceLightPathPoints
        : primaryRayPoints;

    if (!result.primaryRay.targetCrossing) {
      placeLabel(
        labels,
        "actual-ray-label",
        "actual-ray",
        featureDefinitions["actual-ray"].label,
        pointsOnPolyline(primaryRayPoints, result.model.geometryMode === "convex" ? [0.62, 0.48, 0.74] : [0.68, 0.52, 0.8]),
        [
          { x: shortOffsetX * 0.12, y: labelRise * 0.8 },
          { x: mediumOffsetX * 0.18, y: labelRise * 0.96 },
          { x: -mediumOffsetX * 0.14, y: labelDrop * 0.86 },
        ],
        labelMinDx,
        labelMinDy,
        labelPlacementBounds,
        "adaptive",
        labelObstaclePoints,
      );
    }

    if (!result.primaryRay.targetCrossing || resolvedObjectLightPathMode !== "hidden") {
      placeLabel(
        labels,
        "ray-bend",
        result.primaryRay.targetCrossing ? "source-light-path" : "actual-ray",
        t(language, "rayBend", {
          value: formatAngle(result.primaryRay.totalBendRad),
        }),
        pointsOnPolyline(
          curvedPathForLabel,
          result.model.geometryMode === "convex" ? [0.34, 0.46] : [0.4, 0.52],
        ),
        [
          { x: shortOffsetX * 0.08, y: labelRise * 0.46 },
          { x: mediumOffsetX * 0.12, y: labelRise * 0.46 },
        ],
        labelMinDx * 0.7,
        labelMinDy * 0.72,
        labelPlacementBounds,
        "full",
        labelObstaclePoints,
      );
    }
  }

  if (apparentElevationForDisplay != null) {
    const apparentLineEnd = {
      x: Math.cos(apparentElevationForDisplay) * forwardDistanceM,
      y: Math.sin(apparentElevationForDisplay) * forwardDistanceM * verticalExaggeration,
    };

    placeLabel(
      labels,
      "apparent-line-label",
      "apparent-line",
      featureDefinitions["apparent-line"].label,
      [
        pointAlongSegment({ x: 0, y: 0 }, apparentLineEnd, 0.8),
        pointAlongSegment({ x: 0, y: 0 }, apparentLineEnd, 0.66),
        pointAlongSegment({ x: 0, y: 0 }, apparentLineEnd, 0.9),
      ],
      [
        { x: shortOffsetX * 0.16, y: labelRise * 0.72 },
        { x: mediumOffsetX * 0.24, y: labelRise * 0.84 },
        { x: shortOffsetX * 0.12, y: labelDrop * 0.76 },
      ],
      labelMinDx,
      labelMinDy,
      labelPlacementBounds,
      "adaptive",
      labelObstaclePoints,
    );
  }

  if (geometricHorizonPoint && result.model.lineBehavior.showGeometricHorizon) {
    placeLabel(
      labels,
      "geometric-horizon-line-label",
      "horizon-geometric",
      featureDefinitions["horizon-geometric"].label,
      [
        pointAlongSegment({ x: 0, y: 0 }, geometricHorizonPoint, 0.46),
        pointAlongSegment({ x: 0, y: 0 }, geometricHorizonPoint, 0.58),
        pointAlongSegment({ x: 0, y: 0 }, geometricHorizonPoint, 0.34),
      ],
      [
        { x: shortOffsetX * 0.14, y: labelDrop * 0.74 },
        { x: mediumOffsetX * 0.22, y: labelDrop * 0.88 },
        { x: -mediumOffsetX * 0.12, y: labelRise * 0.7 },
      ],
      labelMinDx,
      labelMinDy,
      labelPlacementBounds,
      "adaptive",
      labelObstaclePoints,
    );
  }

  if (opticalHorizonPoint && resolvedOpticalHorizonRayMode !== "hidden") {
    const opticalAnchor =
      resolvedOpticalHorizonRayMode === "traced" && opticalHorizonTrace.length > 1
        ? pointOnPolyline(opticalHorizonTrace, 0.72)
        : pointAlongSegment({ x: 0, y: 0 }, opticalHorizonPoint, 0.7);

    placeLabel(
      labels,
      "optical-horizon-line-label",
      "horizon-optical",
      `${featureDefinitions["horizon-optical"].label} Ray`,
      resolvedOpticalHorizonRayMode === "traced" && opticalHorizonTrace.length > 1
        ? pointsOnPolyline(opticalHorizonTrace, [0.72, 0.58, 0.84])
        : [
            opticalAnchor,
            pointAlongSegment({ x: 0, y: 0 }, opticalHorizonPoint, 0.58),
            pointAlongSegment({ x: 0, y: 0 }, opticalHorizonPoint, 0.84),
          ],
      [
        { x: shortOffsetX * 0.14, y: labelRise * 0.86 },
        { x: mediumOffsetX * 0.24, y: labelRise * 1.04 },
        { x: -mediumOffsetX * 0.14, y: labelDrop * 0.82 },
      ],
      labelMinDx,
      labelMinDy,
      labelPlacementBounds,
      "adaptive",
      labelObstaclePoints,
    );
  }

  placeLabel(
    labels,
    "distance-label",
    "surface",
    t(language, "surfaceDistanceShort", {
      value: formatDistance(result.scenario.surfaceDistanceM, unitPreferences.distance),
    }),
    { x: result.scenario.surfaceDistanceM * 0.42, y: -verticalExaggeration * 26 },
    [
      { x: 0, y: 0 },
      { x: mediumOffsetX * 0.14, y: labelDrop * 0.66 },
      { x: -mediumOffsetX * 0.12, y: labelDrop * 0.66 },
    ],
    labelMinDx * 0.85,
    labelMinDy * 0.82,
    labelPlacementBounds,
    "adaptive",
    labelObstaclePoints,
  );

  placeLabel(
    labels,
    "observer-height-label",
    "observer-height",
    t(language, "observerHeightShort", {
      value: formatHeight(getObserverTotalHeightM(result.scenario), unitPreferences.height),
    }),
    pointAlongSegment(observerBase, { x: 0, y: 0 }, 0.56),
    [
      { x: -shortOffsetX * 0.4, y: labelDrop * 0.46 },
      { x: shortOffsetX * 0.1, y: labelRise * 0.2 },
    ],
    labelMinDx * 0.72,
    labelMinDy * 0.7,
    labelPlacementBounds,
    "adaptive",
    labelObstaclePoints,
  );

  placeLabel(
    labels,
    "target-height-label",
    "target-height",
    t(language, "targetHeightShort", {
      value: formatHeight(result.scenario.targetHeightM, unitPreferences.height),
    }),
    pointAlongSegment(targetBase, targetTop, 0.72),
    [
      { x: shortOffsetX * 0.16, y: labelRise * 0.14 },
      { x: shortOffsetX * 0.22, y: labelDrop * 0.44 },
    ],
    labelMinDx * 0.72,
    labelMinDy * 0.7,
    labelPlacementBounds,
    "adaptive",
    labelObstaclePoints,
  );

  if (result.hiddenHeightM > 0) {
    placeLabel(
      labels,
      "hidden-height",
      "hidden-height",
      t(language, "hiddenShort", {
        value: formatHeight(result.hiddenHeightM, unitPreferences.height),
      }),
      pointAlongSegment(targetBase, targetVisibleStart, 0.5),
      [
        { x: shortOffsetX * 0.2, y: 0 },
        { x: shortOffsetX * 0.2, y: labelRise * 0.22 },
      ],
      labelMinDx * 0.72,
      labelMinDy * 0.7,
      labelPlacementBounds,
      "adaptive",
      labelObstaclePoints,
    );
  }

  placeLabel(
    labels,
    "visibility-label",
    "hidden-height",
    t(language, "visibilityShort", {
      value: formatFraction(result.visibilityFraction),
    }),
    {
      x: result.scenario.surfaceDistanceM * 0.58,
      y: verticalExaggeration * 22,
    },
    [
      { x: 0, y: 0 },
      { x: mediumOffsetX * 0.12, y: labelRise * 0.18 },
    ],
    labelMinDx * 0.8,
    labelMinDy * 0.76,
    labelPlacementBounds,
    "adaptive",
    labelObstaclePoints,
  );

  if (terrainOverlay) {
    placeLabel(
      labels,
      "terrain-profile-label",
      "terrain-profile",
      terrainOverlay.name,
      terrainOverlay.line.points.reduce((highest, point) =>
        point.y > highest.y ? point : highest,
      ),
      [
        { x: shortOffsetX * 0.18, y: labelRise * 0.22 },
        { x: shortOffsetX * 0.18, y: labelDrop * 0.42 },
      ],
      labelMinDx * 0.72,
      labelMinDy * 0.7,
      labelPlacementBounds,
      "full",
      labelObstaclePoints,
    );
  }

  const geometryPoints = [
    ...surfaceSamples,
    ...referenceConstructionPoints,
    ...geometricSightline,
    ...segments.flatMap((segment) => [segment.from, segment.to]),
    ...markers.map((marker) => marker.point),
    ...lines.flatMap((line) => line.points),
  ];
  const bounds = collectBounds(geometryPoints, {
    xPaddingFactor: 0.08,
    minXPad: Math.max(950, result.scenario.surfaceDistanceM * 0.014),
    topPaddingFactor: 0.18,
    bottomPaddingFactor: 0.28,
    minTopPad: Math.max(220, getTargetTopElevationM(result.scenario) * 0.12),
    minBottomPad: Math.max(260, getTargetTopElevationM(result.scenario) * 0.2),
  });
  const focusBounds = createFocusBounds(result, geometryPoints);
  const visibleFeatureIds = new Set<string>([
    ...lines.map((line) => line.featureId),
    ...segments.map((segment) => segment.featureId),
  ]);

  return {
    sceneKey,
    title,
    subtitle: `${getModelLabel(language, result.model)} | ${t(language, "hiddenShort", {
      value: formatHeight(result.hiddenHeightM, unitPreferences.height),
    })} | ${t(language, "apparentShort", {
      value: formatAngle(apparentElevationForDisplay),
    })}`,
    bounds,
    focusBounds,
    suggestedVerticalScale: verticalExaggeration,
    surfaceFill,
    atmosphereFill,
    visibilityPolygons: visibilityPolygons.length ? visibilityPolygons : undefined,
    terrainOverlay,
    surfaceLine: lines[0],
    observerStem: segments.find((segment) => segment.id === "observer-stem")!,
    targetStem: segments.find((segment) => segment.id === "target-stem")!,
    hiddenStem: segments.find((segment) => segment.id === "hidden-stem"),
    markers,
    labels,
    lines,
    segments,
    annotations: buildAnnotationMap(result, terrainOverlay, language).filter((annotation) =>
      visibleFeatureIds.has(annotation.id),
    ),
  };
}
