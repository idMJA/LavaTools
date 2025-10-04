import axios from "axios";
import { TOTP } from "totp-generator";
import type { SpotifyToken } from "#kiyomi/types";

function toHexString(byteArray: Uint8Array) {
	return Array.from(byteArray, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
	const bytes = [];
	for (let i = 0; i < hex.length; i += 2) {
		bytes.push(parseInt(hex.slice(i, i + 2), 16));
	}
	return bytes;
}

function base64ToBase32(base64: string) {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

	const binary = Array.from(Buffer.from(base64, "base64").toString("binary"))
		.map((ch) => ch.charCodeAt(0).toString(2).padStart(8, "0"))
		.join("");

	let base32 = "";
	for (let i = 0; i < binary.length; i += 5) {
		const chunk = binary.slice(i, i + 5);
		if (chunk.length === 5) {
			base32 += alphabet[parseInt(chunk, 2)];
		} else {
			base32 += alphabet[parseInt(chunk.padEnd(5, "0"), 2)];
		}
	}
	return base32;
}

function generateSecret(secretCipherBytes: number[]) {
	const transformed = secretCipherBytes.map((byte, index) => {
		return byte ^ ((index % 33) + 9);
	});

	const joined = transformed.join("");

	const hexStr = toHexString(new TextEncoder().encode(joined));

	const base64 = Buffer.from(hexToBytes(hexStr)).toString("base64");
	const secret = base64ToBase32(base64).replace(/=+$/, "");

	return secret;
}

export async function generateTokenUrl(
	cookieHeader?: string,
	fetchResponse = false,
): Promise<string | SpotifyToken | null> {
	const secret = await axios.get(
		"https://raw.githubusercontent.com/Thereallo1026/spotify-secrets/refs/heads/main/secrets/secretDict.json",
		cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined,
	);
	const secretsMap = secret.data;
	const keys = Object.keys(secretsMap);
	const totpVer = keys.length > 0 ? keys.slice(-1)[0] : undefined;

	if (!totpVer) return null;
	const totpSecretBytes = secretsMap[totpVer];
	const totpSecretKey = generateSecret(totpSecretBytes);

	const { otp } = await TOTP.generate(totpSecretKey);
	const tokenURL = `https://open.spotify.com/api/token?reason=init&productType=web-player&totp=${otp}&totpVer=${totpVer}`;

	if (!fetchResponse) return tokenURL;

	const response = await axios.get(
		tokenURL,
		cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined,
	);

	const record = { ...(response?.data ?? {}) } as Record<string, unknown>;

	delete record._notes;
	return record as SpotifyToken;
}
