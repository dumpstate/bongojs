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
			text: "doc->>'foo' = $1 AND (doc->>'bar' = $2)",
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
			text: "doc->>'foo' = $1 AND (doc->>'bar' = $2) AND (doc->>'baz' = $3)",
			values: [123, "baz", true],
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
