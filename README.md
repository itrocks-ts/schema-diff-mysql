[![npm version](https://img.shields.io/npm/v/@itrocks/schema-diff-mysql?logo=npm)](https://www.npmjs.org/package/@itrocks/schema-diff-mysql)
[![npm downloads](https://img.shields.io/npm/dm/@itrocks/schema-diff-mysql)](https://www.npmjs.org/package/@itrocks/schema-diff-mysql)
[![GitHub](https://img.shields.io/github/last-commit/itrocks-ts/schema-diff-mysql?color=2dba4e&label=commit&logo=github)](https://github.com/itrocks-ts/schema-diff-mysql)
[![issues](https://img.shields.io/github/issues/itrocks-ts/schema-diff-mysql)](https://github.com/itrocks-ts/schema-diff-mysql/issues)
[![discord](https://img.shields.io/discord/1314141024020467782?color=7289da&label=discord&logo=discord&logoColor=white)](https://25.re/ditr)

# schema-diff-mysql

Translates table differences into ALTER TABLE MySQL statements.

*This documentation was written by an artificial intelligence and may contain errors or approximations.
It has not yet been fully reviewed by a human. If anything seems unclear or incomplete,
please feel free to contact the author of this package.*

## Installation

```bash
npm i @itrocks/schema-diff-mysql
```

This package is purely in charge of turning a schema diff into SQL.

It expects you to work with the `Table` and `TableDiff` types from
`@itrocks/schema` and `@itrocks/schema-diff`. In a typical project you will
also use:

- `@itrocks/reflect-to-schema` to build a target schema from your
  TypeScript classes,
- `@itrocks/mysql-to-schema` to extract the current schema from an existing
  MySQL or MariaDB database.

## Usage

`@itrocks/schema-diff-mysql` exposes a single class,
`SchemaDiffMysql`, which converts a `TableDiff` into one or more
`ALTER TABLE` statements.

You are free to build the `TableDiff` by hand, but most real-world usages
rely on other `@itrocks/*` utilities to obtain the source and target
`Table` objects.

### Minimal example: generate ALTER TABLE SQL

```ts
import { TableDiff }       from '@itrocks/schema-diff'
import { SchemaDiffMysql } from '@itrocks/schema-diff-mysql'
import type { Table }      from '@itrocks/schema'

// Imagine you already have two Table objects representing the same table
// before and after your change:
declare const currentTable: Table
declare const targetTable:  Table

// Compute the structural diff between the two versions
const diff = new TableDiff(currentTable, targetTable)

// Translate the diff into ALTER TABLE SQL
const generator = new SchemaDiffMysql()
const sql       = generator.sql(diff, /* allowDeletions */ false)

console.log(sql)
// Example output:
// ALTER TABLE `user`
//   ADD COLUMN `email` varchar(255) NOT NULL,
//   MODIFY COLUMN `name` varchar(128) NOT NULL
```

Once you have the SQL string, execute it with your preferred MySQL or
MariaDB client library.

### Complete example: synchronize a table from a TypeScript model

The following example shows how `SchemaDiffMysql` can be used together with
`@itrocks/mysql-to-schema`, `@itrocks/reflect-to-schema`, and
`@itrocks/schema-diff` to keep a single table in sync with a TypeScript
class definition.

```ts
import mariadb                              from 'mariadb'
import type { Connection }                  from 'mariadb'
import { MysqlToTable }                     from '@itrocks/mysql-to-schema'
import { ReflectToTable }                   from '@itrocks/reflect-to-schema'
import { TableDiff }                        from '@itrocks/schema-diff'
import { SchemaDiffMysql }                  from '@itrocks/schema-diff-mysql'

class User {
  id!: number
  email!: string
}

async function synchronizeUserTable(connection: Connection) {
  const tableName = 'user'

  // Schema from the database
  const mysqlToTable   = new MysqlToTable(connection)
  const existingSchema = await mysqlToTable.convert(tableName)
  mysqlToTable.normalize(existingSchema)

  // Schema from the TypeScript model
  const reflectToTable = new ReflectToTable()
  const targetSchema   = reflectToTable.convert(User)

  // Compute the diff between database and model
  const diff        = new TableDiff(existingSchema, targetSchema)
  const diffToMysql = new SchemaDiffMysql()

  // Set the second argument to true if you also want to drop columns and
  // indexes that no longer exist in your model.
  const sql = diffToMysql.sql(diff, /* allowDeletions */ false)

  if (sql.trim() === '') {
    return false // nothing to update
  }

  await connection.query(sql)
  return true
}

async function main() {
  const pool = mariadb.createPool({
    host:     'localhost',
    user:     'root',
    password: 'secret',
    database: 'my_app',
  })

  const connection: Connection = await pool.getConnection()

  try {
    await synchronizeUserTable(connection)
  }
  finally {
    connection.release()
    await pool.end()
  }
}

main().catch(console.error)
```

In practice, `@itrocks/mysql-maintainer` wraps this kind of workflow for a
whole application model, but the example above illustrates how
`SchemaDiffMysql` is meant to be used on its own.

## API

### `class SchemaDiffMysql extends SchemaToMysql`

Converts a `TableDiff` into SQL statements suitable for MySQL / MariaDB.

`SchemaDiffMysql` inherits all behaviour from `SchemaToMysql` and adds
helpers that work on `TableDiff` instances instead of plain `Table`
objects.

#### Constructor

```ts
new SchemaDiffMysql()
```

There is no configuration parameter. The generated SQL targets standard
MySQL / MariaDB syntax.

#### `alterColumnsSql(tableDiff: TableDiff, deletion?: boolean): string`

Builds the `ALTER TABLE` fragment related to column additions, changes,
and (optionally) deletions.

- `tableDiff` — a `TableDiff` instance describing the difference between
  the current and target versions of a single table.
- `deletion` — when `true`, the fragment will also include `DROP COLUMN`
  clauses for columns found only in the `tableDiff.deletions` set.
  Defaults to `false`.

Returns a string such as:

```sql
ADD COLUMN `email` varchar(255) NOT NULL,
MODIFY COLUMN `name` varchar(128) NOT NULL
```

The string does not include the leading `ALTER TABLE ...` part.

#### `alterIndexesSql(tableDiff: TableDiff, deletion?: boolean): string`

Builds the `ALTER TABLE` fragment related to index additions, changes,
and (optionally) deletions.

- `tableDiff` — a `TableDiff` instance.
- `deletion` — when `true`, the fragment will include `DROP PRIMARY KEY`
  or `DROP KEY` clauses for indexes found only in `tableDiff.deletions`.
  Defaults to `false`.

Returns a string such as:

```sql
ADD KEY `user_email` (`email`),
DROP KEY `user_name`
```

Again, the string does not include the `ALTER TABLE` prefix.

#### `sql(tableDiff: TableDiff, deletion?: boolean): string`

Builds a complete SQL statement (or set of statements) for the given
`TableDiff`.

- `tableDiff` — the diff computed between the existing and target
  versions of a table.
- `deletion` — when `true`, both columns and indexes that appear only on
  the source side of the diff can be dropped.

If the diff does not contain any structural change that requires an
`ALTER TABLE`, the method falls back to creating the table using the
underlying `SchemaToMysql.sql()` implementation, effectively returning a
`CREATE TABLE ...` statement for `tableDiff.target`.

In all other situations it returns an `ALTER TABLE` statement, for
example:

```sql
ALTER TABLE `user`
  ADD COLUMN `email` varchar(255) NOT NULL,
  MODIFY COLUMN `name` varchar(128) NOT NULL,
  ADD KEY `user_email` (`email`)
```

#### `tableSql(table: Table): string`

Returns the leading `ALTER TABLE` clause for a given `Table`.

- `table` — the target `Table` instance.

For a table named `user`, this method returns:

```sql
ALTER TABLE `user`
```

You rarely need to call this directly; it is mostly useful when you want
to assemble custom `ALTER TABLE` statements composed of the fragments
produced by `alterColumnsSql()` and `alterIndexesSql()`.

## Typical use cases

- **Automatic schema migration**: keep an existing MySQL / MariaDB
  database in sync with a TypeScript domain model by generating and
  executing the required `ALTER TABLE` statements.
- **Safe, reviewable migrations**: compute the diff between the current
  and desired schema, generate the SQL once with `SchemaDiffMysql`, and
  store it in migration files that can be reviewed before execution.
- **Schema refactoring**: rename columns, change types, or add new
  indexes in your TypeScript models, then let `SchemaDiffMysql` compute
  the corresponding SQL changes.
- **Integration with tooling**: use the low-level methods
  `alterColumnsSql()` and `alterIndexesSql()` to build custom schema
  migration tools, dashboards, or admin interfaces.
