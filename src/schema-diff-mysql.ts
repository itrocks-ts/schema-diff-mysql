import { Column }        from '@itrocks/schema'
import { Index }         from '@itrocks/schema'
import { Table }         from '@itrocks/schema'
import { TableDiff }     from '@itrocks/schema-diff'
import { SchemaToMysql } from '@itrocks/schema-to-mysql'

export class SchemaDiffMysql extends SchemaToMysql
{

	alterColumnsSql(tableDiff: TableDiff, deletion = false)
	{
		const sql = new Array<string>()
		if (deletion) {
			for (const column of tableDiff.deletions) {
				if (!(column instanceof Column)) continue
				sql.push('DROP COLUMN `' + column.name + '`')
			}
		}
		for (const columnDiff of tableDiff.changes) {
			if (!(columnDiff.source instanceof Column) || !(columnDiff.target instanceof Column)) continue
			if (columnDiff.source.name === columnDiff.target.name) {
				sql.push('MODIFY COLUMN ' + this.columnSql(columnDiff.target))
			}
			else {
				sql.push('CHANGE COLUMN `' + columnDiff.source.name + '` ' + this.columnSql(columnDiff.target))
			}
		}
		for (const column of tableDiff.additions) {
			if (!(column instanceof Column)) continue
			sql.push('ADD COLUMN ' + this.columnSql(column))
		}
		return sql.join(',\n')
	}

	alterIndexesSql(tableDiff: TableDiff, deletion = false)
	{
		const sql = new Array<string>()
		if (deletion) {
			for (const index of tableDiff.deletions) {
				if (!(index instanceof Index)) continue
				if (index.type === 'primary') {
					sql.push('DROP PRIMARY INDEX')
				}
				else {
					sql.push('DROP INDEX `' + index.name + '`')
				}
			}
		}
		for (const indexDiff of tableDiff.changes) {
			if (!(indexDiff.source instanceof Index) || !(indexDiff.target instanceof Index)) continue
			if (indexDiff.source.type === 'primary') {
				sql.push('DROP PRIMARY INDEX')
			}
			else {
				sql.push('DROP INDEX `' + indexDiff.source.name + '`')
			}
			sql.push('ADD ' + this.indexSql(indexDiff.target))
		}
		for (const index of tableDiff.additions) if (index instanceof Index) {
			sql.push('ADD ' + this.indexSql(index))
		}
		return sql.join(',\n')
	}

	// @ts-ignore Pure-API (not used internally), so the parameters can be radically changed
	sql(tableDiff: TableDiff, deletion = false)
	{
		const columnSql = this.alterColumnsSql(tableDiff, deletion)
		const indexSql  = this.alterIndexesSql(tableDiff, deletion)
		if ((columnSql === '') && (indexSql === '')) {
			return super.sql(tableDiff.target)
		}
		const tableSql = this.tableSql(tableDiff.target)
		return tableSql + '\n' + columnSql + (((columnSql !== '') && (indexSql !== '')) ? ',\n' : '') + indexSql
	}

	tableSql(table: Table)
	{
		return 'ALTER TABLE `' + table.name + '`'
	}

}
