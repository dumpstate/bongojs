interface SqlClause {
	readonly text: string
	readonly values: any[]
}

type LogicalOp = "AND" | "OR"

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

export function whereClause(
	query: any,
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
