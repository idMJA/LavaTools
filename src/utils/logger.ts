export function logs(
	level: "log" | "error" | "warn" | "info",
	...args: unknown[]
) {
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

	(console[level] as (...args: unknown[]) => void)(
		`${coloredLevel} ${GRAY}${timestamp}${RESET}`,
		...args,
	);
}

export function logs_undefined(context: string, err: unknown): undefined {
	logs("error", context, err);
	return undefined;
}
