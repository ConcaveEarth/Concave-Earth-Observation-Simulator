import type { ModelConfig } from "./domain/types";

export type LanguageMode = "en" | "es" | "it" | "pt" | "ru";

export const languageOptions: Array<{ value: LanguageMode; label: string }> = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Português" },
  { value: "ru", label: "Русский" },
];

type TranslationDictionary = Record<string, string>;

const en: TranslationDictionary = {
  appEyebrow: "Observation Geometry Lab",
  simulatorTitle: "Concave Earth Observation Simulator",
  panelIntroTitle: "Comparison-first observation simulator",
  panelIntroBody:
    "One shared ray engine drives both the convex baseline and the concave shell interpretation.",
  quickJump: "Quick Jump",
  quickJumpHint:
    "Scroll the controls dock independently while the main scene stays in view.",
  scenario: "Scenario",
  scenarioMode: "Scenario mode",
  view: "View",
  primary: "Model 1",
  compare: "Model 2",
  export: "Export",
  observationInputs: "Observation inputs",
  presentation: "Presentation",
  shareableState: "Shareable state",
  geometryOpticsAtmosphere: "Geometry / Optics / Atmosphere",
  preset: "Preset",
  restoreAll: "Restore all",
  reset: "Reset",
  observerHeight: "Observer height",
  observerSiteElevation: "Observer site elevation",
  observerEyeHeight: "Observer eye height",
  observerTotalElevation: "Observer total elevation",
  targetHeight: "Target height",
  targetBaseElevation: "Target base elevation",
  targetObjectHeight: "Target object height",
  targetTopElevation: "Target top elevation",
  surfaceDistance: "Surface distance",
  shellSphereRadius: "Shell / sphere radius",
  targetSamples: "Target samples",
  routeCoordinates: "Route coordinates",
  useCoordinateDistance: "Use coordinate-derived distance",
  observerLatitude: "Observer latitude",
  observerLongitude: "Observer longitude",
  targetLatitude: "Target latitude",
  targetLongitude: "Target longitude",
  derivedDistance: "Derived distance",
  initialBearing: "Initial bearing",
  coordinateDistanceHint:
    "Surface distance is being derived from the coordinate route: {distance} • initial bearing {bearing}°.",
  routeCoordinateHint:
    "This is the first step toward map-backed scenarios: enter observer and target coordinates to derive a great-circle route using the active shell / sphere radius.",
  terrainBlocksRays: "Terrain / profile blocks rays",
  simpleMode: "Simple mode",
  fieldMode: "Field mode",
  simpleScenarioHint:
    "Simple mode keeps the scenario lightweight: observer height and target top elevation are measured directly from the active datum.",
  fieldScenarioHint:
    "Field mode splits site/base elevations from eye/object heights so real observation cases can be described more like survey data.",
  presetVerification: "Preset verification",
  presetProvenance: "Preset provenance",
  presetAssumptions: "Preset assumptions",
  presetSource: "Preset source",
  presetStatusVerified: "Verified baseline",
  presetStatusSourceInspired: "Source-inspired",
  presetStatusIllustrative: "Illustrative / sandbox",
  dragMicrocopy: "Drag for sweep, use +/- for fine adjustment.",
  crossSection: "Cross-section",
  rayBundle: "Ray Bundle",
  observerView: "Observer View",
  profileVisibility: "Profile Visibility",
  routeMap: "Route Map",
  skyWrap: "Sky Wrap",
  sweep: "Sweep",
  splitCompare: "Split Compare",
  panelLayout: "Panel layout",
  singlePanel: "Single Panel",
  singlePanelModel: "Single-panel model",
  primaryModelShort: "Model 1",
  comparisonModelShort: "Model 2",
  compareLayout: "Compare layout",
  auto: "Auto",
  sideBySide: "Side by side",
  stacked: "Stacked",
  stackComparePanels: "Stack compare panels",
  focused: "Focused",
  operational: "Operational",
  wide: "Wide",
  annotatedMode: "Annotated mode",
  labelDensity: "Label density",
  annotations: "Annotations",
  guides: "Guides",
  adaptive: "Adaptive",
  full: "Full",
  hidden: "Hidden",
  scaleGuides: "Scale guides",
  profileOverlay: "Profile overlay",
  fullWidthDiagrams: "Full-width diagrams",
  centerLayoutHint:
    "Use the scene toolbar for framing, scale, fullscreen, and layout controls.",
  presentationMovedHint:
    "Presentation and compare display controls live above the diagram for faster scene-first adjustment.",
  analysisView: "Analysis view",
  rayBundleIntro:
    "Multiple sampled target heights traced through the shared ray solver to show the visible/blocked envelope.",
  observerViewIntro:
    "A perceptual reconstruction built from solved apparent elevations, showing the apparent horizon and the visible silhouette the observer would actually receive.",
  profileVisibilityIntro:
    "Terrain/profile samples now participate in the shared visibility engine, including terrain-aware obstruction along the traced path rather than remaining purely illustrative.",
  routeMapIntro:
    "Map-backed route workspace with draggable observer and target coordinates, derived great-circle distance, and bearing.",
  skyWrapIntro:
    "A celestial / sky-wrap workspace tracing how the active curvature law bends upward-looking rays in the observer frame.",
  sweepIntro:
    "A controlled parameter sweep driven by repeated solver runs across the active models.",
  rayBundleSummaryTitle: "Ray Bundle Envelope",
  rayBundleSummaryBody:
    "Sampled target heights are traced through the active ray law so you can inspect which parts of the object still connect optically to the observer.",
  observerReconstructionTitle: "Observer Reconstruction",
  observerReconstructionBody:
    "Apparent elevations are reassembled into a perceptual horizon-and-silhouette view that emphasizes what the observer would actually receive rather than the raw geometry alone.",
  profileVisibilitySummaryTitle: "Profile Visibility Envelope",
  profileVisibilitySummaryBody:
    "Terrain or structure profile points are sampled through the shared solver so visible spans, blocked sections, and apparent profile behavior can be studied directly.",
  routeMapSummaryTitle: "Route Map Workspace",
  routeMapSummaryBody:
    "Observer and target coordinates are projected into a route workspace so distance, bearing, and map-backed scenario setup can be adjusted directly.",
  skyWrapSummaryTitle: "Sky-Wrap Workspace",
  skyWrapSummaryBody:
    "Upward-looking rays are traced through the active intrinsic and atmospheric curvature law to study dome-like or horizon-to-sky bending behavior.",
  sweepSummaryTitle: "Parameter Sweep Overview",
  sweepSummaryBody:
    "Repeated solves across a controlled range reveal where the active models diverge, plateau, or cross threshold behavior.",
  activeAnalysis: "Active analysis",
  activeParameter: "Active parameter",
  activeMetric: "Active metric",
  currentScenarioValue: "Current scenario value",
  sweepSamples: "Sweep samples",
  comparedSeries: "Compared series",
  modelOneCurrent: "Model 1 current",
  modelTwoCurrent: "Model 2 current",
  activeModelCurrent: "Active model current",
  bundleSpan: "Bundle span",
  bundleSampleCount: "Bundle samples",
  visibleSamples: "Visible samples",
  blockedSamples: "Blocked samples",
  visibleProfileSpan: "Visible profile span",
  profileSamples: "Profile samples",
  maxProfileHeight: "Max profile height",
  apparentHorizonDip: "Apparent horizon dip",
  visibleTopElevation: "Visible top elevation",
  geometricTopElevation: "Geometric top elevation",
  apparentProfileSpan: "Apparent profile span",
  observerHorizontalLabel: "Observer horizontal",
  apparentHorizonLabel: "Apparent horizon",
  visibleSilhouetteLabel: "Visible silhouette",
  geometricGhostLabel: "Geometric ghost",
  apparentProfileSpanLabel: "Apparent profile span",
  angularElevationLabel: "Angular elevation",
  sampledBundleSpanLabel: "Sampled bundle span",
  profileSpanLabel: "Profile span",
  parameterSweepTitle: "Parameter Sweep",
  parameterSweepBody:
    "Shared solver outputs traced across a controlled range for the active model interpretations.",
  sweepParameter: "Sweep parameter",
  sweepMetric: "Sweep metric",
  sweepRange: "Sweep range",
  sweepResolution: "Sweep resolution",
  distanceParameter: "Surface distance",
  observerHeightParameter: "Observer height",
  targetHeightParameter: "Target height",
  atmosphereParameter: "Atmospheric coefficient",
  hiddenHeightMetric: "Hidden height",
  visibilityFractionMetric: "Visibility fraction",
  apparentElevationMetric: "Apparent elevation",
  opticalHorizonMetric: "Optical horizon",
  geometry: "Geometry",
  advancedLineBehavior: "Advanced line behavior",
  advancedLineBehaviorHint:
    "Power-user controls for forcing or hiding individual construction families while we continue tightening model fidelity.",
  referenceConstruction: "Reference construction",
  straightHorizontal: "Straight horizontal",
  curvedAltitude: "Curved altitude",
  curvilinearTangentOption: "Curvilinear tangent",
  objectLightPath: "Object light path",
  opticalHorizonRay: "Optical horizon ray",
  tracedCurve: "Traced curve",
  straightChord: "Straight chord",
  apparentDirectionSource: "Apparent direction source",
  targetApparentDirection: "Target apparent direction",
  horizonApparentDirection: "Horizon apparent direction",
  showObserverHorizontal: "Show straight observer horizontal",
  showSourceGeometricPath: "Show source geometric path",
  showGeometricHorizon: "Show geometric horizon construction",
  convexSphere: "Convex Sphere",
  concaveShell: "Concave Shell",
  intrinsicCurvature: "Intrinsic curvature",
  none: "None",
  customConstant: "Custom constant",
  atmosphere: "Atmosphere",
  atmosphericRefraction: "Atmospheric Refraction",
  atmosphericRefractionWithK: "Atmospheric Refraction (k = {value})",
  layeredAtmosphere: "Layered atmosphere",
  layeredAtmosphericRefractionWithK:
    "Layered Atmospheric Refraction (k0 = {base}, k1 = {upper})",
  baseAtmosphericCoefficient: "Base atmospheric coefficient",
  upperAtmosphericCoefficient: "Upper atmospheric coefficient",
  transitionHeight: "Transition height",
  inversionStrength: "Inversion strength",
  inversionBaseHeight: "Inversion base height",
  inversionDepth: "Inversion depth",
  layeredAtmosphereHint:
    "Layered atmosphere blends the near-ground and upper coefficients by altitude, then applies an optional inversion pocket near the selected base height.",
  intrinsicShort: "Intrinsic",
  simpleCoefficient: "Simple coefficient",
  atmosphericCoefficient: "Atmospheric coefficient",
  atmosphereHint:
    "Positive k bends light downward in both models. Negative k bends it upward. In concave mode the atmospheric term modifies the intrinsic upward curvature.",
  exportPng: "Export PNG",
  exportJson: "Export JSON",
  exportReport: "Export Report",
  copyShareUrl: "Copy Share URL",
  home: "Home",
  forums: "Concave Earth Forums",
  moreCE: "More CE",
  communityResearchLinks: "Community / research links",
  theme: "Theme",
  language: "Language",
  workspace: "Workspace",
  themeNightLab: "Night Lab",
  themeBlueprint: "Blueprint",
  themePaperLight: "Paper Light",
  workspaceProfessional: "Professional",
  workspaceSimple: "Simple",
  simulationFirst: "Simulation-first / comparison-first",
  sharedSceneText:
    "Shared geometry and ray-path outputs drive both panels, so convex and concave views remain locked to the same scenario while preserving their own geometric and optical assumptions.",
  primaryModelTitle: "Model 1",
  comparisonModelTitle: "Model 2",
  frame: "Frame",
  autoFit: "Auto Fit",
  fullSpan: "Full Span",
  layout: "Layout",
  fullWidth: "Full Width",
  docked: "Docked",
  heightMode: "Height",
  fitContent: "Fit Content",
  scale: "Scale",
  survey: "Survey",
  trueScale: "True Scale",
  diagram: "Diagram",
  zoom: "Zoom",
  vertical: "Vertical",
  hoverHint:
    "Hover to inspect, click to pin, drag to pan, Ctrl+wheel zoom, Shift+wheel vertical",
  analysisViewportHint:
    "Drag to pan, Ctrl+wheel zoom, Shift+wheel vertical",
  loadingAnalysisWorkspace: "Loading analysis workspace",
  fullscreen: "Fullscreen",
  exitFullscreen: "Exit Fullscreen",
  legend: "Legend",
  activeLegend: "Active legend",
  scaleSummaryTrue: "True scale • vertical x{vertical}",
  scaleSummarySurvey: "Survey scale • vertical x{vertical}",
  scaleSummaryDiagram: "Diagram base x{base} • vertical x{vertical}",
  createdBy: "Created by",
  currentOutput: "Current Output",
  numerics: "Numerics",
  hiddenHeight: "Hidden height",
  visibleHeight: "Visible height",
  visibilityFraction: "Visibility fraction",
  apparentElevation: "Apparent elevation",
  actualElevation: "Actual elevation",
  opticalHorizon: "Optical horizon",
  modelTransparency: "Model Transparency",
  assumptions: "Assumptions",
  surveyGeometry: "Survey Geometry",
  fieldMetrics: "Field metrics",
  lineLegend: "Line Legend",
  sceneGuide: "Scene guide",
  featureInspection: "Feature Inspection",
  inspection: "Inspection",
  pinnedFeature: "Pinned feature",
  hoveredFeature: "Hovered feature",
  sceneSummary: "Scene summary",
  clearPin: "Clear pin",
  hoverToInspectHint:
    "Hover a construction to inspect it. Click a line or marker in the scene to pin it here.",
  presetNotes: "Preset Notes",
  context: "Context",
  shareExport: "Share / Export",
  output: "Output",
  routeDistance: "Route distance",
  routePointCount: "Route points",
  coordinatesEnabledLabel: "Coordinate route",
  intrinsicBend: "Intrinsic bend",
  atmosphericBend: "Atmospheric bend",
  netBend: "Net bend",
  skyWrapDomeRadius: "Sky dome radius",
  observerMarker: "Observer",
  targetMarker: "Target",
  featureSurfaceSea: "Surface / Sea Level",
  featureSurfaceGround: "Surface / Ground Level",
  featureObserverHorizontal: "Straight Observer Horizontal",
  featureStraightHorizontalReference: "Straight Horizontal Reference",
  featureCurvedAltitudeReference: "Curved Altitude Reference",
  featureCurvilinearTangent: "Curvilinear Tangent",
  featureObserverHeight: "Observer Height",
  featureTargetHeight: "Target Height",
  featureTerrainOverlay: "Terrain / Profile Overlay",
  featureDirectGeometricSightline: "Direct Geometric Sightline",
  featureObjectToObserverGeometricPath: "Object-To-Observer Geometric Path",
  featureActualRayPath: "Actual Ray Path",
  featureOpticalHorizonReferenceRay: "Optical Horizon Reference Ray",
  featureObjectToObserverLightPath: "Object-To-Observer Light Path",
  featureApparentLineOfSight: "Apparent Line Of Sight",
  featureApparentHorizonDirection: "Apparent Horizon Direction",
  featureOpticalHorizon: "Optical Horizon",
  featureGeometricHorizonTangent: "Geometric Horizon Tangent",
  featureGeometricHorizonConstruction: "Geometric Horizon Construction",
  featureHiddenHeight: "Hidden Height",
  horizontalScale: "Horizontal scale",
  verticalScale: "Vertical scale",
  observer: "Observer",
  target: "Target",
  sightedPoint: "Sighted point",
  sourcePoint: "Source point",
  hiddenShort: "hidden {value}",
  apparentShort: "apparent {value}",
  rayBend: "Ray bend {value}",
  surfaceDistanceShort: "Surface distance {value}",
  observerHeightShort: "Observer height {value}",
  targetHeightShort: "Target height {value}",
  visibilityShort: "Visibility {value}",
  modelConvexSphere: "Convex Sphere",
  modelConvexSphereAtmosphere: "Convex Sphere + Atmospheric Refraction",
  modelConcaveShell: "Concave Shell",
  modelConcaveShellIntrinsic: "Concave Shell + Intrinsic",
  modelConcaveShellAtmosphere: "Concave Shell + Atmospheric Refraction",
  modelConcaveShellIntrinsicAtmosphere:
    "Concave Shell + Intrinsic + Atmospheric Refraction",
};

