export type RiskLevel = "low" | "moderate" | "high";

export type RouteSegment = {
  id: string;
  riskScore: number; // 0–100
  riskLevel: RiskLevel;
  factors: string[];
  coordinates: [number, number][];
};

export type RouteOption = {
  id: string;
  name: string;
  distanceKm: number;
  etaMinutes: number;
  riskScore: number; // 0–100; lower is safer
  riskLevel: RiskLevel;
  segments: RouteSegment[];
  isRecommended: boolean;
  isSimulated: true;
};

export type RoutePreference = "safest" | "fastest" | "balanced";