import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
loadLocalEnv();
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.DATABRICKS_APP_PORT ?? process.env.PORT ?? 5173);
const codexCommand = resolveCodexCommand();

const vite = isProduction
  ? null
  : await import("vite").then(({ createServer }) =>
      createServer({
        root,
        appType: "spa",
        server: { middlewareMode: true, hmr: false },
      }),
    );

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "POST" && url.pathname === "/api/databricks-nearest") {
      const body = await readJson(req, 128_000);
      const result = await fetchDatabricksNearest({
        profile: body.profile,
        careNeed: typeof body.careNeed === "string" ? body.careNeed : "General medicine",
        limit: Number(body.limit ?? 5),
      });

      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/api/codex-chat") {
      const body = await readJson(req, 128_000);
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!message) return sendJson(res, 400, { error: "Message is required." });

      const result = await runCodexChat({
        message,
        profile: body.profile,
        history: Array.isArray(body.history) ? body.history : [],
        recommendations: Array.isArray(body.recommendations) ? body.recommendations : [],
      });

      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/api/openai-realtime-token") {
      const body = await readJson(req, 128_000).catch(() => ({}));
      const result = await createOpenAIRealtimeClientSecret({
        profile: body.profile,
        recommendations: Array.isArray(body.recommendations) ? body.recommendations : [],
      });

      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/api/openai-tts") {
      const body = await readJson(req, 128_000);
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!text) return sendJson(res, 400, { error: "Text is required." });

      const result = await createOpenAISpeech(text);
      if (!result.ok) return sendJson(res, 400, { error: result.error });

      res.writeHead(200, {
        "content-type": result.contentType,
        "cache-control": "no-store",
      });
      return res.end(result.audio);
    }

    if (vite) {
      return vite.middlewares(req, res, () => {
        sendJson(res, 404, { error: "Not found." });
      });
    }

    return serveStatic(req, res, url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return sendJson(res, 500, { error: message });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Prism server listening on http://localhost:${port}`);
});

async function fetchDatabricksNearest({ profile, careNeed, limit }) {
  const config = await getDatabricksConfig();
  if (!config) {
    return {
      ok: false,
      error:
        "Databricks is not configured. Set DATABRICKS_HOST, DATABRICKS_TOKEN, and DATABRICKS_WAREHOUSE_ID, or set PRISM_DATABRICKS_PROFILE to an authenticated Databricks CLI profile.",
      recommendations: [],
    };
  }

  const rowLimit = clampNumber(limit, 1, 20);
  let rows = [];
  try {
    rows = await queryDatabricksRows(config, rowLimit, profile, careNeed);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Databricks query failed.",
      recommendations: [],
      source: config.table,
    };
  }

  const recommendations = rows
    .map((row) => databricksRowToRecommendation(row, profile, careNeed, config.table))
    .filter(Boolean)
    .sort((a, b) => {
      const aCareMatch = a.facility.services.includes(a.careNeed) ? 0 : 1;
      const bCareMatch = b.facility.services.includes(b.careNeed) ? 0 : 1;
      return aCareMatch - bCareMatch || a.facility.distanceKm - b.facility.distanceKm;
    })
    .slice(0, rowLimit);

  if (recommendations.length === 0) {
    return {
      ok: false,
      error: `Databricks returned no usable facility rows from ${config.table}.`,
      recommendations: [],
      source: config.table,
    };
  }

  return {
    ok: true,
    source: config.table,
    recommendations,
  };
}

