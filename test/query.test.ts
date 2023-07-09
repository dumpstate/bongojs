import assert from "node:assert/strict"
import { Schema } from "../src/model"
import { Query, SqlClause, whereClause } from "../src/query"

const Entity = {
	name: "entity",
	schema: {
		foo: { type: "int32" },
		bar: { type: "string" },
		baz: { type: "boolean" },
	},
} as const

type Entity = Schema<typeof Entity>

const testCases: [Query<Entity>, SqlClause][] = [
	[
		{},
		{
			text: "true",
			values: [],
		},
	],
	[
		{ foo: 123 },
		{
			text: "doc @@ '$.foo == 123'",
			values: [],
		},
	],
	[
		{
			foo: 123,
			bar: "baz",
		},
		{
			text: "(doc @@ '$.foo == 123' AND doc @@ '$.bar == \"baz\"')",
			values: [],
		},
	],
	[
		{
			foo: 123,
			bar: "baz",
			baz: true,
		},
		{
			text: "(doc @@ '$.foo == 123' AND doc @@ '$.bar == \"baz\"' AND doc @@ '$.baz == true')",
			values: [],
		},
	],
	[
		{ baz: null },
		{
			text: "doc @@ '$.baz == null'",
			values: [],
		},
	],
	[
		{ $or: [{ foo: 123 }, { baz: null }] },
		{
			text: "(doc @@ '$.foo == 123' OR doc @@ '$.baz == null')",
			values: [],
		},
	],
	[
		{ $and: [{ baz: null }, { $or: [{ bar: "asd" }, { bar: "dsa" }] }] },
		{
			text: "(doc @@ '$.baz == null' AND (doc @@ '$.bar == \"asd\"' OR doc @@ '$.bar == \"dsa\"'))",
			values: [],
		},
	],
	[
		{ foo: { $gt: 4 } },
		{
			text: "doc @@ '$.foo > 4'",
			values: [],
		},
	],
	[
		{ foo: { $gte: 2 }, bar: { $eq: "asd" } },
		{
			text: "(doc @@ '$.foo >= 2' AND doc @@ '$.bar == \"asd\"')",
			values: [],
		},
	],
	[
		{ foo: { $lt: 2 }, baz: { $ne: null } },
		{
			text: "(doc @@ '$.foo < 2' AND doc @@ '$.baz != null')",
			values: [],
		},
	],
	[
		{ foo: { $lte: 2 } },
		{
			text: "doc @@ '$.foo <= 2'",
			values: [],
		},
	],
	[
		{ foo: { $in: [2, 3] } },
		{
			text: "doc @? '$.foo ? (@ == 2 || @ == 3)'",
			values: [],
		},
	],
	[
		{ bar: { $nin: ["asd", "dsa"] } },
		{
			text: 'doc @? \'$.bar ? (@ != "asd" && @ != "dsa")\'',
			values: [],
		},
	],
]

describe("query builder", () => {
	testCases.forEach(([query, expected]) =>
		it("should build query", () => {
			const actual = whereClause<Entity>(query)
			assert.deepEqual(actual, expected)
		}),
	)
})
