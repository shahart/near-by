# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Near-by Chat is a location-based messaging app where users within 500 meters can broadcast messages on specific topics ("subjects"). The classic use case: coordinating a prayer gathering (minyan) at a hotel without knowing other participants' contact info.

## Commands

**Run tests:**
```bash
python -m unittest discover -s tests -p "test_*.py" -q
```

**Run a single test:**
```bash
python -m unittest tests.test_neardistance
```

**Preview frontend locally:**
```bash
npx http-server docs
```

**Deploy Lambda after changes:**
```bash
zip lambda.zip lambda_function.py
aws lambda update-function-code --function-name near-by-chat --zip-file fileb://lambda.zip --region eu-north-1
```

## Architecture

No build step. No dependencies beyond Python stdlib + `boto3` (Lambda runtime) and vanilla JS (browser native).

```
docs/index.html + script.js   →  Static SPA on GitHub Pages
lambda_function.py             →  AWS Lambda (Python), public Function URL
DynamoDB table: free-text      →  eu-north-1, TTL on time_stamp attribute
```

**Request flow:**
1. Browser gets geolocation via `navigator.geolocation`
2. POSTs JSON to hardcoded Lambda URL (`script.js` lines 70, 124)
3. Lambda scans DynamoDB, filters by subject + Haversine proximity (500m default)
4. Frontend sorts by timestamp, filters out items older than 36 hours

**Timestamp convention:** Items are stored with `time_stamp = int(time.time() + 36*3600)` (an expiration time, not creation time). DynamoDB TTL deletes expired items automatically. Frontend reverses this: `new Date((item['time_stamp'] - 36*3600) * 1000)`.

**`lat_lon` format:** Accepts `"lat_lon"` string (underscore, comma, or space separator) or `[lat, lon]` list. Example: `"31.2_35.5"`.

**DynamoDB item schema:**
```python
{
    'time_stamp': int,   # expiration epoch seconds (creation + 36h)
    'text': str,
    'from': str,
    'subject': str,
    'lat-lon': str       # "lat_lon" format
}
```

## Key Hardcoded Values

- Lambda URL: in `docs/script.js` lines 70 and 124 — must be updated after redeployment
- DynamoDB table: `free-text` (`lambda_function.py` line 51)
- AWS region: `eu-north-1`
- Proximity threshold: `500` meters
- Message TTL: `36` hours

## Known Limitations / TODOs

- `table.scan()` is used instead of `query()` — not scalable; a GSI on `(subject, time_stamp)` would fix this (`lambda_function.py` line 100)
- No duplicate-post prevention (TODO at `lambda_function.py` line 82)
- No authentication; Lambda URL accepts unauthenticated requests with CORS `*`
- Browser location-guard extensions can interfere with geolocation
