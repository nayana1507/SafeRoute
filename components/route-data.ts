
export type Zone = {
  id: string;
  name: string;
  areas: string[];
  landmarks: string[];
  position: [number, number]; // [latitude, longitude]
};

export const ZONES: Zone[] = [
  {
    id: "Z01",
    name: "Kakkanad",
    areas: ["Infopark Phase 1", "Infopark Phase 2", "Civil Station"],
    landmarks: ["Infopark Phase 1", "Infopark Phase 2", "Civil Station"],
    position: [10.0159, 76.3419],
  },
  {
    id: "Z02",
    name: "Fort Kochi",
    areas: ["Princess Street", "Beach Road", "Mattancherry"],
    landmarks: ["Princess Street", "Beach Road", "Mattancherry"],
    position: [9.9658, 76.2421],
  },
  {
    id: "Z03",
    name: "Edappally",
    areas: ["Lulu Junction", "Changampuzha Park", "Pipeline Road"],
    landmarks: ["Lulu Junction", "Changampuzha Park", "Pipeline Road"],
    position: [10.0261, 76.308],
  },
  {
    id: "Z04",
    name: "Vyttila",
    areas: ["Vyttila Hub", "Mobility Hub Road", "Thammanam Link"],
    landmarks: ["Vyttila Hub", "Mobility Hub Road", "Thammanam Link"],
    position: [9.968, 76.318],
  },
  {
    id: "Z05",
    name: "Aluva",
    areas: ["Aluva Metro", "Market Road", "Manappuram Ghat"],
    landmarks: ["Aluva Metro", "Market Road", "Manappuram Ghat"],
    position: [10.1081, 76.3512],
  },
];

export type RoadRoute = {
  id: string;
  coordinates: [number, number][]; // Leaflet: [latitude, longitude]
  distanceMeters: number;
  durationSeconds: number;
  riskScore: number | null;
  source: "ORS" | "OSRM";
};

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours} hr ${remainingMinutes} min`
    : `${hours} hr`;
}
