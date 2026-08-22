import { describe, expect, it } from "bun:test";
import {
	base64ToUint8,
	createColdStartToken,
	decodeColdStartToken,
	Uint8ToBase64,
} from "#kiyomi/utils";

describe("BotGuard / WebPO helper functions", () => {
	it("converts Uint8Array to Base64 and back", () => {
		const original = new Uint8Array([72, 101, 108, 108, 111]);
		const b64 = Uint8ToBase64(original, true);
		const decoded = base64ToUint8(b64);
		expect(decoded).toEqual(original);
	});

	it("creates and decodes a cold start token", () => {
		const contentBinding = "dQw4w9WgXcQ";
		const token = createColdStartToken(contentBinding);
		expect(token).toBeDefined();

		if (token) {
			const decoded = decodeColdStartToken(token);
			expect(decoded.contentBinding).toBe(contentBinding);
			expect(decoded.timestamp).toBeGreaterThan(0);
			expect(decoded.date).toBeInstanceOf(Date);
		}
	});
});
