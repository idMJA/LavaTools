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

export function parse_json(looseJson: string): unknown {
	const jsonStr = looseJson
		.replace(/,\s*([\]}])/g, "$1")
		.replace(/\\x([0-9A-Fa-f]{2})/g, "\\u00$1")
		.replace(/'((?:[^'\\]|\\[\s\S])*)'/g, (_match, innerStr) => {
			return `"${innerStr.replace(/\\'/g, "'").replace(/"/g, '\\"')}"`;
		});

	let parsedData: unknown;
	try {
		parsedData = JSON.parse(jsonStr);
	} catch (err) {
		try {
			const reg = jsonStr.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');
			parsedData = JSON.parse(reg);
		} catch {
			throw err;
		}
	}

	const decodeHexEscapes = (value: string): string => {
		return value.replace(/\\x([0-9A-Fa-f]{2})/g, (_match, hex) => {
			return String.fromCharCode(parseInt(hex, 16));
		});
	};

	const normalizeValue = (value: unknown): unknown => {
		if (typeof value === "string") {
			const decodedValue = decodeHexEscapes(value);
			const trimmed = decodedValue.trim();

			if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
				try {
					return normalizeValue(JSON.parse(decodedValue));
				} catch {
					return decodedValue;
				}
			}

			return decodedValue;
		}

		if (Array.isArray(value)) {
			return value.map(normalizeValue);
		}

		if (value && typeof value === "object") {
			const record = value as Record<string, unknown>;
			for (const key in record) {
				record[key] = normalizeValue(record[key]);
			}
		}

		return value;
	};

	return normalizeValue(parsedData);
}
