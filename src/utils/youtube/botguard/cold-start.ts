import type { DecodedColdStartToken } from "#kiyomi/types";
import { COLD_START_MAX_BINDING_BYTES, toBase64, toUint8 } from "#kiyomi/utils";

export function createColdToken(
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

	return toBase64(packet, true);
}

export function decodeColdToken(token: string): DecodedColdStartToken {
	const packet = toUint8(token);

	const p0 = packet[0];
	if (packet.length < 10 || p0 !== 34) {
		throw new Error("invalid cold start token");
	}

	const length = packet[1];
	if (length === undefined || packet.length !== length + 2 || length < 8) {
		throw new Error("invalid cold start packet length");
	}

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
