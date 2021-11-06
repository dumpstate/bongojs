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

export function flatten<T>(prms: Promise<T>[]): Promise<T[]> {
	return prms.reduce(
		(acc, promise) =>
			acc.then((res: T[]) =>
				promise.then((partial: T) => res.concat([partial]))
			),
		Promise.resolve([] as T[])
	)
}