async function getDatabricksConfig() {
  const host = normalizeHost(process.env.DATABRICKS_HOST ?? process.env.DATABRICKS_WORKSPACE_URL);
  const token = process.env.DATABRICKS_TOKEN;
  const warehouseId =
    process.env.DATABRICKS_WAREHOUSE_ID ?? warehouseIdFromHttpPath(process.env.DATABRICKS_HTTP_PATH ?? "");
  const table =
    process.env.PRISM_DATABRICKS_TABLE ??
    "databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities";

  if (host && token && warehouseId) return { host, token, warehouseId, table };

  const appToken = await getDatabricksAppToken(host);
  if (host && appToken && warehouseId) return { host, token: appToken, warehouseId, table };

  const profile = process.env.PRISM_DATABRICKS_PROFILE ?? process.env.DATABRICKS_CONFIG_PROFILE;
  if (!profile) return null;

  const cliAuth = await getDatabricksCliAuth(profile);
  const cliWarehouseId =
    warehouseId || process.env.DATABRICKS_WAREHOUSE_ID || (await getDatabricksDefaultWarehouse(profile));
  if (!cliAuth?.host || !cliAuth?.token || !cliWarehouseId) return null;

  return {
    host: cliAuth.host,
    token: cliAuth.token,
    warehouseId: cliWarehouseId,
    table,
  };
}

async function queryDatabricksRows(config, limit, profile, careNeed) {
  const statement = process.env.PRISM_DATABRICKS_NEAREST_SQL ?? buildNearestFacilitySql(config.table, profile, careNeed, limit);
  const response = await fetch(`${config.host}/api/2.0/sql/statements/`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      statement,
      warehouse_id: config.warehouseId,
      wait_timeout: "10s",
      disposition: "INLINE",
      format: "JSON_ARRAY",
    }),
  });

  const created = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(created?.message ?? "Databricks SQL statement failed to start.");
  }

  const completed = await waitForDatabricksStatement(config, created);
  const status = completed?.status?.state;
  if (status !== "SUCCEEDED") {
    const message = completed?.status?.error?.message ?? `Databricks SQL statement ended with ${status ?? "unknown status"}.`;
    throw new Error(message);
  }

  return statementResultToRows(completed);
}

function buildNearestFacilitySql(table, profile, careNeed, limit) {
  const location = String(profile?.location ?? "");
  const city = location.split(",")[0]?.trim() || "";
  const state = location.split(",")[1]?.trim() || "";
  const coordinates = knownCoordinates(location);
  const careClause = buildCareMatchClause(careNeed);
  const distanceExpression = coordinates
    ? `6371 * 2 * ASIN(SQRT(POWER(SIN(RADIANS(latitude - ${coordinates.lat}) / 2), 2) + COS(RADIANS(${coordinates.lat})) * COS(RADIANS(latitude)) * POWER(SIN(RADIANS(longitude - ${coordinates.lon}) / 2), 2)))`
    : "999";

  return `
SELECT
  *,
  ${distanceExpression} AS distance_km
FROM ${quoteSqlPath(table)}
WHERE name IS NOT NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND lower(coalesce(organization_type, 'facility')) LIKE '%facility%'
ORDER BY
  CASE WHEN ${careClause} THEN 0 ELSE 1 END,
  CASE
    WHEN ${city ? `lower(coalesce(address_city, '')) = lower('${escapeSqlLiteral(city)}')` : "false"} THEN 0
    WHEN ${state ? `lower(coalesce(address_stateOrRegion, '')) LIKE lower('%${escapeSqlLiteral(state)}%')` : "false"} THEN 1
    ELSE 2
  END,
  distance_km ASC
LIMIT ${limit}
`.trim();
}

async function waitForDatabricksStatement(config, statement) {
  let current = statement;
  const statementId = current?.statement_id;
  if (!statementId) return current;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const state = current?.status?.state;
    if (state === "SUCCEEDED" || state === "FAILED" || state === "CANCELED" || state === "CLOSED") {
      return current;
    }

    await delay(1000);
    const response = await fetch(`${config.host}/api/2.0/sql/statements/${statementId}`, {
      headers: { authorization: `Bearer ${config.token}` },
    });
    current = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(current?.message ?? "Databricks SQL statement polling failed.");
  }

  throw new Error("Databricks SQL statement timed out.");
}

