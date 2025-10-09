import { Column }        from '@itrocks/schema'
import { Index }         from '@itrocks/schema'
import { Table }         from '@itrocks/schema'
import { TableDiff }     from '@itrocks/schema-diff'
import { SchemaToMysql } from '@itrocks/schema-to-mysql'

export class SchemaDiffMysql extends SchemaToMysql
{

	alterColumnsSql(tableDiff: TableDiff, deletion = false)
	{
		let   hasId = false
		const setColumns: string[] = []
		for (const column of tableDiff.source.columns) {
			if (column.name === 'id') {
				hasId = true
				continue
			}
			setColumns.push(column.name)
		}
		setColumns.sort()
		tableDiff.additions.sort((column1, column2) => {
			if (column1.name === 'id') return -1
			if (column2.name === 'id') return 1
			return (column2.name > column1.name) ? 1 : -1
		})

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
				let afterColumn = ''
				let sourceName  = columnDiff.source.name
				let targetName  = columnDiff.target.name
				if (targetName !== 'id') {
					for (const otherColumn of setColumns) {
						if (otherColumn === sourceName) continue
						if (otherColumn > targetName) break
						afterColumn = otherColumn
					}
				}
				sql.push(
					'CHANGE COLUMN `' + sourceName + '` ' + this.columnSql(columnDiff.target)
					+ ((afterColumn === '') ? (hasId ? ' AFTER `id`' : ' FIRST') : (' AFTER `' + afterColumn + '`'))
				)
			}
		}

		for (const column of tableDiff.additions) {
			if (!(column instanceof Column)) continue
			let afterColumn = ''
			let columnName  = column.name
			if (columnName !== 'id') {
				for (const otherColumn of setColumns) {
					if (otherColumn > columnName) break
					afterColumn = otherColumn
				}
			}
			sql.push(
				'ADD COLUMN ' + this.columnSql(column)
				+ ((afterColumn === '') ? (hasId ? ' AFTER `id`' : ' FIRST') : (' AFTER `' + afterColumn + '`'))
			)
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
					sql.push('DROP PRIMARY KEY')
				}
				else {
					sql.push('DROP KEY `' + index.name + '`')
				}
			}
		}
		for (const indexDiff of tableDiff.changes) {
			if (!(indexDiff.source instanceof Index) || !(indexDiff.target instanceof Index)) continue
			if (indexDiff.source.type === 'primary') {
				sql.push('DROP PRIMARY KEY')
			}
			else {
				sql.push('DROP KEY `' + indexDiff.source.name + '`')
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
