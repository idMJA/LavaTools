import ky from "ky";
import { TOTP } from "totp-generator";
import type { SpotifyToken } from "#kiyomi/types";
import { logs } from "#kiyomi/utils";

function toHexString(byteArray: Uint8Array): string {
	return Array.from(byteArray, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): number[] {
	const bytes: number[] = [];
	for (let i = 0; i < hex.length; i += 2) {
		bytes.push(Number.parseInt(hex.slice(i, i + 2), 16));
	}
	return bytes;
}

function base64ToBase32(base64: string): string {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
	const binary = Array.from(Buffer.from(base64, "base64").toString("binary"))
		.map((ch) => ch.charCodeAt(0).toString(2).padStart(8, "0"))
		.join("");

	let base32 = "";
	for (let i = 0; i < binary.length; i += 5) {
		const chunk = binary.slice(i, i + 5);
		if (chunk.length === 5) {
			base32 += alphabet[Number.parseInt(chunk, 2)];
		} else {
			base32 += alphabet[Number.parseInt(chunk.padEnd(5, "0"), 2)];
		}
	}
	return base32;
}

function generateSecret(secretCipherBytes: number[]): string {
	const transformed = secretCipherBytes.map((byte, index) => {
		return byte ^ ((index % 33) + 9);
	});

	const joined = transformed.join("");
	const hexStr = toHexString(new TextEncoder().encode(joined));
	const base64 = Buffer.from(hexToBytes(hexStr)).toString("base64");
	return base64ToBase32(base64).replace(/=+$/, "");
}

function parseJsString(literal: string): string {
	const quote = literal[0];
	const raw = literal.slice(1, -1);
	if (quote === '"') {
		return JSON.parse(literal) as string;
	}
	const jsonCompatible = raw
		.replace(/\\'/g, "'")
		.replace(/"/g, '\\"')
		.replace(/\\"/g, '"');
	return JSON.parse(`"${jsonCompatible}"`) as string;
}

export async function fetchSecretDict(): Promise<Record<string, number[]>> {
	try {
		const html = await ky
			.get("https://open.spotify.com/", {
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
				},
				timeout: 5000,
			})
			.text();

		const scriptUrls = [...html.matchAll(/src="([^"]+\.js)"/g)]
			.map((m) => m[1])
			.filter(
				(u): u is string =>
					typeof u === "string" && u.includes("spotifycdn.com"),
			);

		const regex1 =
			/\{\s*['"]?secret['"]?\s*:\s*('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")\s*,\s*['"]?version['"]?\s*:\s*(\d+)\s*\}/g;
		const regex2 =
			/\{\s*['"]?version['"]?\s*:\s*(\d+)\s*,\s*['"]?secret['"]?\s*:\s*('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")\s*\}/g;

		const found: Record<string, string> = {};

		for (const url of scriptUrls) {
			try {
				const code = await ky.get(url, { timeout: 5000 }).text();
				for (const m of code.matchAll(regex1)) {
					const valStr = m[1];
					const verStr = m[2];
					if (valStr && verStr) {
						found[verStr] = parseJsString(valStr);
					}
				}
				for (const m of code.matchAll(regex2)) {
					const verStr = m[1];
					const valStr = m[2];
					if (verStr && valStr) {
						found[verStr] = parseJsString(valStr);
					}
				}
				if (Object.keys(found).length > 0) break;
			} catch (_) {}
		}

		if (Object.keys(found).length > 0) {
			const dict: Record<string, number[]> = {};
			for (const [v, str] of Object.entries(found)) {
				dict[v] = Array.from(str).map((c) => c.charCodeAt(0));
			}
			return dict;
		}
	} catch (err) {
		logs("warn", "Direct Spotify bundle scraping failed, trying mirrors:", err);
	}

	const mirrors = [
		"https://raw.githubusercontent.com/idMJA/secretify/refs/heads/master/secrets/secretDict.json",
		"https://code.thetadev.de/ThetaDev/spotify-secrets/raw/branch/main/secrets/secretDict.json",
		"https://git.gay/thereallo/totp-secrets/raw/branch/main/secrets/secretDict.json",
	];

	for (const mirror of mirrors) {
		try {
			const res = await ky
				.get(mirror, { timeout: 4000 })
				.json<Record<string, number[]>>();
			if (res && Object.keys(res).length > 0) {
				return res;
			}
		} catch (_) {}
	}

	return {
		"61": [
			44, 55, 47, 42, 70, 40, 34, 114, 76, 74, 50, 111, 120, 97, 75, 76, 94,
			102, 43, 69, 49, 120, 118, 80, 64, 78,
		],
	};
}

export async function generateTokenUrl(
	cookieHeader?: string,
	fetchResponse = false,
): Promise<string | SpotifyToken | null> {
	const secretsMap = await fetchSecretDict();
	const keys = Object.keys(secretsMap).sort(
		(a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10),
	);
	const totpVer = keys.length > 0 ? keys.slice(-1)[0] : undefined;

	if (!totpVer) return null;
	const totpSecretBytes = secretsMap[totpVer];
	if (!totpSecretBytes) return null;
	const totpSecretKey = generateSecret(totpSecretBytes);

	let serverTimeSec: number | undefined;
	try {
		const st = await ky
			.get("https://open.spotify.com/api/server-time", { timeout: 3000 })
			.json<{ serverTime?: number }>();
		if (st?.serverTime) serverTimeSec = st.serverTime;
	} catch (_) {}

	const { otp } = await TOTP.generate(totpSecretKey, {
		timestamp: serverTimeSec ? serverTimeSec * 1000 : Date.now(),
	});

	const tokenURL = `https://open.spotify.com/api/token?reason=transport&productType=web-player&totp=${otp}&totpVer=${totpVer}`;

	if (!fetchResponse) return tokenURL;

	const responseData = await ky
		.get(
			tokenURL,
			cookieHeader
				? {
						headers: {
							Cookie: cookieHeader,
							"User-Agent":
								"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
						},
					}
				: {
						headers: {
							"User-Agent":
								"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
						},
					},
		)
		.json<Record<string, unknown>>();

	const record = { ...(responseData ?? {}) };
	delete record._notes;
	return record as SpotifyToken;
}