function statementResultToRows(statement) {
  const columns = statement?.manifest?.schema?.columns?.map((column) => column.name) ?? [];
  const data = statement?.result?.data_array ?? [];
  return data.map((values) =>
    Object.fromEntries(columns.map((column, index) => [column, normalizeDatabricksValue(values[index])])),
  );
}

function databricksRowToRecommendation(row, profile, careNeed, source) {
  const name = pickValue(row, ["facility_name", "name", "center_name", "hospital_name", "provider_name"]);
  if (!name) return null;

  const distanceKm = pickNumber(row, ["distance_km", "distanceKm", "distance", "km"], 999);
  const selectedCareNeed = normalizeCareNeed(
    pickValue(row, ["care_need", "service", "primary_service", "specialty", "service_line"]) ?? careNeed,
  );
  const services = parseServices(pickValue(row, ["services", "service_lines", "specialties", "capability"]), selectedCareNeed);
  const waitMinutes = pickPositiveNumber(row, ["wait_minutes", "waitMinutes", "estimated_wait_minutes"], 45);
  const cabMinutes = pickPositiveNumber(
    row,
    ["travel_minutes", "estimated_travel_minutes", "cab_minutes"],
    Math.max(3, Math.round(distanceKm * 4.5 + 1)),
  );
  const evidenceConfidence = clampNumber(
    pickPositiveNumber(row, ["evidence_confidence", "confidence", "source_confidence"], 82),
    0,
    99,
  );
  const averageVisitCost = pickNumber(row, ["average_visit_cost", "avg_visit_cost", "typical_visit_cost", "price"], 0);
  const priceIndex = clampNumber(Math.round(pickNumber(row, ["price_index", "priceIndex", "budget_tier"], 2)), 1, 4);
  const facility = {
    id: slugify(pickValue(row, ["facility_id", "id", "provider_id"]) ?? name),
    name,
    facilityType: pickValue(row, ["facility_type", "type", "category", "organization_type"]) ?? "Care center",
    region:
      pickValue(row, ["region", "area", "district", "address_stateOrRegion"]) ??
      pickValue(row, ["city", "address_city"]) ??
      "Unknown region",
    city: pickValue(row, ["city", "address_city"]) ?? profile?.location ?? "",
    distanceKm,
    services,
    priceIndex,
    averageVisitCost,
    waitMinutes,
    evidenceConfidence,
    availability: pickValue(row, ["availability", "availability_status", "status"]) ?? "Availability must be confirmed by phone",
    phone: firstListItem(pickValue(row, ["phone", "phone_number", "contact_phone", "officialPhone", "phone_numbers"])) ?? "Phone not listed",
    booking: pickValue(row, ["booking", "booking_instructions", "appointment_instructions"]) ?? "Call before travel",
    evidence: [
      {
        label: pickValue(row, ["evidence_label"]) ?? "Facility row returned from Databricks",
        source,
        freshness: pickValue(row, ["freshness", "updated_at", "snapshot_date", "recency_of_page_update"]) ?? "Databricks query",
        confidence: evidenceConfidence,
      },
    ],
    missingEvidence: parseList(pickValue(row, ["missing_evidence", "missing_fields"])),
    suspiciousSignals: parseList(pickValue(row, ["suspicious_signals", "conflicts"])),
    travelTimes: {
      Ambulance: pickPositiveNumber(row, ["ambulance_minutes"], Math.max(8, Math.round(cabMinutes * 0.7))),
      Cab: cabMinutes,
      Train: pickNullableNumber(row, ["train_minutes"]),
      "Own vehicle": pickPositiveNumber(row, ["own_vehicle_minutes", "drive_minutes"], Math.max(8, Math.round(cabMinutes * 0.9))),
    },
    hotels: [
      {
        name: pickValue(row, ["nearest_hotel", "hotel_name"]) ?? "Nearby stay to confirm",
        distanceKm: pickNumber(row, ["hotel_distance_km"], 1),
        tier: normalizeBudget(pickValue(row, ["hotel_tier"]) ?? profile?.budgetType),
        nightlyEstimate: pickNumber(row, ["hotel_nightly_estimate", "nightly_estimate"], 0),
      },
    ],
  };

  const score = clampNumber(Math.round(100 - distanceKm * 2 + evidenceConfidence / 5), 0, 100);
  return {
    facility,
    score,
    confidence: evidenceConfidence,
    careNeed: selectedCareNeed,
    matchExplanation: `${name} was returned from Databricks and is ${distanceKm.toFixed(1)} km from ${
      profile?.location ?? "the selected location"
    }.`,
    supportingEvidence: facility.evidence,
    missingEvidence: facility.missingEvidence,
    suspiciousEvidence: facility.suspiciousSignals,
    estimatedTravelTime: facility.travelTimes.Cab,
    pricingSignal: averageVisitCost ? `${formatCurrencyINR(averageVisitCost)} typical first-visit estimate` : "Price not listed",
    rankDrivers: [
      { label: "Distance", value: Math.max(0, Math.round(40 - distanceKm)), detail: `${distanceKm.toFixed(1)} km away.` },
      { label: "Evidence", value: Math.round(evidenceConfidence / 2), detail: `${evidenceConfidence}% source confidence.` },
      { label: "Care match", value: services.includes(selectedCareNeed) ? 42 : 16, detail: `${selectedCareNeed} from Databricks row.` },
      { label: "Travel", value: Math.max(0, 25 - Math.round(cabMinutes / 3)), detail: `${cabMinutes} minutes by cab.` },
    ],
  };
}

