import { Pool as PGPool, PoolClient as PGPoolClient } from "pg"

import { DOCUMENT_TABLE, REVISION_COLUMN, REVISION_TABLE } from "./constants"
import { Logger } from "./logger"
import { DocType, partitionName } from "./model"

interface Revision {
	readonly id: number
	readonly up: string
	readonly down: string
}

const REVISIONS: Revision[] = [
	{
		id: 1,
		up: `
CREATE TABLE IF NOT EXISTS ${REVISION_TABLE} (
${REVISION_COLUMN} INTEGER PRIMARY KEY
)`.trim(),
		down: `DROP TABLE ${REVISION_TABLE}`,
	},
	{
		id: 2,
		up: `
CREATE TABLE IF NOT EXISTS ${DOCUMENT_TABLE} (
id CHAR(24),
doctype VARCHAR,
doc JSONB NOT NULL,
PRIMARY KEY (id, doctype)
) PARTITION BY LIST(doctype)`.trim(),
		down: `DROP TABLE ${DOCUMENT_TABLE}`,
	},
	{
		id: 3,
		up: `
CREATE INDEX IF NOT EXISTS ix_${DOCUMENT_TABLE}_doc
ON ${DOCUMENT_TABLE}
USING GIN (doc)`.trim(),
		down: `DROP INDEX IF EXISTS ix_${DOCUMENT_TABLE}_doc`,
	},
]

async function checkTableExists(
	pg: PGPoolClient,
	tablename: string
): Promise<boolean> {
	const res = await pg.query(
		`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE       table_schema = 'public' AND
                            table_name = $1
            )
        `.trim(),
		[tablename]
	)

	return res.rows[0]["exists"]
}

async function currentRevision(pg: PGPoolClient): Promise<number | null> {
	const revisionTableExists = await checkTableExists(pg, REVISION_TABLE)

	if (!revisionTableExists) {
		return null
	}

	const res = await pg.query(`
        SELECT ${REVISION_COLUMN}
        FROM ${REVISION_TABLE}
    `)

	return res.rowCount === 1 ? res.rows[0]["max"] : null
}

async function setCurrentRevision(
	pg: PGPoolClient,
	rev: Revision
): Promise<void> {
	const current = await currentRevision(pg)

	if (current === null) {
		await pg.query(
			`
                INSERT INTO ${REVISION_TABLE}(${REVISION_COLUMN})
                VALUES ($1)
            `,
			[rev.id]
		)
	} else {
		await pg.query(
			`
                UPDATE ${REVISION_TABLE}
                SET    ${REVISION_COLUMN} = $1
            `,
			[rev.id]
		)
	}
}

function revisionsToApply(
	current: number | null,
	direction: "up" | "down"
): Revision[] {
	switch (direction) {
		case "up":
			if (current === null) {
				return REVISIONS
			}

			return REVISIONS.filter((rev) => rev.id > current)
		case "down":
			if (current === null) {
				return []
			}

			return REVISIONS.filter((rev) => rev.id <= current).reverse()
		default:
			throw new Error(`unknown direction: ${direction}`)
	}
}

export async function migrateUp(
	logger: Logger,
	pg: PGPool,
	doctypes: DocType<any>[]
): Promise<void> {
	const conn = await pg.connect()
	const currentRevisionId = await currentRevision(conn)

	try {
		for (const rev of revisionsToApply(currentRevisionId, "up")) {
			try {
				await conn.query("BEGIN")
				logger.info(`UP(${rev.id}) :: ${rev.up}`)
				await conn.query(rev.up)
				await setCurrentRevision(conn, rev)
				await conn.query("COMMIT")
			} catch (err: any) {
				await conn.query("ROLLBACK")
				logger.error(err)
				throw err
			}
		}

		for (const doctype of doctypes) {
			await ensurePartition(logger, conn, doctype)
		}
	} finally {
		conn.release()
	}
}

export async function migrateDown(logger: Logger, pg: PGPool): Promise<void> {
	const conn = await pg.connect()

	try {
		const currentRevisionId = await currentRevision(conn)
		if (!currentRevisionId || currentRevisionId < 1) {
			return
		}

		for (const rev of revisionsToApply(currentRevisionId, "down")) {
			try {
				await conn.query("BEGIN")
				logger.info(`DOWN(${rev.id}) :: ${rev.down}`)
				await conn.query(rev.down)
				await setCurrentRevision(conn, rev)
				await conn.query("COMMIT")
			} catch (err: any) {
				await conn.query("ROLLBACK")
				logger.error(err)
				throw err
			}
		}
	} finally {
		conn.release()
	}
}

async function ensurePartition(
	logger: Logger,
	conn: PGPoolClient,
	doctype: DocType<any>
): Promise<void> {
	logger.info(`Ensuring partition for ${doctype.name}`)

	await conn.query(`
		CREATE TABLE IF NOT EXISTS ${partitionName(doctype)}
			PARTITION OF ${DOCUMENT_TABLE}
			FOR VALUES IN ('${doctype.name}')
	`)
}
