import {
	logs,
	initializeSpotifyClient,
	initializeKeyRotator,
	shutdownKeyRotator,
} from "#kiyomi/utils";
import { Configuration, KeyRotationConfiguration } from "#kiyomi/config";
import type { SpotifyClient } from "#kiyomi/types";
import { startServer } from "./server";

let spotifyClient: SpotifyClient | null = null;

async function main() {
	try {
		spotifyClient = await initializeSpotifyClient(Configuration);

		if (KeyRotationConfiguration.keys.length > 0) {
			initializeKeyRotator(KeyRotationConfiguration);
			logs(
				"info",
				`Key rotator initialized with ${KeyRotationConfiguration.keys.length} keys`,
			);
		} else {
			logs(
				"warn",
				"No Spotify keys configured for rotation. Add keys to KeyRotationConfiguration in config.ts",
			);
		}
	} catch (error) {
		logs("error", "Application startup failed:", error);
		process.exit(1);
	}

	await startServer(spotifyClient);

	async function shutdown() {
		logs("info", "Shutting down server...");

		try {
			shutdownKeyRotator();

			if (spotifyClient?.cleanup) {
				await spotifyClient.cleanup();
				logs("info", "Spotify client cleaned up successfully");
			}
		} catch (error) {
			logs("error", "Error during cleanup:", error);
		}

		process.exit(0);
	}

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}

void main();