const es: Partial<TranslationDictionary> = {
  simulatorTitle: "Simulador de Observación de Tierra Cóncava",
  panelIntroTitle: "Simulador de observación con enfoque comparativo",
  panelIntroBody:
    "Un solo motor de rayos impulsa tanto la base convexa como la interpretación de cascarón cóncavo.",
  quickJump: "Acceso rápido",
  quickJumpHint:
    "Desplaza el panel de controles de forma independiente mientras la escena principal permanece visible.",
  scenario: "Escenario",
  view: "Vista",
  primary: "Principal",
  compare: "Comparar",
  export: "Exportar",
  preset: "Preajuste",
  restoreAll: "Restaurar todo",
  reset: "Restablecer",
  observerHeight: "Altura del observador",
  targetHeight: "Altura del objetivo",
  surfaceDistance: "Distancia superficial",
  shellSphereRadius: "Radio de cascarón / esfera",
  targetSamples: "Muestras del objetivo",
  dragMicrocopy: "Arrastra para barrer, usa +/- para ajuste fino.",
  crossSection: "Sección transversal",
  splitCompare: "Comparación dividida",
  singlePanelModel: "Modelo de un solo panel",
  comparisonModelShort: "Comparación",
  compareLayout: "Diseño comparativo",
  sideBySide: "Lado a lado",
  stacked: "Apilado",
  annotatedMode: "Modo anotado",
  labelDensity: "Densidad de etiquetas",
  annotations: "Anotaciones",
  guides: "Guías",
  adaptive: "Adaptativo",
  full: "Completo",
  scaleGuides: "Guías de escala",
  profileOverlay: "Superposición de perfil",
  fullWidthDiagrams: "Diagramas de ancho completo",
  stackComparePanels: "Apilar paneles comparativos",
  presentationMovedHint:
    "Los controles de presentación y visualización comparativa ahora están sobre el diagrama para un ajuste más rápido.",
  geometry: "Geometría",
  convexSphere: "Esfera convexa",
  concaveShell: "Cascarón cóncavo",
  intrinsicCurvature: "Curvatura intrínseca",
  customConstant: "Constante personalizada",
  atmosphere: "Atmósfera",
  simpleCoefficient: "Coeficiente simple",
  atmosphericCoefficient: "Coeficiente atmosférico",
  exportPng: "Exportar PNG",
  copyShareUrl: "Copiar URL",
  home: "Inicio",
  forums: "Foros Concave Earth",
  moreCE: "Más CE",
  communityResearchLinks: "Enlaces de comunidad / investigación",
  theme: "Tema",
  language: "Idioma",
  workspace: "Espacio",
  themeNightLab: "Laboratorio nocturno",
  themeBlueprint: "Plano técnico",
  themePaperLight: "Papel claro",
  workspaceProfessional: "Profesional",
  workspaceSimple: "Simple",
  simulationFirst: "Simulación primero / comparación primero",
  primaryModelTitle: "Modelo principal",
  comparisonModelTitle: "Modelo de comparación",
  frame: "Marco",
  autoFit: "Ajuste auto",
  fullSpan: "Extensión completa",
  layout: "Diseño",
  fullWidth: "Ancho completo",
  docked: "Acoplado",
  heightMode: "Altura",
  fitContent: "Ajustar al contenido",
  scale: "Escala",
  trueScale: "Escala real",
  hoverHint:
    "Pasa el cursor para inspeccionar, clic para fijar, arrastra para desplazar, rueda para zoom, Shift+rueda vertical",
  fullscreen: "Pantalla completa",
  exitFullscreen: "Salir de pantalla completa",
  createdBy: "Creado por",
};

