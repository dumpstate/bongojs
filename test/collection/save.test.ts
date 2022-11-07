import { test } from "tap"
import { Bongo } from "../../src/Bongo"

test("collection.save", async (t) => {
	const bongo = new Bongo()
	const { cp } = bongo
	const foo = bongo.collection({
		name: "doc:foo:save",
		schema: {
			properties: {
				foo: { type: "int32" },
			},
			optionalProperties: {
				bar: {
					type: "int32",
					nullable: true,
				},
			},
		} as const,
	})

	t.before(async () => {
		await bongo.migrate()
	})

	t.afterEach(async () => {
		await foo.drop().run(cp)
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
			.transact(cp)

		obj.bar = 44
		await foo.save(obj).transact(cp)

		const actual = await foo.findOne({ foo: 42 }).run(cp)

		t.match(actual, { foo: 42, bar: 44 })
	})

	await t.test("save updates with missing optional property", async (t) => {
		const obj = await foo
			.create({
				foo: 42,
			})
			.transact(cp)

		obj.bar = 44
		await foo.save(obj).transact(cp)

		const actual = await foo.findOne({ foo: 42 }).run(cp)

		t.match(actual, { foo: 42, bar: 44 })
	})
})
