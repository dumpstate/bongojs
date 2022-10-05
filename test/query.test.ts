import { JTDDataType } from "ajv/dist/jtd"
import { test } from "tap"

import { Query, SqlClause, whereClause } from "../src/query"

const EntitySchema = {
	properties: {
		foo: { type: "int32" },
		bar: { type: "string" },
	},
	optionalProperties: {
		baz: { type: "boolean" },
	},
} as const

type Entity = JTDDataType<typeof EntitySchema>

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
			text: "doc->>'foo' = $1",
			values: [123],
		},
	],
	[
		{
			foo: 123,
			bar: "baz",
		},
		{
			text: "(doc->>'foo' = $1 AND doc->>'bar' = $2)",
			values: [123, "baz"],
		},
	],
	[
		{
			foo: 123,
			bar: "baz",
			baz: true,
		},
		{
			text: "(doc->>'foo' = $1 AND doc->>'bar' = $2 AND doc->>'baz' = $3)",
			values: [123, "baz", true],
		},
	],
	[
		{ baz: null },
		{
			text: "doc->>'baz' = $1",
			values: [null],
		},
	],
	[
		{ $or: [{ foo: 123 }, { baz: null }] },
		{
			text: "(doc->>'foo' = $1 OR doc->>'baz' = $2)",
			values: [123, null],
		},
	],
	[
		{ $and: [{ baz: null }, { $or: [{ bar: "asd" }, { bar: "dsa" }] }] },
		{
			text: "(doc->>'baz' = $1 AND (doc->>'bar' = $2 OR doc->>'bar' = $3))",
			values: [null, "asd", "dsa"],
		},
	],
	[
		{ foo: { $gt: 4 } },
		{
			text: "doc->>'foo' > $1",
			values: [4],
		},
	],
	[
		{ foo: { $gte: 2 }, bar: { $eq: "asd" } },
		{
			text: "(doc->>'foo' >= $1 AND doc->>'bar' = $2)",
			values: [2, "asd"],
		},
	],
	[
		{ foo: { $lt: 2 }, baz: { $ne: null } },
		{
			text: "(doc->>'foo' < $1 AND doc->>'baz' <> $2)",
			values: [2, null],
		},
	],
	[
		{ foo: { $lte: 2 } },
		{
			text: "doc->>'foo' <= $1",
			values: [2],
		},
	],
	[
		{ foo: { $in: [2, 3] } },
		{
			text: "doc->>'foo' IN ($1, $2)",
			values: [2, 3],
		},
	],
	[
		{ bar: { $nin: ["asd", "dsa"] } },
		{
			text: "doc->>'bar' NOT IN ($1, $2)",
			values: ["asd", "dsa"],
		},
	],
]

testCases.forEach(([query, expected]) =>
	test("query builder", (t) => {
		const actual = whereClause<Entity>(query)
		t.same(actual, expected)
		t.end()
	})
)
