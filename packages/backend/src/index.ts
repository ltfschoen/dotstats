import * as WebSocket from 'ws';
import Node from './node';
import Feed from './feed';
import Aggregator from './aggregator';

const aggregator = new Aggregator;

// WebSocket for Nodes feeding telemetry data to the server
const incomingTelemetry = new WebSocket.Server({ port: 1024 });

// WebSocket for web clients listening to the telemetry data aggregate
const telemetryFeed = new WebSocket.Server({ port: 8080 });

console.log('Telemetry server listening on port 1024');
console.log('Feed server listening on port 8080');

incomingTelemetry.on('connection', async (socket: WebSocket) => {
    try {
        aggregator.addNode(await Node.fromSocket(socket));
    } catch (err) {
        console.error(err);
    }
});

telemetryFeed.on('connection', (socket: WebSocket) => {
    aggregator.addFeed(new Feed(socket));
});

