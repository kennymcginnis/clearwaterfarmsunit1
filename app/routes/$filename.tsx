import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { marked } from 'marked'
import { readMarkdown } from '#app/utils/read-md.server.ts'

export async function loader({ params }: LoaderFunctionArgs) {
	let title = ''
	switch (params.filename) {
		case 'trade-list':
			title = 'Clearwater Farms Trade List'
			break
		case 'announcements':
			title = 'Announcements - Clearwater Farms Property Owners Association'
			break
			case 'contact-us':
				title = 'Contact Us'
				break
		default:
			invariantResponse(params.filename, 'File not configured', { status: 404 })
	}

	const markdown = await readMarkdown(params.filename)
	invariantResponse(markdown, 'File not found', { status: 404 })

	const html = marked(markdown)
	return json({ title, html })
}

export default function ArticleComponent() {
	const { title, html } = useLoaderData<typeof loader>()
	return (
		<main className="container mx-auto flex h-full min-h-[400px] max-w-4xl flex-col px-0 pb-12 md:px-8">
			<div className="w-full bg-muted pl-2 md:container md:rounded-3xl md:pr-0">
				<h1 className="my-6 mb-2 border-b-2 pb-2 text-center text-3xl">
					{title}
				</h1>
				<div className="my-6" dangerouslySetInnerHTML={{ __html: html }} />
			</div>
		</main>
	)
}
