import { PoolClient } from "pg"
import { ConnectionProvider } from "./ConnectionProvider"
import { isPromise } from "./utils"

export class DBAction<T> {
	private readonly action: (conn: PoolClient) => Promise<T>

	constructor(action: (conn: PoolClient) => Promise<T>) {
		this.action = action
	}

	public map<K>(fn: (item: T) => K): DBAction<K> {
		return new DBAction<K>((conn: PoolClient) => this.action(conn).then(fn))
	}

	public flatMap<K>(fn: (item: T) => DBAction<K>): DBAction<K> {
		return new DBAction<K>((conn: PoolClient) =>
			this.action(conn).then((item) => fn(item).action(conn))
		)
	}

	public async run(cp: ConnectionProvider): Promise<T> {
		for await (const conn of cp.next()) {
			return await this.action(conn)
		}

		throw new Error("failed to acquire connection from connection provider")
	}

	public async transact(cp: ConnectionProvider): Promise<T> {
		for await (const conn of cp.next()) {
			try {
				await conn.query("BEGIN")
				const res = await this.action(conn)
				await conn.query("COMMIT")
				return res
			} catch (err) {
				await conn.query("ROLLBACK")
				throw err
			}
		}

		throw new Error("failed to acquire connection from connection provider")
	}
}

export function flatten<T>(actions: DBAction<T>[]): DBAction<T[]> {
	return actions.reduce((acc, next) => {
		return acc.flatMap((items) => next.map((item) => items.concat(item)))
	}, pure<T[]>([]))
}

export function pure<T>(p: Promise<T> | T): DBAction<T> {
	if (isPromise(p)) {
		return new DBAction((_: PoolClient) => p)
	} else {
		return new DBAction((_: PoolClient) => Promise.resolve(p))
	}
}
