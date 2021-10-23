import {
    Pool as PGPool,
    PoolClient as PGPoolClient,
} from 'pg'

import {
    DOCUMENT_TABLE,
    REVISION_COLUMN,
    REVISION_TABLE,
} from './constants'


interface Revision {
    readonly id: number,
    readonly up: string,
    readonly down: string,
}


const REVISIONS: Revision[] = [
    {
        id: 1,
        up: `
            CREATE TABLE ${REVISION_TABLE} (
                ${REVISION_COLUMN} INTEGER PRIMARY KEY
            )
        `,
        down: `DROP TABLE ${REVISION_TABLE}`,
    },
    {
        id: 2,
        up: `
            CREATE TABLE ${DOCUMENT_TABLE} (
                id CHAR(24),
                doctype VARCHAR,
                doc JSONB NOT NULL,
                PRIMARY KEY (id, doctype)
            )
        `,
        down: `DROP TABLE ${DOCUMENT_TABLE}`,
    },
]


async function checkTableExists(pg: PGPoolClient, tablename: string): Promise<boolean> {
    const res = await pg.query(
        `
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE       table_schema = 'public' AND
                            table_name = $1
            )
        `,
        [tablename],
    )

    return res.rows[0]['exists']
}


async function currentRevision(pg: PGPoolClient): Promise<number | null> {
    const revisionTableExists = await checkTableExists(pg, REVISION_TABLE)

    if (!revisionTableExists) {
        return null
    }

    const res = await pg.query(`
        SELECT ${REVISION_COLUMN}
        FROM ${REVISION_TABLE}
        LIMIT 1
    `)

    return res.rowCount === 1
        ? res.rows[0][REVISION_COLUMN]
        : null
}


async function setCurrentRevision(
    pg: PGPoolClient,
    currentRevision: number | null,
    rev: Revision,
): Promise<void> {
    if (currentRevision === null) {
        await pg.query(
            `
                INSERT INTO ${REVISION_TABLE}(${REVISION_COLUMN})
                VALUES ($1)
            `,
            [rev.id],
        )
    } else {
        await pg.query(
            `
                UPDATE ${REVISION_TABLE}
                SET    ${REVISION_COLUMN} = $1
            `,
            [rev.id],
        )
    }
}


function revisionsToApply(current: number | null): Revision[] {
    if (current === null) {
        return REVISIONS
    }

    return REVISIONS
        .filter(rev => rev.id > current)
}


export async function migrateUp(pg: PGPool): Promise<void> {
    const conn = await pg.connect()
    const currentRevisionId = await currentRevision(conn)

    try {
        for (const rev of revisionsToApply(currentRevisionId)) {
            try {
                await conn.query('BEGIN')
    
                await conn.query(rev.up)
                await setCurrentRevision(conn, currentRevisionId, rev)
    
                await conn.query('COMMIT')
            } catch (err) {
                await conn.query('ROLLBACK')
                throw err
            }
        }
    } finally {
        conn.release()
    }
}
