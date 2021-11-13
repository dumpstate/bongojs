import tap from "tap"

import { Bongo } from "../src/Bongo"

let bongo: Bongo

tap.beforeEach(async () => {
	bongo = new Bongo()
})

tap.afterEach(async () => {
	await bongo.close()
})

tap.test("foo", async (t) => {
	const foo = bongo.collection({
		name: "doc:foo",
		prefix: "foo",
		schema: {
			properties: {
				foo: { type: "int32" },
			},
			optionalProperties: {
				bar: { type: "string" },
			},
		} as const,
	})

	const newFoo = await foo.create({
		foo: 42,
		bar: "ouch",
	})

	t.ok(bongo)
	t.ok(newFoo.id)

	newFoo.foo = 22

	await foo.save(newFoo)

	t.ok(newFoo.foo === 22)
})
