import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { Configuration } from "#kiyomi/config";
import { logs } from "#kiyomi/utils";

interface WorkerTask {
	id: number;
	contentBinding: string;
	ttl: number | null;
	resolve: (value: unknown) => void;
	reject: (reason: unknown) => void;
	timer?: ReturnType<typeof setTimeout>;
}

interface WorkerInstance {
	worker: Worker;
	busy: boolean;
	task?: WorkerTask;
}

class BotGuardWorkerPool {
	private workers: WorkerInstance[] = [];
	private queue: WorkerTask[] = [];
	private taskIdCounter = 0;
	private workerCount: number;
	private queueSize: number;
	private timeout: number;
	private workerPath: string;
	private stopped = false;

	constructor() {
		const bgConfig = Configuration.youtube.botguard || {};
		this.workerCount = Math.max(1, bgConfig.workers || 1);
		this.queueSize = Math.max(1, bgConfig.queueSize || 32);
		this.timeout = bgConfig.timeout || 15000;
		this.workerPath = join(import.meta.dir, "worker.ts");

		this.init();
	}

	private init() {
		for (let i = 0; i < this.workerCount; i++) {
			this.spawnWorker();
		}
	}

	private spawnWorker() {
		const worker = new Worker(this.workerPath);
		const instance: WorkerInstance = {
			worker,
			busy: false,
		};

		worker.on(
			"message",
			(msg: {
				id: number;
				success: boolean;
				data?: unknown;
				error?: string;
			}) => {
				if (!instance.task || instance.task.id !== msg.id) return;

				const task = instance.task;
				instance.task = undefined;
				instance.busy = false;

				if (task.timer) clearTimeout(task.timer);

				if (msg.success) {
					task.resolve(msg.data);
				} else {
					task.reject(new Error(msg.error || "Generation failed"));
				}

				this.dispatch();
			},
		);

		worker.on("error", (err) => {
			logs("error", "BotGuard worker error:", err);
			this.handleWorkerFailure(instance, err);
		});

		worker.on("exit", (code) => {
			if (code !== 0 && !this.stopped) {
				this.handleWorkerFailure(
					instance,
					new Error(`Worker exited with code ${code}`),
				);
			}
		});

		this.workers.push(instance);
	}

	private handleWorkerFailure(instance: WorkerInstance, error: Error) {
		if (instance.task) {
			if (instance.task.timer) clearTimeout(instance.task.timer);
			instance.task.reject(error);
			instance.task = undefined;
		}

		const index = this.workers.indexOf(instance);
		if (index !== -1) {
			this.workers.splice(index, 1);
		}

		if (!this.stopped) {
			this.spawnWorker();
			this.dispatch();
		}
	}

	private dispatch() {
		for (const instance of this.workers) {
			if (instance.busy || this.queue.length === 0) continue;

			const task = this.queue.shift();
			if (!task) continue;

			instance.busy = true;
			instance.task = task;

			task.timer = setTimeout(() => {
				instance.worker.terminate();
				this.handleWorkerFailure(
					instance,
					new Error("BotGuard worker generation timed out"),
				);
			}, this.timeout);

			instance.worker.postMessage({
				id: task.id,
				contentBinding: task.contentBinding,
				ttl: task.ttl,
			});
		}
	}

	run<T = unknown>(contentBinding: string, ttl: number | null): Promise<T> {
		if (this.stopped) {
			return Promise.reject(new Error("BotGuard worker pool is stopped"));
		}

		if (
			this.queue.length >= this.queueSize &&
			!this.workers.some((w) => !w.busy)
		) {
			return Promise.reject(new Error("BotGuard generation queue is full"));
		}

		return new Promise((resolve, reject) => {
			const task: WorkerTask = {
				id: ++this.taskIdCounter,
				contentBinding,
				ttl,
				resolve: resolve as (val: unknown) => void,
				reject,
			};

			this.queue.push(task);
			this.dispatch();
		});
	}

	async close() {
		this.stopped = true;
		for (const task of this.queue.splice(0)) {
			task.reject(new Error("Worker pool is stopping"));
		}
		await Promise.all(this.workers.map((w) => w.worker.terminate()));
	}
}

let poolInstance: BotGuardWorkerPool | null = null;

export function getWorkerPool(): BotGuardWorkerPool {
	if (!poolInstance) {
		poolInstance = new BotGuardWorkerPool();
	}
	return poolInstance;
}
