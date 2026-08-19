import { Configuration, KeyRotationConfiguration } from "#kiyomi/config";
import type { SpotifyClient } from "#kiyomi/types";
import {
	initializeKeyRotator,
	initializeSpotifyClient,
	logs,
	shutdownKeyRotator,
} from "#kiyomi/utils";
import { startServer } from "./server";

let spotifyClient: SpotifyClient | null = null;

async function main() {
	try {
		spotifyClient = await initializeSpotifyClient(Configuration);

		const hasSpotifyKeys =
			(KeyRotationConfiguration.keys.spotify?.length ?? 0) > 0;
		const hasDeezerKeys =
			(KeyRotationConfiguration.keys.deezer?.length ?? 0) > 0;

		if (hasSpotifyKeys || hasDeezerKeys) {
			initializeKeyRotator(KeyRotationConfiguration);
			if (hasSpotifyKeys) {
				logs(
					"info",
					`Spotify key rotator initialized with ${KeyRotationConfiguration.keys.spotify?.length} keys`,
				);
			}
			if (hasDeezerKeys) {
				logs(
					"info",
					`Deezer key rotator initialized with ${KeyRotationConfiguration.keys.deezer?.length} keys`,
				);
			}
		} else {
			logs(
				"warn",
				"No Spotify or Deezer keys configured for rotation. Add keys to KeyRotationConfiguration in config.ts",
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
