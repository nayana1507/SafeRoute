
import {
  addDoc,
  collection,
  doc,
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

export async function submitLightingReport(input: {
  type: LightingReportType;
  latitude: number;
  longitude: number;
  note?: string;
}) {
  const { latitude, longitude } = input;

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

  return addDoc(reportsCollection, {
    type: input.type,
    latitude,
    longitude,
    note: input.note?.trim() || "",
    reportedAt: serverTimestamp(),
    status: input.type === "restored" ? "resolved" : "active",
    confirmations: 0,
  });
}

export function subscribeToLightingReports(
  onReports: (reports: LightingReport[]) => void,
  onError?: (error: Error) => void,
) {
  const reportsQuery = query(
    reportsCollection,
    where("status", "==", "active"),
    orderBy("reportedAt", "desc"),
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
    (error) => onError?.(error),
  );
}

export async function resolveLightingReport(id: string) {
  await updateDoc(doc(db, "lightingReports", id), {
    status: "resolved",
  });
}
