import type { TerrainProfilePreset } from "./types";

const terrainProfiles: TerrainProfilePreset[] = [
  {
    id: "aconcagua-study",
    name: "Aconcagua Terrain Profile",
    description:
      "A stylized mountain profile aligned to the long-range Aconcagua scenario distances.",
    strokeColor: "#f2d1a0",
    fillColor: "rgba(201, 163, 110, 0.24)",
    samples: [
      { distanceM: 330_000, heightM: 0 },
      { distanceM: 365_000, heightM: 450 },
      { distanceM: 388_000, heightM: 1_200 },
      { distanceM: 410_000, heightM: 2_900 },
      { distanceM: 430_000, heightM: 4_850 },
      { distanceM: 448_000, heightM: 6_120 },
      { distanceM: 460_000, heightM: 7_040 },
    ],
  },
  {
    id: "lake-pontchartrain",
    name: "Pontchartrain Causeway Profile",
    description:
      "A low bridge-like profile over flat water to help frame long-baseline shoreline scenes.",
    strokeColor: "#d8dec7",
    fillColor: "rgba(144, 158, 126, 0.18)",
    samples: [
      { distanceM: 6_000, heightM: 0 },
      { distanceM: 12_000, heightM: 4 },
      { distanceM: 18_000, heightM: 6 },
      { distanceM: 25_000, heightM: 8 },
      { distanceM: 32_000, heightM: 12 },
      { distanceM: 38_500, heightM: 18 },
    ],
  },
  {
    id: "chicago-lake-michigan",
    name: "Chicago Skyline Profile",
    description:
      "A simplified skyline silhouette aligned to the far-shore Chicago preset.",
    strokeColor: "#f3d3a6",
    fillColor: "rgba(201, 163, 110, 0.22)",
    samples: [
      { distanceM: 84_000, heightM: 35 },
      { distanceM: 89_000, heightM: 120 },
      { distanceM: 92_000, heightM: 260 },
      { distanceM: 94_000, heightM: 180 },
      { distanceM: 95_500, heightM: 370 },
      { distanceM: 96_000, heightM: 442 },
    ],
  },
  {
    id: "oil-rig",
    name: "Oil Rig Silhouette",
    description:
      "A simple offshore structure silhouette centered at the target distance.",
    strokeColor: "#f2d1a0",
    fillColor: "rgba(201, 163, 110, 0.2)",
    samples: [
      { distanceM: 36_800, heightM: 0 },
      { distanceM: 37_200, heightM: 18 },
      { distanceM: 37_700, heightM: 42 },
      { distanceM: 38_000, heightM: 62 },
    ],
  },
  {
    id: "low-ship",
    name: "Ship Silhouette",
    description:
      "A compact ship-like target profile to make lower-obstruction scenarios easier to read.",
    strokeColor: "#e8d8bf",
    fillColor: "rgba(170, 156, 134, 0.22)",
    samples: [
      { distanceM: 22_500, heightM: 0 },
      { distanceM: 23_100, heightM: 4 },
      { distanceM: 23_500, heightM: 11 },
      { distanceM: 24_000, heightM: 18 },
    ],
  },
];

export function getTerrainProfileByPresetId(
  presetId: string,
): TerrainProfilePreset | null {
  return terrainProfiles.find((profile) => profile.id === presetId) ?? null;
}

export function sampleTerrainProfileHeight(
  profile: TerrainProfilePreset,
  distanceM: number,
): number | null {
  const samples = [...profile.samples].sort((left, right) => left.distanceM - right.distanceM);

  if (!samples.length) {
    return null;
  }

  if (distanceM < samples[0].distanceM || distanceM > samples[samples.length - 1].distanceM) {
    return null;
  }

  if (distanceM === samples[0].distanceM) {
    return samples[0].heightM;
  }

  for (let index = 0; index < samples.length - 1; index += 1) {
    const left = samples[index];
    const right = samples[index + 1];

    if (distanceM < left.distanceM || distanceM > right.distanceM) {
      continue;
    }

    const fraction =
      (distanceM - left.distanceM) / Math.max(right.distanceM - left.distanceM, 1e-6);
    return left.heightM + (right.heightM - left.heightM) * fraction;
  }

  return samples[samples.length - 1].heightM;
}

export function createGenericTargetProfile(
  presetId: string,
  surfaceDistanceM: number,
  targetHeightM: number,
): TerrainProfilePreset {
  const widthM = Math.max(
    Math.min(surfaceDistanceM * 0.12, 18_000),
    Math.min(Math.max(targetHeightM * 190, 1_400), 7_500),
  );
  const halfWidthM = widthM / 2;
  const startM = Math.max(surfaceDistanceM - halfWidthM, 0);
  const peakM = surfaceDistanceM;
  const endM = surfaceDistanceM + halfWidthM * 0.68;

  return {
    id: `${presetId}-generic-profile`,
    name: "Target Profile Overlay",
    description:
      "A generated silhouette around the current target location so the scene can present a readable profile even without a preset-specific terrain mesh.",
    strokeColor: "#dfb66d",
    fillColor: "rgba(174, 132, 71, 0.24)",
    samples: [
      { distanceM: startM, heightM: 0 },
      { distanceM: startM + widthM * 0.22, heightM: targetHeightM * 0.22 },
      { distanceM: startM + widthM * 0.48, heightM: targetHeightM * 0.56 },
      { distanceM: peakM, heightM: targetHeightM },
      { distanceM: peakM + widthM * 0.16, heightM: targetHeightM * 0.72 },
      { distanceM: peakM + widthM * 0.31, heightM: targetHeightM * 0.38 },
      { distanceM: endM, heightM: 0 },
    ],
  };
}
