import { Pool } from "pg"
import { test } from "tap"
import { Bongo } from "../src/Bongo"
import { chain, sequence } from "../src/DBAction"

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
		await foo.drop().run(bongo.cp)
	})

	await t.test("foo", async (t) => {
		const newFoo = await foo
			.create({
				foo: 42,
				bar: "ouch",
				baz: "FOO",
			})
			.run(bongo.cp)

		t.ok(bongo)
		t.ok(newFoo.id)

		newFoo.foo = 22

		await foo.save(newFoo).run(bongo.cp)

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
				})
			)
			.transact(bongo.cp)

		t.ok((await foo.find({}).run(bongo.cp)).length === 2)
		t.ok(await foo.findOne({ foo: 44 }).run(bongo.cp))
		t.ok(await foo.findOne({ foo: 45 }).run(bongo.cp))
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
					} as any)
				)
				.transact(bongo.cp)
		} catch (_) {}

		t.ok((await foo.find({}).run(bongo.cp)).length == 0)
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
					} as any)
				)
				.run(bongo.cp)
		} catch (_) {}

		t.ok((await foo.find({}).run(bongo.cp)).length == 1)
		t.ok(await foo.findOne({ foo: 44 }).run(bongo.cp))
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
			() => foo.find({})
		).transact(bongo.cp)

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
			.transact(bongo.cp)

		const items = await sequence(
			foo.find({ foo: 53 }),
			foo.find({ foo: 55 }),
			foo.find({ foo: 52 })
		).run(bongo.cp)

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
				.transact(bongo.cp)

			t.equal(item.foo$, item.foo)
			t.equal(item.bar$, item.bar)
		}
	)
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
