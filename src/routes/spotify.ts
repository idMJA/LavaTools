import { Elysia, t } from "elysia";
import type { SpotifyClient } from "#kiyomi/types";
import { isForced, logs, parseCookies } from "#kiyomi/utils";

export function createSpotifyRoutes(spotifyClient: SpotifyClient | null) {
	return new Elysia().get(
		"/api/spotify/token",
		async ({ cookie, query, set }) => {
			if (!spotifyClient) {
				set.status = 503;
				return { error: "Spotify client not initialized or disabled" };
			}
			try {
				const cookies = parseCookies(cookie);
				const isForce = isForced(query.force);

				const result = await spotifyClient.handleTokenRequest(isForce, cookies);

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
	);
}
