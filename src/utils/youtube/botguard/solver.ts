import { JSDOM } from "jsdom";
import {
	COLD_START_MAX_BINDING_BYTES,
	INNERTUBE_API_KEY,
	REQUEST_KEY,
	TV_CONFIG,
	TV_USER_AGENT,
	USER_AGENT,
	WEB_CLIENT_NAME,
	WEB_CLIENT_VERSION,
	YT_BASE,
} from "./constants";
import { base64ToUint8, buildURL, parse_json, Uint8ToBase64 } from "./helpers";

interface BotGuardOptions {
	program: string;
	globalName: string;
	globalObject: Record<string, unknown>;
	userInteractionElement?: unknown;
}

interface BotGuardVMClient {
	snapshot(
		args: {
			contentBinding?: string;
			signedTimestamp?: string;
			webPoSignalOutput?: unknown[];
			skipPrivacyBuffer?: boolean;
		},
		timeout?: number,
	): Promise<unknown>;
	pass_event(args?: unknown): Promise<unknown>;
	check_camera(args?: unknown): Promise<unknown>;
	shutdown(): Promise<void>;
	snapshot_synchronous(args: {
		contentBinding?: string;
		signedTimestamp?: string;
		webPoSignalOutput?: unknown[];
		skipPrivacyBuffer?: boolean;
	}): unknown;
}

function release_dom(dom: JSDOM | undefined) {
	if (!dom) return;

	const glob = globalThis as unknown as Record<string, unknown>;
	if (glob.window === dom.window) {
		for (const property of ["window", "document", "location", "origin", "yt"]) {
			try {
				delete glob[property];
			} catch {
				glob[property] = undefined;
			}
		}
	}

	dom.window.close();
}

let innertube_api_key = INNERTUBE_API_KEY;
let innertube_api_key_expires = 0;

async function get_innertube_api_key(): Promise<string> {
	if (innertube_api_key_expires > Date.now()) return innertube_api_key;

	try {
		const res = await fetch(`${YT_BASE}/sw.js`, {
			headers: { accept: "*/*", "user-agent": USER_AGENT },
			signal: AbortSignal.timeout(10000),
		});
		const txt = await res.text();
		const key = txt.match(/AIza[0-9A-Za-z_-]{20,}/)?.[0];

		if (key) innertube_api_key = key;
	} catch {
		innertube_api_key = INNERTUBE_API_KEY;
	}

	innertube_api_key_expires = Date.now() + 60 * 60 * 1000;
	return innertube_api_key;
}

function parse_waa_challenge(raw_data: unknown): unknown {
	const rawArr = raw_data as Record<string, unknown>[];
	if (rawArr?.[0]?.bgChallenge) return rawArr[0];

	let challenge_data: unknown[];

	if (rawArr?.length > 1 && typeof rawArr[1] === "string") {
		const bytes = base64ToUint8(rawArr[1]);
		challenge_data = JSON.parse(
			new TextDecoder().decode(bytes.map((value) => value + 97)),
		);
	} else if (Array.isArray(rawArr?.[0])) {
		challenge_data = rawArr[0];
	} else {
		return;
	}

	if (!Array.isArray(challenge_data)) return;

	const [
		message_id,
		wrapped_script,
		wrapped_url,
		interpreter_hash,
		program,
		global_name,
	] = challenge_data;
	const script = Array.isArray(wrapped_script)
		? wrapped_script.find((value) => typeof value === "string")
		: undefined;
	const interpreter_url = Array.isArray(wrapped_url)
		? wrapped_url.find((value) => typeof value === "string")
		: undefined;

	if (!program || !global_name || (!interpreter_url && !script)) return;

	return {
		bgChallenge: {
			messageId: message_id,
			program,
			globalName: global_name,
			interpreterHash: interpreter_hash,
			interpreterUrl: interpreter_url
				? {
						privateDoNotAccessOrElseTrustedResourceUrlWrappedValue:
							interpreter_url,
					}
				: undefined,
			interpreterJavascript: {
				privateDoNotAccessOrElseSafeScriptWrappedValue: script,
			},
		},
	};
}

