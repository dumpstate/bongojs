import { JTDDataType } from "ajv/dist/jtd"
import { test } from "tap"

import { whereClause } from "../src/query"

const EntitySchema = {
	properties: {
		foo: { type: "int32" },
		bar: { type: "string" },
	},
} as const

type Entity = JTDDataType<typeof EntitySchema>

test("empty object match", (t) => {
	const actual = whereClause<Entity>({})

	t.same(actual, {
		text: "true",
		values: [],
	})
	t.end()
})

test("single property match", (t) => {
	const actual = whereClause<Entity>({ foo: 123 })

	t.same(actual, {
		text: "doc->>'foo' = $1",
		values: [123],
	})
	t.end()
})

test("multiple properties match", (t) => {
	const actual = whereClause<Entity>({
		foo: 123,
		bar: "baz",
	})

	t.same(actual, {
		text: "doc->>'foo' = $1 AND (doc->>'bar' = $2)",
		values: [123, "baz"],
	})
	t.end()
})
