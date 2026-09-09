import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Configuration } from "#kiyomi/config";
import { getPlayerScript, PlayerScript, PlayerVariant } from "#kiyomi/utils";

const TEST_PLAYER_ID = "2574220e";

describe("PlayerScript", () => {
	let originalConfigVariant: string | null | undefined;
	let originalConfigId: string | null | undefined;

	beforeEach(() => {
		originalConfigVariant = Configuration.youtube?.overridePlayerVariant;
		originalConfigId = Configuration.youtube?.overridePlayerId;
	});

	afterEach(() => {
		if (Configuration.youtube) {
			Configuration.youtube.overridePlayerVariant = originalConfigVariant;
			Configuration.youtube.overridePlayerId = originalConfigId;
		}
	});

	it("parses IAS player URL", () => {
		const script = PlayerScript.fromUrl(
			`https://www.youtube.com/s/player/${TEST_PLAYER_ID}/player_ias.vflset/en_US/base.js`,
		);

		expect(script.id).toBe(TEST_PLAYER_ID);
		expect(script.variant).toBe(PlayerVariant.IAS);
		expect(script.region).toBe("en_US");
		expect(script.toUrl()).toBe(
			`https://www.youtube.com/s/player/${TEST_PLAYER_ID}/player_ias.vflset/en_US/base.js`,
		);
	});

	it("parses PHONE variant", () => {
		const script = PlayerScript.fromUrl(
			`https://www.youtube.com/s/player/${TEST_PLAYER_ID}/player-plasma-ias-phone-en_US.vflset/base.js`,
		);

		expect(script.variant).toBe(PlayerVariant.PHONE);
		expect(script.region).toBe("en_US");
		expect(script.toUrl()).toBe(
			`https://www.youtube.com/s/player/${TEST_PLAYER_ID}/player-plasma-ias-phone-en_US.vflset/base.js`,
		);
	});

	it("parses region-less TV variant", () => {
		const script = PlayerScript.fromUrl(
			`https://www.youtube.com/s/player/${TEST_PLAYER_ID}/tv-player-ias.vflset/tv-player-ias.js`,
		);

		expect(script.variant).toBe(PlayerVariant.TV);
		expect(script.region).toBeNull();
		expect(script.toUrl()).toBe(
			`https://www.youtube.com/s/player/${TEST_PLAYER_ID}/tv-player-ias.vflset/tv-player-ias.js`,
		);
	});

	it("parses relative player URL path", () => {
		const script = PlayerScript.fromUrl(
			`/s/player/${TEST_PLAYER_ID}/player_es6.vflset/id_ID/base.js`,
		);

		expect(script.variant).toBe(PlayerVariant.ES6);
		expect(script.region).toBe("id_ID");
	});

	it("applies config overrides in getPlayerScript", () => {
		if (Configuration.youtube) {
			Configuration.youtube.overridePlayerVariant = "TV";
			Configuration.youtube.overridePlayerId = "aaaa1111";
		}

		let script = getPlayerScript(
			`https://www.youtube.com/s/player/${TEST_PLAYER_ID}/player_ias.vflset/en_US/base.js`,
		);
		expect(script.id).toBe("aaaa1111");
		expect(script.variant).toBe(PlayerVariant.TV);

		if (Configuration.youtube) {
			Configuration.youtube.overridePlayerVariant = "ES5";
			Configuration.youtube.overridePlayerId = "wxyz5678";
		}

		script = getPlayerScript(
			`https://www.youtube.com/s/player/${TEST_PLAYER_ID}/player_ias.vflset/en_US/base.js`,
		);

		expect(script.id).toBe("wxyz5678");
		expect(script.variant).toBe(PlayerVariant.ES5);
	});

	it("defaults to IAS for unknown variant URL", () => {
		const script = PlayerScript.fromUrl(
			`https://www.youtube.com/s/player/${TEST_PLAYER_ID}/unknown-player-path/base.js`,
		);

		expect(script.variant).toBe(PlayerVariant.IAS);
	});
});
