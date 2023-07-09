import assert from "node:assert/strict"
import { Bongo } from "../../src/Bongo"
import { dropId } from "../utils"

describe("collection.save", () => {
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

	before(async () => {
		await bongo.migrate()
	})

	afterEach(async () => {
		await foo.drop().run(tr)
	})

	after(async () => {
		await bongo.drop()
		await bongo.close()
	})

	it("save updates the object", async () => {
		const obj = await foo
			.create({
				foo: 42,
				bar: 42,
			})
			.transact(tr)

		obj.bar = 44
		await foo.save(obj).transact(tr)

		const actual = await foo.findOne({ foo: 42 }).run(tr)

		assert.deepEqual(dropId(actual), { foo: 42, bar: 44 })
	})

	it("save updates with missing optional property", async () => {
		const obj = await foo
			.create({
				foo: 42,
			})
			.transact(tr)

		obj.bar = 44
		await foo.save(obj).transact(tr)

		const actual = await foo.findOne({ foo: 42 }).run(tr)

		assert.deepEqual(dropId(actual), { foo: 42, bar: 44 })
	})
})
