import { test } from "tap"

import { Bongo } from "../../src/Bongo"

test("collection.find", async (t) => {
	const bongo = new Bongo()
	const foo = bongo.collection({
		name: "doc:foo:find",
		schema: {
			properties: {
				foo: { type: "int32" },
			},
			optionalProperties: {
				bar: { type: "int32" },
			},
		} as const,
	})

	t.before(async () => {
		await bongo.migrate()
	})

	t.afterEach(async () => {
		await foo.drop()
	})

	t.teardown(async () => {
		await bongo.drop()
		await bongo.close()
	})

	await t.test("returns one matching item", async (t) => {
		await foo.createAll([{ foo: 10 }, { foo: 11 }, { foo: 12 }])

		const found = await foo.find({ foo: 11 })

		t.match(found, [{ foo: 11 }])
	})

	await t.test("returns all items when empty query", async (t) => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }, { foo: 3 }])

		const found = await foo.find({})

		t.match(found, [{ foo: 1 }, { foo: 2 }, { foo: 3 }])
	})

	await t.test("returns empty array when no matches", async (t) => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }])

		const found = await foo.find({ foo: 3 })

		t.equal(found.length, 0)
	})

	await t.test("returns multiple matching items", async (t) => {
		await foo.createAll([
			{ foo: 1, bar: 1 },
			{ foo: 2, bar: 2 },
			{ foo: 1, bar: 3 },
			{ foo: 3, bar: 4 },
			{ foo: 1, bar: 5 },
			{ foo: 1 },
		])

		const found = await foo.find({ foo: 1 })

		t.match(found, [
			{ foo: 1, bar: 1 },
			{ foo: 1, bar: 3 },
			{ foo: 1, bar: 5 },
			{ foo: 1 },
		])
	})

	await t.test("findOne returns null when not found", async (t) => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }])

		const found = await foo.findOne({ foo: 10 })

		t.equal(found, null)
	})

	await t.test("findOne throws when more than one found", async (t) => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }, { foo: 1 }])

		t.rejects(
			async () => {
				await foo.findOne({ foo: 1 })
			},
			{},
			"Too many items found"
		)
	})

	await t.test("findById returns matching item", async (t) => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }])
		const { id } = await foo.create({ foo: 3 })

		const found = await foo.findById(id)

		t.match(found, {
			id,
			foo: 3,
		})
	})

	await t.test("findById throws when element not found", async (t) => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }])

		t.rejects(
			async () => {
				await foo.findById("unknown-id")
			},
			{},
			"Model not found: unknown-id"
		)
	})

	await t.test("find with an alternative", async (t) => {
		await foo.createAll([
			{ foo: 1 },
			{ foo: 2, bar: 2 },
			{ foo: 3, bar: 3 },
			{ foo: 4, bar: 3 },
			{ foo: 5 },
		])

		const actual = await foo.find({
			$or: [{ foo: 1 }, { bar: 3 }],
		})

		t.match(actual, [{ foo: 1 }, { foo: 3, bar: 3 }, { foo: 4, bar: 3 }])
	})

	await t.test("find with greater than matcher", async (t) => {
		await foo.createAll([
			{ foo: 1 },
			{ foo: 2, bar: 3 },
			{ foo: 3, bar: 4 },
			{ foo: 4, bar: 5 },
			{ foo: 5 },
		])

		const actual = await foo.find({
			$and: [{ foo: { $lt: 4 } }, { bar: { $gte: 4 } }],
		})

		t.match(actual, [{ foo: 3, bar: 4 }])
	})

	await t.test("find with $in matcher", async (t) => {
		await foo.createAll([
			{ foo: 1 },
			{ foo: 2 },
			{ foo: 2, bar: 4 },
			{ foo: 3 },
			{ foo: 4 },
		])

		const actual = await foo.find({
			foo: { $in: [2, 3] },
		})

		t.match(actual, [{ foo: 2 }, { foo: 2, bar: 4 }, { foo: 3 }])
	})
})
