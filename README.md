# BongoJS

[PostgreSQL](https://www.postgresql.org/) JSON document modeling tool for [node.js](https://nodejs.org).

## Why?

PostgreSQL is an outstanding product. It covers vast spectrum of different use cases - from small applications to very complex systems. But construsting and maintaining relational model is a hassle. Especially for small products (MVPs; weekend projects) document model seems to be an attractive alternative. This is where people usually start with products like MongoDB. Take arbitrarly complex JSON object, persist, retrieve. No tables to declare, schema migrations to maintain. All quick and easy.

PostgreSQL, with JSON and JSONB types, does provide a first class support for document modelling. Unfortunately the learning curve for the JSON-path-like syntax is relatively steep (not a standard SQL) plus is doesn't solve problems like schema validation, or database schema management.

BongoJS is a try to:

-   abstract away complexities related with using JSON/JSONB on PostgreSQL,
-   introduce schema validation for JSON/JSONB columns,
-   minimize complexity related to database schema management,
-   make using document model on PostgreSQL as easy as on MongoDB.

It's a [mongoose](https://mongoosejs.com/) for PostgreSQL.

## Running Tests

To execute the tests, you need PostgreSQL running with user `bongo` and database `bongo_db`:

    createuser bongo
    createdb -O bongo bongo_db

You can also use provided `docker-compose.yml`: `docker-compose up`.