async function runCodexChat({ message, profile, history, recommendations }) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "prism-codex-"));
  const outputFile = path.join(tempDir, "last-message.txt");
  const prompt = buildCodexPrompt({ message, profile, history, recommendations });

  try {
    const { stdout, stderr } = await runWithTimeout(
      codexCommand,
      [
        "exec",
        "--ephemeral",
        "--sandbox",
        "read-only",
        "-c",
        'approval_policy="never"',
        "--color",
        "never",
        "--cd",
        root,
        "--output-last-message",
        outputFile,
        "-",
      ],
      prompt,
      120_000,
    );

    const fileText = await readFile(outputFile, "utf8").catch(() => "");
    const text = sanitizeCodexText(fileText || stdout);
    if (!text) {
      throw new Error(stderr || "Codex CLI returned an empty response.");
    }

    return {
      text,
      source: "codex_cli",
      trace: [
        "codex_cli: codex exec --ephemeral --sandbox read-only",
        "codex_cli: approval_policy never",
      ],
      diagnostics: stderr ? summarizeDiagnostics(stderr) : [],
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function createOpenAISpeech(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "OPENAI_API_KEY is not configured on the server.",
    };
  }

  const responseFormat = process.env.OPENAI_TTS_FORMAT ?? "mp3";
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
      voice: process.env.OPENAI_TTS_VOICE ?? "marin",
      input: text.slice(0, 4096),
      instructions:
        process.env.OPENAI_TTS_INSTRUCTIONS ??
        "Speak as a calm, warm health concierge. Sound natural, reassuring, and clear. Use gentle pacing and avoid a robotic cadence.",
      response_format: responseFormat,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    return {
      ok: false,
      error: data?.error?.message ?? data?.message ?? "OpenAI text-to-speech request failed.",
    };
  }

  return {
    ok: true,
    audio: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? contentTypeForAudioFormat(responseFormat),
  };
}

function contentTypeForAudioFormat(format) {
  if (format === "wav") return "audio/wav";
  if (format === "aac") return "audio/aac";
  if (format === "opus") return "audio/ogg";
  if (format === "flac") return "audio/flac";
  return "audio/mpeg";
}

