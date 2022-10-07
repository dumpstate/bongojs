import { DOCUMENT_TABLE } from "./constants"

export interface DocType<T> {
	readonly name: string
	readonly prefix?: string
	readonly schema: T
}

export function partitionName(doctype: DocType<any>) {
	let suffix = (doctype.prefix ? doctype.prefix : doctype.name)
		.toLowerCase()
		.replace(/[^a-z]/g, "")

	return `${DOCUMENT_TABLE}_${suffix}`
}
