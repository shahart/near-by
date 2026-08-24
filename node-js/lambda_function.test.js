'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
    TTL_SECONDS,
    createHandler,
    nearDistance
} = require('./lambda_function');

test('nearDistance accepts supported coordinate formats', () => {
    assert.equal(nearDistance('31.2_35.5', '31.2_35.5'), true);
    assert.equal(nearDistance('31.2_35.5', '31.2,35.5'), true);
    assert.equal(nearDistance('31.2_35.5', '31.2 35.5'), true);
    assert.equal(nearDistance([31.2, 35.5], [31.2, 35.5]), true);
});

test('nearDistance applies the threshold and rejects invalid input', () => {
    assert.equal(nearDistance('31.200_35.500', '31.201_35.500'), true);
    assert.equal(nearDistance('31.200_35.500', '31.202_35.505'), false);
    assert.equal(nearDistance(null, '31.2_35.5'), false);
    assert.equal(nearDistance('not_a_coord', '31.2_35.5'), false);
});

test('SSE returns only newer messages with the same subject and location', async () => {
    const table = fakeTable([
        item(101, 'new-nearby'),
        item(99, 'old-nearby'),
        item(102, 'different-subject', { subject: 'Dinner' }),
        item(103, 'far-away', { 'lat-lon': '31.8_35.5' })
    ]);
    const handler = createHandler(async () => table);
    const result = await handler({
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: {
            op: 'sse',
            lat_lon: '31.2_35.5',
            subject: 'Minyan',
            since: '100'
        }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.headers['Content-Type'], 'text/event-stream');
    assert.equal(result.headers['Access-Control-Allow-Origin'], undefined);
    assert.match(result.body, /event: message/);
    assert.match(result.body, /id: 101-new-nearby/);
    assert.match(result.body, /"message_id":"new-nearby"/);
    assert.doesNotMatch(result.body, /old-nearby/);
    assert.doesNotMatch(result.body, /different-subject/);
    assert.doesNotMatch(result.body, /far-away/);
});

test('put stores timestamps and a message id', async () => {
    const table = fakeTable();
    const handler = createHandler(async () => table, () => 123, () => 'fixed-id');
    const result = await handler({
        headers: {},
        body: JSON.stringify({
            op: 'put',
            lat_lon: '31.2_35.5',
            subject: 'Minyan',
            from: 'A',
            text: 'hello'
        })
    });

    assert.equal(result.statusCode, 201);
    assert.deepEqual(table.putItems, [{
        time_stamp: 123 + TTL_SECONDS,
        created_at: 123,
        message_id: 'fixed-id',
        text: 'hello',
        from: 'A',
        subject: 'Minyan',
        'lat-lon': '31.2_35.5'
    }]);
});

function item(createdAt, messageId, overrides = {}) {
    return {
        created_at: createdAt,
        time_stamp: createdAt + TTL_SECONDS,
        message_id: messageId,
        text: 'hello',
        from: 'A',
        subject: 'Minyan',
        'lat-lon': '31.2_35.5',
        ...overrides
    };
}

function fakeTable(items = []) {
    return {
        putItems: [],
        async scan() {
            return { Items: items };
        },
        async putItem(value) {
            this.putItems.push(value);
        }
    };
}
