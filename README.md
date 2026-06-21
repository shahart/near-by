# Near by chat #

An ability to broadcast messages between all users in the radius of tbd = 500 meters.

For example, you are in some hotel, would like to make a poll to arrange a Minyan, without knowing the people phones to create some Whatsapp group. Put a paper near the reception with a QR code to https://shahart.github.io/near-by-sched/index.html?subject=Ramot, and the initial message

~ PasteBin.com: less restrictions, and chat like ..

`python -m unittest discover -s tests -p "test_*.py" -q`

Note some browser extensions like 'Location Guard' might impact the ability to use this near-by site.

## Deployment

`aws lambda update-function-code --function-name near-by-chat --zip-file fileb://lambda.zip --region eu-north-1`

See more at .github/copilot-instr-extras.md

## Testing

on Mac: `open -a "Google Chrome" --args --disable-web-security --user-data-dir=/tmp/chrome`

**Some UI for example:**

### Near-by Scheduling App 📍

From: Textbox with שחר

Message: Textbox with אפשר להקדים ל-7? **Submit**

**Thread**:

From: אושרי
Message: זורם
Date: 1/6/2026, 11:11:02 PM

From: שחר
Message: מניין מחר ב-8
Date: 1/6/2026, 10:50:16 PM

