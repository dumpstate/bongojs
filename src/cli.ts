#!/usr/bin/env node

import { join } from "path"

import { Argument, Command } from "commander"

import { Bongo } from "./Bongo"

const program = new Command()

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

program
	.command("migrate")
	.addArgument(new Argument("<direction>").choices(["up", "down"]))
	.addArgument(new Argument("<path>").argOptional())
	.description("applies database migrations")
	.action(async (direction: string, path?: string) => {
		const bongo = loadBongo(path)

		switch (direction) {
			case "up":
				console.log("Migrating UP")

				try {
					await bongo.migrate()

					console.log("Done. Closing DB connection.")
					await bongo.close()
				} catch (err) {
					console.error(err)
					process.exit(1)
				}

				process.exit(0)
			case "down":
				try {
					await bongo.drop()
					await bongo.close()
				} catch (err) {
					console.error(err)
					process.exit(1)
				}

				process.exit(0)
			default:
				throw Error(`Unknown direction: ${direction}`)
		}
	})

program.parse(process.argv)
