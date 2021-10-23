import Ajv from 'ajv/dist/jtd'
import {
    Pool as PGPool,
    PoolClient as PGPoolClient,
} from 'pg'

import { nextId } from './ids'
import { DocType } from './model'
import { omit } from './utils'


export interface DocumentMeta {
    readonly id: string
    readonly doctype: string
}


export interface Collection<T> {
    create: (obj: T) => Promise<T & DocumentMeta>
    drop: () => Promise<number>
    getById: (id: string) => Promise<T>
    save: (obj: T & DocumentMeta) => Promise<T & DocumentMeta>
}


export interface ExtCollection<T> extends Collection<T> {
    on: (conn: PGPoolClient) => Collection<T>
}


export function collection<S, T>(
    pg: PGPool,
    doctype: DocType<S>,
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

        return {
            ...obj,
            get id(): string { return id },
            get doctype(): string { return doctype.name },
        }
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

    function getById(id: string) {
        return exec(async conn => {
            const res = await conn.query(
                `
                    SELECT id, doc
                    FROM bongo_documents
                    WHERE
                        id = $1 AND
                        doctype = $2
                `,
                [id, doctype.name],
            )

            if(res.rowCount > 1) {
                throw new Error('Inconsistent data')
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
            throw new Error('ValidationError')
        }

        return save(
            instance(
                nextId(doctype),
                obj,
            ),
        )
    }

    function drop() {
        return exec(async conn => {
            const res = await conn.query(
                `
                    DELETE FROM bongo_documents
                    WHERE doctype = $1
                `,
                [doctype.name],
            )

            return res.rowCount
        })
    }

    function save(obj: T & DocumentMeta) {
        const doc = omit(obj, ['id', 'doctype'])

        if (!validate(doc)) {
            throw new Error('ValidationError')
        }

        return exec(async conn => {
            const res = await conn.query(
                `
                    INSERT INTO bongo_documents (id, doctype, doc)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (id, doctype)
                    DO
                        UPDATE SET doc = $3
                `,
                [obj.id, obj.doctype, doc],
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
            drop: () => drop()(conn),
            getById: (id: string) => getById(id)(conn),
            save: (obj: T & DocumentMeta) => save(obj)(conn),
        }
    }

    return {
        ...factory(null),
        on: (conn: PGPoolClient) => factory(conn),
    }
}
