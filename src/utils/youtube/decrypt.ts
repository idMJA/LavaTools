import axios from "axios";
import { preprocessPlayer, getFromPrepared } from "#kiyomi/utils";
import type {
	SignatureRequest,
	SignatureResponse,
	Solvers,
} from "#kiyomi/types";

const playerCache = new Map<string, string>();
const preprocessedCache = new Map<string, string>();
const solverCache = new Map<string, Solvers>();

async function fetchPlayerFile(playerUrl: string): Promise<string> {
	if (playerCache.has(playerUrl)) {
		const cached = playerCache.get(playerUrl);
		if (cached !== undefined) return cached;
	}

	try {
		const response = await axios.get(playerUrl, { responseType: "text" });
		const playerContent = response.data;
		playerCache.set(playerUrl, playerContent);
		return playerContent;
	} catch (error) {
		throw new Error(
			`Error fetching player file: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

export async function decryptSignature(
	request: SignatureRequest,
): Promise<SignatureResponse> {
	const { encrypted_signature, n_param, player_url } = request;

	let solvers = solverCache.get(player_url);

	if (!solvers) {
		let preprocessedPlayer = preprocessedCache.get(player_url);

		if (!preprocessedPlayer) {
			const rawPlayer = await fetchPlayerFile(player_url);
			preprocessedPlayer = preprocessPlayer(rawPlayer);
			preprocessedCache.set(player_url, preprocessedPlayer);
		}

		solvers = getFromPrepared(preprocessedPlayer);
		solverCache.set(player_url, solvers);
	}

	let decrypted_signature = "";
	if (encrypted_signature && solvers.sig) {
		decrypted_signature = solvers.sig(encrypted_signature);
	}

	let decrypted_n_sig = "";
	if (n_param && solvers.n) {
		decrypted_n_sig = solvers.n(n_param);
	}

	return {
		decrypted_signature,
		decrypted_n_sig,
	};
}
