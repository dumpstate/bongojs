import assert from "node:assert/strict"
import { chain, sequence } from "@dumpstate/dbaction/lib/PG"
import { Pool } from "pg"
import { Bongo } from "../src/Bongo"
import { nested } from "../src/model"
import { dropId } from "./utils"

describe("Bongo", async () => {
	const bongo = new Bongo()
	const foo = bongo.collection({
		name: "foo",
		prefix: "foo",
		schema: {
			foo: { type: "int32" },
			bar: { type: "string" },
			baz: { enum: ["FOO", "BAR"] },
		} as const,
	})

	before(async () => {
		await bongo.migrate()
	})

	after(async () => {
		await bongo.drop()
		await bongo.close()
	})

	afterEach(async () => {
		await foo.drop().run(bongo.tr)
	})

	it("foo", async () => {
		const newFoo = await foo
			.create({
				foo: 42,
				bar: "ouch",
				baz: "FOO",
			})
			.run(bongo.tr)

		assert(bongo)
		assert(newFoo.id)

		newFoo.foo = 22

		await foo.save(newFoo).run(bongo.tr)

		assert(newFoo.foo === 22)
	})

	it("foo with transact", async () => {
		await foo
			.create({
				foo: 44,
				bar: "foo",
			})
			.flatMap((_) =>
				foo.create({
					foo: 45,
					bar: "baz",
				}),
			)
			.transact(bongo.tr)

		assert((await foo.find({}).run(bongo.tr)).length === 2)
		assert(await foo.findOne({ foo: 44 }).run(bongo.tr))
		assert(await foo.findOne({ foo: 45 }).run(bongo.tr))
	})

	it("foo on rollback", async () => {
		try {
			await foo
				.create({
					foo: 44,
					bar: "foo",
				})
				.flatMap((_) =>
					foo.create({
						foo: "a string",
						bar: 42,
					} as any),
				)
				.transact(bongo.tr)
		} catch (_) {}

		assert((await foo.find({}).run(bongo.tr)).length == 0)
	})

	it("foo with run and failure", async () => {
		try {
			await foo
				.create({
					foo: 44,
					bar: "foo",
				})
				.flatMap((_) =>
					foo.create({
						foo: "a string",
						bar: 42,
					} as any),
				)
				.run(bongo.tr)
		} catch (_) {}

		assert((await foo.find({}).run(bongo.tr)).length == 1)
		assert(await foo.findOne({ foo: 44 }).run(bongo.tr))
	})

	it("foo with chain of actions", async () => {
		const items = await chain(
			foo.create({ foo: 52, bar: "foo" }),
			() => foo.findOne({ foo: 52 }),
			(item) => {
				if (!item) {
					throw Error("item not found")
				}

				return foo.create({ foo: 53, bar: `${item.foo}foo` })
			},
			() => foo.find({}),
		).transact(bongo.tr)

		assert(items.length === 2)
	})

	it("find foo in a sequence", async () => {
		await foo
			.createAll([
				{ foo: 52 },
				{ foo: 53 },
				{ foo: 54 },
				{ foo: 55 },
				{ foo: 56 },
			])
			.transact(bongo.tr)

		const items = await sequence(
			foo.findOne({ foo: 53 }),
			foo.findOne({ foo: 55 }),
			foo.findOne({ foo: 52 }),
		).run(bongo.tr)

		assert.deepEqual(items.map(dropId), [
			{ foo: 53, bar: undefined, baz: undefined },
			{ foo: 55, bar: undefined, baz: undefined },
			{ foo: 52, bar: undefined, baz: undefined },
		])
	})

	it("foo unsafe getters return same as regular getters", async () => {
		const item = await foo
			.create({
				foo: 42,
				bar: "foo",
			})
			.transact(bongo.tr)

		assert.equal(item.foo$, item.foo)
		assert.equal(item.bar$, item.bar)
	})

	it("return collection if already exists", async () => {
		const foo2 = bongo.collection({
			name: "foo",
			prefix: "foo",
			schema: {
				foo: { type: "int32" },
				bar: { type: "string" },
				baz: { enum: ["FOO", "BAR"] },
			} as const,
		})

		assert.equal(foo2, foo)
	})

	it("raise if different schema under same name", async () => {
		assert.throws(
			() =>
				bongo.collection({
					name: "foo",
					prefix: "f",
					schema: {
						foo: { type: "int32" },
					} as const,
				}),
			new Error("Doctype foo already registered with different schema"),
		)
	})
})

