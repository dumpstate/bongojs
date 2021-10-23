import { Bongo } from './Bongo'


async function main() {
    const bongo = new Bongo()

    const foo = bongo.collection({
        name: 'doctype:foo',
        schema: {
            properties: {
                foo: {type: 'int32'},
            },
            optionalProperties: {
                bar: {type: 'string'},
            },
        } as const,
    })

    await bongo.migrate()

    const instance = await foo.create({
        foo: 42,
        bar: 'yeah',
    })

    instance.foo = 22

    await foo.save(instance)

    const another = await foo.getById(instance.id)

    console.log(`Another instance: ${JSON.stringify(another)}`)

    await bongo.close()
}


main()