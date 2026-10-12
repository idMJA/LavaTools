import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { Configuration } from "#kiyomi/config";
import type { SpotifyClient } from "#kiyomi/types";
import { logs } from "#kiyomi/utils";
import { keyRotationRoutes } from "./routes/key-rotation";
import { createSpotifyRoutes } from "./routes/spotify";
import { youtubeRoutes } from "./routes/youtube";

export function createApp(spotifyClient: SpotifyClient | null) {
	return new Elysia()
		.use(
			openapi({
				documentation: {
					info: {
						title: "LavaTools API",
						version: "1.0.0",
						description:
							"API for YouTube signature decryption and Spotify token management",
					},
					servers: [
						{
							url: `http://localhost:${Configuration.server.port || 3000}`,
							description: "Development server",
						},
					],
					tags: [
						{
							name: "General",
							description: "General endpoints",
						},
						{
							name: "YouTube",
							description:
								"YouTube signature and STS endpoints (requires authorization)",
						},
						{
							name: "Spotify",
							description: "Spotify token management endpoints",
						},
						{
							name: "Key Rotation",
							description: "Spotify key rotation management endpoints",
						},
					],
				},
			}),
		)
		.get("/", () => "hi :3", {
			detail: {
				summary: "Health Check",
				description: "Simple health check endpoint",
				tags: ["General"],
			},
		})
		.use(createSpotifyRoutes(spotifyClient))
		.use(keyRotationRoutes)
		.use(youtubeRoutes)
		.listen(Configuration.server.port || 3000);
}

export async function startServer(spotifyClient: SpotifyClient | null) {
	const app = createApp(spotifyClient);
	logs(
		"info",
		`API server is running at ${app.server?.hostname}:${app.server?.port}`,
	);
	return app;
}
