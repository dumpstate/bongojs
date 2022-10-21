import Ajv from "ajv/dist/jtd"
import { Pool as PGPool, PoolClient as PGPoolClient } from "pg"

import { DEFAULT_LIMIT } from "./constants"
import { DBAction } from "./DBAction"
import { nextId } from "./ids"
import { DocType, partitionName } from "./model"
import { Query, whereClause } from "./query"
import { flatten, omit } from "./utils"

export interface DocumentMeta {
	readonly id: string
}

export interface Collection<T> {
	create: (obj: T) => DBAction<T & DocumentMeta>
	createAll: (objs: T[]) => DBAction<(T & DocumentMeta)[]>
	deleteById: (id: string) => DBAction<boolean>
	drop: () => DBAction<number>
	find: (
		query: Query<T>,
		limit?: number,
		offset?: number
	) => DBAction<(T & DocumentMeta)[]>
	findById: (id: string) => DBAction<T>
	findOne: (query: Query<T>) => DBAction<(T & DocumentMeta) | null>
	save: (obj: T & DocumentMeta) => DBAction<T & DocumentMeta>
}

export function collection<S, T>(
	pg: PGPool,
	doctype: DocType<S>
): Collection<T> {
	const ajv = new Ajv()
	const validate = ajv.compile<T>({
		...doctype.schema,
		additionalProperties: false,
	})
	const partition = partitionName(doctype)

	function instance(id: string, obj: T) {
		if (!validate(obj)) {
			throw new Error(`ValidationError: ${JSON.stringify(obj)}`)
		}

		return Object.seal({
			...obj,
			id,
		})
	}

	function find(
		query: Query<T>,
		limit: number = DEFAULT_LIMIT,
		offset: number = 0
	): DBAction<(T & DocumentMeta)[]> {
		const { text, values } = whereClause<T>(query)

		return new DBAction(pg, async (conn: PGPoolClient) => {
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

	function findOne(query: Query<T>): DBAction<(T & DocumentMeta) | null> {
		return find(query).map((items) => {
			if (items.length > 1) {
				throw new Error("too many items found")
			}

			if (items.length === 0) {
				return null
			}

			return items[0] as T & DocumentMeta
		})
	}

	function findById(id: string) {
		return new DBAction(pg, async (conn: PGPoolClient) => {
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

	function create(obj: T): DBAction<T & DocumentMeta> {
		if (!validate(obj)) {
			throw new Error("ValidationError")
		}

		return save(instance(nextId(doctype), obj))
	}

	function createAll(objs: T[]): DBAction<(T & DocumentMeta)[]> {
		return new DBAction(pg, async (conn: PGPoolClient) =>
			flatten(
				objs.map((obj) =>
					save(instance(nextId(doctype), obj)).run(conn)
				)
			)
		)
	}

	function deleteById(id: string): DBAction<boolean> {
		return new DBAction(pg, async (conn: PGPoolClient) => {
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
		return new DBAction(pg, async (conn: PGPoolClient) => {
			const res = await conn.query(`DELETE FROM ${partition}`, [])

			return res.rowCount
		})
	}

	function save(obj: T & DocumentMeta): DBAction<T & DocumentMeta> {
		const doc = omit(obj, ["id", "doctype"])

		if (!validate(doc)) {
			throw new Error("ValidationError")
		}

		return new DBAction(pg, async (conn: PGPoolClient) => {
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

			return obj
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
