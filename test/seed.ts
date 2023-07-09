import { ulid } from "ulid"

import { Bongo, Schema } from "../src/index"

const USERS_COUNT = 1000
const TASKS_COUNT = 1000

const User = {
	name: "user",
	schema: {
		email: { type: "string" },
		passHash: { type: "string" },
		name: {
			properties: {
				first: { type: "string" },
				last: { type: "string" },
			},
		},
		audit: {
			properties: {
				createdAt: { type: "timestamp" },
				updatedAt: { type: "timestamp" },
			},
		},
	},
} as const
type UserType = Schema<typeof User>

const Task = {
	name: "task",
	schema: {
		audit: {
			properties: {
				createdAt: { type: "timestamp" },
			},
		},
		task: {
			discriminator: "type",
			mapping: {
				FIRST_ACTION: {
					properties: {
						foo: { type: "string" },
						bar: { type: "string" },
					},
				},
				SECOND_ACTION: {
					properties: {
						baz: { type: "string" },
					},
				},
			},
		},
	},
} as const
type TaskType = Schema<typeof Task>

function nextStr(): string {
	return ulid()
}

function nextUser(): UserType {
	return {
		email: `${nextStr()}@example.com`,
		passHash: nextStr(),
		name: {
			first: nextStr(),
			last: nextStr(),
		},
		audit: {
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	}
}

function nextTask(): TaskType {
	return {
		audit: { createdAt: new Date() },
		task: {
			...(Math.random() < 0.5
				? {
						type: "FIRST_ACTION",
						bar: nextStr(),
						foo: nextStr(),
				  }
				: {
						type: "SECOND_ACTION",
						baz: nextStr(),
				  }),
		},
	}
}

async function main() {
	const bongo = new Bongo()

	const users = bongo.collection(User)
	const tasks = bongo.collection(Task)

	await bongo.migrate()

	const newUsers = await users
		.createAll([...Array(USERS_COUNT)].map(nextUser))
		.transact(bongo.tr)
	console.log(`Created #${newUsers.length} users.`)

	const newTasks = await tasks
		.createAll([...Array(TASKS_COUNT)].map(nextTask))
		.transact(bongo.tr)
	console.log(`Created #${newTasks.length} tasks.`)

	await bongo.close()
}

main()
