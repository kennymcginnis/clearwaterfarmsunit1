import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { getMDXComponent } from 'mdx-bundler/client'
import React from 'react'
import { prisma } from '#app/utils/db.server.ts'
import { parseMdx } from '#app/utils/mdx-bundler.server'

export async function loader({ params }: LoaderFunctionArgs) {
	const document = await prisma.document.findFirst({
		select: {
			title: true,
			content: true,
			meeting: { select: { date: true } },
			images: { select: { id: true } },
			updatedBy: true,
			updatedAt: true,
		},
		where: { type: params.type },
		orderBy: { updatedAt: 'desc' },
	})

	invariantResponse(document, `No ${params.type} document found`, {
		status: 404,
	})

	let content = await parseMdx(document.content.toString())

	invariantResponse(content, `Error parsing MDX file.`, { status: 404 })

	return json({ document, content })
}

export default function DocumentComponent() {
	const { document, content } = useLoaderData<typeof loader>()
	const { code } = content
	const Component = React.useMemo(() => getMDXComponent(code), [code])

	return (
		<main className="container mx-auto flex h-full min-h-[400px] max-w-4xl flex-col px-0 pb-12 md:px-8">
			<div className="w-full bg-muted pl-2 md:container md:rounded-3xl md:pr-0">
				<h1 className="my-6 mb-2 border-b-2 pb-2 text-center text-3xl">
					{document.title}
				</h1>
				<Component />
			</div>
		</main>
	)
}
