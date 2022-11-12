import { DOCUMENT_TABLE } from "./constants"

type NumberType =
	| "int8"
	| "uint8"
	| "int16"
	| "uint16"
	| "int32"
	| "uint32"
	| "float32"
	| "float64"

export type SchemaType<S> = S extends { type: NumberType }
	? number
	: S extends { type: "boolean" }
	? boolean
	: S extends { type: "string" }
	? string
	: S extends { type: "timestamp" }
	? string | Date
	: S extends { enum: readonly (infer E)[] }
	? string extends E
		? never
		: [E] extends [string]
		? E
		: never
	: S extends { elements: infer E }
	? SchemaType<E>[]
	: S extends { values: infer E }
	? Record<string, SchemaType<E>>
	: { -readonly [k in keyof S]+?: SchemaType<S[k]> | null }

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
