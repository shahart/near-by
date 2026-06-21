import boto3
import json
import time 
import math
import uuid
from decimal import Decimal

TTL_SECONDS = 36*3600

def json_default(value):
    if isinstance(value, Decimal):
        if value % 1 == 0:
            return int(value)
        return float(value)
    raise TypeError

def response(status_code, body, content_type='application/json'):
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': content_type
        },
        'body': body if isinstance(body, str) else json.dumps(body, default=json_default)
    }

def getData(event):
    method = event.get('requestContext', {}).get('http', {}).get('method', '')
    if method == 'GET':
        return event.get('queryStringParameters') or {}
    body = event.get('body') or '{}'
    return json.loads(body)

def itemCreatedAt(item):
    if item.get('created_at') is not None:
        return int(item.get('created_at'))
    return int(item.get('time_stamp', 0)) - TTL_SECONDS

def nearItems(table, lat_lon, subject):
    near_by_items = []
    all_items = table.scan()['Items']

    for item in all_items:
        item_latlon = item.get('lat-lon')
        if item.get('subject') == subject and nearDistance(lat_lon, item_latlon):
            near_by_items.append(item)

    return near_by_items

def sseResponse(items, since):
    lines = [
        'retry: 5000',
        ''
    ]
    for item in sorted(items, key=itemCreatedAt):
        created_at = itemCreatedAt(item)
        if created_at <= since:
            continue
        event_data = {
            'created_at': created_at,
            'message_id': item.get('message_id', ''),
            'from': item.get('from', ''),
            'subject': item.get('subject', ''),
            'text': item.get('text', '')
        }
        lines.append('event: message')
        lines.append('id: ' + str(created_at) + '-' + str(item.get('message_id', '')))
        lines.append('data: ' + json.dumps(event_data, default=json_default))
        lines.append('')

    return response(200, '\n'.join(lines) + '\n', 'text/event-stream')

# prompt: write me nearDisance python function that takes 2 params, in form of 'latitude_longitude' like '31.2_35.5' and returns true if the distance between them is less than X meters.
def nearDistance(a, b, threshold_meters=500):
    """Return True if distance between a and b is <= threshold_meters.
    Accepts strings like '31.2_35.5' (also supports ',' or space separators).
    """
    def parse_latlon(s):
        if s is None:
            return None
        if isinstance(s, (list, tuple)) and len(s) >= 2:
            try:
                return float(s[0]), float(s[1])
            except Exception:
                return None
        if not isinstance(s, str):
            return None
        s = s.strip()
        for sep in ['_', ',', ' ']:
            if sep in s:
                parts = s.split(sep)
                if len(parts) >= 2:
                    try:
                        return float(parts[0]), float(parts[1])
                    except Exception:
                        return None
        return None

    p1 = parse_latlon(a)
    # print(p1)
    p2 = parse_latlon(b)
    # print(p2)
    if not p1 or not p2:
        return False
    lat1, lon1 = map(math.radians, p1)
    lat2, lon2 = map(math.radians, p2)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    R = 6371000.0
    hav = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    dist = 2 * R * math.asin(math.sqrt(hav))
    # print(dist)
    return dist <= threshold_meters

def lambda_handler(event, context):
    sourceIp = (event.get('headers') or {}).get('x-forwarded-for')
    dynamodb = boto3.resource('dynamodb', region_name='eu-north-1')
    table = dynamodb.Table("free-text")

    data = getData(event)
    lat_lon = data.get('lat_lon')

    if (lat_lon is None):
        return response(400, 'missing lat_lon')

    op = data.get('op', {})
    # print('lat_lon:', lat_lon, 'op:', op)

    if (op == 'sse'):
        since = int(data.get('since', 0))
        items = nearItems(table, lat_lon, data.get('subject'))
        return sseResponse(items, since)

    if (op == 'put'):
        # return new_item(data, table, lat_lon);
        text = data.get('text')
        if (text is None):
            return response(400, 'missing text')
        created_at = int(time.time())
        item = {
            'time_stamp': created_at + TTL_SECONDS,  # expire after 36 hours
            'created_at': created_at,
            'message_id': str(uuid.uuid4()),
            'text': text,
            'from': data.get('from', ''),
            'subject': data.get('subject', ''),
            'lat-lon': lat_lon
        }
        # TODO don't put from the same user & sourceIp on same subject more than once in 1 sec.
        table.put_item(Item=item)
        return response(201, 'item added')

    # return near_items(data, table, lat_lon);

    near_by_items = nearItems(table, lat_lon, data.get('subject'))

    # TODO query(), to be sort by the time_stamp using 2nd index.
    # or return body: near_by_items[near_by_items[:, 0].argsort()]

    return response(200, near_by_items)
