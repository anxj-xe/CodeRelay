import { Buffer } from "node:buffer";

/**
 * Encodes a JSON object into Chrome Native Messaging wire format:
 * 4-byte unsigned integer (little-endian) length header followed by UTF-8 JSON.
 */
export function encodeNativeMessage(message: unknown): Buffer {
    const jsonStr = JSON.stringify(message);
    const messageBuffer = Buffer.from(jsonStr, "utf-8");
    const headerBuffer = Buffer.alloc(4);
    headerBuffer.writeUInt32LE(messageBuffer.length, 0);
    return Buffer.concat([headerBuffer, messageBuffer]);
}

/**
 * Reads a single message from a stream using Chrome Native Messaging framing.
 */
export async function readNativeMessage(stream: NodeJS.ReadableStream): Promise<any> {
    return new Promise((resolve, reject) => {
        let headerBuffer = Buffer.alloc(0);
        let messageBuffer = Buffer.alloc(0);
        let expectedLength: number | null = null;

        const onData = (chunk: Buffer) => {
            if (expectedLength === null) {
                headerBuffer = Buffer.concat([headerBuffer, chunk]);
                if (headerBuffer.length >= 4) {
                    expectedLength = headerBuffer.readUInt32LE(0);
                    const remaining = headerBuffer.subarray(4);
                    headerBuffer = Buffer.alloc(0);
                    messageBuffer = Buffer.concat([messageBuffer, remaining]);
                }
            } else {
                messageBuffer = Buffer.concat([messageBuffer, chunk]);
            }

            if (expectedLength !== null && messageBuffer.length >= expectedLength) {
                const completeMessage = messageBuffer.subarray(0, expectedLength);
                stream.removeListener("data", onData);
                stream.removeListener("error", onError);
                try {
                    const parsed = JSON.parse(completeMessage.toString("utf-8"));
                    resolve(parsed);
                } catch (err) {
                    reject(err);
                }
            }
        };

        const onError = (err: Error) => {
            stream.removeListener("data", onData);
            stream.removeListener("error", onError);
            reject(err);
        };

        stream.on("data", onData);
        stream.on("error", onError);
    });
}
