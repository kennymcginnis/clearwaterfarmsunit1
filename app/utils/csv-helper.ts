import { type UploadHandler } from '@remix-run/node'

export type DateFieldFormats = {
	fields: string[]
	format: string
}

export const csvFileToArray = (input: string | undefined) => {
	if (!input) throw 'Empty CSV file'
	const string = input.replaceAll('\r', '')
	const csvHeader = string.slice(0, string.indexOf('\n')).split(',')

	const csvRows = string.slice(string.indexOf('\n') + 1).split('\n')

	const rows = csvRows.map((csvRow: string) => {
		const values = csvRow.split(',')
		const obj = csvHeader.reduce((agg: { [name: string]: string }, header: string, index: number) => {
			agg[header] = values[index]
			return agg
		}, {})
		return obj
	})
	return rows
}

export const csvUploadHandler: UploadHandler = async ({ name, filename, data, contentType }) => {
	if (name !== 'selected_csv') {
		return undefined
	}
	let chunks = []
	for await (let chunk of data) {
		chunks.push(chunk)
	}

	return await new Blob(chunks, { type: contentType }).text()
}
