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
}
