import * as WebSocket from 'ws';
import * as EventEmitter from 'events';
import { timestamp, Maybe, Types, idGenerator } from '@dotstats/common';
import { parseMessage, getBestBlock, Message, BestBlock, SystemInterval } from './message';

const BLOCK_TIME_HISTORY = 10;
const TIMEOUT = (1000 * 60 * 1) as Types.Milliseconds; // 1 minute

const nextId = idGenerator<Types.NodeId>();

export default class Node extends EventEmitter {
    public lastMessage: Types.Timestamp;
    public id: Types.NodeId;
    public name: Types.NodeName;
    public implementation: Types.NodeImplementation;
    public version: Types.NodeVersion;
    public config: string;
    public best = '' as Types.BlockHash;
    public height = 0 as Types.BlockNumber;
    public latency = 0 as Types.Milliseconds;
    public blockTime = 0 as Types.Milliseconds;
    public blockTimestamp = 0 as Types.Timestamp;

    private peers = 0 as Types.PeerCount;
    private txcount = 0 as Types.TransactionCount;

    private socket: WebSocket;
    private blockTimes: Array<number> = new Array(BLOCK_TIME_HISTORY);
    private lastBlockAt: Maybe<Date> = null;

    constructor(
        socket: WebSocket,
        name: Types.NodeName,
        config: string,
        implentation: Types.NodeImplementation,
        version: Types.NodeVersion,
    ) {
        super();

        this.lastMessage = timestamp();
        this.id = nextId();
        this.socket = socket;
        this.name = name;
        this.config = config;
        this.implementation = implentation;
        this.version = version;

        console.log(`Listening to a new node: ${name}`);

        socket.on('message', (data) => {
            const message = parseMessage(data);

            if (!message) {
                return;
            }

            this.lastMessage = timestamp();
            this.updateLatency(message.ts);

            const update = getBestBlock(message);

            if (update) {
                this.updateBestBlock(update);
            }

            if (message.msg === 'system.interval') {
                this.onSystemInterval(message);
            }
        });

        socket.on('close', () => {
            console.log(`${this.name} has disconnected`);

            this.disconnect();
        });

        socket.on('error', (error) => {
            console.error(`${this.name} has errored`, error);

            this.disconnect();
        });
    }

    public static fromSocket(socket: WebSocket): Promise<Node> {
        return new Promise((resolve, reject) => {
            function cleanup() {
                clearTimeout(timeout);
                socket.removeAllListeners('message');
            }

            function handler(data: WebSocket.Data) {
                const message = parseMessage(data);

                if (message && message.msg === "system.connected") {
                    cleanup();

                    const { name, config, implementation, version } = message;

                    resolve(new Node(socket, name, config, implementation, version));
                }
            }

            socket.on('message', handler);

            const timeout = setTimeout(() => {
                cleanup();

                socket.close();

                return reject(new Error('Timeout on waiting for system.connected message'));
            }, 5000);
        });
    }

    public timeoutCheck(now: Types.Timestamp) {
        if (this.lastMessage + TIMEOUT < now) {
            this.disconnect();
        }
    }

    public nodeDetails(): Types.NodeDetails {
        return [this.name, this.implementation, this.version];
    }

    public nodeStats(): Types.NodeStats {
        return [this.peers, this.txcount];
    }

    public blockDetails(): Types.BlockDetails {
        return [this.height, this.best, this.blockTime, this.blockTimestamp];
    }

    public get average(): number {
        let accounted = 0;
        let sum = 0;

        for (const time of this.blockTimes) {
            if (time) {
                accounted += 1;
                sum += time;
            }
        }

        if (accounted === 0) {
            return 0;
        }

        return sum / accounted;
    }

    public get localBlockAt(): Types.Milliseconds {
        if (!this.lastBlockAt) {
            return 0 as Types.Milliseconds;
        }

        return +(this.lastBlockAt || 0) as Types.Milliseconds;
    }

    private disconnect() {
        this.socket.removeAllListeners();
        this.socket.close();

        this.emit('disconnect');
    }

    private onSystemInterval(message: SystemInterval) {
        const { peers, txcount } = message;

        if (this.peers !== peers || this.txcount !== txcount) {
            this.peers = peers;
            this.txcount = txcount;

            this.emit('stats');
        }
    }

    private updateLatency(time: Date) {
        this.latency = (this.lastMessage - +time) as Types.Milliseconds;
    }

    private updateBestBlock(update: BestBlock) {
        const { height, ts: time, best } = update;

        if (this.height < height) {
            const blockTime = this.getBlockTime(time);

            this.best = best;
            this.height = height;
            this.blockTimestamp = timestamp();
            this.lastBlockAt = time;
            this.blockTimes[height % BLOCK_TIME_HISTORY] = blockTime;
            this.blockTime = blockTime;

            this.emit('block');
        }
    }

    private getBlockTime(time: Date): Types.Milliseconds {
        if (!this.lastBlockAt) {
            return 0 as Types.Milliseconds;
        }

        return (+time - +this.lastBlockAt) as Types.Milliseconds;
    }
}
