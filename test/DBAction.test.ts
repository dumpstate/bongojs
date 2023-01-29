import { test } from "tap"
import { Bongo } from "../src/Bongo"
import { pure } from "../src/DBAction"

test("pure", async (t) => {
	const bongo = new Bongo()

	t.teardown(async () => {
		await bongo.close()
	})

	await t.test("should wrap a value with DBAction", async (t) => {
		const res = await pure(42).run(bongo.cp)
		t.ok(res === 42)
	})

	await t.test("should wrap a promise with DBAction", async (t) => {
		const res = await pure(Promise.resolve(43)).run(bongo.cp)
		t.ok(res === 43)
	})

	await t.test("should allow to lazy evaluate promise", async (t) => {
		const res = await pure(() => Promise.resolve(44)).run(bongo.cp)
		t.ok(res === 44)
	})
})
