import assert from "node:assert/strict"
import { Pool } from "pg"
import { includes } from "lodash"
import { Bongo } from "../src/Bongo"
import { REVISIONS } from "../src/schema"

async function getTables(pg: Pool): Promise<string[]> {
	return (
		await pg.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
    `)
	).rows.map((row) => row.table_name)
}

describe("migrateUp", () => {
	const bongo = new Bongo()

	after(async () => {
		await bongo.drop()
		await bongo.close()
	})

	it("should create tables", async () => {
		await bongo.migrate()
		const tables = await getTables(bongo.pg)

		assert.ok(includes(tables, "bongo_revision"))
		assert.ok(includes(tables, "bongo_documents"))
	})

	it("should set revision to the latest", async () => {
		await bongo.migrate()

		const revision = (
			await bongo.pg.query(`
            SELECT revision
            FROM bongo_revision
        `)
		).rows[0].revision

		assert.equal(revision, Math.max(...REVISIONS.map((r) => r.id)))
	})
})

describe("migrateDown", () => {
	const bongo = new Bongo()

	before(async () => {
		await bongo.migrate()
	})

	after(async () => {
		await bongo.close()
	})

	it("should drop tables", async () => {
		await bongo.drop()
		const tables = await getTables(bongo.pg)

		assert.ok(!includes(tables, "bongo_revision"))
		assert.ok(!includes(tables, "bongo_documents"))
	})
})
