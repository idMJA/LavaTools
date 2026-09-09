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

	it("handles commas and quotes in parse_json", async () => {
		const { parse_json } = await import("#kiyomi/utils");
		const input = "{'a': 1, 'b': 2, }";
		const parsed = parse_json(input);
		expect(parsed).toEqual({ a: 1, b: 2 });
	});

	it("decodes hex escapes in parse_json", async () => {
		const { parse_json } = await import("#kiyomi/utils");
		const input =
			'{"title": "Song \\x22Remix\\x22 by \\x41\\x42", "nested": "{\\"count\\": 42}"}';
		const parsed = parse_json(input);
		expect(parsed).toEqual({
			title: 'Song "Remix" by AB',
			nested: { count: 42 },
		});
	});

	it("supports arrays and unquoted keys in parse_json", async () => {
		const { parse_json } = await import("#kiyomi/utils");
		const input = '{ unquoted: ["\\x31", "\\x32"], "name": "test", }';
		const parsed = parse_json(input);
		expect(parsed).toEqual({
			unquoted: ["1", "2"],
			name: "test",
		});
	});
});
