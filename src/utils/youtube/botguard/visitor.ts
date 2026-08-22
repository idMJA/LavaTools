import {
	USER_AGENT,
	VISITOR_ID_ENDPOINT,
	WEB_CLIENT_ID,
	WEB_CLIENT_NAME,
	WEB_CLIENT_VERSION,
	YT_BASE,
} from "#kiyomi/utils";

let visitorData: string | undefined;
let visitor_expires = 0;
let reqs: Promise<string> | undefined;

function extract(value: unknown): string | undefined {
	if (!value || typeof value !== "object") return;

	const valObj = value as Record<string, unknown>;
	if (typeof valObj.VISITOR_DATA === "string") return valObj.VISITOR_DATA;
	if (typeof valObj.visitorData === "string") return valObj.visitorData;
	if (typeof valObj.visitor_id === "string") return valObj.visitor_id;

	for (const child of Object.values(valObj)) {
		const result = extract(child);
		if (result) return result;
	}
}

async function fetch_initial_page(timeout: number): Promise<string> {
	const res = await fetch(YT_BASE, {
		headers: {
			accept: "*/*",
			"accept-language": "en-US,en;q=0.9",
			"user-agent": USER_AGENT,
		},
		signal: AbortSignal.timeout(timeout),
	});

	if (!res.ok) throw new Error(`something went wrong ${res.status}`);

	const txt = await res.text();
	const config = txt.match(/ytcfg\.set\(({.+?})\);/s)?.[1];
	const visitor =
		txt.match(/VISITOR_DATA\s*[:=]\s*["']([^"']+)["']/i)?.[1] ||
		txt.match(/visitorData\s*[:=]\s*["']([^"']+)["']/i)?.[1];
	const result = visitor || (config ? extract(JSON.parse(config)) : undefined);

	if (!result) throw new Error("visitor data was not found in yt initial page");

	return decodeURIComponent(result);
}

async function visitor_endpoint(timeout: number): Promise<string> {
	const res = await fetch(VISITOR_ID_ENDPOINT, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"user-agent": USER_AGENT,
			"x-youtube-client-name": WEB_CLIENT_ID,
			"x-youtube-client-version": WEB_CLIENT_VERSION,
		},
		signal: AbortSignal.timeout(timeout),
		body: JSON.stringify({
			context: {
				client: {
					clientName: WEB_CLIENT_NAME,
					clientVersion: WEB_CLIENT_VERSION,
				},
			},
		}),
	});

	if (!res.ok) throw new Error(`something went wrong ${res.status}`);

	const result = extract(await res.json());

	if (!result) throw new Error("visitor data not found");

	return decodeURIComponent(result);
}

export function getVisitorData(ttl: number, timeout = 30000): Promise<string> {
	if (visitorData && visitor_expires > Date.now())
		return Promise.resolve(visitorData);

	if (reqs) return reqs;

	reqs = (async () => {
		try {
			return await fetch_initial_page(timeout);
		} catch (e: unknown) {
			try {
				return await visitor_endpoint(timeout);
			} catch (e2: unknown) {
				const err1 = (e as Error).message;
				const err2 = (e2 as Error).message;
				throw new Error(`could not generate visitor data: ${err1}; ${err2}`);
			}
		}
	})()
		.then((v) => {
			visitorData = v;
			visitor_expires = Date.now() + ttl;
			return v;
		})
		.finally(() => {
			reqs = undefined;
		});

	return reqs;
}
