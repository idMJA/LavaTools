// RENAME MEEE TO config.ts
import type { KiyomiConfiguration } from "#kiyomi/types";

export const Configuration: KiyomiConfiguration = {
	server: {
		host: "0.0.0.0",
		port: 3000,
	},

	// browserPath: "", // e.g. "/usr/bin/google-chrome-stable" or "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

	logging: {
		level: "info", // "error" | "warn" | "info" | "debug"
		toFile: false,
		filePath: "./logs/app.log",
	},

	spotify: {
		fetchMethod: "browser", // "browser" | "api"
	},

	youtube: {
		auth: "TsukasaAlyaMahiru", // Set your auth password here

		// Forces all cipher requests to use a specific player variant.
		// "IAS" is strongly recommended by yt-cipher for consistent decryption stability.
		// Available: "IAS" | "IAS_TCC" | "IAS_TCE" | "ES5" | "ES6" | "TV" | "TV_ES6" | "PHONE" | "EMBED" | "EMBED_ES6" | "HOUSE" | null
		overridePlayerVariant: "IAS",

		// Forces all cipher requests to use a specific YouTube player script ID (e.g. "44899b31").
		// Set to null to use whatever player ID is requested by Lavalink.
		overridePlayerId: null,
	},
};

export * from "./key";
