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
			"Too many items found",
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
			"Model not found: unknown-id",
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
				},
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
						.transact(tr),
				)
			})
			.transact(tr)
	})
})

test("collection.find by timestamp", async (t) => {
	const bongo = new Bongo()
	const foo = bongo.collection({
		name: "doc:foo:find:timestamp",
		schema: {
			createdAt: { type: "timestamp" },
			value: { type: "int32" },
		} as const,
	})

	t.before(async () => {
		await bongo.migrate()
	})
	t.afterEach(async () => {
		await foo.drop().run(bongo.tr)
	})
	t.teardown(async () => {
		await bongo.drop()
		await bongo.close()
	})

	await t.test("creates with timestamps", async (t) => {
		const date = new Date()
		const dateStr = date.toISOString()

		await foo
			.createAll([
				{ createdAt: date, value: 1 },
				{ createdAt: dateStr, value: 2 },
			])
			.transact(bongo.tr)

		const found = await foo.find({}).run(bongo.tr)
		t.match(found, [
			{ createdAt: dateStr, value: 1 },
			{ createdAt: dateStr, value: 2 },
		])
	})

	await t.test("finds with exact match on ISO string", async (t) => {
		const date = new Date()

		await foo
			.createAll([
				{ createdAt: date, value: 1 },
				{ createdAt: new Date(date.getTime() + 10000), value: 2 },
			])
			.transact(bongo.tr)

		const found = await foo
			.find({ createdAt: date.toISOString() })
			.run(bongo.tr)
		t.match(found, [{ createdAt: date.toISOString(), value: 1 }])
	})

	await t.test("finds with exact match on Date object", async (t) => {
		const date = new Date()

		await foo
			.createAll([
				{ createdAt: date, value: 1 },
				{ createdAt: new Date(date.getTime() + 10000), value: 2 },
			])
			.transact(bongo.tr)

		const found = await foo.find({ createdAt: date }).run(bongo.tr)
		t.match(found, [{ createdAt: date.toISOString(), value: 1 }])
	})

	await t.test("finds with lt/gt comparison", async (t) => {
		const date = new Date()
		const ts1 = new Date(date.getTime() - 10000)
		const ts2 = date
		const ts3 = new Date(date.getTime() + 10000)

		await foo
			.createAll([
				{ createdAt: ts1, value: 1 },
				{ createdAt: ts2, value: 2 },
				{ createdAt: ts3, value: 3 },
			])
			.transact(bongo.tr)

		const cases = [
			{
				query: { createdAt: { $lt: date } },
				expected: [{ createdAt: ts1.toISOString(), value: 1 }],
			},
			{
				query: { createdAt: { $lte: date } },
				expected: [
					{ createdAt: ts1.toISOString(), value: 1 },
					{ createdAt: ts2.toISOString(), value: 2 },
				],
			},
			{
				query: { createdAt: { $gt: date } },
				expected: [{ createdAt: ts3.toISOString(), value: 3 }],
			},
			{
				query: { createdAt: { $gte: date } },
				expected: [
					{ createdAt: ts2.toISOString(), value: 2 },
					{ createdAt: ts3.toISOString(), value: 3 },
				],
			},
			{
				query: {
					$or: [
						{ createdAt: { $lt: date } },
						{ createdAt: { $gt: date } },
					],
				},
				expected: [
					{ createdAt: ts1.toISOString(), value: 1 },
					{ createdAt: ts3.toISOString(), value: 3 },
				],
			},
		]

		for (const { query, expected } of cases) {
			const found = await foo.find(query).run(bongo.tr)
			t.match(found, expected)
		}
	})
})
