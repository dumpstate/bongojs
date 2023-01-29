export function omit(obj: any, keys: string[]) {
	let target: any = {}

	for (let key of Object.keys(obj)) {
		if (keys.indexOf(key) >= 0) {
			continue
		}

		target[key] = obj[key]
	}

	return target
}

export function isPromise<T>(value: any): value is Promise<T> {
	return !!value && typeof value.then === "function"
}

export function isFunction<T>(value: any): value is () => Promise<T> {
	return typeof value === "function"
}
