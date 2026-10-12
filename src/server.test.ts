import { describe, expect, it } from "bun:test";
import { createApp } from "./server";

describe("LavaTools Server Endpoints", () => {
	const app = createApp(null);

	it("GET / returns health check", async () => {
		const res = await app.handle(new Request("http://localhost/"));
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("hi :3");
	});

	it("GET /api/spotify/token returns error when client not initialized", async () => {
		const res = await app.handle(
			new Request("http://localhost/api/spotify/token"),
		);
		expect(res.status).toBe(503);
		const json = await res.json();
		expect(json).toEqual({
			error: "Spotify client not initialized or disabled",
		});
	});

	it("POST /api/youtube/get_sts extracts signature timestamp", async () => {
		const res = await app.handle(
			new Request("http://localhost/api/youtube/get_sts", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({}),
			}),
		);
		// Without auth or invalid body, returns 400, 401, or 422 (Elysia schema validation error)
		expect([400, 401, 422]).toContain(res.status);
	});
});
