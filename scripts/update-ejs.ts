import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = "https://raw.githubusercontent.com/yt-dlp/ejs/main";
const TARGET_DIR = join(import.meta.dir, "../src/utils/youtube/cipher/ejs");

mkdirSync(TARGET_DIR, { recursive: true });

const files: {
	url: string;
	local: string;
	patch?: (content: string) => string;
}[] = [
	{
		url: `${BASE_URL}/src/types.ts`,
		local: "types.ts",
	},
	{
		url: `${BASE_URL}/src/utils.ts`,
		local: "utils.ts",
		patch: (content: string) => {
			return content
				.replace(
					/structure\.every\(\(value, index\) => matchesStructure\(obj\[index\], value\)\)/g,
					"structure.every((value, index) => {\n        const item = obj[index];\n        return item ? matchesStructure(item, value) : false;\n      })",
				)
				.replace(/from "\.\/types\.ts";/g, 'from "#kiyomi/ejs";');
		},
	},
	{
		url: `${BASE_URL}/src/yt/solver/setup.ts`,
		local: "setup.ts",
	},
	{
		url: `${BASE_URL}/src/yt/solver/nsig.ts`,
		local: "nsig.ts",
		patch: (content: string) => {
			return content
				.replace(/from "\.\.\/\.\.\/types\.ts";/g, 'from "#kiyomi/ejs";')
				.replace(/from "\.\.\/\.\.\/utils\.ts";/g, 'from "#kiyomi/ejs";');
		},
	},
	{
		url: `${BASE_URL}/src/yt/solver/solvers.ts`,
		local: "solvers.ts",
		patch: (content: string) => {
			return content
				.replace(/from "\.\.\/\.\.\/utils\.ts";/g, 'from "#kiyomi/ejs";')
				.replace(/from "\.\/nsig\.ts";/g, 'from "#kiyomi/ejs";')
				.replace(/from "\.\/setup\.ts";/g, 'from "#kiyomi/ejs";');
		},
	},
];

console.log("Updating ejs solver files from yt-dlp/ejs...");

for (const file of files) {
	console.log(`Fetching ${file.local}...`);
	const res = await fetch(file.url);
	if (!res.ok) {
		throw new Error(`Failed to fetch ${file.url}: ${res.statusText}`);
	}
	let text = await res.text();
	if (file.patch) {
		text = file.patch(text);
	}
	writeFileSync(join(TARGET_DIR, file.local), text);
}

console.log("Formatting updated files with Biome...");
execSync("bun run format", {
	stdio: "inherit",
	cwd: join(import.meta.dir, ".."),
});

console.log("Successfully updated and formatted all ejs solver files!");
