import json
import sys
import types
import unittest

# stub boto3 to allow importing lambda_function in environments without boto3
sys.modules.setdefault('boto3', types.SimpleNamespace(resource=lambda *a, **k: None))

import lambda_function


class FakeTable:
    def __init__(self, items=None):
        self.items = items or []
        self.put_items = []

    def scan(self):
        return {'Items': self.items}

    def put_item(self, Item):
        self.put_items.append(Item)


class FakeDynamoDb:
    def __init__(self, table):
        self.table = table

    def Table(self, name):
        return self.table


class TestSse(unittest.TestCase):
    def setUp(self):
        self.original_boto3 = lambda_function.boto3

    def tearDown(self):
        lambda_function.boto3 = self.original_boto3

    def test_sse_returns_only_new_nearby_subject_messages(self):
        table = FakeTable([
            {
                'created_at': 101,
                'time_stamp': 101 + lambda_function.TTL_SECONDS,
                'message_id': 'new-nearby',
                'text': 'hello',
                'from': 'A',
                'subject': 'Minyan',
                'lat-lon': '31.2_35.5'
            },
            {
                'created_at': 99,
                'time_stamp': 99 + lambda_function.TTL_SECONDS,
                'message_id': 'old-nearby',
                'text': 'old',
                'from': 'B',
                'subject': 'Minyan',
                'lat-lon': '31.2_35.5'
            },
            {
                'created_at': 102,
                'time_stamp': 102 + lambda_function.TTL_SECONDS,
                'message_id': 'different-subject',
                'text': 'other',
                'from': 'C',
                'subject': 'Dinner',
                'lat-lon': '31.2_35.5'
            },
            {
                'created_at': 103,
                'time_stamp': 103 + lambda_function.TTL_SECONDS,
                'message_id': 'far-away',
                'text': 'far',
                'from': 'D',
                'subject': 'Minyan',
                'lat-lon': '31.8_35.5'
            }
        ])
        lambda_function.boto3 = types.SimpleNamespace(resource=lambda *a, **k: FakeDynamoDb(table))

        result = lambda_function.lambda_handler({
            'requestContext': {'http': {'method': 'GET'}},
            'queryStringParameters': {
                'op': 'sse',
                'lat_lon': '31.2_35.5',
                'subject': 'Minyan',
                'since': '100'
            }
        }, None)

        self.assertEqual(result['statusCode'], 200)
        self.assertEqual(result['headers']['Content-Type'], 'text/event-stream')
        self.assertIn('event: message', result['body'])
        self.assertIn('id: 101', result['body'])
        self.assertIn('"message_id": "new-nearby"', result['body'])
        self.assertNotIn('old-nearby', result['body'])
        self.assertNotIn('different-subject', result['body'])
        self.assertNotIn('far-away', result['body'])

    def test_put_adds_created_at_and_message_id_for_sse_clients(self):
        table = FakeTable()
        lambda_function.boto3 = types.SimpleNamespace(resource=lambda *a, **k: FakeDynamoDb(table))

        result = lambda_function.lambda_handler({
            'headers': {},
            'body': json.dumps({
                'op': 'put',
                'lat_lon': '31.2_35.5',
                'subject': 'Minyan',
                'from': 'A',
                'text': 'hello'
            })
        }, None)

        self.assertEqual(result['statusCode'], 201)
        self.assertEqual(len(table.put_items), 1)
        self.assertIn('created_at', table.put_items[0])
        self.assertIn('message_id', table.put_items[0])


if __name__ == '__main__':
    unittest.main()
