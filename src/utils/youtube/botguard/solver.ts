import vm from "node:vm";
import { JSDOM, VirtualConsole } from "jsdom";
import { Configuration } from "#kiyomi/config";
import {
	buildURL,
	INNERTUBE_API_KEY,
	parse_json,
	REQUEST_KEY,
	TV_CONFIG,
	TV_USER_AGENT,
	toBase64,
	toUint8,
	USER_AGENT,
	WEB_CLIENT_NAME,
	WEB_CLIENT_VERSION,
	YT_BASE,
} from "#kiyomi/utils";
import { Minter } from "./minter";

interface BotGuardOptions {
	program: string;
	globalName: string;
	globalObject: Record<string, unknown>;
	userInteractionElement?: unknown;
}

export interface BotGuardVMClient {
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

function parseChallenge(raw_data: unknown): unknown {
	const rawArr = raw_data as Record<string, unknown>[];
	if (rawArr?.[0]?.bgChallenge) return rawArr[0];

	let challenge_data: unknown[];

	if (rawArr?.length > 1 && typeof rawArr[1] === "string") {
		const bytes = toUint8(rawArr[1]);
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

export async function createVM(
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

	if (!vm?.a) throw new Error("BotGuard VM unavailable");

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

let minter_promise: Promise<Minter> | undefined;
let expires = 0;
let cur: Minter | undefined;

export async function getWebPo(useYouTubeAPI = true): Promise<Minter> {
	if (cur?.isExhausted()) {
		cur.retire();
		cur = undefined;
		minter_promise = undefined;
		expires = 0;
	}

	if (minter_promise && (expires === 0 || expires > Date.now() + 15000))
		return minter_promise;

	cur?.retire();
	cur = undefined;
	minter_promise = undefined;

	let runtime_dom: JSDOM | undefined;

	minter_promise = (async () => {
		const virtualConsole = new VirtualConsole();
		virtualConsole.on("jsdomError", (error: Error) => {
			if (error.message.includes("HTMLCanvasElement")) return;
			console.error(error);
		});

		const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
			url: YT_BASE,
			virtualConsole,
		});

		if (dom.window.HTMLCanvasElement) {
			dom.window.HTMLCanvasElement.prototype.getContext = (() =>
				null) as unknown as typeof dom.window.HTMLCanvasElement.prototype.getContext;
		}

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
		let eacrToken: string | undefined;

		try {
			const res = await fetch(YT_BASE, {
				headers: {
					accept: "*/*",
					"accept-language": "en-US,en;q=0.7",
					"user-agent": USER_AGENT,
				},
			});

			const txt = await res.text();

			const win = dom.window as unknown as {
				yt?: { config_?: Record<string, unknown> };
			};
			win.yt = win.yt || { config_: {} };
			win.yt.config_ = win.yt.config_ || {};

			const cfg = txt.matchAll(/ytcfg\.set\(({.+?})\);/gs);
			for (const match of cfg) {
				if (match[1]) {
					try {
						Object.assign(win.yt.config_, JSON.parse(match[1]));
					} catch {
						try {
							Object.assign(
								win.yt.config_,
								parse_json(match[1]) as Record<string, unknown>,
							);
						} catch {}
					}
				}
			}

			const reg_match = txt.matchAll(
				/ytcfg\.set\(["']([A-Za-z0-9_]+)["']\s*,\s*(["'].*?["']|true|false|\d+|{[^}]+}|\[[^\]]+\])\);/gs,
			);
			for (const match of reg_match) {
				if (match[1] && match[2]) {
					try {
						win.yt.config_[match[1]] = JSON.parse(match[2]);
					} catch {
						win.yt.config_[match[1]] = match[2].replace(/^["']|["']$/g, "");
					}
				}
			}

			if (!win.yt.config_.EVENT_ID) {
				const rand_bytes = new Uint8Array(16);
				crypto.getRandomValues(rand_bytes);
				win.yt.config_.EVENT_ID = toBase64(rand_bytes, true).replace(/=+$/, "");
			}

			glob.yt = win.yt;

			const attestation = txt.match(/window\.ytAtN\(\s*({[\s\S]*?})\s*\)/);
			if (attestation?.[1]) {
				try {
					const parsed = parse_json(attestation[1]) as {
						R?: Record<string, unknown>;
						T?: string;
					};
					challenge = (
						parsed.R?.bgChallenge ? parsed.R : parseChallenge(parsed.R)
					) as Record<string, unknown> | undefined;
					eacrToken = parsed.T;
				} catch {
					challenge = undefined;
				}
			}

			if (!challenge?.bgChallenge && !eacrToken) {
				const initialAttestationMatch = txt.match(
					/initialAttestationDataJson\s*=\s*({[\s\S]*?});/,
				);
				if (initialAttestationMatch?.[1]) {
					try {
						const parsed = parse_json(initialAttestationMatch[1]) as {
							R?: Record<string, unknown>;
							T?: string;
						};
						challenge = (
							parsed.R?.bgChallenge ? parsed.R : parseChallenge(parsed.R)
						) as Record<string, unknown> | undefined;
						eacrToken = parsed.T || eacrToken;
					} catch {}
				}
			}
		} catch {}

		if (
			!challenge ||
			typeof challenge !== "object" ||
			!("bgChallenge" in challenge)
		) {
			try {
				const payload: Record<string, unknown> = {
					context: {
						client: {
							clientName: WEB_CLIENT_NAME,
							clientVersion: WEB_CLIENT_VERSION,
						},
					},
					engagementType: "ENGAGEMENT_TYPE_UNBOUND",
				};

				if (eacrToken) payload.eacrToken = eacrToken;

				const att_res = await fetch(
					`${YT_BASE}/youtubei/v1/att/get?prettyPrint=false`,
					{
						method: "POST",
						headers: {
							accept: "*/*",
							"content-type": "application/json",
							"user-agent": USER_AGENT,
							"x-goog-api-key": INNERTUBE_API_KEY,
						},
						body: JSON.stringify(payload),
					},
				);

				if (!att_res.ok) throw new Error(`att/get returned ${att_res.status}`);

				const attestation = await att_res.json();

				if (!attestation?.bgChallenge)
					throw new Error("could not get challenge from att/get");

				challenge = { bgChallenge: attestation.bgChallenge };
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
					"x-goog-api-key": INNERTUBE_API_KEY,
					"x-user-agent": "grpc-web-javascript/0.1",
					"user-agent": USER_AGENT,
				},
				body: JSON.stringify([key]),
			});

			if (!waa_res.ok) throw new Error(`WAA Create returned ${waa_res.status}`);

			challenge = parseChallenge(await waa_res.json()) as Record<
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

		const botguardConfig = Configuration.youtube.botguard || {};
		const executionMode = botguardConfig.mode || "auto";
		const timeout = botguardConfig.timeout || 5000;

		let vmGlobalScope: Record<string, unknown> =
			globalThis as unknown as Record<string, unknown>;

		if (executionMode === "direct") {
			new Function(interpreter)();
		} else {
			// Sandboxed node:vm execution with hardened isolation and timeout kill
			const sandbox = Object.assign(globalThis, {
				window: dom.window,
				document: dom.window.document,
				location: dom.window.location,
				origin: dom.window.origin,
				navigator: dom.window.navigator,
				yt: dom.window.yt,
			});

			const context = vm.createContext(sandbox);
			vm.runInContext(interpreter, context, {
				timeout,
				displayErrors: false,
			});

			vmGlobalScope = sandbox as Record<string, unknown>;
		}

		const client = await createVM({
			program: bgChallenge.program as string,
			globalName: bgChallenge.globalName as string,
			globalObject: vmGlobalScope,
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

		const t_txt = await fetch(endpoint, generate_options(INNERTUBE_API_KEY));

		if (!t_txt.ok) throw new Error(`GenerateIT returned ${t_txt.status}`);

		const [
			integrity_token,
			estimated_ttl_secs,
			mint_refresh_threshold,
			websafe_fallback_token,
		] = await t_txt.json();
		const ttl = Number(estimated_ttl_secs);

		expires =
			Date.now() +
			Math.max(1, (Number.isFinite(ttl) && ttl > 0 ? ttl : 300) - 30) * 1000;

		const minter = await Minter.create(
			{
				integrity_token,
				mint_refresh_threshold,
				websafe_fallback_token,
				expiresAt: expires,
			},
			signals,
			client,
			dom,
		);
		minter.expiresAt = expires;

		cur = minter;

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
	ttl: number | null = null,
): Promise<{
	poToken: string;
	contentBinding: string;
	ttl: number;
	minterSession: string | null;
}> {
	const minter = await getWebPo(useYouTubeAPI);
	const minter_expires = minter.expiresAt || expires;
	const token_expires =
		typeof ttl === "number" && Number.isFinite(ttl) && ttl > 0
			? Math.min(minter_expires, Date.now() + ttl)
			: minter_expires;

	return {
		poToken: await minter.mint(contentBinding),
		contentBinding,
		ttl: Math.max(0, Math.floor((token_expires - Date.now()) / 1000)),
		minterSession: minter.integrityTokenData?.integrity_token || null,
	};
}
