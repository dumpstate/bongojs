import tap from "tap"

import { Bongo } from "../../src/Bongo"

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

tap.afterEach(async () => {
	await foo.drop()
})

tap.teardown(async () => {
	await bongo.close()
})

tap.test("find returns one matching item", async (t) => {
	await foo.createAll([{ foo: 10 }, { foo: 11 }, { foo: 12 }])

	const found = await foo.find({ foo: 11 })

	t.match(found, [{ foo: 11 }])
})

tap.test("find returns all items when empty query", async (t) => {
	await foo.createAll([{ foo: 1 }, { foo: 2 }, { foo: 3 }])

	const found = await foo.find({})

	t.match(found, [{ foo: 1 }, { foo: 2 }, { foo: 3 }])
})

tap.test("find returns empty array when no matches", async (t) => {
	await foo.createAll([{ foo: 1 }, { foo: 2 }])

	const found = await foo.find({ foo: 3 })

	t.equal(found.length, 0)
})

tap.test("find returns multiple matching items", async (t) => {
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

tap.test("findOne returns null when not found", async (t) => {
	await foo.createAll([{ foo: 1 }, { foo: 2 }])

	const found = await foo.findOne({ foo: 10 })

	t.equal(found, null)
})

tap.test("findOne throws when more than one found", async (t) => {
	await foo.createAll([{ foo: 1 }, { foo: 2 }, { foo: 1 }])

	t.rejects(
		async () => {
			await foo.findOne({ foo: 1 })
		},
		{},
		"Too many items found"
	)
})

tap.test("findById returns matching item", async (t) => {
	await foo.createAll([{ foo: 1 }, { foo: 2 }])
	const { id } = await foo.create({ foo: 3 })

	const found = await foo.findById(id)

	t.match(found, {
		id,
		foo: 3,
	})
})

tap.test("findById throws when element not found", async (t) => {
	await foo.createAll([{ foo: 1 }, { foo: 2 }])

	t.rejects(
		async () => {
			await foo.findById("unknown-id")
		},
		{},
		"Model not found: unknown-id"
	)
})
