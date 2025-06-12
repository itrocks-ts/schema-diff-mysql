import { Table }         from '@itrocks/schema'
import { TableDiff }     from '@itrocks/schema-diff'
import { SchemaToMysql } from '@itrocks/schema-to-mysql'

export class SchemaDiffMysql extends SchemaToMysql
{

	alterColumnsSql(tableDiff: TableDiff, deletion = false)
	{
		const sql = new Array<string>()
		for (const column of tableDiff.additions) {
			sql.push('ADD COLUMN ' + this.columnSql(column))
		}
		for (const columnDiff of tableDiff.changes) {
			if (columnDiff.source.name === columnDiff.target.name) {
				sql.push('MODIFY COLUMN ' + this.columnSql(columnDiff.target))
			}
			else {
				sql.push('CHANGE COLUMN `' + columnDiff.source.name + '` ' + this.columnSql(columnDiff.target))
			}
		}
		if (deletion) {
			for (const column of tableDiff.deletions) {
				sql.push('DROP COLUMN `' + column.name + '`')
			}
		}
		return sql.join(',\n')
	}

	// @ts-ignore Pure-API (not used internally), so the parameters can be radically changed
	sql(tableDiff: TableDiff, alter = false, deletion = false)
	{
		return alter
			? this.tableSql(tableDiff.target, true)+ ' (\n' + this.alterColumnsSql(tableDiff, deletion) + '\n)'
			: super.sql(tableDiff.target)
	}

	tableSql(table: Table, alter = false)
	{
		return alter
			? 'ALTER TABLE `' + table.name + '`'
			: super.tableSql(table)
	}
}
