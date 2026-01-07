**Deploying the Lambda (example commands)**

- Create an IAM role for the Lambda (replace `123456789012` with your AWS account id):
```bash
cat > lambda-trust.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]
}
EOF

aws iam create-role --role-name near-by-lambda-role --assume-role-policy-document file://lambda-trust.json
aws iam attach-role-policy --role-name near-by-lambda-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam attach-role-policy --role-name near-by-lambda-role --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
```

- Package and create/update the Lambda function (Python runtime may be `python3.11` or `python3.10` depending on your environment):
```bash
zip lambda.zip lambda_function.py
aws lambda create-function --function-name near-by-chat \
  --zip-file fileb://lambda.zip --handler lambda_function.lambda_handler \
  --runtime python3.11 --role arn:aws:iam::123456789012:role/near-by-lambda-role \
  --region eu-north-1

# If the function exists already, update the code instead:
aws lambda update-function-code --function-name near-by-chat --zip-file fileb://lambda.zip --region eu-north-1
```

- Create a Lambda Function URL (public, no-auth) and enable CORS for the browser client:
```bash
aws lambda create-function-url-config --function-name near-by-chat \
  --auth-type NONE \
  --cors AllowOrigins='*',AllowMethods='POST,OPTIONS',AllowHeaders='Content-Type' \
  --region eu-north-1

aws lambda get-function-url-config --function-name near-by-chat --region eu-north-1
```

- Update the endpoint in `docs/script.js` (search for the existing hardcoded URL) with the URL returned above.

**Sample DynamoDB `create-table` (recommended schema)**

Note: the current code uses `table.scan()` and stores these item attributes: `subject`, `time_stamp`, `text`, `from`, `lat-lon`.
It's recommended to create a table keyed by `subject` (HASH) and `time_stamp` (RANGE) to allow efficient time-ordered queries per subject.

- AWS CLI example (provisioned throughput shown; for low traffic you can use `--billing-mode PAY_PER_REQUEST` instead):
```bash
aws dynamodb create-table --table-name free-text \
  --attribute-definitions AttributeName=subject,AttributeType=S AttributeName=time_stamp,AttributeType=N \
  --key-schema AttributeName=subject,KeyType=HASH AttributeName=time_stamp,KeyType=RANGE \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region eu-north-1

# Enable TTL on the `time_stamp` attribute (the code uses offsets based on 36h):
aws dynamodb update-time-to-live --table-name free-text \
  --time-to-live-specification "Enabled=true, AttributeName=time_stamp" --region eu-north-1
```

- Minimal CloudFormation snippet (YAML) to create the table (without TTL):
```yaml
Resources:
  FreeTextTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: free-text
      AttributeDefinitions:
        - AttributeName: subject
          AttributeType: S
        - AttributeName: time_stamp
          AttributeType: N
      KeySchema:
        - AttributeName: subject
          KeyType: HASH
        - AttributeName: time_stamp
          KeyType: RANGE
      BillingMode: PAY_PER_REQUEST
```

**Notes & migration tips**
- If you create a keyed table as above, update `lambda_function.py` to use `query()` by `subject` and a `KeyConditionExpression` on `time_stamp` instead of `scan()` to scale.
- If the existing production table has a different key schema, DO NOT recreate it; instead create a new table or add a Global Secondary Index (GSI) that supports queries by `subject` + `time_stamp`.
