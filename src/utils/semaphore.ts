export class Semaphore {
	private _locked = false;
	private _waiters: Array<(release: () => void) => void> = [];

	async acquire(): Promise<() => void> {
		if (this._locked) {
			return new Promise((resolve) => {
				this._waiters.push(resolve);
			});
		}
		this._locked = true;
		return this._release.bind(this);
	}

	private _release() {
		const waiter = this._waiters.shift();
		if (waiter) {
			waiter(this._release.bind(this));
		} else {
			this._locked = false;
		}
	}
}
