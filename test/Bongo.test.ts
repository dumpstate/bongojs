import { test } from "tap"
import { Bongo } from "../src/Bongo"

test("Bongo", async (t) => {
	const bongo = new Bongo()
	const foo = bongo.collection({
		name: "foo",
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

	t.before(async () => {
		await bongo.migrate()
	})

	t.teardown(async () => {
		await bongo.drop()
		await bongo.close()
	})

	t.afterEach(async () => {
		await foo.drop()
	})

	await t.test("foo", async (t) => {
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
})
