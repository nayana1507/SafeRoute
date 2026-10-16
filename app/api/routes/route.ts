
import { NextResponse } from "next/server";

type Coordinates = [number, number];

function isValidPoint(value: unknown): value is Coordinates {
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

export async function POST(request: Request) {
  const apiKey = process.env.ORS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "ORS_API_KEY is missing from .env.local." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { pickup, destination } = body;

    if (!isValidPoint(pickup) || !isValidPoint(destination)) {
      return NextResponse.json(
        {
          error:
            "Pickup and destination must be [latitude, longitude] coordinates.",
        },
        { status: 400 }
      );
    }

    // The app uses [latitude, longitude].
    // OpenRouteService expects [longitude, latitude].
    const coordinates = [
      [pickup[1], pickup[0]],
      [destination[1], destination[0]],
    ];

    const response = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
          Accept: "application/geo+json, application/json",
        },
        body: JSON.stringify({
          coordinates,
          alternative_routes: {
            target_count: 3,
            weight_factor: 1.4,
            share_factor: 0.6,
          },
        }),
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenRouteService error:", response.status, data);

      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            data?.message ||
            `Routing service returned HTTP ${response.status}.`,
        },
        { status: response.status }
      );
    }

    const features = Array.isArray(data.features) ? data.features : [];

    const routes = features
      .filter((feature: any) => {
        const geometry = feature.geometry;
        const summary = feature.properties?.summary;

        return (
          Array.isArray(geometry?.coordinates) &&
          geometry.coordinates.length > 1 &&
          Number.isFinite(summary?.distance) &&
          Number.isFinite(summary?.duration)
        );
      })
      .map((feature: any, index: number) => ({
        id: `route-${index + 1}`,
        // Keep coordinates in ORS order here.
        // The frontend converts them to Leaflet order.
        coordinates: feature.geometry.coordinates,
        distanceMeters: feature.properties.summary.distance,
        durationSeconds: feature.properties.summary.duration,
        riskScore: null,
        source: "ORS",
      }));

    if (routes.length === 0) {
      return NextResponse.json(
        { error: "OpenRouteService returned no usable routes." },
        { status: 502 }
      );
    }

    return NextResponse.json({ routes });
  } catch (error) {
    console.error("Route API error:", error);

    return NextResponse.json(
      { error: "Unable to calculate routes. Please try again." },
      { status: 500 }
    );
  }
}
