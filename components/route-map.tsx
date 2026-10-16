
"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import {
  formatDistance,
  formatDuration,
  type RoadRoute,
  ZONES,
} from "./route-data";

type Props = {
  pickupId: string;
  destinationId: string;
  selectedRouteId: string | null;
  onRoutesLoaded: (routes: RoadRoute[]) => void;
  onSelectRoute: (routeId: string) => void;
  refreshKey: number;
};

type ApiRoute = {
  id: string;
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  riskScore: number | null;
  source: "ORS";
};

type ApiResponse = {
  routes?: ApiRoute[];
  error?: string;
};

function createMarker(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 1px 5px #555"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

const pickupIcon = createMarker("#16a34a");
const destinationIcon = createMarker("#dc2626");

function MapController({
  route,
  pickupPosition,
}: {
  route: RoadRoute | null;
  pickupPosition: [number, number];
}) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
    });

    resizeObserver.observe(container);

    const frame = requestAnimationFrame(() => {
      map.invalidateSize({ pan: false });
    });

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [map]);

  useEffect(() => {
    if (route && route.coordinates.length > 1) {
      const bounds = L.latLngBounds(route.coordinates);

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [35, 35],
          maxZoom: 15,
        });
        return;
      }
    }

    map.setView(pickupPosition, 12);
  }, [map, route, pickupPosition]);

  return null;
}

export default function RouteMap({
  pickupId,
  destinationId,
  selectedRouteId,
  onRoutesLoaded,
  onSelectRoute,
  refreshKey,
}: Props) {
  const [routes, setRoutes] = useState<RoadRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pickup = useMemo(
    () => ZONES.find((zone) => zone.id === pickupId),
    [pickupId]
  );

  const destination = useMemo(
    () => ZONES.find((zone) => zone.id === destinationId),
    [destinationId]
  );

  const selectedRoute =
    routes.find((route) => route.id === selectedRouteId) ??
    routes[0] ??
    null;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadRoutes() {
      setRoutes([]);
      setError("");
      onRoutesLoaded([]);

      if (!pickup || !destination) {
        setError("Please select valid pickup and destination zones.");
        setLoading(false);
        return;
      }

      if (pickup.id === destination.id) {
        setError("Choose two different zones for your trip.");
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const response = await fetch("/api/routes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pickup: pickup.position,
            destination: destination.position,
          }),
          signal: controller.signal,
        });

        const data = (await response.json()) as ApiResponse;

        if (!response.ok) {
          throw new Error(
            data.error ||
              `Routing service returned HTTP ${response.status}.`
          );
        }

        if (!Array.isArray(data.routes) || data.routes.length === 0) {
          throw new Error("No routes were returned.");
        }

        const validRoutes: RoadRoute[] = data.routes
          .filter(
            (route) =>
              Array.isArray(route.coordinates) &&
              route.coordinates.length > 1 &&
              Number.isFinite(route.distanceMeters) &&
              Number.isFinite(route.durationSeconds)
          )
          .map((route, index) => ({
            id: `route-${index + 1}`,
            // ORS returns [longitude, latitude].
            // Leaflet uses [latitude, longitude].
            coordinates: route.coordinates.map(
              ([longitude, latitude]) =>
                [latitude, longitude] as [number, number]
            ),
            distanceMeters: route.distanceMeters,
            durationSeconds: route.durationSeconds,
            riskScore: null,
            source: "ORS",
          }));

        if (validRoutes.length === 0) {
          throw new Error("No valid route geometry was returned.");
        }

        validRoutes.sort((a, b) => {
           // Primary: shortest estimated driving time.
           const timeDifference = a.durationSeconds - b.durationSeconds;

           if (timeDifference !== 0) {
              return timeDifference;
        }

        // Tie-breaker: shorter distance when estimated times are equal.
            return a.distanceMeters - b.distanceMeters;
       });

        const normalizedRoutes = validRoutes.map((route, index) => ({
          ...route,
          id: `route-${index + 1}`,
        }));

        if (!active) return;

        setRoutes(normalizedRoutes);
        onRoutesLoaded(normalizedRoutes);

        if (normalizedRoutes.length === 1) {
          setError(
            "Only one route was returned. Alternative routes are not guaranteed for every journey."
          );
        }
      } catch (err) {
        if (
          !active ||
          (err instanceof Error && err.name === "AbortError")
        ) {
          return;
        }

        const message =
          err instanceof Error ? err.message : "Could not load routes.";

        setRoutes([]);
        onRoutesLoaded([]);
        setError(`${message} Check your connection and try again.`);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadRoutes();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    pickupId,
    destinationId,
    refreshKey,
    pickup,
    destination,
    onRoutesLoaded,
  ]);

  if (!pickup || !destination) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        The selected zone could not be found.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
        <span>
          <span className="mr-2 inline-block h-3 w-3 rounded-full bg-green-600" />
          Pickup: {pickup.name}
        </span>

        <span>
          <span className="mr-2 inline-block h-3 w-3 rounded-full bg-red-600" />
          Destination: {destination.name}
        </span>

        <span>
          <span className="mr-2 inline-block h-1 w-5 bg-cyan-600 align-middle" />
          Selected route
        </span>
      </div>

      {loading && (
        <p role="status" className="text-sm text-slate-600">
          Finding available road routes…
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
        >
          {error}
        </div>
      )}

      {selectedRoute && (
        <div className="flex flex-wrap gap-6 rounded-lg bg-slate-50 p-3">
          <div>
            <p className="text-xs text-slate-500">Road distance</p>
            <p className="font-semibold">
              {formatDistance(selectedRoute.distanceMeters)}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">
              Estimated driving time
            </p>
            <p className="font-semibold">
              {formatDuration(selectedRoute.durationSeconds)}
            </p>
          </div>

          <p className="self-center text-xs text-slate-500">
            OpenRouteService estimate; not live-traffic data.
          </p>
        </div>
      )}

      <div className="h-[460px] w-full overflow-hidden rounded-xl border border-slate-200">
        <MapContainer
          center={pickup.position}
          zoom={12}
          className="h-full w-full"
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <MapController
            route={selectedRoute}
            pickupPosition={pickup.position}
          />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Marker position={pickup.position} icon={pickupIcon}>
            <Popup>Pickup: {pickup.name}</Popup>
          </Marker>

          <Marker position={destination.position} icon={destinationIcon}>
            <Popup>Destination: {destination.name}</Popup>
          </Marker>

          {routes.map((route) => {
            const isSelected = route.id === selectedRoute?.id;

            return (
              <Polyline
                key={route.id}
                positions={route.coordinates}
                pathOptions={{
                  color: isSelected ? "#0891b2" : "#64748b",
                  weight: isSelected ? 6 : 4,
                  opacity: isSelected ? 0.95 : 0.5,
                }}
                eventHandlers={{
                  click: () => onSelectRoute(route.id),
                }}
              />
            );
          })}
        </MapContainer>
      </div>

      {routes.length > 0 && (
        <p className="text-xs text-slate-500">
          {routes.length} route option{routes.length === 1 ? "" : "s"} returned.
          Route alternatives are not guaranteed. Zone coordinates are
          approximate reference points.
        </p>
      )}
    </section>
  );
}
