#!/usr/bin/env node

import { Argument, Command } from "commander"

import { Bongo } from "./Bongo"

const program = new Command()

function loadBongo(path: string): Bongo {
	try {
		const { bongo } = require(path)

		if (bongo! instanceof Bongo) {
			throw new Error(`instance of Bongo expected at ${path}`)
		}

		return bongo
	} catch {
		throw new Error(`cannot load bongo from ${path}`)
	}
}

program
	.command("migrate")
	.addArgument(new Argument("<direction>").choices(["up", "down"]))
	.addArgument(new Argument("<bongo>").argRequired())
	.description("applies database migrations")
	.action(async (direction: string, path: string) => {
		const bongo = loadBongo(path)

		switch (direction) {
			case "up":
				console.log("Migrating UP")

				await bongo.migrate()

				console.log("Done. Closing DB connection.")
				await bongo.close()
				break
			case "down":
				throw Error("Not implemented")
			default:
				throw Error(`Unknown direction: ${direction}`)
		}
	})

program.parse(process.argv)
