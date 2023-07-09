import { Bongo } from "./Bongo"

async function main() {
	const bongo = new Bongo()

	const foo = bongo.collection({
		name: "doctype:foo",
		schema: {
			foo: { type: "int32" },
			bar: { type: "string" },
		} as const,
	})

	await bongo.migrate()

	const instance = await foo
		.create({
			foo: 42,
			bar: "yeah",
		})
		.run(bongo.tr)

	instance.foo = 22

	await foo.save(instance).run(bongo.tr)

	const another = await foo.findById(instance.id).run(bongo.tr)

	console.log(`Another instance: ${JSON.stringify(another)}`)

	const queried = await foo
		.find(
			{
				// foo: {ooo: 22},
				foo: 22,
				// bar: 'yeah',
			},
			{ limit: 2 },
		)
		.run(bongo.tr)

	console.log(`All(foo = 22): ${JSON.stringify(queried)}`)

	await bongo.close()
}

main()
