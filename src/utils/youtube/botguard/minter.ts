import type { JSDOM } from "jsdom";
import type { IntegrityTokenData } from "#kiyomi/types";
import { toBase64, toUint8 } from "#kiyomi/utils";
import type { BotGuardVMClient } from "./solver";

export class Minter {
	private callback: (data: Uint8Array) => Promise<Uint8Array>;
	private client: BotGuardVMClient;
	private dom: JSDOM;
	public integrityTokenData?: IntegrityTokenData;
	public expiresAt = 0;
	public mintThreshold = 100;
	public mintCount = 0;
	private active = 0;
	private retired = false;
	private closed = false;

	constructor(
		callback: (data: Uint8Array) => Promise<Uint8Array>,
		client: BotGuardVMClient,
		dom: JSDOM,
		iTdata?: IntegrityTokenData,
	) {
		this.callback = callback;
		this.client = client;
		this.dom = dom;
		this.integrityTokenData = iTdata;
		this.expiresAt = iTdata?.expiresAt || 0;
		const threshold = Number(
			iTdata?.mint_refresh_threshold ?? iTdata?.mintRefreshThreshold,
		);
		this.mintThreshold =
			Number.isFinite(threshold) && threshold > 0 ? threshold : 100;
	}

	isExhausted(): boolean {
		return this.mintThreshold > 0 && this.mintCount >= this.mintThreshold;
	}

	static async create(
		integrityToken: IntegrityTokenData,
		webPoSignalOutput: unknown[],
		client: BotGuardVMClient,
		dom: JSDOM,
	): Promise<Minter> {
		const getMinter = webPoSignalOutput[0] as
			| ((
					token: Uint8Array,
			  ) => Promise<(data: Uint8Array) => Promise<Uint8Array>>)
			| undefined;

		if (!getMinter || !integrityToken.integrity_token) {
			throw new Error("Could not create WebPO minter");
		}

		const callback = await getMinter(toUint8(integrityToken.integrity_token));

		if (typeof callback !== "function") {
			throw new Error("WebPO minter unavailable");
		}

		return new Minter(callback, client, dom, integrityToken);
	}

	retire(): void {
		this.retired = true;
		this.closeIdles();
	}

	private closeIdles(): void {
		if (!this.retired || this.active > 0 || this.closed) return;

		this.closed = true;
		if (typeof this.dom?.window?.close === "function") {
			try {
				this.dom.window.close();
			} catch {}

			try {
				const glob = globalThis as unknown as Record<string, unknown>;
				if (glob.window === this.dom.window) {
					for (const property of [
						"window",
						"document",
						"location",
						"origin",
						"yt",
					]) {
						try {
							delete glob[property];
						} catch {
							glob[property] = undefined;
						}
					}
				}
			} catch {}
		}

		Promise.resolve(this.client?.shutdown?.()).catch(() => {});
	}

	async mint(contentBinding: string): Promise<string> {
		this.active++;
		this.mintCount++;

		try {
			return toBase64(
				await this.callback(new TextEncoder().encode(contentBinding)),
				true,
			);
		} finally {
			this.active--;
			this.closeIdles();
		}
	}
}
