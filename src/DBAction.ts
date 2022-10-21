import { Pool, PoolClient } from "pg"

export class DBAction<T> {
	private readonly pg: Pool
	private readonly action: (conn: PoolClient) => Promise<T>

	constructor(pg: Pool, action: (conn: PoolClient) => Promise<T>) {
		this.pg = pg
		this.action = action
	}

	public map<K>(fn: (item: T) => K): DBAction<K> {
		return new DBAction<K>(this.pg, (conn: PoolClient) =>
			this.action(conn).then(fn)
		)
	}

	public flatMap<K>(fn: (item: T) => DBAction<K>): DBAction<K> {
		return new DBAction<K>(this.pg, (conn: PoolClient) =>
			this.action(conn).then((item) => fn(item).action(conn))
		)
	}

	public async run(conn: PoolClient | undefined | null = null): Promise<T> {
		let nextConn = conn

		if (!nextConn) {
			nextConn = await this.pg.connect()
		}

		try {
			return await this.action(nextConn)
		} finally {
			if (!conn) {
				nextConn.release()
			}
		}
	}
}