export async function create_bg(
	options: BotGuardOptions,
): Promise<BotGuardVMClient> {
	const vm = options.globalObject[options.globalName] as unknown as {
		a: (
			program: string,
			callback: (
				async_snapshot: unknown,
				shutdown: unknown,
				pass_event: unknown,
				check_camera: unknown,
			) => void,
			flag: boolean,
			userInteractionElement: unknown,
			emptyFn: () => void,
			arrays: [unknown[], unknown[]],
			paramUndefined: undefined,
			paramFalse: boolean,
			emptyArr: unknown[],
		) => Promise<[(args: unknown[]) => unknown]>;
	};

	if (!vm || !vm.a) throw new Error("BotGuard VM unavailable");

	type VMFunctions = {
		async_snapshot: (cb: (res: unknown) => void, args: unknown[]) => void;
		shutdown: () => Promise<void>;
		pass_event: (args?: unknown) => Promise<unknown>;
		check_camera: (args?: unknown) => Promise<unknown>;
	};
	let resolveVm: (value: VMFunctions) => void;
	const vmPromise = new Promise<VMFunctions>((res) => {
		resolveVm = res;
	});

	const callback = (
		async_snapshot: unknown,
		shutdown: unknown,
		pass_event: unknown,
		check_camera: unknown,
	) => {
		resolveVm({
			async_snapshot: async_snapshot as (
				cb: (res: unknown) => void,
				args: unknown[],
			) => void,
			shutdown: shutdown as () => Promise<void>,
			pass_event: pass_event as (args?: unknown) => Promise<unknown>,
			check_camera: check_camera as (args?: unknown) => Promise<unknown>,
		});
	};

	const sync_snapshot = (
		await vm.a(
			options.program,
			callback,
			true,
			options.userInteractionElement,
			() => {},
			[[], []],
			undefined,
			false,
			[],
		)
	)?.[0];

	return {
		async snapshot(
			args: {
				contentBinding?: string;
				signedTimestamp?: string;
				webPoSignalOutput?: unknown[];
				skipPrivacyBuffer?: boolean;
			},
			timeout = 3000,
		) {
			const { async_snapshot } = await vmPromise;

			return await new Promise((resolve, reject) => {
				const timer = setTimeout(
					() => reject(new Error("VM operation timed out")),
					timeout,
				);

				async_snapshot(
					(res: unknown) => {
						clearTimeout(timer);
						resolve(res);
					},
					[
						args.contentBinding,
						args.signedTimestamp,
						args.webPoSignalOutput,
						args.skipPrivacyBuffer,
					],
				);
			});
		},
		async pass_event(args?: unknown) {
			const { pass_event } = await vmPromise;
			return pass_event?.(args);
		},
		async check_camera(args?: unknown) {
			const { check_camera } = await vmPromise;
			return check_camera?.(args);
		},
		async shutdown() {
			const { shutdown } = await vmPromise;
			return shutdown?.();
		},
		async snapshot_synchronous(args: {
			contentBinding?: string;
			signedTimestamp?: string;
			webPoSignalOutput?: unknown[];
			skipPrivacyBuffer?: boolean;
		}) {
			if (!sync_snapshot)
				throw new Error("synchronous snapshot function not found");
			return sync_snapshot([
				args.contentBinding,
				args.signedTimestamp,
				args.webPoSignalOutput,
				args.skipPrivacyBuffer,
			]);
		},
	};
}

class Minter {
	private callback: (data: Uint8Array) => Promise<Uint8Array>;
	private client: BotGuardVMClient;
	private dom: JSDOM;
	private active = 0;
	private retired = false;
	private closed = false;

	constructor(
		callback: (data: Uint8Array) => Promise<Uint8Array>,
		client: BotGuardVMClient,
		dom: JSDOM,
	) {
		this.callback = callback;
		this.client = client;
		this.dom = dom;
	}

	static async create(
		integrityToken: { integrity_token?: string },
		webPoSignalOutput: unknown[],
		client: BotGuardVMClient,
		dom: JSDOM,
	): Promise<Minter> {
		const getMinter = webPoSignalOutput[0] as
			| ((
					token: Uint8Array,
			  ) => Promise<(data: Uint8Array) => Promise<Uint8Array>>)
			| undefined;

		if (!getMinter || !integrityToken.integrity_token)
			throw new Error("Could not create WebPO minter");

		const callback = await getMinter(
			base64ToUint8(integrityToken.integrity_token),
		);

		if (!(callback instanceof Function))
			throw new Error("WebPO minter unavailable");

		return new Minter(callback, client, dom);
	}

	retire() {
		this.retired = true;
		this.close_idles();
	}

	close_idles() {
		if (!this.retired || this.active > 0 || this.closed) return;

		this.closed = true;
		release_dom(this.dom);

		Promise.resolve(this.client?.shutdown?.()).catch(() => {});
	}

	async mintAsWebsafeString(contentBinding: string): Promise<string> {
		this.active++;

		try {
			return Uint8ToBase64(
				await this.callback(new TextEncoder().encode(contentBinding)),
				true,
			);
		} finally {
			this.active--;
			this.close_idles();
		}
	}
}

