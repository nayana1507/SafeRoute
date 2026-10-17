
import { NextResponse } from "next/server";
import {
  fetchRouteRisk,
  type RiskInputPayload,
} from "@/lib/risk-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LatLng = [number, number];
type ORSCoordinate = [number, number];

type RiskBand = "Low" | "Medium" | "High" | "Unknown";

type RouteResult = {
  id: string;
  coordinates: ORSCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
  riskScore: number | null;
  safetyScore: number | null;
  risk_score: number | null;
  riskBand: RiskBand;
  risk_band: RiskBand;
  confidenceScore: number | null;
  riskError: string | null;
  riskDataQuality: "model_estimate" | "unavailable";
  source: string;
};

function isValidPoint(value: unknown): value is LatLng {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    value[0] >= -90 &&
    value[0] <= 90 &&
    value[1] >= -180 &&
    value[1] <= 180
  );
}

// ORS GeoJSON uses [longitude, latitude].
function isValidCoordinate(
  value: unknown
): value is ORSCoordinate {
  if (!Array.isArray(value) || value.length !== 2) {
    return false;
  }

  const [longitude, latitude] = value;

  return (
    typeof longitude === "number" &&
    typeof latitude === "number" &&
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}

function normalizeBand(value: unknown): RiskBand {
  if (typeof value !== "string") return "Unknown";

  const band = value.trim().toLowerCase();

  if (band === "low") return "Low";
  if (band === "medium") return "Medium";
  if (band === "high") return "High";

  return "Unknown";
}

function sampleCoordinates(
  coordinates: ORSCoordinate[],
  maxSamples = 5
): ORSCoordinate[] {
  if (coordinates.length <= maxSamples) {
    return coordinates;
  }

  const samples: ORSCoordinate[] = [];

  for (let i = 0; i < maxSamples; i++) {
    const index = Math.round(
      (i * (coordinates.length - 1)) / (maxSamples - 1)
    );

    samples.push(coordinates[index]);
  }

  return samples;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Risk prediction failed.";
}

async function predictRisk(
  latitude: number,
  longitude: number,
  index: number,
  signal: AbortSignal
) {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();

  // These are fallback values, not observed real-world data.
  // Replace them with features from a real data source when possible.
  const payload: RiskInputPayload = {
    zone_id: `ROUTE_POINT_${index + 1}`,
    subzone: `Route sample ${index + 1}`,
    latitude,
    longitude,
    demand: 0.75,
    accident_risk: 0.5,
    incident_rate: 0.3,
    hour,
    day_of_week: dayOfWeek,
    is_weekend: [0, 6].includes(dayOfWeek) ? "Yes" : "No",
    is_night: hour >= 22 || hour < 6 ? 1 : 0,
    rain: 0,
    low_footfall: 0,
    poor_lighting: 0,
    data_source: "baseline_inputs",
  };

  return fetchRouteRisk(payload, signal);
}

async function assessRouteRisk(
  coordinates: ORSCoordinate[],
  signal: AbortSignal
): Promise<{
  score: number | null;
  band: RiskBand;
  confidenceScore: number | null;
  error: string | null;
  dataQuality: "model_estimate" | "unavailable";
}> {
  const samples = sampleCoordinates(coordinates, 5);

  if (samples.length === 0) {
    return {
      score: null,
      band: "Unknown",
      confidenceScore: null,
      error: "Route contains no coordinates to assess.",
      dataQuality: "unavailable",
    };
  }

  try {
    // Each sample is assessed by the actual FastAPI model.
    const predictions = await Promise.all(
      samples.map(([longitude, latitude], index) =>
        predictRisk(
          latitude,
          longitude,
          index,
          signal
        )
      )
    );

    // Route score: mean of the actual point-level predictions.
    const averageScore =
      predictions.reduce(
        (total, prediction) =>
          total + prediction.predicted_risk_score,
        0
      ) / predictions.length;

    // Average only confidence values actually supplied by FastAPI.
    // A missing confidence is not treated as zero.
    const validConfidences = predictions
      .map((prediction) => prediction.confidence_score)
      .filter(
        (value): value is number =>
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= 0 &&
          value <= 1
      );

    const averageConfidence =
      validConfidences.length > 0
        ? validConfidences.reduce(
            (total, value) => total + value,
            0
          ) / validConfidences.length
        : null;

    // Select the most frequently predicted band.
    // Resolve ties in favour of greater severity.
    const severity: Record<RiskBand, number> = {
      Unknown: 0,
      Low: 1,
      Medium: 2,
      High: 3,
    };

    const counts = new Map<RiskBand, number>();

    for (const prediction of predictions) {
      const band = normalizeBand(
        prediction.predicted_risk_band
      );

      counts.set(band, (counts.get(band) ?? 0) + 1);
    }

    const band =
      [...counts.entries()].sort(
        (a, b) =>
          b[1] - a[1] ||
          severity[b[0]] - severity[a[0]]
      )[0]?.[0] ?? "Unknown";

    return {
      score: Number(averageScore.toFixed(4)),
      band,
      confidenceScore:
        averageConfidence === null
          ? null
          : Number(averageConfidence.toFixed(4)),
      error: null,
      dataQuality: "model_estimate",
    };
  } catch (error) {
    console.error("Route risk prediction failed:", error);

    return {
      score: null,
      band: "Unknown",
      confidenceScore: null,
      error: getErrorMessage(error),
      dataQuality: "unavailable",
    };
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.ORS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "ORS_API_KEY is missing from .env.local." },
      { status: 500 }
    );
  }

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 }
      );
    }

    const { pickup, destination } = body as {
      pickup?: unknown;
      destination?: unknown;
    };

    if (
      !isValidPoint(pickup) ||
      !isValidPoint(destination)
    ) {
      return NextResponse.json(
        {
          error:
            "Pickup and destination must be [latitude, longitude] coordinates.",
        },
        { status: 400 }
      );
    }

    if (
      pickup[0] === destination[0] &&
      pickup[1] === destination[1]
    ) {
      return NextResponse.json(
        { error: "Pickup and destination must be different." },
        { status: 400 }
      );
    }

    // Leaflet input: [latitude, longitude].
    // ORS input: [longitude, latitude].
    const orsCoordinates: ORSCoordinate[] = [
      [pickup[1], pickup[0]],
      [destination[1], destination[0]],
    ];

    const orsResponse = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
          Accept: "application/geo+json, application/json",
        },
        body: JSON.stringify({
          coordinates: orsCoordinates,
          alternative_routes: {
            target_count: 3,
            weight_factor: 1.4,
            share_factor: 0.6,
          },
        }),
        cache: "no-store",
      }
    );

    const orsData = await orsResponse.json();

    if (!orsResponse.ok) {
      console.error(
        "OpenRouteService error:",
        orsResponse.status,
        orsData
      );

      return NextResponse.json(
        {
          error:
            orsData?.error?.message ??
            orsData?.message ??
            `Routing service returned HTTP ${orsResponse.status}.`,
        },
        { status: orsResponse.status }
      );
    }

    const features = Array.isArray(orsData.features)
      ? orsData.features
      : [];

    const validFeatures = features.filter(
      (feature: any) => {
        const routeCoordinates =
          feature?.geometry?.coordinates;
        const summary = feature?.properties?.summary;

        return (
          Array.isArray(routeCoordinates) &&
          routeCoordinates.length > 1 &&
          routeCoordinates.every(isValidCoordinate) &&
          typeof summary?.distance === "number" &&
          Number.isFinite(summary.distance) &&
          summary.distance >= 0 &&
          typeof summary?.duration === "number" &&
          Number.isFinite(summary.duration) &&
          summary.duration >= 0
        );
      }
    );

    if (validFeatures.length === 0) {
      return NextResponse.json(
        { error: "OpenRouteService returned no usable routes." },
        { status: 502 }
      );
    }

    const riskController = new AbortController();
    const riskTimeout = setTimeout(
      () => riskController.abort(),
      20000
    );

    let routes: RouteResult[];

    try {
      routes = await Promise.all(
        validFeatures.map(async (feature: any, index: number) => {
          const routeCoordinates =
            feature.geometry.coordinates as ORSCoordinate[];

          const risk = await assessRouteRisk(
            routeCoordinates,
            riskController.signal
          );

          return {
            id: `route-${index + 1}`,
            coordinates: routeCoordinates,

            distanceMeters: feature.properties.summary.distance,
            durationSeconds: feature.properties.summary.duration,

            riskScore: risk.score,
            safetyScore: risk.score,
            risk_score: risk.score,

            riskBand: risk.band,
            risk_band: risk.band,

            confidenceScore: risk.confidenceScore,
            riskError: risk.error,
            riskDataQuality: risk.dataQuality,

            source: "OpenRouteService + FastAPI",
          };
        })
      );
    } finally {
      clearTimeout(riskTimeout);
    }

    // Fastest first; distance breaks ties.
    routes.sort(
      (a, b) =>
        a.durationSeconds - b.durationSeconds ||
        a.distanceMeters - b.distanceMeters
    );

    // Keep route IDs consistent with the final display order.
    routes = routes.map((route, index) => ({
      ...route,
      id: `route-${index + 1}`,
    }));

    return NextResponse.json({
      routes,
      riskNotice:
        "Route risk is aggregated from FastAPI predictions at sampled route points. Some input features use baseline values rather than observed real-world data. Confidence is provided only when the classifier supports probability estimates; such estimates may not be calibrated.",
    });
  } catch (error) {
    console.error("Route API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to calculate routes. Please try again.",
      },
      { status: 500 }
    );
  }
}