const it: Partial<TranslationDictionary> = {
  simulatorTitle: "Simulatore di Osservazione della Terra Concava",
  panelIntroTitle: "Simulatore osservativo orientato al confronto",
  panelIntroBody:
    "Un unico motore di raggi guida sia la base convessa sia l'interpretazione a guscio concavo.",
  quickJump: "Accesso rapido",
  scenario: "Scenario",
  view: "Vista",
  primary: "Primario",
  compare: "Confronto",
  export: "Esporta",
  preset: "Preset",
  restoreAll: "Ripristina tutto",
  reset: "Reimposta",
  observerHeight: "Altezza osservatore",
  targetHeight: "Altezza obiettivo",
  surfaceDistance: "Distanza superficiale",
  shellSphereRadius: "Raggio guscio / sfera",
  targetSamples: "Campioni obiettivo",
  dragMicrocopy: "Trascina per la corsa, usa +/- per la regolazione fine.",
  crossSection: "Sezione",
  splitCompare: "Confronto sdoppiato",
  compareLayout: "Layout confronto",
  sideBySide: "Affiancato",
  stacked: "Impilato",
  annotatedMode: "Modalità annotata",
  annotations: "Annotazioni",
  guides: "Guide",
  scaleGuides: "Guide di scala",
  profileOverlay: "Overlay profilo",
  fullWidthDiagrams: "Diagrammi a piena larghezza",
  stackComparePanels: "Impila pannelli di confronto",
  presentationMovedHint:
    "I controlli di presentazione e confronto si trovano sopra il diagramma per regolazioni più rapide.",
  geometry: "Geometria",
  convexSphere: "Sfera convessa",
  concaveShell: "Guscio concavo",
  atmosphere: "Atmosfera",
  home: "Home",
  forums: "Forum Concave Earth",
  moreCE: "Altro CE",
  theme: "Tema",
  language: "Lingua",
  workspace: "Area di lavoro",
  themeNightLab: "Night Lab",
  themeBlueprint: "Blueprint",
  themePaperLight: "Carta chiara",
  workspaceProfessional: "Professionale",
  workspaceSimple: "Semplice",
  primaryModelTitle: "Modello primario",
  comparisonModelTitle: "Modello di confronto",
  frame: "Inquadratura",
  autoFit: "Adatta",
  fullSpan: "Estensione completa",
  layout: "Layout",
  fullWidth: "Piena larghezza",
  docked: "Agganciato",
  heightMode: "Altezza",
  fitContent: "Adatta al contenuto",
  scale: "Scala",
  trueScale: "Scala reale",
  fullscreen: "Schermo intero",
  exitFullscreen: "Esci da schermo intero",
  createdBy: "Creato da",
};

