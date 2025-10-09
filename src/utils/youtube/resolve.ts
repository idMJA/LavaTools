import { getSolvers } from "#kiyomi/utils";
import type { ResolveUrlRequest, ResolveUrlResponse } from "#kiyomi/types";

export async function resolveUrl(
	request: ResolveUrlRequest,
): Promise<ResolveUrlResponse> {
	const {
		stream_url,
		player_url,
		encrypted_signature,
		signature_key,
		n_param: nParamFromRequest,
	} = request;

	const solvers = await getSolvers(player_url);

	if (!solvers) {
		throw new Error("Failed to generate solvers from player script");
	}

	const url = new URL(stream_url);

	if (encrypted_signature) {
		if (!solvers.sig) {
			throw new Error("No signature solver found for this player");
		}
		const decryptedSig = solvers.sig(encrypted_signature);
		const sigKey = signature_key || "sig";
		url.searchParams.set(sigKey, decryptedSig);
		url.searchParams.delete("s");
	}

	let nParam = nParamFromRequest || null;
	if (!nParam) {
		nParam = url.searchParams.get("n");
	}

	if (solvers.n) {
		if (!nParam) {
			throw new Error("n_param not found in request or stream_url");
		}
		const decryptedN = solvers.n(nParam);
		url.searchParams.set("n", decryptedN);
	}

	const response: ResolveUrlResponse = {
		resolved_url: url.toString(),
	};

	return response;
}
