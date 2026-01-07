**Purpose**: Short guidance to help AI coding agents become productive in this repository.

**Big Picture / Architecture**
- Frontend: static single-page UI in `docs/` (served as static site / GitHub Pages). See [docs/index.html](docs/index.html) and [docs/script.js](docs/script.js).
- Backend: a single AWS Lambda function implemented in `lambda_function.py` that reads/writes items to a DynamoDB table named `free-text` (region: `eu-north-1`). See [lambda_function.py](lambda_function.py).
- Data flow: the browser geolocates the user and POSTs JSON to the Lambda URL (hardcoded in `docs/script.js`). Lambda scans the `free-text` table and returns nearby messages filtered by `subject` and geographic proximity.

**Key data shapes & conventions**
- DynamoDB item fields (observed): `time_stamp` (int), `text`, `from`, `subject`, `lat-lon`.
- TTL pattern: the code sets `time_stamp = int(time.time() + 36*3600)` and the frontend subtracts `36*3600` to compute displayed dates — preserve this offset if you change TTL handling.
- Lat/lon string format: `"lat_lon": "{lat}_{lon}"` (also accepts `,` or space separators). See `nearDistance()` in [lambda_function.py](lambda_function.py).

**Project-specific patterns & gotchas**
- The Lambda uses `table.scan()` (not queries) and filters client-side for `subject` + proximity; be cautious when adding scale-sensitive changes.
- Hardcoded values to watch: DynamoDB table name `free-text`, AWS region `eu-north-1`, and the Lambda URL in [docs/script.js](docs/script.js). Update these consistently when deploying.
- There is an in-code TODO: avoid multiple posts from same IP/user within 1 second (see `lambda_function.py` comment). Also note a TODO to replace scan() with query + index for proper sorting.
- The frontend sorts results by `time_stamp` ascending and only shows items within ~36 hours (see `docs/script.js`).

**Developer workflows (what to run / where to change)**
- Local dev: no build system. Edit files in-place and preview `docs/index.html` in a browser (or use a static server like `npx http-server docs`).
- When deploying backend, ensure the DynamoDB table `free-text` exists and that TTL is enabled on attribute `time_stamp`.
  - Example to enable TTL (already requires a table):
    ```bash
    aws dynamodb update-time-to-live --table-name free-text \
      --time-to-live-specification "Enabled=true, AttributeName=time_stamp"
    ```
- Update the Lambda deployment and then update the Lambda URL constant in [docs/script.js](docs/script.js) to point to the new endpoint.

**Examples & quick references**
- Where the client POSTs messages: see `putMsg()` in [docs/script.js](docs/script.js).
- Proximity check implementation: `nearDistance(a, b, threshold_meters=200)` in [lambda_function.py](lambda_function.py) — accepts strings like `"31.2_35.5"`.
- Message model example (from Lambda `put` handler): `{ 'time_stamp': <int>, 'text': <str>, 'from': <str>, 'subject': <str>, 'lat-lon': <str> }`.

**What to look for when changing behavior**
- If you change `time_stamp` or TTL semantics, update the frontend logic that converts timestamps for display.
- If you change the table name, region, or item keys, update both `lambda_function.py` and `docs/script.js`.
- If you replace `scan()` with a `query()`, add and document the needed secondary index (the code currently hints at a time-sorted index).

**Safety / security notes**
- There is no authentication in the current code; messages are public for a subject within a radius. Any change that adds authentication must consider how the static site will authenticate with the Lambda endpoint.

**If you're an AI agent: actionable first edits**
1. Search the repo for any other deployment scripts or infra (none found). If adding infra, update `docs/script.js` with the new Lambda URL.
2. Consider converting Lambda response bodies to JSON strings explicitly (`json.dumps`) and ensure the Lambda URL returns appropriate CORS headers.
3. Add a note or tests that assert `nearDistance()` accepts the known separator formats (`_`, `,`, or space).

If anything here is unclear or you want me to expand a section (example commands to deploy the Lambda, or a sample DynamoDB `create-table` template), tell me which section to expand.
