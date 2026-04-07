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
      { distanceM: 460_000, heightM: 6_962 },
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

