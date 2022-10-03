interface SqlClause {
	readonly text: string
	readonly values: any[]
}

type LogicalOp = "AND" | "OR"

type AtLeastOne<T> = [T, ...T[]]
type AtLeastTwo<T> = [T, T, ...T[]]

type NumericPropNames<T> = {
	[k in keyof T]: T[k] extends Number ? k : never
}[keyof T]

type NonNumericPropNames<T> = {
	[k in keyof T]: T[k] extends Number
		? never
		: T[k] extends Function
		? never
		: k
}[keyof T]

type NonNumericQueryableProps<T> = {
	[k in keyof Pick<T, NonNumericPropNames<T>>]?:
		| T[k]
		| InOp<T[k]>
		| NinOp<T[k]>
		| EqOp<T[k]>
		| NeOp<T[k]>
}

type NumericQueryableProps<T> = {
	[k in keyof Pick<T, NumericPropNames<T>>]?:
		| T[k]
		| InOp<T[k]>
		| NinOp<T[k]>
		| EqOp<T[k]>
		| NeOp<T[k]>
		| GtOp<T[k]>
		| GteOp<T[k]>
		| LtOp<T[k]>
		| LteOp<T[k]>
}

type QueryableProps<T> = NonNumericQueryableProps<T> | NumericQueryableProps<T>

type Without<T, U> = {
	[p in Exclude<keyof T, keyof U>]?: never
}

type XOR<T, U> = T | U extends object
	? (Without<T, U> & U) | (Without<U, T> & T)
	: T | U

type AndOp<T> = {
	$and?: AtLeastTwo<BooleanOps<T> | QueryableProps<T>>
}

type OrOp<T> = {
	$or?: AtLeastTwo<BooleanOps<T> | QueryableProps<T>>
}

type BooleanOps<T> = XOR<AndOp<T>, OrOp<T>>

type InOp<Q> = { $in: AtLeastOne<Q> }
type NinOp<Q> = { $nin: AtLeastOne<Q> }
type EqOp<Q> = { $eq: Q }
type NeOp<Q> = { $ne: Q }
type GtOp<Q> = { $gt: Q }
type GteOp<Q> = { $gte: Q }
type LtOp<Q> = { $lt: Q }
type LteOp<Q> = { $lte: Q }

export type Query<T> = QueryableProps<T> | BooleanOps<T>

function reduce(clauses: SqlClause[], op: LogicalOp): SqlClause {
	return clauses.reduce(
		(acc, clause) => ({
			text:
				acc.text.length > 0
					? `${acc.text} ${op} (${clause.text})`
					: clause.text,
			values: acc.values.concat(clause.values),
		}),
		{ text: "", values: [] }
	)
}

function conj(clauses: SqlClause[]): SqlClause {
	return reduce(clauses, "AND")
}

abstract class Match {
	abstract toSQL(ix: number, targetColumn: string): [SqlClause, number]
}

class ExactMatch extends Match {
	constructor(
		public readonly key: string,
		public readonly value: string | number
	) {
		super()
	}

	public toSQL(ix: number, targetColumn: string) {
		return [
			{
				text: `${targetColumn}->>'${this.key}' = $${ix}`,
				values: [this.value],
			},
			ix + 1,
		] as [SqlClause, number]
	}
}

function match(key: string, value: any): Match {
	if (key === "$or" || key === "$and") {
		throw new Error("not implemented")
	}

	if (typeof value === "object") {
		throw new Error(`not implemented: ${JSON.stringify(value)}`)
	}

	if (typeof value === "string" || typeof value === "number") {
		return new ExactMatch(key, value)
	}

	throw new Error(`Unsupported match: ${key} -> ${JSON.stringify(value)}`)
}

export function whereClause<T>(
	query: Query<T>,
	targetColumn: string = "doc"
): SqlClause {
	const clauses: SqlClause[] = []
	let ix = 1

	for (const [key, value] of Object.entries(query)) {
		const [clause, nextIx] = match(key, value).toSQL(ix, targetColumn)

		ix = nextIx
		clauses.push(clause)
	}

	if (clauses.length > 0) {
		return conj(clauses)
	}

	return { text: "true", values: [] }
}
