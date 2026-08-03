# Node.js Lambda

This directory is the Node.js port of `lambda_function.py`. It keeps the same
AWS region, DynamoDB table, request/response format, 36-hour TTL, SSE format,
and 500-meter proximity rule.

Install and test:

```sh
npm install
npm test
```

The Lambda handler is:

```text
lambda_function.handler
```

To make a deployment archive after installing production dependencies:

```sh
npm install --omit=dev
zip -r lambda-node.zip lambda_function.js node_modules package.json
```
