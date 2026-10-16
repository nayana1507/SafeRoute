import type {
  RiskLevel,
  RouteOption,
  RoutePreference,
} from "@/types/routes";

export function getRiskLevel(score: number): RiskLevel {
  if (score < 35) return "low";
  if (score < 70) return "moderate";
  return "high";
}

export function calculateRouteRisk(route: RouteOption): number {
  if (route.segments.length === 0) {
    return Math.max(0, Math.min(100, route.riskScore));
  }

  // Weight segment risk by the number of coordinate points.
  // This is a demo approximation, not a calibrated safety model.
  const weightedRisk = route.segments.reduce((total, segment) => {
    const weight = Math.max(1, segment.coordinates.length - 1);
    return total + segment.riskScore * weight;
  }, 0);

  const totalWeight = route.segments.reduce(
    (total, segment) =>
      total + Math.max(1, segment.coordinates.length - 1),
    0,
  );

  return Math.round(weightedRisk / totalWeight);
}

export function recommendRoute(
  routes: RouteOption[],
  preference: RoutePreference = "balanced",
): RouteOption | null {
  if (routes.length === 0) return null;

  return [...routes].sort((a, b) => {
    if (preference === "safest") {
      return calculateRouteRisk(a) - calculateRouteRisk(b);
    }

    if (preference === "fastest") {
      return a.etaMinutes - b.etaMinutes;
    }

    // Balanced: normalized combination of risk and ETA.
    const score = (route: RouteOption) =>
      0.7 * calculateRouteRisk(route) +
      0.3 * (route.etaMinutes / Math.max(
        ...routes.map((r) => r.etaMinutes),
        1,
      )) * 100;

    return score(a) - score(b);
  })[0];
}