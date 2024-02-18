import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { getMDXComponent } from 'mdx-bundler/client/index.js'
import React from 'react'
import { Spacer } from '#app/components/spacer.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { parseMdx } from '#app/utils/mdx-bundler.server'
import { getDocumentImgSrc } from '#app/utils/misc.tsx'
import { useOptionalAdminUser } from '#app/utils/user.ts'

export async function loader({ params }: LoaderFunctionArgs) {
	const document = await prisma.document.findFirst({
		select: {
			id: true,
			type: true,
			title: true,
			content: true,
			meeting: { select: { id: true } },
			images: {
				select: {
					id: true,
					altText: true,
				},
			},
			updatedBy: true,
			updatedAt: true,
		},
		where: {
			type: params.type,
			meeting: { date: params.date },
		},
	})

	invariantResponse(document, `Meeting ${params.type} not found`, {
		status: 404,
	})

	let content = await parseMdx(document.content.toString())

	return json({ document, content })
}

export default function ProfileRoute() {
	const { document, content } = useLoaderData<typeof loader>()
	const { code } = content
	const Component = React.useMemo(() => getMDXComponent(code), [code])
	const displayBar = useOptionalAdminUser()
	return (
		<div className="container mb-48 mt-36">
			<Component />
			<Spacer size="4xs" />
			<div className={`${displayBar ? 'pb-24' : 'pb-12'} overflow-y-auto`}>
				<ul className="flex flex-wrap gap-5 py-5">
					{document.images.map(image => (
						<li key={image.id}>
							<a href={getDocumentImgSrc(image.id)}>
								<img
									src={getDocumentImgSrc(image.id)}
									alt={image.altText ?? ''}
									className="h-32 w-32 rounded-lg object-cover"
								/>
							</a>
						</li>
					))}
				</ul>
			</div>
		</div>
	)
}
