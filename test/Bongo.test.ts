import { chain, sequence } from "@dumpstate/dbaction/lib/PG"
import { Pool } from "pg"
import { test } from "tap"
import { Bongo } from "../src/Bongo"
import { nested } from "../src/model"

test("Bongo", async (t) => {
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

	t.before(async () => {
		await bongo.migrate()
	})

	t.teardown(async () => {
		await bongo.drop()
		await bongo.close()
	})

	t.afterEach(async () => {
		await foo.drop().run(bongo.tr)
	})

	await t.test("foo", async (t) => {
		const newFoo = await foo
			.create({
				foo: 42,
				bar: "ouch",
				baz: "FOO",
			})
			.run(bongo.tr)

		t.ok(bongo)
		t.ok(newFoo.id)

		newFoo.foo = 22

		await foo.save(newFoo).run(bongo.tr)

		t.ok(newFoo.foo === 22)
	})

	await t.test("foo with transact", async (t) => {
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

		t.ok((await foo.find({}).run(bongo.tr)).length === 2)
		t.ok(await foo.findOne({ foo: 44 }).run(bongo.tr))
		t.ok(await foo.findOne({ foo: 45 }).run(bongo.tr))
	})

	await t.test("foo on rollback", async (t) => {
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

		t.ok((await foo.find({}).run(bongo.tr)).length == 0)
	})

	await t.test("foo with run and failure", async (t) => {
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

		t.ok((await foo.find({}).run(bongo.tr)).length == 1)
		t.ok(await foo.findOne({ foo: 44 }).run(bongo.tr))
	})

	await t.test("foo with chain of actions", async (t) => {
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

		t.ok(items.length === 2)
	})

	await t.test("find foo in a sequence", async (t) => {
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
			foo.find({ foo: 53 }),
			foo.find({ foo: 55 }),
			foo.find({ foo: 52 }),
		).run(bongo.tr)

		t.ok(items.length === 3)
		t.match(items[0], [{ foo: 53 }])
		t.match(items[1], [{ foo: 55 }])
		t.match(items[2], [{ foo: 52 }])
	})

	await t.test(
		"foo unsafe getters return same as regular getters",
		async (t) => {
			const item = await foo
				.create({
					foo: 42,
					bar: "foo",
				})
				.transact(bongo.tr)

			t.equal(item.foo$, item.foo)
			t.equal(item.bar$, item.bar)
		},
	)

	await t.test("return collection if already exists", async (t) => {
		const foo2 = bongo.collection({
			name: "foo",
			prefix: "foo",
			schema: {
				foo: { type: "int32" },
				bar: { type: "string" },
				baz: { enum: ["FOO", "BAR"] },
			} as const,
		})

		t.equal(foo2, foo)
	})

	await t.test("raise if different schema under same name", async (t) => {
		t.throws(
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

test("create bongo with collection of discriminated union objects", async (t) => {
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

	t.before(async () => {
		await bongo.migrate()
	})

	t.teardown(async () => {
		await bongo.drop()
		await bongo.close()
	})

	t.afterEach(async () => {
		await baz.drop().run(bongo.tr)
	})

	await t.test("baz", async (t) => {
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

		t.match(items[0].baz, { type: "FOO", foo: 44 })
		t.match(items[1].baz, { type: "BAR", bar: "bar" })
	})
})

test("create collection with nested document as properties", async (t) => {
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

	t.before(async () => {
		await bongo.migrate()
	})

	t.teardown(async () => {
		await bongo.drop()
		await bongo.close()
	})

	t.afterEach(async () => {
		await foo.drop().run(bongo.tr)
		await bar.drop().run(bongo.tr)
	})

	await t.test("create document with a nested doc", async (t) => {
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

		t.match(actual, barItem)
		t.match(actual.nestedFoo$.foo, fooItem.foo$)
	})
})

test("create collection with nested document as reference", async (t) => {
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

	t.before(async () => {
		await bongo.migrate()
	})

	t.teardown(async () => {
		await bongo.drop()
		await bongo.close()
	})

	t.afterEach(async () => {
		await foo.drop().run(bongo.tr)
		await bar.drop().run(bongo.tr)
	})

	await t.test("create document with a nested doc", async (t) => {
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

		t.match(actual, barItem)
		t.match(actual.nestedFoo$.id, fooItem.id)
		t.match(actual.nestedFoo$.foo, fooItem.foo$)
	})
})
