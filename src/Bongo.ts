import { JTDDataType } from 'ajv/dist/jtd'
import {
    Pool as PGPool,
    PoolClient as PGPoolClient,
} from 'pg'

import { collection } from './collection'
import { DocType } from './model'
import { migrateUp } from './schema'


export class Bongo {

    public pg: PGPool
    private registry: Map<string, DocType<any>> = new Map()

    constructor(
        pgPool?: PGPool
    ) {
        if (!pgPool) {
            this.pg = new PGPool()

            process.on('SIGTERM', () => {
                this.pg.end()
                    .catch(err => {
                        console.error('Error during the shutdown', err)
                        process.exit(1)
                    })
            })
        } else {
            this.pg = pgPool
        }
    }

    public collection<S>(doctype: DocType<S>) {
        if (this.registry.has(doctype.name)) {
            throw new Error(`DocType ${doctype.name} already registered`)
        }

        this.registry.set(doctype.name, doctype)
        const { schema } = doctype
        type DataType = JTDDataType<typeof schema>

        return collection<S, DataType>(this.pg, doctype)
    }

    public async migrate() {
        if (this.registry.size === 0) {
            console.warn('No doctypes registered when migrating')
        }

        await migrateUp(this.pg)
    }

    public async close() {
        return this.pg.end()
    }

    public async transaction<T>(cbk: (txClient: PGPoolClient) => Promise<T>) {
        const conn = await this.pg.connect()

        try {
            await conn.query('BEGIN')

            const res = await cbk(conn)

            await conn.query('COMMIT')

            return res
        } catch (err) {
            await conn.query('ROLLBACK')

            throw err
        } finally {
            conn.release()
        }
    }
}
