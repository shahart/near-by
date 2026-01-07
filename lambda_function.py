import boto3
import json
import time 
import math

# prompt: write me nearDisance python function that takes 2 params, in form of 'latitude_longitude' like '31.2_35.5' and returns true if the distance between them is less than 200 meters.
def nearDistance(a, b, threshold_meters=200):
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
    sourceIp = event.get('headers').get('x-forwarded-for')
    dynamodb = boto3.resource('dynamodb', region_name='eu-north-1')
    table = dynamodb.Table("free-text")
    all_items = []
    near_by_items = []

    data = json.loads(event.get('body'))
    lat_lon = data.get('lat_lon')

    if (lat_lon is None):
        return {
            'statusCode': 400,
            'body': json.dumps('missing lat_lon')
        }

    op = data.get('op', {})
    # print('lat_lon:', lat_lon, 'op:', op)

    if (op == 'put'):
        # return new_item(data, table, lat_lon);
        text = data.get('text')
        if (text is None):
            return {
                'statusCode': 400,
                'body': json.dumps('missing text')
            }
        item = {
            'time_stamp': int( time.time() + 36*3600 ),  # expire after 36 hours
            'text': text,
            'from': data.get('from', ''),
            'subject': data.get('subject', ''),
            'lat-lon': lat_lon
        }
        # TODO don't put from the same user & sourceIp on same subject more than once in 1 sec.
        table.put_item(Item=item)
        return {
            'statusCode': 201,
            'body': json.dumps('item added')
        }

    # return near_items(data, table, lat_lon);

    all_items = table.scan()['Items']

    for item in all_items:
        # print(item)
        item_latlon = item.get('lat-lon')
        # print('item_latlon:', item_latlon)
        if item.get('subject') == data.get('subject') and nearDistance(lat_lon, item_latlon):
            near_by_items.append(item)

    # TODO query(), to be sort by the time_stamp using 2nd index.
    # or return body: near_by_items[near_by_items[:, 0].argsort()]

    return {
        'statusCode': 200,
        'body': near_by_items
    }
