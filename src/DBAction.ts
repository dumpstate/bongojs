import { PoolClient } from "pg"
import { ConnectionProvider } from "./ConnectionProvider"
import { isFunction, isPromise } from "./utils"

export class DBAction<T> {
	private readonly _action: (conn: PoolClient) => Promise<T>

	constructor(action: (conn: PoolClient) => Promise<T>) {
		this._action = action
	}

	get action(): (conn: PoolClient) => Promise<T> {
		return this._action
	}

	public map<K>(fn: (item: T) => K): DBAction<K> {
		return new DBAction<K>((conn: PoolClient) =>
			this._action(conn).then(fn)
		)
	}

	public flatMap<K>(fn: (item: T) => DBAction<K>): DBAction<K> {
		return new DBAction<K>((conn: PoolClient) =>
			this._action(conn).then((item) => fn(item)._action(conn))
		)
	}

	public async run(cp: ConnectionProvider): Promise<T> {
		for await (const conn of cp.next()) {
			return await this._action(conn)
		}

		throw new Error("failed to acquire connection from connection provider")
	}

	public async transact(cp: ConnectionProvider): Promise<T> {
		for await (const conn of cp.next()) {
			try {
				await conn.query("BEGIN")
				const res = await this._action(conn)
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

export function pure<T>(p: Promise<T> | T | (() => Promise<T>)): DBAction<T> {
	if (isPromise(p)) {
		return new DBAction((_: PoolClient) => p)
	} else if (isFunction(p)) {
		return new DBAction((_: PoolClient) => p())
	} else {
		return new DBAction((_: PoolClient) => Promise.resolve(p))
	}
}

export function chain<A>(action: DBAction<A>): DBAction<A>
export function chain<A, B>(
	action: DBAction<A>,
	action2: (input: A) => DBAction<B>
): DBAction<B>
export function chain<A, B, C>(
	action: DBAction<A>,
	action2: (input: A) => DBAction<B>,
	action3: (input: B) => DBAction<C>
): DBAction<C>
export function chain<A, B, C, D>(
	action: DBAction<A>,
	action2: (input: A) => DBAction<B>,
	action3: (input: B) => DBAction<C>,
	action4: (input: C) => DBAction<D>
): DBAction<D>
export function chain<A, B, C, D, E>(
	action: DBAction<A>,
	action2: (input: A) => DBAction<B>,
	action3: (input: B) => DBAction<C>,
	action4: (input: C) => DBAction<D>,
	action5: (input: D) => DBAction<E>
): DBAction<E>
export function chain<A, B, C, D, E, F>(
	action: DBAction<A>,
	action2: (input: A) => DBAction<B>,
	action3: (input: B) => DBAction<C>,
	action4: (input: C) => DBAction<D>,
	action5: (input: D) => DBAction<E>,
	action6: (input: E) => DBAction<F>
): DBAction<F>
export function chain<A, B, C, D, E, F, G>(
	action: DBAction<A>,
	action2: (input: A) => DBAction<B>,
	action3: (input: B) => DBAction<C>,
	action4: (input: C) => DBAction<D>,
	action5: (input: D) => DBAction<E>,
	action6: (input: E) => DBAction<F>,
	action7: (input: F) => DBAction<G>
): DBAction<G>
export function chain<A, B, C, D, E, F, G, H>(
	action: DBAction<A>,
	action2: (input: A) => DBAction<B>,
	action3: (input: B) => DBAction<C>,
	action4: (input: C) => DBAction<D>,
	action5: (input: D) => DBAction<E>,
	action6: (input: E) => DBAction<F>,
	action7: (input: F) => DBAction<G>,
	action8: (input: G) => DBAction<H>
): DBAction<H>
export function chain<A, B, C, D, E, F, G, H, I>(
	action: DBAction<A>,
	action2: (input: A) => DBAction<B>,
	action3: (input: B) => DBAction<C>,
	action4: (input: C) => DBAction<D>,
	action5: (input: D) => DBAction<E>,
	action6: (input: E) => DBAction<F>,
	action7: (input: F) => DBAction<G>,
	action8: (input: G) => DBAction<H>,
	action9: (input: H) => DBAction<I>
): DBAction<I>
export function chain<A, B, C, D, E, F, G, H, I, J>(
	action: DBAction<A>,
	action2: (input: A) => DBAction<B>,
	action3: (input: B) => DBAction<C>,
	action4: (input: C) => DBAction<D>,
	action5: (input: D) => DBAction<E>,
	action6: (input: E) => DBAction<F>,
	action7: (input: F) => DBAction<G>,
	action8: (input: G) => DBAction<H>,
	action9: (input: H) => DBAction<I>,
	action10: (input: I) => DBAction<J>
): DBAction<J>
export function chain(
	action: DBAction<any>,
	...args: ((input: any) => DBAction<any>)[]
): DBAction<any> {
	if (!args || args.length === 0) {
		return action
	}

	return args.reduce((acc, next) => acc.flatMap((res) => next(res)), action)
}

export function sequence<A, B>(
	action: DBAction<A>,
	action2: DBAction<B>
): DBAction<[A, B]>
export function sequence<A, B, C>(
	action: DBAction<A>,
	action2: DBAction<B>,
	action3: DBAction<C>
): DBAction<[A, B, C]>
export function sequence<A, B, C, D>(
	action: DBAction<A>,
	action2: DBAction<B>,
	action3: DBAction<C>,
	action4: DBAction<D>
): DBAction<[A, B, C, D]>
export function sequence<A, B, C, D, E>(
	action: DBAction<A>,
	action2: DBAction<B>,
	action3: DBAction<C>,
	action4: DBAction<D>,
	action5: DBAction<E>
): DBAction<[A, B, C, D, E]>
export function sequence<A, B, C, D, E, F>(
	action: DBAction<A>,
	action2: DBAction<B>,
	action3: DBAction<C>,
	action4: DBAction<D>,
	action5: DBAction<E>,
	action6: DBAction<F>
): DBAction<[A, B, C, D, E, F]>
export function sequence(
	action: DBAction<any>,
	...args: DBAction<any>[]
): DBAction<any> {
	if (!args || args.length === 0) {
		return action
	}

	return new DBAction((conn: PoolClient) =>
		Promise.all([action, ...args].map((act) => act.action(conn)))
	)
}
