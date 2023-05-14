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

export function deepEquals(obj1: any, obj2: any): boolean {
	if (typeof obj1 !== typeof obj2) {
		return false
	}

	if (Object.keys(obj1).length !== Object.keys(obj2).length) {
		return false
	}

	for (const key in obj1) {
		const v1 = obj1[key]
		const v2 = obj2[key]

		if (
			(v1 instanceof Object && !deepEquals(v1, v2)) ||
			(!(v1 instanceof Object) && v1 !== v2)
		) {
			return false
		}
	}

	return true
}
