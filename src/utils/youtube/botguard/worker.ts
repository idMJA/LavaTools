import { parentPort } from "node:worker_threads";
import { fetch_pot } from "./solver";

if (!parentPort) {
	throw new Error("BotGuard worker must be run as a worker thread");
}

parentPort.on(
	"message",
	async (msg: { id: number; contentBinding: string; ttl: number | null }) => {
		try {
			const result = await fetch_pot(msg.contentBinding, true, msg.ttl);
			parentPort?.postMessage({
				id: msg.id,
				success: true,
				data: result,
			});
		} catch (error) {
			parentPort?.postMessage({
				id: msg.id,
				success: false,
				error: (error as Error).message || "BotGuard generation failed",
			});
		}
	},
);
