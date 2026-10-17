
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import RouteMapLoader from "@/components/route-map-loader";
import {
  formatDistance,
  formatDuration,
  type RoadRoute,
  ZONES,
} from "@/components/route-data";
import AuthGuard from "@/components/auth-guard";
import { auth } from "@/lib/firebase";

export default function Page() {
  const router = useRouter();

  const [pickupId, setPickupId] = useState("Z03");
  const [destinationId, setDestinationId] = useState("Z01");
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<RoadRoute[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const pickup = ZONES.find((zone) => zone.id === pickupId)!;
  const destination = ZONES.find((zone) => zone.id === destinationId)!;

  useEffect(() => {
    const savedTheme = localStorage.getItem("saferoute-theme");
    setDarkMode(savedTheme === "dark");
    setThemeLoaded(true);
  }, []);

  useEffect(() => {
    if (!themeLoaded) return;

    document.documentElement.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("saferoute-theme", darkMode ? "dark" : "light");
  }, [darkMode, themeLoaded]);

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
    setSelectedRouteId((currentId) =>
      newRoutes.some((route) => route.id === currentId)
        ? currentId
        : newRoutes[0]?.id ?? null
    );
  }, []);

  const handleSelectRoute = useCallback((routeId: string) => {
    setSelectedRouteId(routeId);
  }, []);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await signOut(auth);
      router.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      setLoggingOut(false);
    }
  }

  function handlePickupChange(newPickupId: string) {
    if (newPickupId === destinationId) {
      const alternative = ZONES.find((zone) => zone.id !== newPickupId);
      if (alternative) setDestinationId(alternative.id);
    }

    setPickupId(newPickupId);
    setRoutes([]);
    setSelectedRouteId(null);
  }

  function handleDestinationChange(newDestinationId: string) {
    if (newDestinationId === pickupId) {
      const alternative = ZONES.find(
        (zone) => zone.id !== newDestinationId
      );
      if (alternative) setPickupId(alternative.id);
    }

    setDestinationId(newDestinationId);
    setRoutes([]);
    setSelectedRouteId(null);
  }

  return (
    <AuthGuard>
      <div
        className={`min-h-screen ${
          darkMode ? "dark-mode" : ""
        } bg-slate-50 text-slate-900`}
      >
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                SafeRoute
              </h1>
              <p className="text-sm text-slate-500">
                Route safety assistance for delivery partners
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setDarkMode((current) => !current)}
                aria-label={
                  darkMode ? "Switch to light mode" : "Switch to dark mode"
                }
                aria-pressed={darkMode}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                {darkMode ? "☀️ Light mode" : "🌙 Dark mode"}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                {loggingOut ? "Logging out..." : "Log out"}
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">
                Plan a delivery route
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Select your pickup and destination zones to find available
                road routes.
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
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
                className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                Recalculate routes
              </button>
              <p className="text-xs text-slate-500">
                Route requests require an internet connection.
              </p>
            </div>
          </section>

          <section className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Route map</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Select a route card to highlight the route on the map.
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

            <aside className="min-w-0 space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold">Available routes</h2>
                <p className="mb-4 mt-1 text-sm text-slate-500">
                  Compare the estimated distance and driving time.
                </p>

                {routes.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    Routes will appear here after a successful routing
                    request.
                  </p>
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
                          className={`w-full rounded-xl border p-4 text-left transition ${
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
                              <p className="text-xs text-slate-500">
                                Distance
                              </p>
                              <p className="mt-1 font-semibold">
                                {formatDistance(route.distanceMeters)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">
                                Driving time
                              </p>
                              <p className="mt-1 font-semibold">
                                {formatDuration(route.durationSeconds)}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="font-semibold">Route safety</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Routes are based on road-routing data. Safety scores and
                  real-time footfall data are not currently available.
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold">
                  Selected route summary
                </h2>

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
                  predictions.
                </p>
              </section>
            </aside>
          </section>

          <footer className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
            Route coordinates are approximate reference points. Routes and
            driving times are provided by the routing service. Live footfall,
            crime, lighting, weather and traffic feeds are not currently
            connected.
          </footer>
        </main>
      </div>
    </AuthGuard>
  );
}
