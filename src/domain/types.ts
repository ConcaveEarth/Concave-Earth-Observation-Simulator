export type GeometryMode = "convex" | "concave";
export type IntrinsicCurvatureMode = "none" | "1/R" | "2/R" | "constant";
export type AtmosphereMode = "none" | "simpleCoefficient";
export type ViewMode = "cross-section" | "compare";
export type FocusedModel = "primary" | "comparison";

export interface Vec2 {
  x: number;
  y: number;
}

export interface ScenarioInput {
  observerHeightM: number;
  targetHeightM: number;
  surfaceDistanceM: number;
  radiusM: number;
  targetSampleCount: number;
  presetId: string;
  units: "metric";
}

export interface AtmosphereConfig {
  mode: AtmosphereMode;
  coefficient: number;
}

export interface ModelConfig {
  id: string;
  label: string;
  geometryMode: GeometryMode;
  intrinsicCurvatureMode: IntrinsicCurvatureMode;
  intrinsicCurvaturePerM: number;
  atmosphere: AtmosphereConfig;
}

export interface RayPoint extends Vec2 {
  s: number;
  headingRad: number;
}

export interface RayTargetCrossing {
  position: Vec2;
  arcLengthM: number;
  radialDistanceM: number;
  heightM: number;
  missHeightM: number;
  fraction: number;
}

export interface RayTrace {
  launchAngleRad: number;
  points: RayPoint[];
  incomingHeadingRad: number;
  totalBendRad: number;
  terminationReason: "target-angle" | "surface-intersection" | "max-arc";
  firstSurfaceIntersection?: Vec2;
  firstSurfaceArcLengthM?: number;
  targetCrossing?: RayTargetCrossing;
  minSurfaceClearanceM: number;
}

export interface VisibilitySample {
  sampleHeightM: number;
  visible: boolean;
  trace?: RayTrace;
  apparentElevationRad?: number;
  actualElevationRad: number;
  missHeightM: number;
}

export interface HorizonResult {
  point: Vec2;
  surfaceAngleRad: number;
  trace?: RayTrace;
  distanceM: number;
  apparentElevationRad: number;
}

export interface SolverMetadata {
  stepM: number;
  maxArcLengthM: number;
  sampleCount: number;
  solvedVisibleSamples: number;
}

export interface VisibilitySolveResult {
  scenario: ScenarioInput;
  model: ModelConfig;
  observerPoint: Vec2;
  observerSurfacePoint: Vec2;
  targetBasePoint: Vec2;
  targetTopPoint: Vec2;
  targetAngleRad: number;
  observerTangent: Vec2;
  observerUp: Vec2;
  geometricHorizon: HorizonResult | null;
  opticalHorizon: HorizonResult | null;
  targetSamples: VisibilitySample[];
  primaryRay: RayTrace | null;
  visible: boolean;
  hiddenHeightM: number;
  visibleHeightM: number;
  visibilityFraction: number;
  apparentElevationRad: number | null;
  actualElevationRad: number;
  firstBlockingIntersection: Vec2 | null;
  solverMetadata: SolverMetadata;
}

export interface SurfaceAnnotation {
  id: string;
  label: string;
  description: string;
  color: string;
}

export interface TerrainProfileSample {
  distanceM: number;
  heightM: number;
}

export interface TerrainProfilePreset {
  id: string;
  name: string;
  description: string;
  strokeColor?: string;
  fillColor?: string;
  samples: TerrainProfileSample[];
}

export interface SceneLine {
  id: string;
  featureId: string;
  label?: string;
  color: string;
  width: number;
  dashed?: boolean;
  points: Vec2[];
}

export interface SceneSegment {
  id: string;
  featureId: string;
  label?: string;
  color: string;
  width: number;
  dashed?: boolean;
  from: Vec2;
  to: Vec2;
}

export interface SceneMarker {
  id: string;
  featureId: string;
  point: Vec2;
  label: string;
  color: string;
  labelOffset?: Vec2;
  hideLabel?: boolean;
  density?: "adaptive" | "full";
}

export interface SceneLabel {
  id: string;
  featureId: string;
  text: string;
  point: Vec2;
  density?: "adaptive" | "full";
}

export interface ScenePolygon {
  id: string;
  points: Vec2[];
  fill: string;
  opacity: number;
}

export interface SceneTerrainOverlay {
  id: string;
  featureId: string;
  name: string;
  description: string;
  maxHeightM: number;
  spanDistanceM: number;
  line: SceneLine;
  fill?: ScenePolygon;
}

export interface SceneBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface SceneViewModel {
  sceneKey: FocusedModel;
  title: string;
  subtitle: string;
  bounds: SceneBounds;
  focusBounds: SceneBounds;
  suggestedVerticalScale: number;
  surfaceFill: ScenePolygon;
  atmosphereFill?: ScenePolygon;
  terrainOverlay?: SceneTerrainOverlay;
  surfaceLine: SceneLine;
  observerStem: SceneSegment;
  targetStem: SceneSegment;
  hiddenStem?: SceneSegment;
  markers: SceneMarker[];
  labels: SceneLabel[];
  lines: SceneLine[];
  segments: SceneSegment[];
  annotations: SurfaceAnnotation[];
}
