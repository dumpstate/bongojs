import assert from "node:assert/strict"
import { pure } from "@dumpstate/dbaction"
import { Bongo } from "../../src/Bongo"
import { dropId } from "../utils"

describe("collection.find", async () => {
	const bongo = new Bongo()
	const tr = bongo.tr
	const foo = bongo.collection({
		name: "doc:foo:find",
		schema: {
			foo: { type: "int32" },
			bar: { type: "int32" },
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

	it("returns one matching item", async () => {
		await foo.createAll([{ foo: 10 }, { foo: 11 }, { foo: 12 }]).run(tr)

		const found = await foo.find({ foo: 11 }).run(tr)

		assert.deepEqual(found.map(dropId), [{ foo: 11, bar: undefined }])
	})

	it("returns all items when empty query", async () => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).run(tr)

		const found = await foo.find({}).run(tr)

		assert.deepEqual(found.map(dropId), [
			{ foo: 1, bar: undefined },
			{ foo: 2, bar: undefined },
			{ foo: 3, bar: undefined },
		])
	})

	it("returns empty array when no matches", async () => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }]).run(tr)

		const found = await foo.find({ foo: 3 }).run(tr)

		assert.equal(found.length, 0)
	})

	it("returns multiple matching items", async () => {
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

		assert.deepEqual(found.map(dropId), [
			{ foo: 1, bar: 1 },
			{ foo: 1, bar: 3 },
			{ foo: 1, bar: 5 },
			{ foo: 1, bar: undefined },
		])
	})

	it("findOne returns null when not found", async () => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }]).run(tr)

		const found = await foo.findOne({ foo: 10 }).run(tr)

		assert.equal(found, null)
	})

	it("findOne throws when more than one found", async () => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }, { foo: 1 }]).run(tr)

		assert.rejects(
			async () => {
				await foo.findOne({ foo: 1 }).run(tr)
			},
			{},
			"Too many items found",
		)
	})

	it("findById returns matching item", async () => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }]).run(tr)
		const { id } = await foo.create({ foo: 3 }).run(tr)

		const found = await foo.findById(id).run(tr)

		assert.deepEqual(found, {
			id,
			foo: 3,
			bar: undefined,
		})
	})

	it("findById throws when element not found", async () => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }]).run(tr)

		assert.rejects(
			async () => {
				await foo.findById("unknown-id").run(tr)
			},
			{},
			"Model not found: unknown-id",
		)
	})

	it("find with an alternative", async () => {
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

		assert.deepEqual(actual.map(dropId), [
			{ foo: 1, bar: undefined },
			{ foo: 3, bar: 3 },
			{ foo: 4, bar: 3 },
		])
	})

	it("find with greater than matcher", async () => {
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

		assert.deepEqual(actual.map(dropId), [{ foo: 3, bar: 4 }])
	})

	it("find with $in matcher", async () => {
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

		assert.deepEqual(actual.map(dropId), [
			{ foo: 2, bar: undefined },
			{ foo: 2, bar: 4 },
			{ foo: 3, bar: undefined },
		])
	})

	it("find with limit", async () => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).transact(tr)

		const actual = await foo.find({}, { limit: 2 }).run(tr)

		assert.deepEqual(actual.map(dropId), [
			{ foo: 1, bar: undefined },
			{ foo: 2, bar: undefined },
		])
	})

	it("find with offset and limit", async () => {
		await foo.createAll([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).transact(tr)

		const actual = await foo.find({}, { limit: 3, offset: 1 }).run(tr)

		assert.deepEqual(actual.map(dropId), [
			{ foo: 2, bar: undefined },
			{ foo: 3, bar: undefined },
		])
	})

	it("find with sort, ascending", async () => {
		await foo
			.createAll([
				{ foo: 1, bar: 2 },
				{ foo: 2, bar: 1 },
				{ foo: 3, bar: 3 },
			])
			.transact(tr)

		const actual = await foo.find({}, { sort: [["bar", "ASC"]] }).run(tr)

		assert.deepEqual(actual.map(dropId), [
			{ foo: 2, bar: 1 },
			{ foo: 1, bar: 2 },
			{ foo: 3, bar: 3 },
		])
	})

	it("find with sort, descending", async () => {
		await foo
			.createAll([
				{ foo: 1, bar: 2 },
				{ foo: 1, bar: 1 },
				{ foo: 3, bar: 3 },
			])
			.transact(tr)

		const actual = await foo.find({}, { sort: [["bar", "DESC"]] }).run(tr)

		assert.deepEqual(actual.map(dropId), [
			{ foo: 3, bar: 3 },
			{ foo: 1, bar: 2 },
			{ foo: 1, bar: 1 },
		])
	})

	it("find with sort, multiple props", async () => {
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

		assert.deepEqual(actual.map(dropId), [
			{ foo: 1, bar: 4 },
			{ foo: 1, bar: 1 },
			{ foo: 2, bar: 3 },
			{ foo: 3, bar: 2 },
		])
	})

	it("count should count rows", async () => {
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

		assert.equal(actual, 3)
	})

	it("should lock rows when requested", async () => {
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
				assert.deepEqual(actualFirst.map(dropId), [
					{ foo: 3, bar: 1 },
					{ foo: 3, bar: 2 },
				])

				return pure(
					foo
						.find({}, { limit: 2, forUpdate: true })
						.map((actualSecond) => {
							assert.deepEqual(actualSecond.map(dropId), [
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

describe("collection.find by timestamp", async () => {
	const bongo = new Bongo()
	const foo = bongo.collection({
		name: "doc:foo:find:timestamp",
		schema: {
			createdAt: { type: "timestamp" },
			value: { type: "int32" },
		} as const,
	})

	before(async () => {
		await bongo.migrate()
	})
	afterEach(async () => {
		await foo.drop().run(bongo.tr)
	})
	after(async () => {
		await bongo.drop()
		await bongo.close()
	})

	it("creates with timestamps", async () => {
		const date = new Date()
		const dateStr = date.toISOString()

		await foo
			.createAll([
				{ createdAt: date, value: 1 },
				{ createdAt: dateStr, value: 2 },
			])
			.transact(bongo.tr)

		const found = await foo.find({}).run(bongo.tr)
		assert.deepEqual(found.map(dropId), [
			{ createdAt: dateStr, value: 1 },
			{ createdAt: dateStr, value: 2 },
		])
	})

	it("finds with exacassert.deepEqual on ISO string", async () => {
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
		assert.deepEqual(found.map(dropId), [
			{ createdAt: date.toISOString(), value: 1 },
		])
	})

	it("finds with exacassert.deepEqual on Date object", async () => {
		const date = new Date()

		await foo
			.createAll([
				{ createdAt: date, value: 1 },
				{ createdAt: new Date(date.getTime() + 10000), value: 2 },
			])
			.transact(bongo.tr)

		const found = await foo.find({ createdAt: date }).run(bongo.tr)
		assert.deepEqual(found.map(dropId), [
			{ createdAt: date.toISOString(), value: 1 },
		])
	})

	it("finds with lt/gt comparison", async () => {
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
			assert.deepEqual(found.map(dropId), expected)
		}
	})
})
