# Prism Health Concierge Copilot

Prism is a runnable React demo for an AI-powered health concierge built for Databricks AI for Good. It supports profile setup, patient vs doctor/coordinator modes, Databricks-style insights, chat-driven facility ranking, evidence and uncertainty display, shortlist saving, and trip planning.

## Run Locally

```bash
npm install --cache ./.npm-cache
npm run dev
```

Open the Vite URL printed by the dev server.

## What Is Implemented

- WebGL shader landing page using the 21st-style shader pattern.
- Chat tab with a v0-style composer, live Prism responses, deterministic structured fallback, citations, and voice input.
- Recommendation tab with ranked facilities, match explanations, supporting evidence, missing evidence, conflicting signals, pricing signals, travel time, shortlist actions, and journey planning.
- Data and Insights tab with facility distribution, care availability, price ranges, evidence confidence, missing-data indicators, and shortlist comparison.
- Databricks Apps runtime files: `app.yaml` and `databricks.yml`.

## Data Mode

Nearest-center recommendations are fetched through `POST /api/databricks-nearest`, which queries Databricks SQL and maps the returned rows into Prism recommendations. If Databricks is not configured, the app shows a configuration message instead of showing local demo centers as live results.

Required runtime variables:

- `DATABRICKS_HOST`
- `DATABRICKS_TOKEN`
- `DATABRICKS_WAREHOUSE_ID` or `DATABRICKS_HTTP_PATH`
- `PRISM_DATABRICKS_TABLE`, defaulting to `workspace.default.facility_scored`

For local development with Databricks CLI auth, set `PRISM_DATABRICKS_PROFILE` or `DATABRICKS_CONFIG_PROFILE` to an authenticated CLI profile instead of storing a token. The server will ask the CLI for auth material and the default warehouse at runtime.

Optional override:

- `PRISM_DATABRICKS_NEAREST_SQL` can provide a custom SQL statement if the facility table has a different shape.

## Chat Backend

The Prism chat calls `POST /api/codex-chat` for conversational responses, while structured recommendation data is supplied by the Databricks nearest-center endpoint for location requests. If the chat backend fails or times out, the app falls back to the local Prism response without exposing backend implementation details in the UI.

## Voice Mode

The current UI uses browser speech recognition for local voice input and browser speech synthesis for spoken replies. A production version should mint ephemeral client secrets from a server and connect a browser `RealtimeSession` to an OpenAI realtime voice model.
