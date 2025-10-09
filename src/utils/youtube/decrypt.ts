import { getSolvers } from "#kiyomi/utils";
import type { SignatureRequest, SignatureResponse } from "#kiyomi/types";

export async function decryptSignature(
	request: SignatureRequest,
): Promise<SignatureResponse> {
	const { encrypted_signature, n_param, player_url } = request;

	const solvers = await getSolvers(player_url);

	if (!solvers) {
		throw new Error("Failed to generate solvers from player script");
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
