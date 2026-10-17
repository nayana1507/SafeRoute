
"use client";

import { useCallback, useMemo, useState } from "react";
import RouteMapLoader from "@/components/route-map-loader";
import {
  formatDistance,
  formatDuration,
  type RoadRoute,
  ZONES,
} from "@/components/route-data";

function RiskBand({ band }: { band: string }) {
  const styles =
    band === "High"
      ? "bg-red-100 text-red-800"
      : band === "Medium"
        ? "bg-amber-100 text-amber-800"
        : band === "Low"
          ? "bg-emerald-100 text-emerald-800"
          : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}
    >
      {band}
    </span>
  );
}

export default function Page() {
  const [pickupId, setPickupId] = useState("Z03");
  const [destinationId, setDestinationId] = useState("Z01");
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<RoadRoute[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [checkInStarted, setCheckInStarted] = useState(false);

  const pickup = ZONES.find((zone) => zone.id === pickupId);
  const destination = ZONES.find((zone) => zone.id === destinationId);

  const sortedRoutes = useMemo(
    () =>
      [...routes].sort(
        (a, b) =>
          a.durationSeconds - b.durationSeconds ||
          a.distanceMeters - b.distanceMeters
      ),
    [routes]
  );

  const selectedRoute =
    routes.find((route) => route.id === selectedRouteId) ??
    sortedRoutes[0] ??
    null;

  const fastestRouteId = sortedRoutes[0]?.id ?? null;

  const safestRoute = useMemo(() => {
    const routesWithScores = routes.filter(
      (route) =>
        route.riskScore !== null &&
        Number.isFinite(route.riskScore)
    );

    if (routesWithScores.length === 0) return null;

    // Assumes lower predicted risk scores mean safer routes.
    return routesWithScores.reduce((safest, route) =>
      route.riskScore! < safest.riskScore! ? route : safest
    );
  }, [routes]);

  const handleRoutesLoaded = useCallback((newRoutes: RoadRoute[]) => {
    setRoutes(newRoutes);
    setSelectedRouteId(newRoutes[0]?.id ?? null);
  }, []);

  const handleSelectRoute = useCallback((routeId: string) => {
    setSelectedRouteId(routeId);
  }, []);

  function handlePickupChange(newPickupId: string) {
    setPickupId(newPickupId);

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
      const alternative = ZONES.find(
        (zone) => zone.id !== newDestinationId
      );
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

          <span className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-800">
            ROUTING + RISK ASSESSMENT
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">
              Plan a delivery route
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Select your pickup and destination zones to request road routes
              and risk predictions.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">
                Pickup zone
              </span>

              <select
                value={pickupId}
                onChange={(event) =>
                  handlePickupChange(event.target.value)
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
                {pickup?.landmarks}
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
                {destination?.landmarks}
              </span>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setRefreshKey((key) => key + 1)}
              disabled={pickupId === destinationId}
              className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              Recalculate routes
            </button>

            <p className="text-xs text-slate-500">
              Routing and predictions require the relevant services to be
              running.
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Route map</h2>
              <p className="mt-1 text-sm text-slate-500">
                Select a route card or click a route line to highlight that
                route and update its summary.
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
                Compare distance, estimated driving time, and predicted risk.
              </p>

              {routes.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  Routes will appear here after a successful routing request.
                  Select your zones and click Recalculate routes.
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedRoutes.map((route, index) => {
                    const isSelected = route.id === selectedRouteId;
                    const isFastest = route.id === fastestRouteId;
                    const isSafest = route.id === safestRoute?.id;

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

                            <div className="mt-2 flex flex-wrap gap-2">
                              {isFastest && (
                                <span className="inline-block rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800">
                                  Fastest
                                </span>
                              )}

                              {isSafest && (
                                <span className="inline-block rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
                                  Lowest predicted risk
                                </span>
                              )}
                            </div>
                          </div>

                          {isSelected && (
                            <span className="text-xs font-semibold text-emerald-800">
                              Selected
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-slate-500">
                              Distance
                            </p>
                            <p className="mt-1 font-semibold">
                              {formatDistance(route.distanceMeters)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Estimated driving time
                            </p>
                            <p className="mt-1 font-semibold">
                              {formatDuration(route.durationSeconds)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-slate-600">
                              Predicted risk score
                            </span>
                            <span className="font-semibold text-slate-900">
                              {route.riskScore !== null &&
                              Number.isFinite(route.riskScore)
                                ? route.riskScore.toFixed(2)
                                : "Not available"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-slate-600">
                              Risk level
                            </span>
                            <RiskBand
                              band={
                                route.riskScore !== null
                                  ? route.riskBand
                                  : "Unavailable"
                              }
                            />
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-slate-600">
                              Model confidence
                            </span>
                            <span className="font-semibold text-slate-900">
                              {route.confidenceScore != null &&
                              Number.isFinite(route.confidenceScore)
                                ? `${(route.confidenceScore * 100).toFixed(0)}%`
                                : "Not available"}
                            </span>
                          </div>

                          {route.riskError && (
                            <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">
                              Prediction error: {route.riskError}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <h2 className="font-semibold text-emerald-950">
                Risk assessment
              </h2>

              <p className="mt-2 text-sm leading-6 text-emerald-900">
                Risk predictions are supplied by your FastAPI model. The
                lowest predicted risk and fastest estimated route may be
                different options. Predictions depend on the quality and
                completeness of the input data.
              </p>

              {routes.length > 0 && (
                <p className="mt-3 text-sm text-emerald-900">
                  {routes.filter((route) => route.riskScore !== null).length}
                  {" of "}
                  {routes.length} routes have a risk prediction.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">
                Selected route summary
              </h2>

              {selectedRoute ? (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Distance</p>
                      <p className="mt-1 text-lg font-bold">
                        {formatDistance(selectedRoute.distanceMeters)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">
                        Driving time
                      </p>
                      <p className="mt-1 text-lg font-bold">
                        {formatDuration(selectedRoute.durationSeconds)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">
                      Predicted risk score
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {selectedRoute.riskScore !== null
                        ? selectedRoute.riskScore.toFixed(2)
                        : "Not available"}
                    </p>
                    <div className="mt-2">
                      <RiskBand
                        band={
                          selectedRoute.riskScore !== null
                            ? selectedRoute.riskBand
                            : "Unavailable"
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Model confidence
                    </p>
                    <p className="mt-1 font-semibold">
                      {selectedRoute.confidenceScore != null &&
                      Number.isFinite(selectedRoute.confidenceScore)
                        ? `${(selectedRoute.confidenceScore * 100).toFixed(0)}%`
                        : "Not available"}
                    </p>
                  </div>

                  {selectedRoute.riskError && (
                    <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                      Risk prediction failed: {selectedRoute.riskError}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  No route is selected yet.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">
                Safety check-in demo
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Simulate starting a check-in for your delivery journey.
                This demo does not send messages or contact emergency
                services.
              </p>

              <button
                type="button"
                onClick={() =>
                  setCheckInStarted((started) => !started)
                }
                className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {checkInStarted
                  ? "End demo check-in"
                  : "Start demo check-in"}
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
          <strong>System status:</strong> OpenRouteService provides route
          geometry and estimated driving times. FastAPI provides the
          predicted risk score, risk band, and model confidence when
          prediction succeeds.
        </footer>
      </main>
    </div>
  );
}