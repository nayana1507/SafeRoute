import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type LightingReportType =
  | "outage"
  | "poor_lighting"
  | "restored";

export type LightingReport = {
  id: string;
  type: LightingReportType;
  latitude: number;
  longitude: number;
  reportedAt: Timestamp | null;
  status: "active" | "resolved";
  confirmations: number;
  note?: string;
};

const reportsCollection = collection(db, "lightingReports");

function validateCoordinates(latitude: number, longitude: number) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Invalid report coordinates.");
  }
}

function distanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadius = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLon / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function submitLightingReport(input: {
  type: Exclude<LightingReportType, "restored">;
  latitude: number;
  longitude: number;
  note?: string;
}) {
  const { latitude, longitude } = input;

  validateCoordinates(latitude, longitude);

  return addDoc(reportsCollection, {
    type: input.type,
    latitude,
    longitude,
    note: input.note?.trim() || "",
    reportedAt: serverTimestamp(),
    status: "active",
    confirmations: 0,
  });
}

export function subscribeToLightingReports(
  onReports: (reports: LightingReport[]) => void,
  onError?: (error: Error) => void
) {
  const reportsQuery = query(
    reportsCollection,
    where("status", "==", "active"),
    orderBy("reportedAt", "desc")
  );

  return onSnapshot(
    reportsQuery,
    (snapshot) => {
      const reports = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as LightingReport[];

      onReports(reports);
    },
    (error) => onError?.(error)
  );
}

/**
 * Resolve the nearest active streetlight outage within maxDistanceMeters.
 * Throws if no matching outage is close enough.
 */
export async function resolveNearestLightingOutage(
  latitude: number,
  longitude: number,
  maxDistanceMeters = 100
) {
  validateCoordinates(latitude, longitude);

  if (!Number.isFinite(maxDistanceMeters) || maxDistanceMeters <= 0) {
    throw new Error("The search distance must be greater than zero.");
  }

  // A single-field status query avoids requiring another composite index.
  const activeReportsQuery = query(
    reportsCollection,
    where("status", "==", "active")
  );

  const snapshot = await getDocs(activeReportsQuery);

  let nearest:
    | {
        id: string;
        distance: number;
      }
    | undefined;

  for (const item of snapshot.docs) {
    const data = item.data();

    if (data.type !== "outage") continue;

    if (
      typeof data.latitude !== "number" ||
      typeof data.longitude !== "number"
    ) {
      continue;
    }

    const distance = distanceInMeters(
      latitude,
      longitude,
      data.latitude,
      data.longitude
    );

    if (
      distance <= maxDistanceMeters &&
      (!nearest || distance < nearest.distance)
    ) {
      nearest = { id: item.id, distance };
    }
  }

  if (!nearest) {
    throw new Error(
      `No active streetlight outage was found within ${maxDistanceMeters} metres. Select the location of an existing outage, or submit a new outage report if the light is still broken.`
    );
  }

  await updateDoc(doc(db, "lightingReports", nearest.id), {
    status: "resolved",
    resolvedAt: serverTimestamp(),
  });

  return {
    id: nearest.id,
    distanceMeters: Math.round(nearest.distance),
  };
}

export async function resolveLightingReport(id: string) {
  if (!id.trim()) {
    throw new Error("A lighting report ID is required.");
  }

  await updateDoc(doc(db, "lightingReports", id), {
    status: "resolved",
    resolvedAt: serverTimestamp(),
  });
}