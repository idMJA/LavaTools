import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Configuration } from "#kiyomi/config";

export function logs(
	level: "log" | "error" | "warn" | "info",
	...args: unknown[]
) {
	const configuredLevel = Configuration.logging?.level || "info";
	const priorities = { log: 0, debug: 0, info: 1, warn: 2, error: 3 };
	const normalizedLevel = level === "log" ? "debug" : level;
	if (priorities[normalizedLevel] < priorities[configuredLevel]) return;

	const timestamp = `[${new Date().toUTCString()}]`;
	let coloredLevel: string;
	const RESET = "\x1b[0m";
	const BOLD = "\x1b[1m";
	const RED = "\x1b[31m";
	const YELLOW = "\x1b[33m";
	const BLUE = "\x1b[34m";
	const GREEN = "\x1b[32m";
	const GRAY = "\x1b[90m";

	if (level === "error") {
		coloredLevel = `${RED}${BOLD}[ERROR]${RESET}`;
	} else if (level === "warn") {
		coloredLevel = `${YELLOW}${BOLD}[WARN]${RESET}`;
	} else if (level === "info") {
		coloredLevel = `${BLUE}${BOLD}[INFO]${RESET}`;
	} else {
		coloredLevel = `${GREEN}${BOLD}[LOG]${RESET}`;
	}

	const message = `${coloredLevel} ${GRAY}${timestamp}${RESET}`;
	(console[level === "log" ? "debug" : level] as (...args: unknown[]) => void)(
		message,
		...args,
	);

	if (Configuration.logging?.toFile) {
		const filePath = Configuration.logging.filePath || "./logs/app.log";
		mkdirSync(dirname(filePath), { recursive: true });
		appendFileSync(
			filePath,
			`${new Date().toISOString()} [${normalizedLevel.toUpperCase()}] ${args.map(String).join(" ")}\n`,
		);
	}
}

export function logs_undefined(context: string, err: unknown): undefined {
	logs("error", context, err);
	return undefined;
}