async function createOpenAIRealtimeClientSecret({ profile, recommendations }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "OPENAI_API_KEY is not configured on the server.",
    };
  }

  const safeProfile = redactProfile(profile);
  const topRecommendations = recommendations.slice(0, 3).map((item) => ({
    facility: item?.facility?.name,
    services: item?.facility?.services,
    availability: item?.facility?.availability,
    booking: item?.facility?.booking,
    score: item?.score,
    confidence: item?.confidence,
    careNeed: item?.careNeed,
    distanceKm: item?.facility?.distanceKm,
    estimatedTravelTime: item?.estimatedTravelTime,
    pricingSignal: item?.pricingSignal,
  }));

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "OpenAI-Safety-Identifier": stableSafetyIdentifier(safeProfile),
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2",
        instructions: buildRealtimeInstructions({ profile: safeProfile, recommendations: topRecommendations }),
        audio: {
          input: {
            transcription: {
              model: process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe",
              language: process.env.OPENAI_REALTIME_TRANSCRIPTION_LANGUAGE ?? "en",
              prompt:
                process.env.OPENAI_REALTIME_TRANSCRIPTION_PROMPT ??
                "Expect concise healthcare concierge requests, hospital names, care needs, booking, transport, and location details.",
            },
          },
          output: {
            voice: process.env.OPENAI_REALTIME_VOICE ?? "marin",
          },
        },
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      error: data?.error?.message ?? data?.message ?? "OpenAI Realtime token request failed.",
    };
  }

  return {
    ok: true,
    clientSecret: data.value,
    expiresAt: data.expires_at ?? data.expiresAt,
    model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2",
  };
}

function buildRealtimeInstructions({ profile, recommendations }) {
  return `You are Prism, a calm health concierge voice assistant.

Speak naturally in short turns. Do not cover the whole care journey at once.

Guide the user one optional step at a time:
1. First understand the diagnosis the patient went through, symptoms, reports, referral notes, urgency, and location.
2. Then recommend a hospital based on available capability, equipment, service, and evidence data. If equipment is not directly listed, say so and use service capability evidence.
3. Then offer optional booking help.
4. Then offer optional transport planning.
5. End with optional hotel planning only if the user wants an overnight stay.

Every logistics step is optional and skippable. End each turn with one clear next question.

Do not diagnose, prescribe, or replace emergency care. If symptoms sound urgent, advise immediate local emergency care.

Do not mention internal implementation details. Do not claim live Databricks results unless the user has recommendations in context.

Profile context:
${JSON.stringify(profile, null, 2)}

Visible recommendation context:
${JSON.stringify(recommendations, null, 2)}
`;
}

function stableSafetyIdentifier(profile) {
  const source = JSON.stringify({
    role: profile?.role,
    location: profile?.location,
    name: profile?.name,
  });
  return createHash("sha256").update(source || "prism-demo-user").digest("hex");
}

