
export interface RiskInputPayload {
  zone_id: string;
  subzone: string;
  latitude: number;
  longitude: number;
  demand: number;
  accident_risk: number;
  incident_rate: number;
  hour: number;
  day_of_week: number;
  is_weekend: string;
  is_night: number;
  rain: number;
  low_footfall: number;
  poor_lighting: number;
  data_source: string;
}

export interface RiskResponse {
  zone_id: string;
  subzone: string;
  predicted_risk_score: number;
  predicted_risk_band: string;
  confidence_score: number | null;
}

const API_URL =
  process.env.RISK_API_URL ??
  "http://127.0.0.1:8000/predict";

export async function fetchRouteRisk(
  payload: RiskInputPayload,
  signal?: AbortSignal
): Promise<RiskResponse> {
  const timeoutSignal = AbortSignal.timeout(15000);

  // Prefer the caller's signal when provided. Otherwise, use
  // this helper's own 15-second timeout.
  const requestSignal = signal ?? timeoutSignal;

  let response: Response;

  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: requestSignal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("FastAPI risk prediction was cancelled or timed out.");
    }

    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("FastAPI risk prediction timed out after 15 seconds.");
    }

    throw new Error(
      `Could not connect to FastAPI at ${API_URL}. ` +
        "Check that the Python API is running and RISK_API_URL is correct."
    );
  }

  if (!response.ok) {
    const details = await response.text().catch(() => "");

    throw new Error(
      `FastAPI returned HTTP ${response.status}: ${
        details || response.statusText
      }`
    );
  }

  let raw: unknown;

  try {
    raw = await response.json();
  } catch {
    throw new Error("FastAPI returned invalid JSON.");
  }

  if (!raw || typeof raw !== "object") {
    throw new Error("FastAPI returned an invalid response.");
  }

  const data = raw as Record<string, unknown>;

  if (
    typeof data.predicted_risk_score !== "number" ||
    !Number.isFinite(data.predicted_risk_score)
  ) {
    throw new Error(
      "FastAPI returned an invalid predicted_risk_score."
    );
  }

  if (typeof data.predicted_risk_band !== "string") {
    throw new Error(
      "FastAPI returned an invalid predicted_risk_band."
    );
  }

  const confidence = data.confidence_score;

  if (
    confidence !== null &&
    (
      typeof confidence !== "number" ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1
    )
  ) {
    throw new Error(
      "FastAPI returned an invalid confidence_score. " +
        "Expected a number between 0 and 1, or null."
    );
  }

  return {
    zone_id:
      typeof data.zone_id === "string"
        ? data.zone_id
        : payload.zone_id,

    subzone:
      typeof data.subzone === "string"
        ? data.subzone
        : payload.subzone,

    predicted_risk_score: data.predicted_risk_score,
    predicted_risk_band: data.predicted_risk_band,
    confidence_score: confidence as number | null,
  };
}