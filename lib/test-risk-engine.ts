import {
  recommendRoute,
  calculateRouteRisk,
} from "../lib/risk-engine";
import type { RouteOption } from "@/types/routes";

const routes: RouteOption[] = [
  {
    id: "route-a",
    name: "Fast Route",
    distanceKm: 3,
    etaMinutes: 12,
    riskScore: 65,
    riskLevel: "moderate",
    segments: [],
    isRecommended: false,
    isSimulated: true,
  },
  {
    id: "route-b",
    name: "Safer Route",
    distanceKm: 4,
    etaMinutes: 18,
    riskScore: 20,
    riskLevel: "low",
    segments: [],
    isRecommended: false,
    isSimulated: true,
  },
  {
    id: "route-c",
    name: "Balanced Route",
    distanceKm: 3.5,
    etaMinutes: 15,
    riskScore: 35,
    riskLevel: "moderate",
    segments: [],
    isRecommended: false,
    isSimulated: true,
  },
];

console.log(
  "Safest:",
  recommendRoute(routes, "safest")?.name,
);

console.log(
  "Fastest:",
  recommendRoute(routes, "fastest")?.name,
);

console.log(
  "Balanced:",
  recommendRoute(routes, "balanced")?.name,
);

console.log(
  "Risk score:",
  calculateRouteRisk(routes[1]),
);