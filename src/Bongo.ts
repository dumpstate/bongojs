import { Pool as PGPool, PoolConfig as PGPoolConfig } from "pg"

import { collection } from "./collection"
import { Logger, newLogger } from "./logger"
import { DocType, SchemaType, SchemaTypeDef } from "./model"
import { migrateDown, migrateUp } from "./schema"
import { ConnectionProvider } from "./ConnectionProvider"

function isPGPool(obj: any): obj is PGPool {
	return obj && obj instanceof PGPool
}

export class Bongo {
	public pg: PGPool
	public cp: ConnectionProvider
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

		this.cp = new ConnectionProvider(this.pg)
	}

	public collection<S extends SchemaTypeDef>(doctype: DocType<S>) {
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
		type DataType = SchemaType<typeof schema>

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
}
