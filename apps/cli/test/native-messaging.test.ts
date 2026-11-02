import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import { encodeNativeMessage, readNativeMessage } from "../src/native-messaging.js";

describe("Chrome Native Messaging Framing", () => {
    it("should encode and decode a JSON object correctly", async () => {
        const payload = { action: "SYNC", platform: "leetcode", id: 12345 };
        const encoded = encodeNativeMessage(payload);

        // Verify length prefix
        const length = encoded.readUInt32LE(0);
        const jsonStr = encoded.subarray(4).toString("utf-8");
        expect(length).toBe(Buffer.byteLength(jsonStr));

        // Decode using readNativeMessage
        const stream = Readable.from([encoded]);
        const decoded = await readNativeMessage(stream);

        expect(decoded).toEqual(payload);
    });

    it("should handle chunked streaming data", async () => {
        const payload = { test: "data across multiple chunks" };
        const encoded = encodeNativeMessage(payload);

        // Split encoded buffer into 3 chunks
        const chunk1 = encoded.subarray(0, 2);
        const chunk2 = encoded.subarray(2, 6);
        const chunk3 = encoded.subarray(6);

        const stream = Readable.from([chunk1, chunk2, chunk3]);
        const decoded = await readNativeMessage(stream);

        expect(decoded).toEqual(payload);
    });
});
