# Repository Guidelines

## Project Structure & Module Organization
`lambda_function.py` contains the AWS Lambda backend, including request handling and the `nearDistance` proximity helper. `docs/` hosts the static frontend for GitHub Pages: [`docs/index.html`](C:\repos\near-by\docs\index.html) is the page shell and [`docs/script.js`](C:\repos\near-by\docs\script.js) contains all browser logic. `tests/` holds Python unit tests, currently focused on distance parsing and threshold behavior in `test_neardistance.py`. `README.md` describes the product, and `CLAUDE.md` captures operational notes such as deployment details and hardcoded infrastructure values.

## Build, Test, and Development Commands
There is no build step. Use:

- `python -m unittest discover -s tests -p "test_*.py" -q` to run the full Python test suite.
- `python -m unittest tests.test_neardistance` to run the distance tests directly.
- `npx http-server docs` to preview the static frontend locally.
- `zip lambda.zip lambda_function.py` to package the Lambda for deployment when backend code changes.

## Coding Style & Naming Conventions
Follow the existing style in each file. Python uses 4-space indentation, top-level functions, and mixed camelCase naming already established in `nearDistance` and `lambda_handler`; keep new names consistent with surrounding code rather than mixing styles within a file. JavaScript in `docs/script.js` also uses 4-space indentation and simple DOM/XHR code without frameworks. Prefer small, direct functions and avoid adding dependencies unless there is a clear payoff.

## Testing Guidelines
Add or update `unittest` coverage for every backend behavior change. Name new test files `test_*.py` and group related assertions in `unittest.TestCase` classes. Stub external AWS dependencies the same way current tests stub `boto3`, so tests stay local and deterministic. Frontend changes should be verified manually with a local static server and browser geolocation enabled.

## Commit & Pull Request Guidelines
Keep commit subjects short, imperative, and specific, matching the existing history: `Add Refresh button`, `Fix minus lat/ lon`, `add unit test for nearDistance`. Prefer one logical change per commit. Pull requests should explain the user-visible change, call out any Lambda URL or AWS configuration updates, link related issues, and include screenshots for `docs/` UI changes.

## Security & Configuration Tips
This repo contains hardcoded AWS details and a public Lambda URL in `docs/script.js`. Do not change region, table name, TTL behavior, or endpoint values casually; document any such change in the PR and update all affected references together.
