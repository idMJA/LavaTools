import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "..");
const OLD_CONFIG_FILE = join(PROJECT_ROOT, "src/config/config.ts");
const OLD_KEY_FILE = join(PROJECT_ROOT, "src/config/key.ts");
const TARGET_TOML_FILE = join(PROJECT_ROOT, "config.toml");

if (!existsSync(OLD_CONFIG_FILE) && !existsSync(OLD_KEY_FILE)) {
	console.log("No legacy src/config/config.ts or key.ts found to migrate.");
	process.exit(0);
}

console.log("Migrating legacy TypeScript configuration to config.toml...");

interface LegacyConfig {
	server?: {
		host?: string;
		port?: number;
	};
	browserPath?: string | null;
	logging?: {
		level?: string;
		toFile?: boolean;
		filePath?: string;
	};
	spotify?: {
		fetchMethod?: string;
	};
	youtube?: {
		auth?: string | null;
		overridePlayerVariant?: string | null;
		overridePlayerId?: string | null;
	};
}

interface LegacyKeyConfig {
	lavalinkServers?: Array<{
		name?: string;
		host?: string;
		port?: number;
		secure?: boolean;
		password?: string;
	}>;
	keys?: {
		spotify?: Array<{
			clientId?: string;
			clientSecret?: string;
			spDc?: string;
		}>;
		deezer?: Array<{
			arl?: string;
			masterDecryptionKey?: string;
			formats?: string[];
		}>;
	};
	rotationInterval?: number;
	maxErrors?: number;
	autoRotate?: boolean;
}

let legacyConfig: LegacyConfig = {};
let legacyKeys: LegacyKeyConfig = {};

if (existsSync(OLD_CONFIG_FILE)) {
	try {
		const mod = await import(OLD_CONFIG_FILE);
		legacyConfig = mod.Configuration || {};
	} catch (e) {
		console.warn(
			"Could not import old config.ts dynamically, skipping:",
			(e as Error).message,
		);
	}
}

if (existsSync(OLD_KEY_FILE)) {
	try {
		const mod = await import(OLD_KEY_FILE);
		legacyKeys = mod.KeyRotationConfiguration || {};
	} catch (e) {
		console.warn(
			"Could not import old key.ts dynamically, skipping:",
			(e as Error).message,
		);
	}
}

const tomlLines: string[] = [
	"# LavaTools Config (Migrated from TypeScript)",
	"",
];

// [server]
tomlLines.push("[server]");
tomlLines.push(
	`host = ${JSON.stringify(legacyConfig.server?.host || "0.0.0.0")}`,
);
tomlLines.push(`port = ${legacyConfig.server?.port ?? 3000}`);
if (legacyConfig.browserPath) {
	tomlLines.push(`browserPath = ${JSON.stringify(legacyConfig.browserPath)}`);
}
tomlLines.push("");

// [logging]
tomlLines.push("[logging]");
tomlLines.push(
	`level = ${JSON.stringify(legacyConfig.logging?.level || "info")}`,
);
tomlLines.push(`toFile = ${legacyConfig.logging?.toFile ?? false}`);
if (legacyConfig.logging?.filePath) {
	tomlLines.push(`filePath = ${JSON.stringify(legacyConfig.logging.filePath)}`);
}
tomlLines.push("");

// [spotify]
tomlLines.push("[spotify]");
tomlLines.push(
	`fetchMethod = ${JSON.stringify(legacyConfig.spotify?.fetchMethod || "browser")}`,
);
tomlLines.push("");

// [youtube]
tomlLines.push("[youtube]");
tomlLines.push(`auth = ${JSON.stringify(legacyConfig.youtube?.auth || "")}`);
tomlLines.push(
	`overridePlayerVariant = ${JSON.stringify(legacyConfig.youtube?.overridePlayerVariant || "IAS")}`,
);
tomlLines.push(
	`overridePlayerId = ${JSON.stringify(legacyConfig.youtube?.overridePlayerId || "")}`,
);
tomlLines.push("");

// [youtube.botguard]
tomlLines.push("[youtube.botguard]");
tomlLines.push('mode = "auto"');
tomlLines.push("timeout = 5000");
tomlLines.push("workers = 1");
tomlLines.push("queueSize = 32");
tomlLines.push("");

// [[nodes]]
const nodes = legacyKeys.lavalinkServers || [];
for (const node of nodes) {
	tomlLines.push("[[nodes]]");
	tomlLines.push(`name = ${JSON.stringify(node.name || "Primary Lavalink")}`);
	tomlLines.push(`host = ${JSON.stringify(node.host || "localhost")}`);
	tomlLines.push(`port = ${node.port ?? 8080}`);
	tomlLines.push(`secure = ${node.secure ?? false}`);
	tomlLines.push(`password = ${JSON.stringify(node.password || "")}`);
	tomlLines.push("");
}

// [rotation]
tomlLines.push("[rotation]");
tomlLines.push(`interval = ${legacyKeys.rotationInterval ?? 60}`);
tomlLines.push(`maxErrors = ${legacyKeys.maxErrors ?? 3}`);
tomlLines.push(`auto = ${legacyKeys.autoRotate ?? true}`);
tomlLines.push("");

// [[rotation.keys.spotify]]
for (const sp of legacyKeys.keys?.spotify || []) {
	tomlLines.push("[[rotation.keys.spotify]]");
	tomlLines.push(`clientId = ${JSON.stringify(sp.clientId || "")}`);
	tomlLines.push(`clientSecret = ${JSON.stringify(sp.clientSecret || "")}`);
	if (sp.spDc) tomlLines.push(`spDc = ${JSON.stringify(sp.spDc)}`);
	tomlLines.push("");
}

// [[rotation.keys.deezer]]
for (const dz of legacyKeys.keys?.deezer || []) {
	tomlLines.push("[[rotation.keys.deezer]]");
	tomlLines.push(`arl = ${JSON.stringify(dz.arl || "")}`);
	if (dz.masterDecryptionKey)
		tomlLines.push(
			`masterDecryptionKey = ${JSON.stringify(dz.masterDecryptionKey)}`,
		);
	tomlLines.push("");
}

writeFileSync(TARGET_TOML_FILE, tomlLines.join("\n"));
console.log(`Successfully generated ${TARGET_TOML_FILE}`);