const pt: Partial<TranslationDictionary> = {
  simulatorTitle: "Simulador de Observação da Terra Côncava",
  panelIntroTitle: "Simulador de observação com foco em comparação",
  panelIntroBody:
    "Um único motor de raios conduz tanto a linha de base convexa quanto a interpretação de casca côncava.",
  quickJump: "Acesso rápido",
  scenario: "Cenário",
  view: "Visualização",
  primary: "Primário",
  compare: "Comparar",
  export: "Exportar",
  preset: "Predefinição",
  restoreAll: "Restaurar tudo",
  reset: "Redefinir",
  observerHeight: "Altura do observador",
  targetHeight: "Altura do alvo",
  surfaceDistance: "Distância de superfície",
  shellSphereRadius: "Raio da casca / esfera",
  targetSamples: "Amostras do alvo",
  crossSection: "Seção transversal",
  splitCompare: "Comparação dividida",
  compareLayout: "Layout de comparação",
  sideBySide: "Lado a lado",
  stacked: "Empilhado",
  annotatedMode: "Modo anotado",
  annotations: "Anotações",
  guides: "Guias",
  scaleGuides: "Guias de escala",
  profileOverlay: "Sobreposição de perfil",
  fullWidthDiagrams: "Diagramas em largura total",
  stackComparePanels: "Empilhar painéis comparativos",
  presentationMovedHint:
    "Os controles de apresentação e comparação ficam acima do diagrama para ajustes mais rápidos.",
  geometry: "Geometria",
  convexSphere: "Esfera convexa",
  concaveShell: "Casca côncava",
  atmosphere: "Atmosfera",
  home: "Início",
  forums: "Fóruns Concave Earth",
  moreCE: "Mais CE",
  theme: "Tema",
  language: "Idioma",
  workspace: "Espaço de trabalho",
  workspaceProfessional: "Profissional",
  workspaceSimple: "Simples",
  primaryModelTitle: "Modelo primário",
  comparisonModelTitle: "Modelo de comparação",
  frame: "Enquadramento",
  autoFit: "Ajuste auto",
  fullSpan: "Extensão total",
  layout: "Layout",
  fullWidth: "Largura total",
  docked: "Acoplado",
  heightMode: "Altura",
  fitContent: "Ajustar ao conteúdo",
  scale: "Escala",
  trueScale: "Escala real",
  fullscreen: "Tela cheia",
  exitFullscreen: "Sair da tela cheia",
  createdBy: "Criado por",
};

