#!/usr/bin/env node

import { join } from "path"

import minimist from "minimist"

import { Bongo } from "./Bongo"

function loadBongo(path?: string): Bongo {
	if (path) {
		const absPath = join(process.cwd(), path)

		try {
			const { bongo } = require(absPath)

			return bongo
		} catch (err) {
			console.error(err)
			throw new Error(`bongo not found at: ${absPath}`)
		}
	}

	return new Bongo()
}

async function migrateUp(path?: string) {
	console.log("Migrating UP")

	const bongo = loadBongo(path)

	try {
		await bongo.migrate()

		console.log("Done. Closing DB connection.")
		await bongo.close()
	} catch (err) {
		console.error(err)
		process.exit(1)
	}

	process.exit(0)
}

async function migrateDown(path?: string) {
	console.log("Migrating DOWN")

	const bongo = loadBongo(path)

	try {
		await bongo.drop()
		await bongo.close()
	} catch (err) {
		console.error(err)
		process.exit(1)
	}

	process.exit(0)
}

function usage() {
	console.log("node ./lib/cli.js migrate <DIR> [<PATH>]")
	console.log("\t<DIR> - either 'up' or 'down'")
	console.log("\t<PATH> - optional path to script exporting bongo instance")
}

async function main() {
	const argv = minimist(process.argv.slice(2))

	if (argv._.length < 2 || argv._[0] !== "migrate") {
		usage()
		process.exit(1)
	}

	const path = argv._.length > 2 ? argv._[2] : undefined

	switch (argv._[1]) {
		case "up":
			await migrateUp(path)
			break
		case "down":
			await migrateDown(path)
			break
		default:
			usage()
			process.exit(1)
	}

	process.exit(0)
}

main()
