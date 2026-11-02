import { describe, expect, it } from "bun:test";
import { Configuration } from "./config/config";
import { createApp } from "./server";
import { createSpotifyClient } from "./utils/spotify";

describe("Spotify Direct API & Resolver Endpoints", () => {
	it("resolves single track with ISRC using native fetch", async () => {
		const client = await createSpotifyClient(Configuration);
		const app = createApp(client);

		const trackUrl = "https://open.spotify.com/track/2BlDX1yfT0ea5wo0vjCKKa";
		const resp = await app.handle(
			new Request(
				`http://localhost/api/resolve?url=${encodeURIComponent(trackUrl)}`,
			),
		);

		expect(resp.status).toBe(200);
		const data = await resp.json();
		expect(data.type).toBe("track");
		expect(data.items.length).toBe(1);
		expect(data.items[0].id).toBe("2BlDX1yfT0ea5wo0vjCKKa");
		expect(data.items[0].title).toBe("光るなら");
		expect(data.items[0].isrc).toBe("JPU901401919");
	}, 15000);

	it("resolves playlist with multiple tracks and ISRCs", async () => {
		const client = await createSpotifyClient(Configuration);
		const app = createApp(client);

		const plUrl = "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M";
		const resp = await app.handle(
			new Request(
				`http://localhost/api/resolve?url=${encodeURIComponent(plUrl)}`,
			),
		);

		expect(resp.status).toBe(200);
		const data = await resp.json();
		expect(data.type).toBe("playlist");
		expect(data.items.length).toBeGreaterThan(10);
		expect(data.items[0].isrc).toBeDefined();
		expect(data.items[0].isrc.length).toBeGreaterThan(5);
	}, 20000);

	it("fetches Spotify anonymous token without browser", async () => {
		const client = await createSpotifyClient(Configuration);
		const app = createApp(client);

		const resp = await app.handle(
			new Request("http://localhost/api/spotify/token"),
		);
		expect(resp.status).toBe(200);
		const data = await resp.json();
		expect(data.accessToken).toBeDefined();
		expect(data.accessTokenExpirationTimestampMs).toBeGreaterThan(Date.now());
	}, 15000);
});