const ru: Partial<TranslationDictionary> = {
  simulatorTitle: "Симулятор наблюдений вогнутой Земли",
  panelIntroTitle: "Симулятор наблюдений с упором на сравнение",
  panelIntroBody:
    "Один общий лучевой движок управляет как выпуклой базовой моделью, так и вогнутой оболочкой.",
  quickJump: "Быстрый переход",
  scenario: "Сценарий",
  view: "Вид",
  primary: "Основной",
  compare: "Сравнение",
  export: "Экспорт",
  preset: "Пресет",
  restoreAll: "Восстановить всё",
  reset: "Сброс",
  observerHeight: "Высота наблюдателя",
  targetHeight: "Высота цели",
  surfaceDistance: "Поверхностная дистанция",
  shellSphereRadius: "Радиус оболочки / сферы",
  targetSamples: "Точки цели",
  crossSection: "Сечение",
  splitCompare: "Разделённое сравнение",
  compareLayout: "Компоновка сравнения",
  sideBySide: "Рядом",
  stacked: "Стопкой",
  annotatedMode: "Режим аннотаций",
  annotations: "Аннотации",
  guides: "Направляющие",
  scaleGuides: "Шкалы",
  profileOverlay: "Профиль рельефа",
  fullWidthDiagrams: "Диаграммы на всю ширину",
  stackComparePanels: "Сложить сравнительные панели",
  presentationMovedHint:
    "Управление представлением и сравнением вынесено над диаграммой для более быстрых настроек.",
  geometry: "Геометрия",
  convexSphere: "Выпуклая сфера",
  concaveShell: "Вогнутая оболочка",
  atmosphere: "Атмосфера",
  home: "Главная",
  forums: "Форум Concave Earth",
  moreCE: "Ещё CE",
  theme: "Тема",
  language: "Язык",
  workspace: "Рабочая область",
  workspaceProfessional: "Профессиональный",
  workspaceSimple: "Простой",
  primaryModelTitle: "Основная модель",
  comparisonModelTitle: "Сравнительная модель",
  frame: "Кадр",
  autoFit: "Автоподгонка",
  fullSpan: "Полный охват",
  layout: "Макет",
  fullWidth: "Во всю ширину",
  docked: "С доками",
  heightMode: "Высота",
  fitContent: "По содержимому",
  scale: "Масштаб",
  trueScale: "Истинный масштаб",
  fullscreen: "На весь экран",
  exitFullscreen: "Выйти из полноэкранного режима",
  createdBy: "Создано",
};

