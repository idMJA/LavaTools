import type { KeyRotationConfig, LavalinkServerConfig } from "./lavalink";

type SpotifyFetchMethod = "api" | "browser";

/**
 * Spotify configuration settings.
 */
interface SpotifyConfig {
	enabled?: boolean;
	fetchMethod: SpotifyFetchMethod;
}

export type BotGuardExecutionMode = "auto" | "worker" | "vm" | "direct";

export interface BotGuardConfig {
	/**
	 * Execution sandbox mode for running untrusted Google BotGuard VM scripts:
	 * - "auto": Intelligently selects "worker" thread pool when workers > 1, or "vm" sandbox.
	 * - "worker": Runs BotGuard in isolated worker threads with hardened node:vm (highest security and non-blocking).
	 * - "vm": In-process hardened node:vm with execution timeouts (memory-efficient, ideal for low-RAM containers).
	 * - "direct": Legacy execution using global eval/Function without sandboxing.
	 * Default: "auto"
	 */
	mode?: BotGuardExecutionMode;

	/**
	 * Hard execution timeout in milliseconds for BotGuard challenge evaluation.
	 * Prevents CPU freeze / DoS if an invalid challenge script is received.
	 * Default: 5000 (5 seconds)
	 */
	timeout?: number;

	/**
	 * Number of worker threads for BotGuard execution when running in "worker" mode.
	 * Default: 1
	 */
	workers?: number;

	/**
	 * Maximum queue size for concurrent BotGuard generation requests.
	 * Default: 32
	 */
	queueSize?: number;
}

/**
 * YouTube configuration settings.
 */
interface YouTubeConfig {
	enabled?: boolean;
	cipherEnabled?: boolean;
	botguardEnabled?: boolean;
	auth: string;
	overridePlayerVariant?: string | null;
	overridePlayerId?: string | null;
	botguard?: BotGuardConfig;
}

/**
 * Server configuration settings.
 */
interface ServerConfig {
	host: string;
	port?: number;
}

export interface FeaturesConfig {
	cipher?: boolean;
	botguard?: boolean;
	spotify?: boolean;
	rotation?: boolean;
}

export interface KiyomiConfiguration {
	server: ServerConfig;

	browserPath?: string | null;

	logging?: {
		level: "error" | "warn" | "info" | "debug";
		toFile: boolean;
		filePath?: string;
	};

	enabled?: FeaturesConfig;

	spotify: SpotifyConfig;

	youtube: YouTubeConfig;

	rotation?: KeyRotationConfig;
	nodes?: LavalinkServerConfig[];
}
