import { JTDDataType } from "ajv/dist/jtd"
import {
	Pool as PGPool,
	PoolClient as PGPoolClient,
	PoolConfig as PGPoolConfig,
} from "pg"

import { collection } from "./collection"
import { Logger, newLogger } from "./logger"
import { DocType } from "./model"
import { migrateDown, migrateUp } from "./schema"
import { Transactor } from "./Transactor"

function isPGPool(obj: any): obj is PGPool {
	return obj && obj instanceof PGPool
}

export class Bongo {
	public pg: PGPool
	public tx: Transactor
	private logger: Logger

	private registry: Map<string, DocType<any>> = new Map()
	private idPrefixes: Set<string> = new Set()

	constructor(pgPoolOrConfig?: PGPool | PGPoolConfig, logger?: Logger) {
		if (logger) {
			this.logger = logger
		} else {
			this.logger = newLogger({
				name: "Bongo",
				level: "info",
			})
		}

		if (isPGPool(pgPoolOrConfig)) {
			this.pg = pgPoolOrConfig
		} else {
			this.pg = new PGPool(pgPoolOrConfig)

			process.on("SIGTERM", () => {
				this.pg.end().catch((err) => {
					this.logger.error("Error during the shutdown", err)
					process.exit(1)
				})
			})
		}

		this.tx = new Transactor(this.pg)
	}

	public collection<S>(doctype: DocType<S>) {
		if (this.registry.has(doctype.name)) {
			throw new Error(`DocType ${doctype.name} already registered`)
		}

		if (doctype.prefix) {
			if (doctype.prefix.length > 3) {
				throw new Error(
					`Id prefix cannot be longer than 3 characters: ${doctype.prefix}`
				)
			}

			if (this.idPrefixes.has(doctype.prefix)) {
				throw new Error(`Prefix: ${doctype.prefix} already registered`)
			}

			this.idPrefixes.add(doctype.prefix)
		}

		this.registry.set(doctype.name, doctype)

		const { schema } = doctype
		type DataType = JTDDataType<typeof schema>

		return collection<S, DataType>(doctype)
	}

	public async migrate() {
		if (this.registry.size === 0) {
			this.logger.warn("No doctypes registered when migrating")
		}

		await migrateUp(
			this.logger,
			this.pg,
			Array.from(this.registry.values())
		)
	}

	public async drop() {
		await migrateDown(this.logger, this.pg)
	}

	public async close() {
		return this.pg.end()
	}

	public async transaction<T>(cbk: (txClient: PGPoolClient) => Promise<T>) {
		const conn = await this.pg.connect()

		try {
			await conn.query("BEGIN")

			const res = await cbk(conn)

			await conn.query("COMMIT")

			return res
		} catch (err) {
			await conn.query("ROLLBACK")

			throw err
		} finally {
			conn.release()
		}
	}
}
