import { Elysia, t } from "elysia";
import type { SpotifyClient } from "#kiyomi/types";
import { isForced, logs, parseCookies } from "#kiyomi/utils";

export function createSpotifyRoutes(spotifyClient: SpotifyClient | null) {
	return new Elysia()
		.get(
			"/api/spotify/token",
			async ({ cookie, query, set }) => {
				if (!spotifyClient) {
					set.status = 503;
					return { error: "Spotify client not initialized or disabled" };
				}
				try {
					const cookies = parseCookies(cookie);
					const isForce = isForced(query.force);

					const result = await spotifyClient.handleTokenRequest(
						isForce,
						cookies,
					);

					if (cookie?.lastTokenUrl && "accessToken" in result) {
						cookie.lastTokenUrl.value = new Date().toISOString();
					}

					return result;
				} catch (e) {
					logs("error", "Token request failed:", e);
					return { error: (e as Error).message };
				}
			},
			{
				query: t.Object({
					force: t.Optional(
						t.String({
							description: "Force refresh token (1, yes, true to enable)",
						}),
					),
				}),
				detail: {
					summary: "Get Spotify Access Token",
					description:
						"Retrieves or refreshes Spotify access token using configured method (API or browser)",
					tags: ["Spotify"],
				},
			},
		)
		.get(
			"/api/resolve",
			async ({ query, set }) => {
				if (!spotifyClient?.resolveUrl) {
					set.status = 503;
					return { error: "Spotify resolver is not available" };
				}
				if (!query.url) {
					set.status = 400;
					return { error: "Missing required query parameter: url" };
				}
				return await spotifyClient.resolveUrl(query.url);
			},
			{
				query: t.Object({
					url: t.String({
						description: "Spotify share URL (track, playlist, album)",
					}),
				}),
				detail: {
					summary: "Resolve Spotify URL",
					description:
						"Deep resolve Spotify track, playlist, or album into rich metadata with ISRC codes",
					tags: ["Spotify"],
				},
			},
		)
		.get(
			"/api/search",
			async ({ query, set }) => {
				if (!spotifyClient?.searchCatalog) {
					set.status = 503;
					return { error: "Spotify search is not available" };
				}
				if (!query.q) {
					set.status = 400;
					return { error: "Missing required query parameter: q" };
				}
				const limit = query.limit ? Number.parseInt(query.limit, 10) : 10;
				return await spotifyClient.searchCatalog(query.q, limit);
			},
			{
				query: t.Object({
					q: t.String({ description: "Search query" }),
					limit: t.Optional(
						t.String({ description: "Results limit (default: 10)" }),
					),
				}),
				detail: {
					summary: "Search Spotify Catalog",
					description: "Search tracks from Spotify catalog",
					tags: ["Spotify"],
				},
			},
		)
		.get(
			"/api/artist-top-tracks",
			async ({ query, set }) => {
				if (!spotifyClient?.getArtistTopTracks) {
					set.status = 503;
					return { error: "Spotify artist resolver is not available" };
				}
				if (!query.id) {
					set.status = 400;
					return { error: "Missing required query parameter: id" };
				}
				return await spotifyClient.getArtistTopTracks(query.id);
			},
			{
				query: t.Object({
					id: t.String({ description: "Spotify artist ID" }),
				}),
				detail: {
					summary: "Get Artist Top Tracks",
					description: "Fetch top tracks for an artist",
					tags: ["Spotify"],
				},
			},
		);
}
