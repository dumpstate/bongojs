import Ajv from "ajv/dist/jtd"
import { PoolClient as PGPoolClient } from "pg"

import { DEFAULT_LIMIT } from "./constants"
import { DBAction, flatten } from "./DBAction"
import { nextId } from "./ids"
import {
	Document,
	DocumentMeta,
	DocType,
	partitionName,
	SchemaTypeDef,
} from "./model"
import { Query, whereClause } from "./query"
import { omit } from "./utils"

export interface Collection<T> {
	create: (obj: T) => DBAction<Document<T>>
	createAll: (objs: T[]) => DBAction<Document<T>[]>
	deleteById: (id: string) => DBAction<boolean>
	drop: () => DBAction<number>
	find: (
		query: Query<T>,
		limit?: number,
		offset?: number
	) => DBAction<Document<T>[]>
	findById: (id: string) => DBAction<Document<T>>
	findOne: (query: Query<T>) => DBAction<Document<T> | null>
	save: (obj: T & DocumentMeta) => DBAction<Document<T>>
}

export function collection<S extends SchemaTypeDef, T>(
	doctype: DocType<S>
): Collection<T> {
	const ajv = new Ajv()
	const validate = ajv.compile({
		optionalProperties: doctype.schema,
		additionalProperties: false,
	})
	const partition = partitionName(doctype)
	const defaultOptionalProps = Object.keys(doctype.schema).reduce(
		(acc: any, next) => {
			acc[next] = undefined
			return acc
		},
		{}
	)
	const unsafeGetters = Object.keys(doctype.schema).reduce(
		(acc: any, next) => {
			acc[`${next}$`] = {
				get() {
					const val = this[next]

					if (val === undefined || val === null) {
						throw Error(
							`expected '${next}' to be deinfed and not null`
						)
					}

					return val
				},
			}
			return acc
		},
		{}
	)

	function withUnsafeGetters(obj: T & DocumentMeta): Document<T> {
		return Object.defineProperties(obj, unsafeGetters) as Document<T>
	}

	function instance(id: string, obj: T): Document<T> {
		const doc = omit(obj, ["id", "doctype"])

		if (!validate(doc)) {
			throw new Error(`ValidationError: ${JSON.stringify(doc)}`)
		}

		return Object.seal(
			withUnsafeGetters({
				...defaultOptionalProps,
				...(doc as any),
				id,
			})
		)
	}

	function find(
		query: Query<T>,
		limit: number = DEFAULT_LIMIT,
		offset: number = 0
	): DBAction<Document<T>[]> {
		const { text, values } = whereClause<T>(query)

		return new DBAction(async (conn: PGPoolClient) => {
			const res = await conn.query(
				`
					SELECT id, doc
					FROM ${partition}
					WHERE doctype = $${values.length + 1} AND ${text}
					LIMIT $${values.length + 2}
					OFFSET $${values.length + 3}
				`,
				values.concat([doctype.name, limit, offset])
			)

			return res.rows.map((row) => instance(row.id, row.doc))
		})
	}

	function findOne(query: Query<T>): DBAction<Document<T> | null> {
		return find(query).map((items) => {
			if (items.length > 1) {
				throw new Error("too many items found")
			}

			if (items.length === 0) {
				return null
			}

			return items[0] as Document<T>
		})
	}

	function findById(id: string) {
		return new DBAction(async (conn: PGPoolClient) => {
			const res = await conn.query(
				`
					SELECT id, doc
					FROM ${partition}
					WHERE
						id = $1 AND
						doctype = $2
				`,
				[id, doctype.name]
			)

			if (res.rowCount > 1) {
				throw new Error("inconsistent data")
			}

			if (res.rowCount === 0) {
				throw new Error(`model not found: ${id}`)
			}

			const [obj] = res.rows

			return instance(obj.id, obj.doc)
		})
	}

	function create(obj: T): DBAction<Document<T>> {
		if (!validate(obj)) {
			throw new Error("ValidationError")
		}

		return save(instance(nextId(doctype), obj))
	}

	function createAll(objs: T[]): DBAction<Document<T>[]> {
		return flatten(objs.map((obj) => save(instance(nextId(doctype), obj))))
	}

	function deleteById(id: string): DBAction<boolean> {
		return new DBAction(async (conn: PGPoolClient) => {
			const res = await conn.query(
				`
					DELETE FROM ${partition}
					WHERE id = $1 AND
					      doctype = $2
				`,
				[id, doctype.name]
			)

			return res.rowCount === 1
		})
	}

	function drop(): DBAction<number> {
		return new DBAction(async (conn: PGPoolClient) => {
			const res = await conn.query(`DELETE FROM ${partition}`, [])

			return res.rowCount
		})
	}

	function save(obj: T & DocumentMeta): DBAction<Document<T>> {
		const doc = omit(obj, ["id", "doctype"])

		if (!validate(doc)) {
			throw new Error("ValidationError")
		}

		return new DBAction(async (conn: PGPoolClient) => {
			const res = await conn.query(
				`
					INSERT INTO ${partition} (id, doctype, doc)
					VALUES ($1, $2, $3)
					ON CONFLICT (id, doctype)
					DO
						UPDATE SET doc = $3
				`,
				[obj.id, doctype.name, doc]
			)

			if (res.rowCount !== 1) {
				throw new Error("inconsistent update, expected one row update")
			}

			return instance(obj.id, obj)
		})
	}

	return {
		create,
		createAll,
		deleteById,
		drop,
		find,
		findById,
		findOne,
		save,
	}
}
