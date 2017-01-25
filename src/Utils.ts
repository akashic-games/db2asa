export class Logger {
	log: (...args: any[]) => void;

	constructor(isEnabled: boolean) {
		if (isEnabled) {
			this.log = (...args: any[]) => {
				console.log.apply(console, args);
			};
		} else {
			this.log = (...args: any[]) => { /* nothing to do */ };
		}
	}
}
