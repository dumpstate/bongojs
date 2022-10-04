import Ajv from "ajv/dist/jtd"
import { Pool as PGPool, PoolClient as PGPoolClient } from "pg"

import { DEFAULT_LIMIT, DOCUMENT_TABLE } from "./constants"
import { nextId } from "./ids"
import { DocType } from "./model"
import { Query, whereClause } from "./query"
import { flatten, omit } from "./utils"

export interface DocumentMeta {
	readonly id: string
}

export interface Collection<T> {
	create: (obj: T) => Promise<T & DocumentMeta>
	createAll: (objs: T[]) => Promise<(T & DocumentMeta)[]>
	deleteById: (id: string) => Promise<boolean>
	drop: () => Promise<number>
	find: (
		query: Query<T>,
		limit?: number,
		offset?: number
	) => Promise<(T & DocumentMeta)[]>
	findById: (id: string) => Promise<T>
	findOne: (query: Query<T>) => Promise<(T & DocumentMeta) | null>
	save: (obj: T & DocumentMeta) => Promise<T & DocumentMeta>
}

export interface ExtCollection<T> extends Collection<T> {
	on: (conn: PGPoolClient) => Collection<T>
}

export function collection<S, T>(
	pg: PGPool,
	doctype: DocType<S>
): ExtCollection<T> {
	const ajv = new Ajv()
	const validate = ajv.compile<T>({
		...doctype.schema,
		additionalProperties: false,
	})

	function instance(id: string, obj: T) {
		if (!validate(obj)) {
			throw new Error(`ValidationError: ${JSON.stringify(obj)}`)
		}

		return Object.seal({
			...obj,
			id,
		})
	}

	function exec<T>(fn: (conn: PGPoolClient) => Promise<T>) {
		return async (conn: PGPoolClient | undefined | null) => {
			let nextConn = conn

			if (!nextConn) {
				nextConn = await pg.connect()
			}

			try {
				return await fn(nextConn)
			} finally {
				if (!conn) {
					nextConn.release()
				}
			}
		}
	}

	function find(
		query: Query<T>,
		limit: number = DEFAULT_LIMIT,
		offset: number = 0
	) {
		return exec(async (conn) => {
			const { text, values } = whereClause<T>(query)
			const res = await conn.query(
				`
                    SELECT id, doc
                    FROM ${DOCUMENT_TABLE}
                    WHERE doctype = $${values.length + 1} AND ${text}
                    LIMIT $${values.length + 2}
                    OFFSET $${values.length + 3}
                `,
				values.concat([doctype.name, limit, offset])
			)

			return res.rows.map((row) => instance(row.id, row.doc))
		})
	}

	function findOne(query: Query<T>) {
		return async (conn: PGPoolClient | undefined | null) => {
			const res = await find(query)(conn)

			if (res.length > 1) {
				throw new Error("Too many items found")
			}

			if (res.length === 0) {
				return null
			}

			return res[0] as T & DocumentMeta
		}
	}

	function findById(id: string) {
		return exec(async (conn) => {
			const res = await conn.query(
				`
                    SELECT id, doc
                    FROM ${DOCUMENT_TABLE}
                    WHERE
                        id = $1 AND
                        doctype = $2
                `,
				[id, doctype.name]
			)

			if (res.rowCount > 1) {
				throw new Error("Inconsistent data")
			}

			if (res.rowCount === 0) {
				throw new Error(`Model not found: ${id}`)
			}

			const [obj] = res.rows

			return instance(obj.id, obj.doc)
		})
	}

	function create(obj: T) {
		if (!validate(obj)) {
			throw new Error("ValidationError")
		}

		return save(instance(nextId(doctype), obj))
	}

	function createAll(
		objs: T[]
	): (
		conn: PGPoolClient | null | undefined
	) => Promise<(T & DocumentMeta)[]> {
		return async (conn: PGPoolClient | null | undefined) => {
			let nextConn = conn

			if (!nextConn) {
				nextConn = await pg.connect()
			}

			try {
				if (!conn) {
					await nextConn.query("BEGIN")
				}

				const res = flatten(
					objs.map((obj) =>
						save(instance(nextId(doctype), obj))(nextConn)
					)
				)

				if (!conn) {
					await nextConn.query("COMMIT")
				}

				return res
			} catch (err) {
				if (!conn) {
					await nextConn.query("ROLLBACK")
				}

				throw err
			} finally {
				if (!conn) {
					nextConn.release()
				}
			}
		}
	}

	function deleteById(id: string) {
		return exec(async (conn) => {
			const res = await conn.query(
				`
                    DELETE FROM ${DOCUMENT_TABLE}
                    WHERE id = $1 AND
                          doctype = $2
                `,
				[id, doctype.name]
			)

			return res.rowCount === 1
		})
	}

	function drop() {
		return exec(async (conn) => {
			const res = await conn.query(
				`
                    DELETE FROM ${DOCUMENT_TABLE}
                    WHERE doctype = $1
                `,
				[doctype.name]
			)

			return res.rowCount
		})
	}

	function save(obj: T & DocumentMeta) {
		const doc = omit(obj, ["id", "doctype"])

		if (!validate(doc)) {
			throw new Error("ValidationError")
		}

		return exec(async (conn) => {
			const res = await conn.query(
				`
                    INSERT INTO ${DOCUMENT_TABLE} (id, doctype, doc)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (id, doctype)
                    DO
                        UPDATE SET doc = $3
                `,
				[obj.id, doctype.name, doc]
			)

			if (res.rowCount !== 1) {
				throw new Error(`Inconsistent update, expected one row update`)
			}

			return obj
		})
	}

	function factory(conn: PGPoolClient | undefined | null) {
		return {
			create: (obj: T) => create(obj)(conn),
			createAll: (objs: T[]) => createAll(objs)(conn),
			deleteById: (id: string) => deleteById(id)(conn),
			drop: () => drop()(conn),
			find: (query: any, limit?: number, offset?: number) =>
				find(query, limit, offset)(conn),
			findById: (id: string) => findById(id)(conn),
			findOne: (query: any) => findOne(query)(conn),
			save: (obj: T & DocumentMeta) => save(obj)(conn),
		}
	}

	return {
		...factory(null),
		on: (conn: PGPoolClient) => factory(conn),
	}
}
