import fs from 'fs/promises'

export async function readMarkdown(fileName: string) {
	const file = await fs.readFile(`./public/docs/${fileName}.md`)
	return file.toString()
}
