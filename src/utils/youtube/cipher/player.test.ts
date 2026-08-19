import { afterEach, describe, expect, it } from "bun:test";

const TEST_PLAYER_ID = "44899b31";

describe("PlayerScript", () => {
	afterEach(() => {
		delete process.env.OVERRIDE_PLAYER_ID;
		delete process.env.OVERRIDE_PLAYER_VARIANT;
	});

	it("parses IAS player URL", async () => {
		const { PlayerScript, PlayerVariant } = await import("./player");

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

	it("parses PHONE variant", async () => {
		const { PlayerScript, PlayerVariant } = await import("./player");

		const script = PlayerScript.fromUrl(
			`https://www.youtube.com/s/player/${TEST_PLAYER_ID}/player-plasma-ias-phone-en_US.vflset/base.js`,
		);

		expect(script.variant).toBe(PlayerVariant.PHONE);
		expect(script.region).toBe("en_US");
		expect(script.toUrl()).toBe(
			`https://www.youtube.com/s/player/${TEST_PLAYER_ID}/player-plasma-ias-phone-en_US.vflset/base.js`,
		);
	});

	it("parses region-less TV variant", async () => {
		const { PlayerScript, PlayerVariant } = await import("./player");

		const script = PlayerScript.fromUrl(
			`https://www.youtube.com/s/player/${TEST_PLAYER_ID}/tv-player-ias.vflset/tv-player-ias.js`,
		);

		expect(script.variant).toBe(PlayerVariant.TV);
		expect(script.region).toBeNull();
		expect(script.toUrl()).toBe(
			`https://www.youtube.com/s/player/${TEST_PLAYER_ID}/tv-player-ias.vflset/tv-player-ias.js`,
		);
	});

	it("parses relative player URL path", async () => {
		const { PlayerScript, PlayerVariant } = await import("./player");

		const script = PlayerScript.fromUrl(
			`/s/player/${TEST_PLAYER_ID}/player_es6.vflset/id_ID/base.js`,
		);

		expect(script.variant).toBe(PlayerVariant.ES6);
		expect(script.region).toBe("id_ID");
	});

	it("applies env overrides in getPlayerScript", async () => {
		process.env.OVERRIDE_PLAYER_ID = "wxyz5678";
		process.env.OVERRIDE_PLAYER_VARIANT = "ES5";

		const { getPlayerScript, PlayerVariant } = await import(
			`./player?override-${Date.now()}`
		);

		const script = getPlayerScript(
			`https://www.youtube.com/s/player/${TEST_PLAYER_ID}/player_ias.vflset/en_US/base.js`,
		);

		expect(script.id).toBe("wxyz5678");
		expect(script.variant).toBe(PlayerVariant.ES5);
	});

	it("defaults to IAS for unknown variant URL", async () => {
		const { PlayerScript, PlayerVariant } = await import("./player");

		const script = PlayerScript.fromUrl(
			`https://www.youtube.com/s/player/${TEST_PLAYER_ID}/unknown-player-path/base.js`,
		);

		expect(script.variant).toBe(PlayerVariant.IAS);
	});
});