const dictionaries: Record<LanguageMode, Partial<TranslationDictionary>> = {
  en,
  es,
  it,
  pt,
  ru,
};

function interpolate(template: string, params: Record<string, string | number>): string {
  return Object.entries(params).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(String(value)),
    template,
  );
}

export function t(
  language: LanguageMode,
  key: string,
  params?: Record<string, string | number>,
): string {
  const template = dictionaries[language][key] ?? en[key] ?? key;
  return params ? interpolate(template, params) : template;
}

const presetTranslations: Record<
  string,
  Partial<Record<LanguageMode, { name: string; description: string }>>
> = {
  "low-ship": {
    es: {
      name: "Barco con observador bajo",
      description: "Un observador casi a nivel del mar mirando hacia un barco cerca del horizonte.",
    },
    it: {
      name: "Nave con osservatore basso",
      description: "Un osservatore quasi al livello del mare che guarda una nave vicino all'orizzonte.",
    },
    pt: {
      name: "Navio com observador baixo",
      description: "Um observador quase ao nível do mar olhando para um navio próximo do horizonte.",
    },
    ru: {
      name: "Корабль с низким наблюдателем",
      description: "Наблюдатель почти на уровне моря смотрит на корабль у горизонта.",
    },
  },
  "elevated-observer": {
    es: {
      name: "Observador elevado",
      description: "Eleva al observador para mostrar cómo cambian el horizonte y la visibilidad.",
    },
    it: {
      name: "Osservatore elevato",
      description: "Solleva l'osservatore per mostrare come cambiano orizzonte e visibilità.",
    },
    pt: {
      name: "Observador elevado",
      description: "Eleva o observador para mostrar como mudam o horizonte e a visibilidade.",
    },
    ru: {
      name: "Высокий наблюдатель",
      description: "Поднимает наблюдателя, чтобы показать изменение горизонта и видимости.",
    },
  },
  "aconcagua-study": {
    es: {
      name: "Estudio Aconcagua",
      description:
        "Caso de visibilidad montañosa de largo alcance inspirado en los diagramas clásicos comparativos del Aconcagua.",
    },
    it: {
      name: "Studio Aconcagua",
      description:
        "Caso di visibilità montana a lunga distanza ispirato ai classici diagrammi comparativi dell'Aconcagua.",
    },
    pt: {
      name: "Estudo do Aconcágua",
      description:
        "Caso de visibilidade de longa distância inspirado nos diagramas clássicos comparativos do Aconcágua.",
    },
    ru: {
      name: "Исследование Аконкагуа",
      description:
        "Дальняя горная видимость по мотивам классических сравнительных диаграмм Аконкагуа.",
    },
  },
  "oil-rig": {
    es: {
      name: "Plataforma petrolera",
      description: "Estructura de media distancia con énfasis en la obstrucción inferior.",
    },
    it: {
      name: "Piattaforma petrolifera",
      description: "Struttura a media distanza con forte enfasi sull'ostruzione inferiore.",
    },
    pt: {
      name: "Plataforma de petróleo",
      description: "Estrutura de média distância com ênfase na obstrução inferior.",
    },
    ru: {
      name: "Нефтяная платформа",
      description: "Средняя дистанция с акцентом на нижнее скрытие объекта.",
    },
  },
  "lake-pontchartrain": {
    es: {
      name: "Lake Pontchartrain",
      description:
        "Observación a baja altura a través del Lake Pontchartrain sobre una larga ruta de agua plana.",
    },
    it: {
      name: "Lake Pontchartrain",
      description:
        "Osservazione a bassa quota attraverso il Lake Pontchartrain lungo un tratto d'acqua molto piatto.",
    },
    pt: {
      name: "Lake Pontchartrain",
      description:
        "Observação de baixa altitude sobre o Lake Pontchartrain por um longo trecho de água plana.",
    },
    ru: {
      name: "Лейк-Пончартрейн",
      description:
        "Низкое наблюдение через Lake Pontchartrain по длинному плоскому водному участку.",
    },
  },
  "chicago-lake-michigan": {
    es: {
      name: "Chicago a través del lago Míchigan",
      description:
        "Observación de horizonte urbano a larga distancia inspirada en las discusiones sobre visibilidad de Chicago a través del lago Michigan.",
    },
    it: {
      name: "Chicago attraverso il lago Michigan",
      description:
        "Osservazione urbana a lunga distanza ispirata ai dibattiti sulla visibilità di Chicago attraverso il lago Michigan.",
    },
    pt: {
      name: "Chicago através do lago Michigan",
      description:
        "Observação de skyline em longa distância inspirada nas discussões sobre a visibilidade de Chicago através do lago Michigan.",
    },
    ru: {
      name: "Чикаго через озеро Мичиган",
      description:
        "Дальнее наблюдение линии горизонта Чикаго через озеро Мичиган.",
    },
  },
  "balloon-100kft": {
    es: {
      name: "Globo a 100 000 pies",
      description:
        "Observación desde un globo de gran altitud a unos 100 000 pies (30 480 m) para estudiar el horizonte estratosférico.",
    },
    it: {
      name: "Pallone a 100.000 piedi",
      description:
        "Osservazione da un pallone d'alta quota a circa 100.000 piedi (30.480 m).",
    },
    pt: {
      name: "Balão a 100.000 pés",
      description:
        "Observação de balão de alta altitude a cerca de 100.000 pés (30.480 m).",
    },
    ru: {
      name: "Шар на 100 000 футов",
      description:
        "Наблюдение с высотного шара на высоте около 100 000 футов (30 480 м).",
    },
  },
  "strong-concave-demo": {
    es: {
      name: "Demostración cóncava fuerte",
      description: "Preajuste estilizado para forzar una curvatura intrínseca ascendente intensa.",
    },
    it: {
      name: "Demo concava forte",
      description: "Preset stilizzato per stressare una forte curvatura intrinseca verso l'alto.",
    },
    pt: {
      name: "Demonstração côncava forte",
      description: "Predefinição estilizada para testar uma curvatura intrínseca ascendente intensa.",
    },
    ru: {
      name: "Сильная вогнутая демонстрация",
      description: "Стилизованный пресет для проверки сильного внутреннего восходящего изгиба.",
    },
  },
  "six-foot-horizon": {
    es: {
      name: "Horizonte con observador de 6 pies",
      description:
        "Un observador de 6 pies a nivel del mar mirando directamente hacia el horizonte geométrico.",
    },
    it: {
      name: "Orizzonte con osservatore di 6 piedi",
      description:
        "Un osservatore alto 6 piedi al livello del mare che guarda direttamente l'orizzonte geometrico.",
    },
    pt: {
      name: "Horizonte com observador de 6 pés",
      description:
        "Um observador de 6 pés ao nível do mar olhando diretamente para o horizonte geométrico.",
    },
    ru: {
      name: "Горизонт для наблюдателя 6 футов",
      description:
        "Наблюдатель ростом 6 футов на уровне моря смотрит прямо на геометрический горизонт.",
    },
  },
  "great-orme-blackpool": {
    es: {
      name: "Great Orme a Blackpool Tower",
      description:
        "Caso clásico de largo alcance entre la cumbre de Great Orme y Blackpool Tower.",
    },
    it: {
      name: "Great Orme verso Blackpool Tower",
      description:
        "Classico caso a lunga distanza tra la cima del Great Orme e la Blackpool Tower.",
    },
    pt: {
      name: "Great Orme até Blackpool Tower",
      description:
        "Caso clássico de longo alcance entre o cume do Great Orme e a Blackpool Tower.",
    },
    ru: {
      name: "Great Orme — Blackpool Tower",
      description:
        "Классический дальний сценарий между вершиной Great Orme и башней Blackpool.",
    },
  },
  "canigou-marseille": {
    es: {
      name: "Canigó desde Marsella",
      description:
        "Caso de larga distancia inspirado en las observaciones del Canigó desde las alturas de Marsella.",
    },
    it: {
      name: "Canigó da Marsiglia",
      description:
        "Caso a lunga distanza ispirato alle osservazioni del Canigó dalle alture di Marsiglia.",
    },
    pt: {
      name: "Canigó desde Marselha",
      description:
        "Caso de longa distância inspirado nas observações do Canigó vistas das alturas de Marselha.",
    },
    ru: {
      name: "Канигу из Марселя",
      description:
        "Дальний сценарий, вдохновлённый наблюдениями массива Канигу с высот Марселя.",
    },
  },
};