let minter_promise: Promise<Minter> | undefined;
let expires = 0;
let cur: Minter | undefined;

export async function getWebPo(useYouTubeAPI = true): Promise<Minter> {
	if (minter_promise && (expires === 0 || expires > Date.now()))
		return minter_promise;

	cur?.retire();
	cur = undefined;
	minter_promise = undefined;

	let runtime_dom: JSDOM | undefined;

	minter_promise = (async () => {
		const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
			url: YT_BASE,
		});

		runtime_dom = dom;
		const glob = globalThis as unknown as Record<string, unknown>;
		Object.assign(glob, {
			window: dom.window,
			document: dom.window.document,
			location: dom.window.location,
			origin: dom.window.origin,
		});

		let key = REQUEST_KEY;
		let challenge: Record<string, unknown> | undefined;
		const api_key = await get_innertube_api_key();

		try {
			const res = await fetch(YT_BASE, {
				headers: {
					accept: "*/*",
					"accept-language": "en-US,en;q=0.7",
					"user-agent": USER_AGENT,
				},
			});

			const txt = await res.text();
			const config = txt.match(/ytcfg\.set\(({.+?})\);/s)?.[1];

			if (config) {
				const win = dom.window as unknown as Record<string, unknown>;
				win.yt = {
					config_: JSON.parse(config),
				};
				glob.yt = win.yt;
			}

			const attestation = txt.match(/window\.ytAtN\(\s*({[\s\S]*?})\s*\)/);
			challenge = attestation?.[1]
				? ((parse_json(attestation[1]) as Record<string, unknown>)?.R as Record<
						string,
						unknown
					>)
				: undefined;
		} catch {}

		if (
			!challenge ||
			typeof challenge !== "object" ||
			!("bgChallenge" in challenge)
		) {
			try {
				const res = await fetch(TV_CONFIG, {
					headers: { accept: "*/*", "user-agent": TV_USER_AGENT },
				});
				const txt = await res.text();

				if (!txt.startsWith(")]}'"))
					throw new Error("invalid yt tv config response");

				const json = JSON.parse(txt.slice(4));

				challenge = json.challengeParams?.R
					? JSON.parse(json.challengeParams.R)
					: undefined;
				key = json.challengeRequestKey || key;
			} catch {
				challenge = undefined;
			}
		}

		if (
			!challenge ||
			typeof challenge !== "object" ||
			!("bgChallenge" in challenge)
		) {
			const waa_res = await fetch(buildURL("Create", false), {
				method: "POST",
				headers: {
					"content-type": "application/json+protobuf",
					"x-goog-api-key": api_key,
					"x-user-agent": "grpc-web-javascript/0.1",
					"user-agent": USER_AGENT,
				},
				body: JSON.stringify([key]),
			});

			if (!waa_res.ok) throw new Error(`WAA Create returned ${waa_res.status}`);

			challenge = parse_waa_challenge(await waa_res.json()) as Record<
				string,
				unknown
			>;
		}

		if (
			!challenge ||
			typeof challenge !== "object" ||
			!("bgChallenge" in challenge)
		) {
			try {
				const att_url = `${YT_BASE}/youtubei/v1/att/get?prettyPrint=false`;
				const att_res = await fetch(att_url, {
					method: "POST",
					headers: {
						accept: "*/*",
						"content-type": "application/json",
						"user-agent": USER_AGENT,
						"x-goog-api-key": api_key,
					},
					body: JSON.stringify({
						context: {
							client: {
								clientName: WEB_CLIENT_NAME,
								clientVersion: WEB_CLIENT_VERSION,
							},
						},
						engagementType: "ENGAGEMENT_TYPE_UNBOUND",
					}),
				});

				if (!att_res.ok) throw new Error(`att/get returned ${att_res.status}`);

				const attestation = await att_res.json();

				if (!attestation?.bgChallenge)
					throw new Error("could not get challenge from att/get");

				challenge = { bgChallenge: attestation.bgChallenge };
			} catch {
				challenge = undefined;
			}
		}

		const bgChallenge = challenge?.bgChallenge as
			| Record<string, unknown>
			| undefined;

		if (!bgChallenge) throw new Error("Could not get botguard challenge");

		const interpreterUrl = (
			bgChallenge.interpreterUrl as Record<string, string> | undefined
		)?.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue;
		const inlineInterpreter = (
			bgChallenge.interpreterJavascript as Record<string, string> | undefined
		)?.privateDoNotAccessOrElseSafeScriptWrappedValue;
		const interpreter =
			inlineInterpreter ||
			(interpreterUrl
				? await (await fetch(`https:${interpreterUrl}`)).text()
				: "");

		if (!interpreter) throw new Error("couldn't load botguard interpreter");

		new Function(interpreter)();

		const client = await create_bg({
			program: bgChallenge.program as string,
			globalName: bgChallenge.globalName as string,
			globalObject: globalThis as unknown as Record<string, unknown>,
		});

		const signals: unknown[] = [];
		const res = await client.snapshot({ webPoSignalOutput: signals });
		const endpoint = buildURL("GenerateIT", useYouTubeAPI);

		const generate_options = (request_key: string) => ({
			method: "POST",
			headers: {
				"content-type": "application/json+protobuf",
				"x-goog-api-key": request_key,
				"x-user-agent": "grpc-web-javascript/0.1",
				"user-agent": USER_AGENT,
			},
			body: JSON.stringify([key, res]),
		});

		let t_txt = await fetch(endpoint, generate_options(api_key));
		if (!t_txt.ok && api_key !== INNERTUBE_API_KEY)
			t_txt = await fetch(endpoint, generate_options(INNERTUBE_API_KEY));

		if (!t_txt.ok) throw new Error(`GenerateIT returned ${t_txt.status}`);

		const [integrity_token, estimated_ttl_secs] = await t_txt.json();
		const minter = await Minter.create(
			{ integrity_token },
			signals,
			client,
			dom,
		);

		cur = minter;

		const ttl = Number(estimated_ttl_secs);
		expires =
			Date.now() +
			Math.max(1, (Number.isFinite(ttl) && ttl > 0 ? ttl : 300) - 30) * 1000;

		return minter;
	})();

	try {
		return await minter_promise;
	} catch (error) {
		release_dom(runtime_dom);
		minter_promise = undefined;
		expires = 0;
		throw error;
	}
}

