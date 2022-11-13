import { DOCUMENT_TABLE } from "./constants"

export type NumberType =
	| "int8"
	| "uint8"
	| "int16"
	| "uint16"
	| "int32"
	| "uint32"
	| "float32"
	| "float64"

export type SchemaDefinitionValueType =
	| { type: NumberType | "string" | "timestamp" | "boolean" }
	| { enum: readonly string[] }
	| { elements: SchemaDefinitionValueType }
	| { values: SchemaDefinitionValueType }
	| { properties: Record<string, SchemaDefinitionValueType> }

export type ValidKey = Exclude<string, "id">

export type SchemaTypeDef = Record<ValidKey, SchemaDefinitionValueType>

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
	: S extends { elements: infer E extends SchemaDefinitionValueType }
	? SchemaType<E>[]
	: S extends { values: infer E extends SchemaDefinitionValueType }
	? Record<ValidKey, SchemaType<E>>
	: S extends { properties: infer E extends SchemaTypeDef }
	? SchemaType<E>
	: S extends SchemaTypeDef
	? {
			-readonly [k in keyof S]+?: k extends ValidKey
				? SchemaType<S[k]> | null
				: never
	  }
	: never

export interface DocType<T extends SchemaTypeDef> {
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
