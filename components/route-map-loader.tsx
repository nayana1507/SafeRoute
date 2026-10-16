"use client";

import dynamic from "next/dynamic";
import type { RoadRoute } from "./route-data";

type RouteMapLoaderProps = {
  pickupId: string;
  destinationId: string;
  selectedRouteId: string | null;
  onRoutesLoaded: (routes: RoadRoute[]) => void;
  onSelectRoute: (routeId: string) => void;
  refreshKey: number;
};

const RouteMap = dynamic(() => import("./route-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[460px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600">
      Loading map…
    </div>
  ),
});

export default function RouteMapLoader(props: RouteMapLoaderProps) {
  return <RouteMap {...props} />;
}