export async function fetch_pot(
	contentBinding: string,
	useYouTubeAPI = true,
): Promise<{ poToken: string; contentBinding: string }> {
	const minter = await getWebPo(useYouTubeAPI);

	return {
		poToken: await minter.mintAsWebsafeString(contentBinding),
		contentBinding,
	};
}

export function createColdStartToken(
	contentBinding: string,
	clientState = 1,
): string | undefined {
	const bytecode = new TextEncoder().encode(contentBinding);

	if (bytecode.length > COLD_START_MAX_BINDING_BYTES) return;

	const timestamp = Math.floor(Date.now() / 1000);
	const rand_keys = [
		Math.floor(Math.random() * 256),
		Math.floor(Math.random() * 256),
	];

	const header = rand_keys.concat(
		[0, clientState],
		[
			(timestamp >> 24) & 0xff,
			(timestamp >> 16) & 0xff,
			(timestamp >> 8) & 0xff,
			timestamp & 0xff,
		],
	);

	const packet = new Uint8Array(2 + header.length + bytecode.length);

	packet[0] = 34;
	packet[1] = header.length + bytecode.length;
	packet.set(header, 2);
	packet.set(bytecode, 2 + header.length);

	const payload = packet.subarray(2);

	for (let i = 2; i < payload.length; i++) {
		const curr = payload[i];
		const key = payload[i % 2];
		if (curr !== undefined && key !== undefined) {
			payload[i] = curr ^ key;
		}
	}

	return Uint8ToBase64(packet, true);
}

export function decodeColdStartToken(token: string): {
	contentBinding: string;
	timestamp: number;
	unknownVal: number;
	clientState: number;
	keys: [number, number];
	date: Date;
} {
	const packet = base64ToUint8(token);

	const p0 = packet[0];
	if (packet.length < 10 || p0 !== 34)
		throw new Error("invalid cold start token");

	const length = packet[1];
	if (length === undefined || packet.length !== length + 2 || length < 8)
		throw new Error("invalid cold start packet length");

	const payload = packet.slice(2);
	for (let i = 2; i < payload.length; i++) {
		const curr = payload[i];
		const key = payload[i % 2];
		if (curr !== undefined && key !== undefined) {
			payload[i] = curr ^ key;
		}
	}

	const p4 = payload[4] ?? 0;
	const p5 = payload[5] ?? 0;
	const p6 = payload[6] ?? 0;
	const p7 = payload[7] ?? 0;

	const timestamp = ((p4 << 24) | (p5 << 16) | (p6 << 8) | p7) >>> 0;

	return {
		contentBinding: new TextDecoder().decode(payload.subarray(8)),
		timestamp,
		unknownVal: payload[2] ?? 0,
		clientState: payload[3] ?? 0,
		keys: [payload[0] ?? 0, payload[1] ?? 0],
		date: new Date(timestamp * 1000),
	};
}
