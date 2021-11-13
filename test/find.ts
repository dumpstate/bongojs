import tap from "tap"

import { Bongo } from "../src/Bongo"

const bongo = new Bongo()
const foo = bongo.collection({
	name: "doc:foo:find",
	schema: {
		properties: {
			foo: { type: "int32" },
		},
	} as const,
})

tap.afterEach(async () => {
	await foo.drop()
})

tap.teardown(async () => {
	await bongo.close()
})

tap.test("insert and find", async (t) => {
	await foo.createAll([{ foo: 10 }, { foo: 11 }, { foo: 12 }])

	const found = await foo.find({ foo: 11 })

	t.equal(found.length, 1)
	t.equal(found[0].foo, 11)
})
