import { pure } from "@dumpstate/dbaction"
import { test } from "tap"

import { Bongo } from "../../src/Bongo"

test("collection.find", async (t) => {
	const bongo = new Bongo()
	const tr = bongo.tr
	const foo = bongo.collection({
		name: "doc:foo:find",
		schema: {
			foo: { type: "int32" },
			bar: { type: "int32" },
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

	await t.test("returns one matching item", async (t) => {
		await foo.createAll([{ foo: 10 }, { foo: 11 }, { foo: 12 }]).run(tr)

		const found = await foo.find({ foo: 11 }).run(tr)

		t.match(found, [{ foo: 11 }])
	})

	await t.test("returns all items when empty query", async (t) => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).run(tr)

		const found = await foo.find({}).run(tr)

		t.match(found, [{ foo: 1 }, { foo: 2 }, { foo: 3 }])
	})

	await t.test("returns empty array when no matches", async (t) => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }]).run(tr)

		const found = await foo.find({ foo: 3 }).run(tr)

		t.equal(found.length, 0)
	})

	await t.test("returns multiple matching items", async (t) => {
		await foo
			.createAll([
				{ foo: 1, bar: 1 },
				{ foo: 2, bar: 2 },
				{ foo: 1, bar: 3 },
				{ foo: 3, bar: 4 },
				{ foo: 1, bar: 5 },
				{ foo: 1 },
			])
			.run(tr)

		const found = await foo.find({ foo: 1 }).run(tr)

		t.match(found, [
			{ foo: 1, bar: 1 },
			{ foo: 1, bar: 3 },
			{ foo: 1, bar: 5 },
			{ foo: 1 },
		])
	})

	await t.test("findOne returns null when not found", async (t) => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }]).run(tr)

		const found = await foo.findOne({ foo: 10 }).run(tr)

		t.equal(found, null)
	})

	await t.test("findOne throws when more than one found", async (t) => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }, { foo: 1 }]).run(tr)

		t.rejects(
			async () => {
				await foo.findOne({ foo: 1 }).run(tr)
			},
			{},
			"Too many items found"
		)
	})

	await t.test("findById returns matching item", async (t) => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }]).run(tr)
		const { id } = await foo.create({ foo: 3 }).run(tr)

		const found = await foo.findById(id).run(tr)

		t.match(found, {
			id,
			foo: 3,
		})
	})

	await t.test("findById throws when element not found", async (t) => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }]).run(tr)

		t.rejects(
			async () => {
				await foo.findById("unknown-id").run(tr)
			},
			{},
			"Model not found: unknown-id"
		)
	})

	await t.test("find with an alternative", async (t) => {
		await foo
			.createAll([
				{ foo: 1 },
				{ foo: 2, bar: 2 },
				{ foo: 3, bar: 3 },
				{ foo: 4, bar: 3 },
				{ foo: 5 },
			])
			.run(tr)

		const actual = await foo
			.find({
				$or: [{ foo: 1 }, { bar: 3 }],
			})
			.run(tr)

		t.match(actual, [{ foo: 1 }, { foo: 3, bar: 3 }, { foo: 4, bar: 3 }])
	})

	await t.test("find with greater than matcher", async (t) => {
		await foo
			.createAll([
				{ foo: 1 },
				{ foo: 2, bar: 3 },
				{ foo: 3, bar: 4 },
				{ foo: 4, bar: 5 },
				{ foo: 5 },
			])
			.run(tr)

		const actual = await foo
			.find({
				$and: [{ foo: { $lt: 4 } }, { bar: { $gte: 4 } }],
			})
			.run(tr)

		t.match(actual, [{ foo: 3, bar: 4 }])
	})

	await t.test("find with $in matcher", async (t) => {
		await foo
			.createAll([
				{ foo: 1 },
				{ foo: 2 },
				{ foo: 2, bar: 4 },
				{ foo: 3 },
				{ foo: 4 },
			])
			.run(tr)

		const actual = await foo
			.find({
				foo: { $in: [2, 3] },
			})
			.run(tr)

		t.match(actual, [{ foo: 2 }, { foo: 2, bar: 4 }, { foo: 3 }])
	})

	await t.test("find with limit", async (t) => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).transact(tr)

		const actual = await foo.find({}, { limit: 2 }).run(tr)

		t.match(actual, [{ foo: 1 }, { foo: 2 }])
	})

	await t.test("find with offset and limit", async (t) => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).transact(tr)

		const actual = await foo.find({}, { limit: 3, offset: 1 }).run(tr)

		t.match(actual, [{ foo: 2 }, { foo: 3 }])
	})

	await t.test("find with sort, ascending", async (t) => {
		await foo
			.createAll([
				{ foo: 1, bar: 2 },
				{ foo: 2, bar: 1 },
				{ foo: 3, bar: 3 },
			])
			.transact(tr)

		const actual = await foo.find({}, { sort: [["bar", "ASC"]] }).run(tr)

		t.match(actual, [
			{ foo: 2, bar: 1 },
			{ foo: 1, bar: 2 },
			{ foo: 3, bar: 3 },
		])
	})

	await t.test("find with sort, descending", async (t) => {
		await foo
			.createAll([
				{ foo: 1, bar: 2 },
				{ foo: 1, bar: 1 },
				{ foo: 3, bar: 3 },
			])
			.transact(tr)

		const actual = await foo.find({}, { sort: [["bar", "DESC"]] }).run(tr)

		t.match(actual, [
			{ foo: 3, bar: 3 },
			{ foo: 1, bar: 2 },
			{ foo: 1, bar: 1 },
		])
	})

	await t.test("find with sort, multiple props", async (t) => {
		await foo
			.createAll([
				{ foo: 3, bar: 2 },
				{ foo: 1, bar: 1 },
				{ foo: 1, bar: 4 },
				{ foo: 2, bar: 3 },
			])
			.transact(tr)

		const actual = await foo
			.find(
				{},
				{
					sort: [
						["foo", "ASC"],
						["bar", "DESC"],
					],
				}
			)
			.run(tr)

		t.match(actual, [
			{ foo: 1, bar: 4 },
			{ foo: 1, bar: 1 },
			{ foo: 2, bar: 3 },
			{ foo: 3, bar: 2 },
		])
	})

	await t.test("count should count rows", async (t) => {
		await foo
			.createAll([
				{ foo: 3, bar: 1 },
				{ foo: 3, bar: 2 },
				{ foo: 4, bar: 3 },
				{ foo: 5, bar: 4 },
				{ foo: 3, bar: 5 },
			])
			.run(tr)

		const actual = await foo.count({ foo: 3 }).run(tr)

		t.equal(actual, 3)
	})

	await t.test("should lock rows when requested", async (t) => {
		await foo
			.createAll([
				{ foo: 3, bar: 1 },
				{ foo: 3, bar: 2 },
				{ foo: 4, bar: 3 },
				{ foo: 5, bar: 4 },
			])
			.run(tr)

		await foo
			.find({}, { limit: 2, forUpdate: true })
			.flatMap((actualFirst) => {
				t.match(actualFirst, [
					{ foo: 3, bar: 1 },
					{ foo: 3, bar: 2 },
				])

				return pure(
					foo
						.find({}, { limit: 2, forUpdate: true })
						.map((actualSecond) => {
							t.match(actualSecond, [
								{ foo: 4, bar: 3 },
								{ foo: 5, bar: 4 },
							])
						})
						.transact(tr)
				)
			})
			.transact(tr)
	})
})
