import { DOCUMENT_TABLE } from "./constants"

export interface DocumentMeta {
	readonly id: string
}

export type Document<T> = T & DocumentMeta & UnsafeGetters<T>

type IsNullable<k extends keyof T, T> = null extends T[k] ? k : never

type NullableOnly<T> = {
	[k in keyof T as IsNullable<k, T>]: T[k]
}

export type UnsafeGetters<T> = {
	readonly [k in keyof NullableOnly<T> & string as `${k}$`]: NonNullable<T[k]>
}

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
	| {
			discriminator: string
			mapping: Record<string, SchemaDefinitionValueType>
	  }
	| { ref: DocType<any> }

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
	: S extends { elements: infer E }
	? SchemaType<E>[]
	: S extends { values: infer E }
	? Record<ValidKey, SchemaType<E>>
	: S extends { properties: infer E extends SchemaTypeDef }
	? SchemaType<E>
	: S extends { discriminator: infer E; mapping: Record<string, unknown> }
	? [E] extends [string]
		? {
				[K in keyof S["mapping"]]: SchemaType<S["mapping"][K]> & {
					[KE in E]: K
				}
		  }[keyof S["mapping"]]
		: never
	: S extends { ref: DocType<infer E extends SchemaTypeDef> }
	? SchemaType<E> & DocumentMeta
	: S extends SchemaTypeDef
	? {
			-readonly [k in keyof S]+?: k extends ValidKey
				? SchemaType<S[k]> | null
				: never
	  }
	: unknown

export interface DocType<T extends SchemaTypeDef> {
	readonly name: string
	readonly prefix?: string
	readonly schema: T
}

export type Schema<D> = D extends DocType<infer S extends SchemaTypeDef>
	? SchemaType<S>
	: never

export function partitionName(doctype: DocType<any>) {
	let suffix = (doctype.prefix ? doctype.prefix : doctype.name)
		.toLowerCase()
		.replace(/[^a-z]/g, "")

	return `${DOCUMENT_TABLE}_${suffix}`
}

export function nested<T>(doc: Document<T>): Omit<Document<T>, "id"> {
	const { id, ...rest } = doc
	return rest
}
