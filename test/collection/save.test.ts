import { test } from "tap"
import { Bongo } from "../../src/Bongo"

test("collection.save", async (t) => {
	const bongo = new Bongo()
	const { tr } = bongo
	const foo = bongo.collection({
		name: "doc:foo:save",
		schema: {
			foo: { type: "int32" },
			bar: {
				type: "int32",
			},
		} as const,
	})

	t.before(async () => {
		await bongo.migrate()
	})

	t.afterEach(async () => {
		await foo.drop().run(tr)
	})

	t.teardown(async () => {
		await bongo.drop()
		await bongo.close()
	})

	await t.test("save updates the object", async (t) => {
		const obj = await foo
			.create({
				foo: 42,
				bar: 42,
			})
			.transact(tr)

		obj.bar = 44
		await foo.save(obj).transact(tr)

		const actual = await foo.findOne({ foo: 42 }).run(tr)

		t.match(actual, { foo: 42, bar: 44 })
	})

	await t.test("save updates with missing optional property", async (t) => {
		const obj = await foo
			.create({
				foo: 42,
			})
			.transact(tr)

		obj.bar = 44
		await foo.save(obj).transact(tr)

		const actual = await foo.findOne({ foo: 42 }).run(tr)

		t.match(actual, { foo: 42, bar: 44 })
	})
})
