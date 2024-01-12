import { invariantResponse } from '@epic-web/invariant'
import { json } from '@remix-run/node'
import { marked } from 'marked'
import DocumentComponent from '#app/routes/documents+/$filename'
import { readMarkdown } from '#app/utils/read-md.server.ts'

export async function loader() {
	let title = 'contact-us'

	const markdown = await readMarkdown(title)
	invariantResponse(markdown, 'File not found', { status: 404 })

	const html = marked(markdown)
	return json({ title, html })
}

export default DocumentComponent
