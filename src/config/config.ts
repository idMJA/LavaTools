import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	BotGuardConfig,
	KeyRotationConfig,
	KiyomiConfiguration,
	LavalinkServerConfig,
} from "#kiyomi/types";

const PROJECT_ROOT = join(import.meta.dir, "../..");
const CONFIG_FILE = join(PROJECT_ROOT, "config.toml");
const EXAMPLE_CONFIG_FILE = join(PROJECT_ROOT, "config.example.toml");

const DEFAULT_SERVER = { host: "0.0.0.0", port: 3000 };
const DEFAULT_LOGGING = { level: "info" as const, toFile: false };
const DEFAULT_BOTGUARD: BotGuardConfig = {
	mode: "auto",
	timeout: 5000,
	workers: 1,
	queueSize: 32,
};

function validateConfig(config: Partial<KiyomiConfiguration>): void {
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

	if (!config.spotify) {
		throw new Error("Invalid config: [spotify] table is missing");
	}
	if (
		config.spotify.fetchMethod !== "browser" &&
		config.spotify.fetchMethod !== "api"
	) {
		throw new Error(
			`Invalid config: spotify.fetchMethod must be "browser" or "api", received "${config.spotify.fetchMethod}"`,
		);
	}
	if (!config.youtube) {
		throw new Error("Invalid config: [youtube] table is missing");
	}

	const level = config.logging?.level;
	if (level && !["error", "warn", "info", "debug"].includes(level)) {
		throw new Error(
			`Invalid config: logging.level must be one of error, warn, info, debug, received "${level}"`,
		);
	}

	if (config.youtube?.botguard?.mode) {
		const validModes = ["auto", "worker", "vm", "direct"];
		if (!validModes.includes(config.youtube.botguard.mode)) {
			throw new Error(
				`Invalid config: youtube.botguard.mode must be one of ${validModes.join(", ")}, received "${config.youtube.botguard.mode}"`,
			);
		}
	}

	const botguard = config.youtube.botguard;
	for (const [name, value] of Object.entries({
		timeout: botguard?.timeout,
		workers: botguard?.workers,
		queueSize: botguard?.queueSize,
	})) {
		if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
			throw new Error(
				`Invalid config: youtube.botguard.${name} must be a positive integer`,
			);
		}
	}

	validateNodes(config.nodes, "nodes");
	validateNodes(config.rotation?.nodes, "rotation.nodes");
	const rotation = config.rotation;
	for (const [name, value] of Object.entries({
		interval: rotation?.interval,
		rotationInterval: rotation?.rotationInterval,
		maxErrors: rotation?.maxErrors,
	})) {
		if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
			throw new Error(
				`Invalid config: rotation.${name} must be a positive integer`,
			);
		}
	}
}

function validateNodes(
	nodes: LavalinkServerConfig[] | undefined,
	name: string,
): void {
	if (!nodes) return;
	for (const [index, node] of nodes.entries()) {
		if (!node || typeof node.host !== "string" || !node.host.trim()) {
			throw new Error(
				`Invalid config: ${name}[${index}].host must be a non-empty string`,
			);
		}
		if (
			node.port !== undefined &&
			(!Number.isInteger(node.port) || node.port <= 0 || node.port > 65535)
		) {
			throw new Error(
				`Invalid config: ${name}[${index}].port must be a valid port number`,
			);
		}
		if (typeof node.secure !== "boolean") {
			throw new Error(
				`Invalid config: ${name}[${index}].secure must be a boolean`,
			);
		}
		if (typeof node.password !== "string") {
			throw new Error(
				`Invalid config: ${name}[${index}].password must be a string`,
			);
		}
	}
}

function normalizeConfig(
	config: Partial<KiyomiConfiguration>,
): KiyomiConfiguration {
	return {
		...config,
		server: { ...DEFAULT_SERVER, ...config.server },
		logging: { ...DEFAULT_LOGGING, ...config.logging },
		spotify: { fetchMethod: "api", ...config.spotify },
		youtube: {
			auth: "",
			cipherEnabled: true,
			botguardEnabled: true,
			overridePlayerVariant: "IAS",
			overridePlayerId: "",
			...config.youtube,
			botguard: { ...DEFAULT_BOTGUARD, ...config.youtube?.botguard },
		},
	};
}

function loadTomlConfig(): KiyomiConfiguration {
	const targetPath =
		Bun.env.NODE_ENV === "test" ? EXAMPLE_CONFIG_FILE : CONFIG_FILE;
	if (!existsSync(targetPath)) {
		throw new Error(
			"Configuration file not found. Please copy config.example.toml to config.toml",
		);
	}

	let content: string;
	try {
		content = readFileSync(targetPath, "utf-8");
	} catch {
		throw new Error(`Unable to read configuration file: ${CONFIG_FILE}`);
	}

	const rawConfig = Bun.TOML.parse(
		content,
	) as unknown as Partial<KiyomiConfiguration>;
	validateConfig(rawConfig);
	const parsed = normalizeConfig(rawConfig);
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
	nodes:
		rotationConfig?.nodes && rotationConfig.nodes.length > 0
			? rotationConfig.nodes
			: globalNodes || [],
	keys: rotationConfig?.keys || {
		spotify: [],
		deezer: [],
	},
	rotationInterval:
		rotationConfig?.interval ?? rotationConfig?.rotationInterval ?? 60,
	maxErrors: rotationConfig?.maxErrors ?? 3,
	autoRotate: rotationConfig?.auto ?? rotationConfig?.autoRotate ?? true,
};
