import { Pool, PoolClient } from "pg"

export class Transactor {
	private readonly pg: Pool

	constructor(pg: Pool) {
		this.pg = pg
	}

	public async *connection(): AsyncGenerator<PoolClient> {
		const conn = await this.pg.connect()

		try {
			yield conn
		} finally {
			conn.release()
		}
	}

	public async *transaction(): AsyncGenerator<PoolClient> {
		const conn = await this.pg.connect()

		try {
			await conn.query("BEGIN")
			yield conn
			await conn.query("COMMIT")
		} catch (err) {
			await conn.query("ROLLBACK")
			throw err
		} finally {
			conn.release()
		}
	}
}
