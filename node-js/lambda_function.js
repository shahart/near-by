'use strict';

const { randomUUID } = require('node:crypto');

const TTL_SECONDS = 36 * 3600;
const AWS_REGION = 'eu-north-1';
const TABLE_NAME = 'free-text';

function response(statusCode, body, contentType = 'application/json') {
    return {
        statusCode,
        headers: {
            'Content-Type': contentType
        },
        body: typeof body === 'string' ? body : JSON.stringify(body)
    };
}

function getData(event) {
    const method = event?.requestContext?.http?.method || '';
    if (method === 'GET') {
        return event?.queryStringParameters || {};
    }

    return JSON.parse(event?.body || '{}');
}

function itemCreatedAt(item) {
    if (item.created_at !== undefined && item.created_at !== null) {
        return Math.trunc(Number(item.created_at));
    }
    return Math.trunc(Number(item.time_stamp || 0)) - TTL_SECONDS;
}

function parseLatLon(value) {
    if (value === undefined || value === null) {
        return null;
    }

    if (Array.isArray(value) && value.length >= 2) {
        return parseLatLonParts(value[0], value[1]);
    }

    if (typeof value !== 'string') {
        return null;
    }

    const input = value.trim();
    for (const separator of ['_', ',', ' ']) {
        if (input.includes(separator)) {
            const parts = input.split(separator);
            if (parts.length >= 2) {
                return parseLatLonParts(parts[0], parts[1]);
            }
        }
    }

    return null;
}

function parseLatLonParts(latitude, longitude) {
    if (String(latitude).trim() === '' || String(longitude).trim() === '') {
        return null;
    }

    const parsed = [Number(latitude), Number(longitude)];
    return parsed.every(Number.isFinite) ? parsed : null;
}

function nearDistance(a, b, thresholdMeters = 500) {
    const point1 = parseLatLon(a);
    const point2 = parseLatLon(b);
    if (!point1 || !point2) {
        return false;
    }

    const toRadians = degrees => degrees * Math.PI / 180;
    const [lat1, lon1] = point1.map(toRadians);
    const [lat2, lon2] = point2.map(toRadians);
    const dlat = lat2 - lat1;
    const dlon = lon2 - lon1;
    const earthRadiusMeters = 6371000;
    const haversine = Math.sin(dlat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
    const distance = 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));

    return distance <= thresholdMeters;
}

async function nearItems(table, latLon, subject) {
    const result = await table.scan();
    return (result.Items || []).filter(item => (
        item.subject === subject && nearDistance(latLon, item['lat-lon'])
    ));
}

function sseResponse(items, since) {
    const lines = ['retry: 5000', ''];
    const sortedItems = [...items].sort((a, b) => itemCreatedAt(a) - itemCreatedAt(b));

    for (const item of sortedItems) {
        const createdAt = itemCreatedAt(item);
        if (createdAt <= since) {
            continue;
        }

        const eventData = {
            created_at: createdAt,
            message_id: item.message_id || '',
            from: item.from || '',
            subject: item.subject || '',
            text: item.text || ''
        };
        lines.push('event: message');
        lines.push(`id: ${createdAt}-${item.message_id || ''}`);
        lines.push(`data: ${JSON.stringify(eventData)}`);
        lines.push('');
    }

    return response(200, `${lines.join('\n')}\n`, 'text/event-stream');
}

function createHandler(getTable, now = () => Math.floor(Date.now() / 1000), uuid = randomUUID) {
    return async function handler(event, context) {
        void context;
        const table = await getTable();
        const data = getData(event);
        const latLon = data.lat_lon;

        if (latLon === undefined || latLon === null) {
            return response(400, 'missing lat_lon');
        }

        const op = data.op || {};
        if (op === 'sse') {
            const since = Math.trunc(Number(data.since || 0));
            const items = await nearItems(table, latLon, data.subject);
            return sseResponse(items, since);
        }

        if (op === 'put') {
            if (data.text === undefined || data.text === null) {
                return response(400, 'missing text');
            }

            const createdAt = now();
            const item = {
                time_stamp: createdAt + TTL_SECONDS,
                created_at: createdAt,
                message_id: uuid(),
                text: data.text,
                from: data.from || '',
                subject: data.subject || '',
                'lat-lon': latLon
            };
            await table.putItem(item);
            return response(201, 'item added');
        }

        const items = await nearItems(table, latLon, data.subject);
        return response(200, items);
    };
}

let defaultTable;

async function getDefaultTable() {
    if (!defaultTable) {
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const {
            DynamoDBDocumentClient,
            PutCommand,
            ScanCommand
        } = require('@aws-sdk/lib-dynamodb');
        const documentClient = DynamoDBDocumentClient.from(
            new DynamoDBClient({ region: AWS_REGION })
        );
        defaultTable = {
            scan: () => documentClient.send(new ScanCommand({ TableName: TABLE_NAME })),
            putItem: Item => documentClient.send(new PutCommand({ TableName: TABLE_NAME, Item }))
        };
    }
    return defaultTable;
}

const handler = createHandler(getDefaultTable);

module.exports = {
    AWS_REGION,
    TABLE_NAME,
    TTL_SECONDS,
    createHandler,
    getData,
    handler,
    itemCreatedAt,
    nearDistance,
    nearItems,
    response,
    sseResponse
};
