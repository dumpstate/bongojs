#!/usr/bin/env node

import { Argument, Command } from "commander"

import { Bongo } from "./Bongo"

const program = new Command()

program
	.command("migrate")
	.addArgument(new Argument("<direction>").choices(["up", "down"]))
	.description("applies database migrations")
	.action(async (direction: string) => {
		const bongo = new Bongo()

		// TODO add a way to create indexes + run user migrations

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
