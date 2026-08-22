import {
	BASE64_MAP,
	GOOGLE_API_BASE,
	REG_FOR_BASE64,
	YT_BASE,
} from "#kiyomi/utils";

export function base64ToUint8(base64: string): Uint8Array {
	const base64Mod = base64.replace(
		REG_FOR_BASE64,
		(match) => BASE64_MAP[match] || match,
	);
	return new Uint8Array([...atob(base64Mod)].map((char) => char.charCodeAt(0)));
}

export function Uint8ToBase64(u8: Uint8Array, base64url = false): string {
	const result = btoa(String.fromCharCode(...u8));
	return base64url ? result.replace(/\+/g, "-").replace(/\//g, "_") : result;
}

export function buildURL(endpoint: string, use_api = true): string {
	return `${use_api ? YT_BASE : GOOGLE_API_BASE}/${use_api ? "api/jnn/v1" : "$rpc/google.internal.waa.v1.Waa"}/${endpoint}`;
}

export function parse_json(str: string): unknown {
	const cleaned = str
		.replace(/\\x([0-9a-f]{2})/gi, (_, h) =>
			String.fromCharCode(parseInt(h, 16)),
		)
		.replace(/,\s*([}\]])/g, "$1")
		.replace(/'((?:[^'\\]|\\[\s\S])*)'/g, (_, s) =>
			JSON.stringify(s.replace(/\\'/g, "'")),
		)
		.replace(/([{,]\s*)([\w$]+)\s*:/g, '$1"$2":');

	const obj = JSON.parse(cleaned);

	for (const [k, v] of Object.entries(obj)) {
		if (typeof v === "string" && /^[\s]*[{[]/.test(v)) {
			try {
				obj[k] = JSON.parse(v);
			} catch {}
		}
	}

	return obj;
}