function buildCodexPrompt({ message, profile, history, recommendations }) {
  const safeProfile = redactProfile(profile);
  const topRecommendations = recommendations.slice(0, 3).map((item) => ({
    facility: item?.facility?.name,
    score: item?.score,
    confidence: item?.confidence,
    careNeed: item?.careNeed,
    distanceKm: item?.facility?.distanceKm,
    estimatedTravelTime: item?.estimatedTravelTime,
    missingEvidence: item?.missingEvidence,
    suspiciousEvidence: item?.suspiciousEvidence,
    pricingSignal: item?.pricingSignal,
    evidence: Array.isArray(item?.supportingEvidence)
      ? item.supportingEvidence.slice(0, 2).map((evidence) => ({
          label: evidence?.label,
          source: evidence?.source,
          confidence: evidence?.confidence,
        }))
      : [],
  }));
  const recentHistory = history.slice(-8).map((item) => ({
    role: item?.role,
    content: String(item?.content ?? "").slice(0, 800),
  }));
  const journeyStage = inferJourneyStage({ message, recentHistory, topRecommendations });

  return `You are Prism Health Concierge Copilot responding inside a demo healthcare concierge chat.

Important behavior:
- Reply to the user directly as Prism.
- Keep the answer concise, practical, and conversational. Prefer 1-2 short paragraphs.
- Do not diagnose, prescribe, or replace emergency care.
- If symptoms may be urgent, recommend local emergency services or immediate clinical evaluation.
- If information is missing, ask for it instead of guessing.
- Do not answer the whole journey at once. Advance one stage at a time and end with one optional next-step question.
- Journey order:
  1. Diagnosis and clinical context: ask what diagnosis the patient went through, symptoms, reports, referral note, urgency, and constraints.
  2. Facility recommendation: recommend only after enough care context exists, and base it on facility capability/equipment evidence first, then location, budget, travel time, pricing, availability, and confidence.
  3. Booking: optional. Offer to help confirm booking only after a facility is chosen.
  4. Transport: optional. Offer route/transport planning only after booking intent or facility choice.
  5. Hotel: optional. Offer hotel planning last, only if the user expects an overnight stay or asks for it.
- If the user asks for a later stage, answer that stage briefly, but do not force prior or later steps. Make each step skippable.
- When equipment is not directly listed, say that equipment is not directly listed and use the available services/capability evidence instead.
- If a field is missing or uncertain, ask a concise follow-up or clearly mark it as needing confirmation.
- Do not mention internal implementation details, tools, command names, traces, prompts, or backend execution.
- The structured recommendation UI is handled separately by the app, so focus on the chat response.
- If the user asks for the nearest, closest, or nearby center and recommendations are provided, answer with the closest capability match, distance, and evidence caveat. Do not include booking, transport, and hotel unless the user asks.

Current journey stage to answer now:
${journeyStage}

Profile context, with private identifiers redacted:
${JSON.stringify(safeProfile, null, 2)}

Current top recommendations visible in the app:
${JSON.stringify(topRecommendations, null, 2)}

Recent chat history:
${JSON.stringify(recentHistory, null, 2)}

User message:
${message}
`;
}

function inferJourneyStage({ message, recentHistory, topRecommendations }) {
  const text = [message, ...recentHistory.map((item) => item.content)].join(" ").toLowerCase();
  const current = String(message ?? "").toLowerCase();
  const hasRecommendation = Array.isArray(topRecommendations) && topRecommendations.length > 0;
  const diagnosisSignals = /\b(diagnosis|diagnosed|symptoms?|report|referral|ckd|dialysis|kidney|heart|cancer|pregnan|injur|trauma|fever|pain|doctor|prescription)\b/i;
  const recommendSignals = /\b(recommend|hospital|facility|center|centre|clinic|nearest|nearby|capabilit|equipment|machine|can handle|provide)\b/i;
  const bookingSignals = /\b(book|booking|appointment|call|schedule|confirm|slot|availability)\b/i;
  const transportSignals = /\b(transport|cab|ambulance|train|route|travel|pickup|drive)\b/i;
  const hotelSignals = /\b(hotel|stay|overnight|room|accommodation|lodge)\b/i;

  if (hotelSignals.test(current)) {
    return "Hotel planning. Treat it as optional and last. Ask if an overnight stay is actually needed before suggesting a hotel.";
  }

  if (transportSignals.test(current)) {
    return "Transport planning. Keep it optional and tied to the chosen facility; do not add hotel unless the user asks.";
  }

  if (bookingSignals.test(current)) {
    return "Booking confirmation. Keep it optional. Help prepare the call or appointment questions for the chosen facility.";
  }

  if (recommendSignals.test(current) || hasRecommendation) {
    return "Capability-based facility recommendation. Recommend using diagnosis/care need and available service/evidence/capability data first. Mention missing direct equipment evidence if needed, then ask whether to proceed to optional booking.";
  }

  if (diagnosisSignals.test(text)) {
    return "Diagnosis and clinical context. Confirm what diagnosis/symptoms/reports the patient has, then ask whether to look for capability-matched hospitals.";
  }

  return "Intake. Ask for the diagnosis the patient went through, current symptoms, reports/referral notes, urgency, and location. Do not recommend a facility yet.";
}

