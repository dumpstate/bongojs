import { Transactor } from "@dumpstate/dbaction/lib/PG"
import { Pool as PGPool, PoolConfig as PGPoolConfig } from "pg"

import { Collection, collection } from "./collection"
import { Logger, newLogger } from "./logger"
import { DocType, SchemaType, SchemaTypeDef } from "./model"
import { migrateDown, migrateUp } from "./schema"
import { deepEquals } from "./utils"

function isPGPool(obj: any): obj is PGPool {
	return obj && obj instanceof PGPool
}

export class Bongo {
	public pg: PGPool
	public tr: Transactor
	private logger: Logger

	private collectionRegistry: Map<string, Collection<any>> = new Map()
	private doctypeRegistry: Map<string, DocType<any>> = new Map()
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

		this.tr = new Transactor(this.pg)
	}

	public collection<S extends SchemaTypeDef>(
		doctype: DocType<S>,
	): Collection<SchemaType<S>> {
		if (this.collectionRegistry.has(doctype.name)) {
			const col = this.collectionRegistry.get(doctype.name) as Collection<
				SchemaType<S>
			>

			if (
				!deepEquals(
					doctype.schema,
					this.doctypeRegistry.get(doctype.name)?.schema,
				)
			) {
				throw new Error(
					`Doctype ${doctype.name} already registered with different schema`,
				)
			}

			return col
		}

		if (doctype.prefix) {
			if (doctype.prefix.length > 3) {
				throw new Error(
					`Id prefix cannot be longer than 3 characters: ${doctype.prefix}`,
				)
			}

			if (this.idPrefixes.has(doctype.prefix)) {
				throw new Error(`Prefix: ${doctype.prefix} already registered`)
			}

			this.idPrefixes.add(doctype.prefix)
		}

		const { schema } = doctype
		type DataType = SchemaType<typeof schema>

		const col = collection<S, DataType>(doctype, this.logger)
		this.collectionRegistry.set(doctype.name, col)
		this.doctypeRegistry.set(doctype.name, doctype)
		return col
	}

	public async migrate() {
		if (this.doctypeRegistry.size === 0) {
			this.logger.warn("No doctypes registered when migrating")
		}

		await migrateUp(
			this.logger,
			this.pg,
			Array.from(this.doctypeRegistry.values()),
		)
	}

	public async drop() {
		await migrateDown(this.logger, this.pg)
	}

	public async close() {
		return this.tr.close()
	}
}
