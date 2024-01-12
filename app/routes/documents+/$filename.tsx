import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { marked } from 'marked'
import { readMarkdown } from '#app/utils/read-md.server.ts'

export async function loader({ params }: LoaderFunctionArgs) {
	let title = ''
	switch (params.filename) {
		case 'articles-of-incorporation':
			title =
				'Articles of Incorporation of Clearwater Farms Unit #1 Property Owners Association'
			break
		case 'cc-and-r-s':
			title = 'Declaration of Conditions, Covenants and Restrictions'
			break
		case 'by-laws':
			title = 'By-Laws of Clearwater Farms Property Owners Association'
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
				<div dangerouslySetInnerHTML={{ __html: html }} />
			</div>
		</main>
	)
}
