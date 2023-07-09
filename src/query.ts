export interface SqlClause {
	readonly text: string
	readonly values: (string | number | boolean | null)[]
}

type LogicalOp = "AND" | "OR"
type ArrayMatchOperator = ["==", "||"] | ["!=", "&&"]
type ValueMatchOperator = "==" | "!=" | "<" | "<=" | ">" | ">="

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

type SortDirection = "ASC" | "DESC"

export type Query<T> = QueryableProps<T> | BooleanOps<T> | {}

export type QueryOpts<T> = {
	offset?: number
	limit?: number
	sort?: [keyof T, SortDirection][]
	forUpdate?: boolean
}

function ipltJSONPath(value: string | number | boolean | null): string {
	if (value === null) {
		return "null"
	}

	if (typeof value === "boolean") {
		return value ? "true" : "false"
	}

	if (typeof value === "number") {
		// TODO check postgres number limits + float precision
		return `${value}`
	}

	if (typeof value === "string") {
		// TODO escape problematic characters
		return `"${value}"`
	}

	throw new Error(`unsupported value: ${typeof value}: ${value}`)
}

function reduce(clauses: SqlClause[], op: LogicalOp): SqlClause {
	const clause = clauses.reduce(
		(acc, clause) => ({
			text:
				acc.text.length > 0
					? `${acc.text} ${op} ${clause.text}`
					: clause.text,
			values: acc.values.concat(clause.values),
		}),
		{ text: "", values: [] },
	)

	return {
		text: `(${clause.text})`,
		values: clause.values,
	}
}

abstract class Match {
	abstract toSQL(ix: number, targetColumn: string): [SqlClause, number]
}

class ValueMatch extends Match {
	constructor(
		public readonly operator: ValueMatchOperator,
		public readonly key: string,
		public readonly value: string | number | boolean | null,
	) {
		super()
	}

	public toSQL(ix: number, targetColumn: string) {
		return [
			{
				text: `${targetColumn} @@ '$.${this.key} ${
					this.operator
				} ${ipltJSONPath(this.value)}'`,
				values: [],
			},
			ix + 1,
		] as [SqlClause, number]
	}
}

class ArrayMatch extends Match {
	constructor(
		public readonly operator: ArrayMatchOperator,
		public readonly key: string,
		public readonly values: (string | number | boolean | null)[],
	) {
		super()
	}

	public toSQL(ix: number, targetColumn: string) {
		if (this.values.length < 1) {
			return [{ text: "true", values: [] }, ix] as [SqlClause, number]
		}

		const [innerOp, logOp] = this.operator

		return [
			{
				text: `${targetColumn} @? '$.${this.key} ? (${this.values
					.map((v) => `@ ${innerOp} ${ipltJSONPath(v)}`)
					.join(` ${logOp} `)})'`,
				values: [],
			},
			ix + this.values.length,
		] as [SqlClause, number]
	}
}

class MultiMatch extends Match {
	constructor(
		public readonly matches: Match[],
		public readonly operator: LogicalOp,
	) {
		super()
	}

	public toSQL(ix: number, targetColumn: string): [SqlClause, number] {
		const clauses: SqlClause[] = []
		let x = ix

		this.matches.forEach((match) => {
			const [clause, nextIx] = match.toSQL(x, targetColumn)
			x = nextIx
			clauses.push(clause)
		})

		return [reduce(clauses, this.operator), x]
	}
}

class NoopMatch extends Match {
	constructor() {
		super()
	}

	public toSQL(ix: number, _: string): [SqlClause, number] {
		return [
			{
				text: "true",
				values: [],
			},
			ix,
		]
	}
}

function plainValue(value: any): [string | number | boolean | null, boolean] {
	switch (typeof value) {
		case "string":
		case "number":
		case "boolean":
			return [value, true]
		default:
			if (value === null) {
				return [value, true]
			}

			if (value instanceof Date) {
				return [value.toISOString(), true]
			}

			return [value, false]
	}
}

function matchObject(key: string, value: any): Match {
	if (typeof value !== "object" || value === null || value === undefined) {
		throw new Error(`not a valid match object: ${JSON.stringify(value)}`)
	}

	const entries = Object.entries(value)
	if (entries.length !== 1) {
		throw new Error("invalid match object")
	}

	const [eKey, eValue] = entries[0] as [string, any]
	const [plainEntryValue, isPlainValue] = plainValue(eValue)
	if (!isPlainValue) {
		if (Array.isArray(eValue)) {
			switch (eKey) {
				case "$in":
					return new ArrayMatch(["==", "||"], key, eValue)
				case "$nin":
					return new ArrayMatch(["!=", "&&"], key, eValue)
				default:
					throw new Error(`unsupported operator ${eKey}`)
			}
		}

		throw new Error("either plain value or array expected")
	}

	switch (eKey) {
		case "$eq":
			return new ValueMatch("==", key, plainEntryValue)
		case "$ne":
			return new ValueMatch("!=", key, plainEntryValue)
		case "$gt":
			return new ValueMatch(">", key, plainEntryValue)
		case "$gte":
			return new ValueMatch(">=", key, plainEntryValue)
		case "$lt":
			return new ValueMatch("<", key, plainEntryValue)
		case "$lte":
			return new ValueMatch("<=", key, plainEntryValue)
		default:
			throw new Error(`unsuported operator: ${eKey}`)
	}
}

function valueMatch(key: string, value: any): Match {
	const [valueToMatch, isPlain] = plainValue(value)
	if (isPlain) {
		return new ValueMatch("==", key, valueToMatch)
	}

	return matchObject(key, value)
}

function match(key: string, value: any): Match {
	switch (key) {
		case "$or":
		case "$and":
			if (!Array.isArray(value)) {
				throw new Error(`array expected: ${value}`)
			}

			const subQuery = value.map((subq) => {
				const entries = Object.entries(subq) as [string, any][]

				if (entries.length === 0) {
					return new NoopMatch()
				} else if (entries.length === 1) {
					const [eKey, eValue] = entries[0] as [string, any]
					return match(eKey, eValue)
				} else {
					return new MultiMatch(
						entries.map(([eKey, eValue]) => match(eKey, eValue)),
						"AND",
					)
				}
			})

			return new MultiMatch(subQuery, key === "$or" ? "OR" : "AND")
		default:
			return valueMatch(key, value)
	}
}

export function whereClause<T>(
	query: Query<T>,
	targetColumn: string = "doc",
): SqlClause {
	const clauses: SqlClause[] = []
	let ix = 1

	for (const [key, value] of Object.entries(query)) {
		const [clause, nextIx] = match(key, value).toSQL(ix, targetColumn)

		ix = nextIx
		clauses.push(clause)
	}

	if (clauses.length > 1) {
		return reduce(clauses, "AND")
	} else if (clauses.length === 1) {
		return clauses[0] as SqlClause
	} else {
		return { text: "true", values: [] }
	}
}

export function orderByClause<T>(
	sort: [keyof T, SortDirection][],
	targetColumn: string = "doc",
): SqlClause {
	return {
		text: sort
			.map(
				([key, direction]) =>
					`${targetColumn}->'${String(key)}' ${direction}`,
			)
			.join(", "),
		values: [],
	}
}
