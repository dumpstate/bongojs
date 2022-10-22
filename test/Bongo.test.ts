import { Pool } from "pg"
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
		await foo.drop().run(bongo.tx)
	})

	await t.test("foo", async (t) => {
		const newFoo = await foo
			.create({
				foo: 42,
				bar: "ouch",
			})
			.run(bongo.tx)

		t.ok(bongo)
		t.ok(newFoo.id)

		newFoo.foo = 22

		await foo.save(newFoo).run(bongo.tx)

		t.ok(newFoo.foo === 22)
	})
})

test("create bongo for an existing Pool", async (t) => {
	const bongo = new Bongo(new Pool())

	t.teardown(async () => {
		await bongo.close()
	})

	await t.test("pool is usable", async (t) => {
		const conn = await bongo.pg.connect()
		const res = await conn.query("select 1")
		conn.release()
		t.ok(res)
	})
})
