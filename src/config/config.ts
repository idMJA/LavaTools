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
	},
};

export * from "./key";
