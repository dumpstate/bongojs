# BongoJS

[PostgreSQL](https://www.postgresql.org/) JSON document modeling tool for [node.js](https://nodejs.org).

## Motivation

PostgreSQL is an outstanding product. It covers vast spectrum of different use cases - from small applications to very complex systems. But construsting and maintaining relational model is a hassle. Especially for small products (MVPs; weekend projects) document model seems to be an attractive alternative. This is where people usually start with products like MongoDB. Take arbitrarly complex JSON object, persist, retrieve. No tables to declare, schema migrations to maintain. All quick and easy.

PostgreSQL, with JSON and JSONB types, does provide a first class support for document modelling. Unfortunately the learning curve for the JSON-path-like syntax is relatively steep (not a standard SQL) plus is doesn't solve problems like schema validation, or database schema management.

BongoJS is an attempt to:

-   abstract complexities related to using JSON/JSONB on PostgreSQL,
-   introduce schema validation for JSON/JSONB columns,
-   minimize complexity related to database schema management,
-   make using document model on PostgreSQL as easy as with MongoDB.

## Install

Install package:

```sh
npm install @dumpstate/bongojs --save
```

Install peer dependencies (if not yet installed):

```sh
npm install pg --save
```

## Usage

### BongoJS instance

The main entrypoint is a `Bongo` class. One needs an instance of `Bongo` to start defining the model and running queries.

```typescript
import { Bongo } from "@dumpstate/bongojs"

const bongo = new Bongo()
```

The constructor optionally accepts either an instance of an existing [`node-postgres`](https://node-postgres.com/) connection pool or a `PoolConfig` object. If not provided, _BongoJS_ will create a new instance of `node-postgres` connection pool with environment defaults (i.e., one can set `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` etc., in the environment).

### Model Declaration

Bongo validates the model in the application code, so it requires a model declaration. The model declaration is a [JSON Typedef](https://jsontypedef.com/)-like schema registered at the `Bongo` instance.

```typescript
import { Schema } from "@dumpstate/bongojs"

const Foo = {
	name: "foo",
	schema: {
		createdAt: { type: "timestamp" },
		bar: { type: "string" },
		baz: { type: "int32" },
	},
} as const

// though not required, is it useful to create a type declaration along the way
type FooType = Schema<typeof Foo>

// with a model definition in hand, one can create a bongo collection (and register the schema)
const foos = bongo.collection(Foo)

// the type of `foos` is now `Collection<FooType>` (thus why the type declaration is useful)
```

### Schema Migration

_BongoJS_ does requires some tables to be initialised in postgres. The table structure is dependent on the model definition, as we're creating table partitions and indexes under the hood. Thus, it's most convenient to run the migration after the collections are defined:

```typescript
await bongo.migrate()
```

In a more professional setup, one may be interested in running the migration as a separate step, e.g., as a part of the CD pipeline. Then, it is preferred to leverage the provided CLI script:

```sh
npx bongojs migrate up ./path/to/entrypoint
```

where `./path/to/entrypoint` is a path to a file exporting a `Bongo` instance (with all the collections being registered).

### The Transactor

At this point, the primary interface to the database are the _collections_ and the instance of the `Transactor`. The `Transactor` is required to provide db connection/transaction object to the [`DBAction`](https://github.com/dumpstate/dbaction/)s returned from the `collection` instance.

```typescript
// Foo and bongo from the previous example
const foos = bongo.collection(Foo)

const res: DBAction<Document<FooType>> = foos.create({
	createdAt: new Date(),
	bar: "bar",
	baz: "baz",
})
```

the `res` is of type `DBAction<Document<FooType>>` - nothing has been executed yet, but one can use `res` for further composition.

The `DBAction` should be executed by calling `run` or `transact` method and providing a `Transactor` instance:

```typescript
const foo: FooType = await res.run(bongo.tr)
```

`run` method requests a new database connection from the pool (via _transactor_) and injects to the chain defined as a `DBAction`. All the composed queries are executed on the same DB connection.

`transactor` serves the same purpose, but the chain is being wrapped with `BEGIN` / `COMMIT` / `ROLLBACK`.

### The Document Type

The model instance returned from collection is a plain [_sealed_](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/seal) JavaScript object of type `Document<T>` (e.g., `Document<FooType>`), with a properties that follow convensions:

1. the `id` property of type `string` is always present and cannot be null,
2. all the properties declared on the schema are always nullable, e.g., `foo.bar` is of type `string | null` - it is not possible to have non-nullable properties for backwards compatibility reasons (similar to what [_protobuf_](https://stackoverflow.com/questions/31801257/why-required-and-optional-is-removed-in-protocol-buffers-3) does),
3. all the properties declared on the schema have their _required_ counterparts - when called the getter may raise an exception, e.g., `foo.bar$` is of type `string` and will throw if `foo.bar` is `null`.

The unsafe getters of document (e.g., `foo.bar$`) help to write more concise code, while preserving the backwards compatibility at the collection level (e.g., what if tomorrow I deprecate the `bar` property?).

### Collection

The `Collection` is instantiated the moment we register the schema on _bongo_ instance, e.g.:

```typescript
const foos: Collection<FooType> = bongo.collection(Foo)
```

The `Collection` offers the following database operations:

-   `find(query: Query<T>, opts?: QueryOpts<T>): DBAction<<Document<T>[]>` finds all documents matching the query,
-   `findOne(query: Query<T>): DBAction<Document<T> | null>` finds the first document matching the query,
-   `findById(id: string): DBAction<Document<T>>` - finds the document by id (throws if not found),
-   `create(obj: T): DBAction<Document<T>>` - creates a new document,
-   `createAll(objs: T[]): DBAction<Document<T>[]>` - creates multiple documents,
-   `deleteById(id: string): DBAction<boolean>` - deletes the document by id,
-   `drop(): DBAction<number>` - drops the collection (deletes all the documents from the partition),
-   `save(obj: T & DocumentMeta): DBAction<Document<T>>` - saves the document (inserts if not exists, updates otherwise),
-   `count(query: Query<T>): DBAction<number>` - counts the documents matching the query.

#### Query Object

Collections methods like `find`, `findOne` or `count` does acccept the `Query<T>` object as an input.

The `Query` is a MongoDB-like query object, with the type of the fields being inferred from the schema of `T`. The query is being translated to a SQL query - we're actually querying on the JSON column. The only index available is `GIN` on the _document_ column, thus the query performance is usually limited to an exact match on a single field.

## Running Tests

To execute the tests, you need PostgreSQL running with user `bongo` and database `bongo_db`:

    createuser bongo
    createdb -O bongo bongo_db

You can also use provided `docker-compose.yml`: `docker-compose up`.

Then, run:

```sh
pnpm test
```
