import { describe, expect, it } from "bun:test";
import {
	createColdToken,
	decodeColdToken,
	toBase64,
	toUint8,
} from "#kiyomi/utils";

describe("BotGuard / WebPO helper functions", () => {
	it("converts Uint8Array to Base64 and back", () => {
		const original = new Uint8Array([72, 101, 108, 108, 111]);
		const b64 = toBase64(original, true);
		const decoded = toUint8(b64);
		expect(decoded).toEqual(original);
	});

	it("creates and decodes a cold start token", () => {
		const binding = "dQw4w9WgXcQ";
		const token = createColdToken(binding);
		expect(token).toBeDefined();

		if (token) {
			const decoded = decodeColdToken(token);
			expect(decoded.contentBinding).toBe(binding);
			expect(decoded.clientState).toBe(1);
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