describe("create bongo for an existing Pool", async () => {
	const bongo = new Bongo(new Pool())

	after(async () => {
		await bongo.close()
	})

	it("pool is usable", async () => {
		const conn = await bongo.pg.connect()
		const res = await conn.query("select 1")
		conn.release()
		assert(res)
	})
})

describe("create bongo with collection of discriminated union objects", async () => {
	const bongo = new Bongo()
	const baz = bongo.collection({
		name: "baz",
		prefix: "baz",
		schema: {
			baz: {
				discriminator: "type",
				mapping: {
					FOO: {
						properties: {
							foo: { type: "int32" },
						},
					},
					BAR: {
						properties: {
							bar: { type: "string" },
						},
					},
				},
			},
		} as const,
	})

	before(async () => {
		await bongo.migrate()
	})

	after(async () => {
		await bongo.drop()
		await bongo.close()
	})

	afterEach(async () => {
		await baz.drop().run(bongo.tr)
	})

	it("baz", async () => {
		const items = await baz
			.createAll([
				{
					baz: {
						type: "FOO",
						foo: 44,
					},
				},
				{
					baz: {
						type: "BAR",
						bar: "bar",
					},
				},
			])
			.transact(bongo.tr)

		assert.deepEqual(items.at(0)?.baz, { type: "FOO", foo: 44 })
		assert.deepEqual(items.at(1)?.baz, { type: "BAR", bar: "bar" })
	})
})

describe("create collection with nested document as properties", async () => {
	const bongo = new Bongo()
	const Foo = {
		name: "foo",
		schema: {
			foo: { type: "string" },
			baz: { type: "string" },
		} as const,
	}
	const Bar = {
		name: "bar",
		schema: {
			bar: { type: "string" },
			nestedFoo: { properties: Foo.schema },
		} as const,
	}
	const foo = bongo.collection(Foo)
	const bar = bongo.collection(Bar)

	before(async () => {
		await bongo.migrate()
	})

	after(async () => {
		await bongo.drop()
		await bongo.close()
	})

	afterEach(async () => {
		await foo.drop().run(bongo.tr)
		await bar.drop().run(bongo.tr)
	})

	it("create document with a nested doc", async () => {
		const fooItem = await foo
			.create({ foo: "foo-value" })
			.transact(bongo.tr)
		const barItem = await bar
			.create({
				bar: "bar-value",
				nestedFoo: nested(fooItem),
			})
			.transact(bongo.tr)
		const actual = await bar.findById(barItem.id).run(bongo.tr)

		assert.deepEqual(actual, {
			bar: barItem.bar$,
			id: barItem.id,
			nestedFoo: {
				foo: fooItem.foo$,
			},
		})
		assert.deepEqual(actual.nestedFoo$.foo, fooItem.foo$)
	})
})

describe("create collection with nested document as reference", async () => {
	const bongo = new Bongo()
	const Foo = {
		name: "foo",
		schema: {
			foo: { type: "string" },
			baz: { type: "string" },
		} as const,
	}
	const Bar = {
		name: "bar",
		schema: {
			bar: { type: "string" },
			nestedFoo: { ref: Foo },
		} as const,
	}
	const foo = bongo.collection(Foo)
	const bar = bongo.collection(Bar)

	before(async () => {
		await bongo.migrate()
	})

	after(async () => {
		await bongo.drop()
		await bongo.close()
	})

	afterEach(async () => {
		await foo.drop().run(bongo.tr)
		await bar.drop().run(bongo.tr)
	})

	it("create document with a nested doc", async () => {
		const fooItem = await foo
			.create({ foo: "foo-value" })
			.transact(bongo.tr)
		const barItem = await bar
			.create({
				bar: "bar-value",
				nestedFoo: fooItem,
			})
			.transact(bongo.tr)
		const actual = await bar.findById(barItem.id).run(bongo.tr)

		assert.deepEqual(actual, {
			bar: barItem.bar$,
			id: barItem.id,
			nestedFoo: {
				foo: fooItem.foo$,
				id: fooItem.id,
			},
		})
		assert.deepEqual(actual.nestedFoo$.id, fooItem.id)
		assert.deepEqual(actual.nestedFoo$.foo, fooItem.foo$)
	})
})