export function getPresetName(
  language: LanguageMode,
  preset: { id: string; name: string },
): string {
  return presetTranslations[preset.id]?.[language]?.name ?? preset.name;
}

export function getPresetDescription(
  language: LanguageMode,
  preset: { id: string; description: string },
): string {
  return presetTranslations[preset.id]?.[language]?.description ?? preset.description;
}

export function getModelLabel(language: LanguageMode, model: ModelConfig): string {
  const atmosphereLabel =
    model.atmosphere.mode === "simpleCoefficient"
      ? t(language, "atmosphericRefractionWithK", {
          value: model.atmosphere.coefficient.toFixed(2),
        })
      : model.atmosphere.mode === "layered"
        ? t(language, "layeredAtmosphericRefractionWithK", {
            base: model.atmosphere.coefficient.toFixed(2),
            upper: model.atmosphere.upperCoefficient.toFixed(2),
          })
      : null;

  if (model.geometryMode === "convex") {
    return atmosphereLabel
      ? `${t(language, "convexSphere")} + ${atmosphereLabel}`
      : t(language, "convexSphere");
  }

  const hasIntrinsic = model.intrinsicCurvatureMode !== "none";
  const parts = [t(language, "concaveShell")];

  if (hasIntrinsic) {
    parts.push(t(language, "intrinsicShort"));
  }

  if (atmosphereLabel) {
    parts.push(atmosphereLabel);
  }

  return parts.join(" + ");
}
