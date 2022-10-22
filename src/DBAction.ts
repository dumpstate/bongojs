import { PoolClient } from "pg"
import { Transactor } from "./Transactor"
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

	public async run(tr: Transactor): Promise<T> {
		for await (const conn of tr.connection()) {
			return this.action(conn)
		}

		throw new Error("failed to acquire connection from transactor")
	}

	public async transact(tr: Transactor): Promise<T> {
		for await (const conn of tr.transaction()) {
			return this.action(conn)
		}

		throw new Error("failed to acquire connection from transactor")
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