function redactProfile(profile) {
  if (!profile || typeof profile !== "object") return null;
  return {
    role: profile.role,
    name: profile.name,
    dateOfBirth: profile.dateOfBirth,
    location: profile.location,
    currentProblems: profile.currentProblems,
    medicalHistory: profile.medicalHistory,
    budgetType: profile.budgetType,
    travelTime: profile.travelTime,
    preferredTransportation: profile.preferredTransportation,
    insuranceNumber: profile.insuranceNumber ? "[redacted]" : "",
    governmentHealthCard: profile.governmentHealthCard ? "[redacted]" : "",
  };
}

function sanitizeCodexText(text) {
  return String(text)
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\r/g, "")
    .trim();
}

function summarizeDiagnostics(stderr) {
  return String(stderr)
    .split("\n")
    .filter((line) => line.includes("ERROR") || line.includes("WARN"))
    .slice(0, 4)
    .map((line) => line.replace(/^\S+\s+/, "").trim());
}

function runWithTimeout(command, args, stdin, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error("Codex CLI timed out before returning a response."));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `Codex CLI exited with code ${code}.`));
      }
    });

    child.stdin.end(stdin);
  });
}

function resolveCodexCommand() {
  if (process.env.CODEX_CLI_PATH) return process.env.CODEX_CLI_PATH;
  const bundled = "/Applications/Codex.app/Contents/Resources/codex";
  return existsSync(bundled) ? bundled : "codex";
}

function loadLocalEnv() {
  for (const envFile of [".env", ".env.local"]) {
    const envPath = path.join(root, envFile);
    if (!existsSync(envPath)) continue;

    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;

      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

async function getDatabricksCliAuth(profile) {
  const [{ stdout: envStdout }, { stdout: tokenStdout }] = await Promise.all([
    runProcess("databricks", ["auth", "env", "--profile", profile, "--output", "json"], "", 30_000),
    runProcess("databricks", ["auth", "token", profile, "--output", "json"], "", 30_000),
  ]);
  const auth = JSON.parse(envStdout || "{}");
  const token = JSON.parse(tokenStdout || "{}");
  const env = auth.env ?? auth;
  return {
    host: normalizeHost(env.host ?? env.DATABRICKS_HOST),
    token: token.access_token ?? token.token_value ?? env.token ?? env.DATABRICKS_TOKEN,
  };
}

async function getDatabricksAppToken(host) {
  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET;
  if (!host || !clientId || !clientSecret) return "";

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "all-apis",
  });
  const response = await fetch(`${host}/oidc/v1/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error_description ?? data?.error ?? "Databricks app OAuth token request failed.");
  }
  return data.access_token ?? "";
}

async function getDatabricksDefaultWarehouse(profile) {
  const { stdout } = await runProcess(
    "databricks",
    ["experimental", "aitools", "tools", "get-default-warehouse", "--profile", profile, "--output", "json"],
    "",
    45_000,
  );
  const warehouse = JSON.parse(stdout || "{}");
  return warehouse.id ?? warehouse.warehouse_id ?? "";
}

function readJson(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk.toString();
      if (data.length > maxBytes) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function serveStatic(req, res, url) {
  const dist = path.join(root, "dist");
  const requestedPath = decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(dist, requestedPath === "/" ? "index.html" : requestedPath));

  if (!filePath.startsWith(dist)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const candidate = existsSync(filePath) ? filePath : path.join(dist, "index.html");
  const fileStat = await stat(candidate).catch(() => null);
  if (!fileStat?.isFile()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "content-type": contentType(candidate) });
  createReadStream(candidate).pipe(res);
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function normalizeHost(host) {
  if (!host) return "";
  return host.startsWith("http") ? host.replace(/\/$/, "") : `https://${host.replace(/\/$/, "")}`;
}

function warehouseIdFromHttpPath(httpPath) {
  return httpPath.match(/\/warehouses\/([^/?]+)/)?.[1] ?? "";
}

function quoteSqlPath(pathValue) {
  return String(pathValue)
    .split(".")
    .map((part) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(part) ? part : `\`${part.replace(/`/g, "``")}\``))
    .join(".");
}

function escapeSqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

function buildCareMatchClause(careNeed) {
  const haystack = "lower(concat_ws(' ', coalesce(name, ''), coalesce(specialties, ''), coalesce(capability, ''), coalesce(description, '')))";
  const termsByNeed = {
    Dialysis: ["dialysis", "nephrology", "renal", "kidney"],
    Trauma: ["trauma", "emergency", "critical care", "icu"],
    Cardiology: ["cardiology", "cardiac", "heart"],
    Maternity: ["maternity", "maternal", "gynecology", "obstetric", "pediatric"],
    Oncology: ["oncology", "cancer", "radiation oncology"],
    "General medicine": ["general medicine", "internal medicine", "hospital"],
  };
  const terms = termsByNeed[normalizeCareNeed(careNeed)] ?? termsByNeed["General medicine"];
  return terms.map((term) => `${haystack} LIKE '%${escapeSqlLiteral(term)}%'`).join(" OR ");
}

function knownCoordinates(location) {
  const normalized = String(location ?? "").toLowerCase();
  if (normalized.includes("jaipur")) return { lat: 26.9124, lon: 75.7873 };
  if (normalized.includes("jodhpur")) return { lat: 26.2389, lon: 73.0243 };
  if (normalized.includes("udaipur")) return { lat: 24.5854, lon: 73.7125 };
  if (normalized.includes("delhi")) return { lat: 28.6139, lon: 77.209 };
  if (normalized.includes("mumbai")) return { lat: 19.076, lon: 72.8777 };
  if (normalized.includes("bengaluru") || normalized.includes("bangalore")) return { lat: 12.9716, lon: 77.5946 };
  return null;
}

function normalizeDatabricksValue(value) {
  if (Array.isArray(value)) return value.map(normalizeDatabricksValue);
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return "";
  if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

function pickValue(row, names) {
  for (const name of names) {
    const value = row?.[name];
    const normalized = String(value ?? "").trim().toLowerCase();
    if (value !== undefined && value !== null && normalized !== "" && normalized !== "null" && normalized !== "undefined") {
      return value;
    }
  }
  return null;
}

function pickNumber(row, names, fallback) {
  const value = pickValue(row, names);
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function pickPositiveNumber(row, names, fallback) {
  const number = pickNumber(row, names, fallback);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function pickNullableNumber(row, names) {
  const value = pickValue(row, names);
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstListItem(value) {
  const items = parseList(value);
  return items[0] ?? null;
}

function parseServices(value, fallback) {
  const parsed = parseList(value).map(normalizeCareNeed);
  const services = parsed.length ? parsed : [fallback];
  if (!services.includes("General medicine")) services.push("General medicine");
  return [...new Set(services)];
}

function normalizeCareNeed(value) {
  const normalized = String(value ?? "").toLowerCase();
  if (
    normalized.includes("dialysis") ||
    normalized.includes("kidney") ||
    normalized.includes("renal") ||
    normalized.includes("nephro")
  ) {
    return "Dialysis";
  }
  if (normalized.includes("trauma") || normalized.includes("emergency")) return "Trauma";
  if (normalized.includes("cardio") || normalized.includes("heart")) return "Cardiology";
  if (normalized.includes("maternity") || normalized.includes("preg") || normalized.includes("obstetric")) return "Maternity";
  if (normalized.includes("oncology") || normalized.includes("cancer")) return "Oncology";
  return "General medicine";
}

function normalizeBudget(value) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("economy")) return "Economy";
  if (normalized.includes("luxury")) return "Luxury";
  if (normalized.includes("elite")) return "Elite";
  return "Balanced";
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function formatCurrencyINR(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runProcess(command, args, stdin, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`${command} timed out.`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `${command} exited with code ${code}.`));
      }
    });

    child.stdin.end(stdin);
  });
}
