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
		.run(bongo.cp)

	instance.foo = 22

	await foo.save(instance).run(bongo.cp)

	const another = await foo.findById(instance.id).run(bongo.cp)

	console.log(`Another instance: ${JSON.stringify(another)}`)

	const queried = await foo
		.find(
			{
				// foo: {ooo: 22},
				foo: 22,
				// bar: 'yeah',
			},
			2
		)
		.run(bongo.cp)

	console.log(`All(foo = 22): ${JSON.stringify(queried)}`)

	await bongo.close()
}

main()
