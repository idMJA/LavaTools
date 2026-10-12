import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { KeyRotationConfig, KiyomiConfiguration } from "#kiyomi/types";

const PROJECT_ROOT = join(import.meta.dir, "../..");
const CONFIG_FILE = join(PROJECT_ROOT, "config.toml");
const EXAMPLE_CONFIG_FILE = join(PROJECT_ROOT, "config.example.toml");

function validateConfig(config: KiyomiConfiguration): void {
	if (!config.server) {
		throw new Error("Invalid config: [server] table is missing");
	}
	if (typeof config.server.host !== "string" || !config.server.host.trim()) {
		throw new Error("Invalid config: server.host must be a non-empty string");
	}
	if (
		config.server.port !== undefined &&
		(!Number.isInteger(config.server.port) ||
			config.server.port <= 0 ||
			config.server.port > 65535)
	) {
		throw new Error(
			`Invalid config: server.port (${config.server.port}) must be a valid port number (1-65535)`,
		);
	}

	if (config.spotify?.enabled !== false) {
		const method = config.spotify?.fetchMethod;
		if (method && method !== "browser" && method !== "api") {
			throw new Error(
				`Invalid config: spotify.fetchMethod must be "browser" or "api", received "${method}"`,
			);
		}
	}

	if (config.youtube?.botguard?.mode) {
		const validModes = ["auto", "worker", "vm", "direct"];
		if (!validModes.includes(config.youtube.botguard.mode)) {
			throw new Error(
				`Invalid config: youtube.botguard.mode must be one of ${validModes.join(", ")}, received "${config.youtube.botguard.mode}"`,
			);
		}
	}
}

function loadTomlConfig(): KiyomiConfiguration {
	const targetPath = existsSync(CONFIG_FILE)
		? CONFIG_FILE
		: EXAMPLE_CONFIG_FILE;

	let content: string;
	try {
		content = readFileSync(targetPath, "utf-8");
	} catch {
		throw new Error(
			"Configuration file not found. Please create config.toml based on config.example.toml",
		);
	}

	const parsed = Bun.TOML.parse(content) as unknown as KiyomiConfiguration;
	validateConfig(parsed);
	return parsed;
}

export const Configuration: KiyomiConfiguration = loadTomlConfig();

const rotationConfig = Configuration.rotation;
const globalNodes = Configuration.nodes;

function isFeatureEnabled(
	specific: boolean | undefined,
	general: boolean | undefined,
	defaultState = true,
): boolean {
	if (general !== undefined) return general;
	if (specific !== undefined) return specific;
	return defaultState;
}

export function isCipherEnabled(): boolean {
	return isFeatureEnabled(
		Configuration.youtube.cipherEnabled,
		Configuration.enabled?.cipher,
		true,
	);
}

export function isBotGuardEnabled(): boolean {
	return isFeatureEnabled(
		Configuration.youtube.botguardEnabled,
		Configuration.enabled?.botguard,
		true,
	);
}

export function isSpotifyEnabled(): boolean {
	return isFeatureEnabled(
		Configuration.spotify?.enabled,
		Configuration.enabled?.spotify,
		true,
	);
}

export function isRotationEnabled(): boolean {
	return isFeatureEnabled(
		Configuration.rotation?.enabled,
		Configuration.enabled?.rotation,
		true,
	);
}

export const KeyRotationConfiguration: KeyRotationConfig = {
	enabled: isRotationEnabled(),
	nodes: rotationConfig?.nodes || globalNodes || [],
	keys: rotationConfig?.keys || {
		spotify: [],
		deezer: [],
	},
	rotationInterval:
		rotationConfig?.interval ?? rotationConfig?.rotationInterval ?? 60,
	maxErrors: rotationConfig?.maxErrors ?? 3,
	autoRotate: rotationConfig?.auto ?? rotationConfig?.autoRotate ?? true,
};
