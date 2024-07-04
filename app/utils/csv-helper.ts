import { type UploadHandler } from '@remix-run/node'

function matchDatum(row: string): string[] {
	const matched = row.match(/,?(("(\\"|.)+?")|([^",][^,]*))?/g)
	if (!matched) return []
	return matched.map(datum => datum.replace(/^,?"?|"$/g, '').trim())
}

export const csvFileToArray = (rawCsvFile: string | undefined) => {
	if (!rawCsvFile) throw 'Empty CSV file'
	const array1d = rawCsvFile.match(/((\\\n)|[^\n])+/g)
	if (!array1d) throw 'Invalid CSV file'
	const [propsRow, ...array2d]: string[][] = array1d.map(matchDatum)
	const output: { [name: string]: string }[] = []
	array2d.forEach(row => {
		const addMe: { [name: string]: string } = {}
		row.forEach((datum, j) => (addMe[propsRow[j]] = datum))
		output.push(addMe)
	})
	return output
}

export const csvUploadHandler: UploadHandler = async ({ name, filename, data, contentType }) => {
	if (name !== 'selected_csv') return undefined
	let chunks = []
	for await (let chunk of data) {
		chunks.push(chunk)
	}

	return await new Blob(chunks, { type: contentType }).text()
}
