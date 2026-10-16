"use client";

import { useCallback, useMemo, useState } from "react";
import RouteMapLoader from "@/components/route-map-loader";
import {
  formatDistance,
  formatDuration,
  RoadRoute,
  ZONES,
} from "@/components/route-data";

export default function Page() {
  const [pickupId, setPickupId] = useState("Z03");
  const [destinationId, setDestinationId] = useState("Z01");
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<RoadRoute[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [checkInStarted, setCheckInStarted] = useState(false);

  const pickup = ZONES.find((zone) => zone.id === pickupId)!;
  const destination = ZONES.find((zone) => zone.id === destinationId)!;

  const sortedRoutes = useMemo(
    () => [...routes].sort((a, b) => a.durationSeconds - b.durationSeconds),
    [routes]
  );

  const selectedRoute =
    routes.find((route) => route.id === selectedRouteId) ??
    sortedRoutes[0] ??
    null;

  const fastestRouteId = sortedRoutes[0]?.id ?? null;

  const handleRoutesLoaded = useCallback((newRoutes: RoadRoute[]) => {
    setRoutes(newRoutes);
    setSelectedRouteId(newRoutes[0]?.id ?? null);
  }, []);

  const handleSelectRoute = useCallback((routeId: string) => {
    setSelectedRouteId(routeId);
  }, []);

  function handlePickupChange(newPickupId: string) {
    setPickupId(newPickupId);

    // Keep the two endpoints different.
    if (newPickupId === destinationId) {
      const alternative = ZONES.find((zone) => zone.id !== newPickupId);
      if (alternative) setDestinationId(alternative.id);
    }

    setRoutes([]);
    setSelectedRouteId(null);
  }

  function handleDestinationChange(newDestinationId: string) {
    setDestinationId(newDestinationId);

    if (newDestinationId === pickupId) {
      const alternative = ZONES.find((zone) => zone.id !== newDestinationId);
      if (alternative) setPickupId(alternative.id);
    }

    setRoutes([]);
    setSelectedRouteId(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              SafeRoute
            </h1>
            <p className="text-sm text-slate-500">
              Route safety assistance for delivery partners
            </p>
          </div>

          <span className="rounded-full bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800">
            DEMO · RISK ENGINE NOT CONNECTED
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Plan a delivery route</h2>
            <p className="mt-1 text-sm text-slate-500">
              Select your pickup and destination zones to request road routes.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Pickup zone</span>
              <select
                value={pickupId}
                onChange={(event) => handlePickupChange(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              >
                {ZONES.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">
                {pickup.landmarks}
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium">
                Destination zone
              </span>
              <select
                value={destinationId}
                onChange={(event) =>
                  handleDestinationChange(event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              >
                {ZONES.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">
                {destination.landmarks}
              </span>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setRefreshKey((key) => key + 1)}
              className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              Recalculate routes
            </button>

            <p className="text-xs text-slate-500">
              Route requests require an internet connection.
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Route map</h2>
              <p className="mt-1 text-sm text-slate-500">
                Select a route card or click a route line to change the
                highlighted route.
              </p>
            </div>

            <RouteMapLoader
              pickupId={pickupId}
              destinationId={destinationId}
              selectedRouteId={selectedRouteId}
              onRoutesLoaded={handleRoutesLoaded}
              onSelectRoute={handleSelectRoute}
              refreshKey={refreshKey}
            />
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Available routes</h2>
              <p className="mb-4 mt-1 text-sm text-slate-500">
                Distance and duration come from the routing service.
              </p>

              {routes.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  Routes will appear here after a successful routing request.
                  If none appear, check the message above the map and try again.
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedRoutes.map((route, index) => {
                    const isSelected = route.id === selectedRouteId;
                    const isFastest = route.id === fastestRouteId;

                    return (
                      <button
                        key={route.id}
                        type="button"
                        onClick={() => handleSelectRoute(route.id)}
                        aria-pressed={isSelected}
                        className={`w-full rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600"
                            : "border-slate-200 bg-white hover:border-slate-400"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">
                              Route option {index + 1}
                            </p>
                            {isFastest && (
                              <span className="mt-1 inline-block rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800">
                                Fastest returned
                              </span>
                            )}
                          </div>

                          {isSelected && (
                            <span className="text-xs font-semibold text-emerald-800">
                              Selected
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-slate-500">Distance</p>
                            <p className="mt-1 font-semibold">
                              {formatDistance(route.distanceMeters)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">
                              Est. driving time
                            </p>
                            <p className="mt-1 font-semibold">
                              {formatDuration(route.durationSeconds)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 border-t border-slate-200 pt-3">
                          <p className="text-sm text-slate-600">
                            Safety score:{" "}
                            <span className="font-medium">
                              Not available
                            </span>
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-semibold text-amber-950">
                Safety information
              </h2>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                The risk engine has not been connected. This version cannot
                determine which route is safest. A shorter route or faster
                estimated journey is not necessarily a safer route.
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Selected route summary</h2>

              {selectedRoute ? (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Distance</p>
                    <p className="mt-1 text-lg font-bold">
                      {formatDistance(selectedRoute.distanceMeters)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Driving time</p>
                    <p className="mt-1 text-lg font-bold">
                      {formatDuration(selectedRoute.durationSeconds)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  No route is selected yet.
                </p>
              )}

              <p className="mt-4 text-xs leading-5 text-slate-500">
                These are routing-service estimates, not live traffic
                predictions. Route availability depends on the service
                response.
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Safety check-in demo</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Simulate starting a check-in for your delivery journey.
                This demo does not send messages or contact emergency services.
              </p>

              <button
                type="button"
                onClick={() => setCheckInStarted((started) => !started)}
                className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {checkInStarted ? "End demo check-in" : "Start demo check-in"}
              </button>

              {checkInStarted && (
                <p
                  role="status"
                  className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
                >
                  Demo check-in active. No alert or message has been sent.
                </p>
              )}
            </section>
          </aside>
        </section>

        <footer className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
          <strong>Prototype limitations:</strong> Safety-zone coordinates are
          approximate reference points, not verified boundaries. Routes and
          driving times are provided by the OSRM routing service. This
          application currently has no live footfall, crime, lighting, weather
          or traffic feed and no connected machine-learning risk predictions.
          OpenStreetMap map data is used for display.
        </footer>
      </main>
    </div>
  );
}