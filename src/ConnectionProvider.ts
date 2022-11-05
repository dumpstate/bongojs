import { Pool, PoolClient } from "pg"

export class ConnectionProvider {
	private readonly pg: Pool

	constructor(pg: Pool) {
		this.pg = pg
	}

	public async *next(): AsyncGenerator<PoolClient> {
		const conn = await this.pg.connect()

		try {
			yield conn
		} finally {
			conn.release()
		}
	}
}
