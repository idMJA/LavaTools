/*
Taken from https://github.com/yt-dlp/ejs
Auto-synced by scripts/update-ejs.ts
*/

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const EJS_UPSTREAM_URL = "https://github.com/yt-dlp/ejs";
const BASE_URL = "https://raw.githubusercontent.com/ashton045/ejs/tcl";
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
				.replace(/from "\.\.\/\.\.\/utils\.ts";/g, 'from "#kiyomi/ejs";')
				.replace(
					/result = \{ key: k1\.val \^ pool\[0\], isDirect: false \};/g,
					"if (pool[0] !== undefined) {\n          result = { key: k1.val ^ pool[0], isDirect: false };\n          return;\n        }",
				);
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
	const headerCredit = `/*\nTaken from ${EJS_UPSTREAM_URL}\nAuto-synced by scripts/update-ejs.ts\n*/\n\n`;
	if (file.patch) {
		text = file.patch(text);
	}
	writeFileSync(join(TARGET_DIR, file.local), `${headerCredit}${text}`);
}

console.log("Formatting updated files with Biome...");
execSync("bun run format", {
	stdio: "inherit",
	cwd: join(import.meta.dir, ".."),
});

console.log("Successfully updated and formatted all ejs solver files!");
