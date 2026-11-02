export class Semaphore {
	private _capacity: number;
	private _active = 0;
	private _waiters: Array<() => void> = [];

	constructor(capacity = 1) {
		this._capacity = capacity;
	}

	async acquire(): Promise<() => void> {
		if (this._active < this._capacity) {
			this._active++;
			return this._release.bind(this);
		}
		return new Promise((resolve) => {
			this._waiters.push(() => {
				resolve(this._release.bind(this));
			});
		});
	}

	private _release() {
		const next = this._waiters.shift();
		if (next) {
			next();
		} else {
			this._active--;
		}
	}
}
