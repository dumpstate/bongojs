import { test } from "tap"
import { SchemaType } from "../src/model"

import { Query, SqlClause, whereClause } from "../src/query"

const EntitySchema = {
	foo: { type: "int32" },
	bar: { type: "string" },
	baz: { type: "boolean" },
} as const

type Entity = SchemaType<typeof EntitySchema>

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

testCases.forEach(([query, expected]) =>
	test("query builder", (t) => {
		const actual = whereClause<Entity>(query)
		t.same(actual, expected)
		t.end()
	})
)
