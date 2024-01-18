import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { formatDistanceToNow } from 'date-fns'
import { getMDXComponent } from 'mdx-bundler/client/index.js'
import React from 'react'
import { floatingToolbarClassName } from '#app/components/floating-toolbar.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { parseMdx } from '#app/utils/mdx-bundler.server'
import { userHasRole } from '#app/utils/permissions.ts'
import { useOptionalUser } from '#app/utils/user.ts'

export async function loader({ params, request }: LoaderFunctionArgs) {
	const requestUrl = new URL(request.url)
	const type = params.type || requestUrl.pathname.substring(1)
	console.log({ type })
	const document = await prisma.document.findFirst({
		select: {
			title: true,
			content: true,
			meeting: { select: { date: true } },
			images: { select: { id: true } },
			updatedBy: true,
			updatedAt: true,
		},
		where: { type },
		orderBy: { updatedAt: 'desc' },
	})

	invariantResponse(document, `No ${params.type} document found`, {
		status: 404,
	})

	const date = new Date(document.updatedAt)
	const timeAgo = formatDistanceToNow(date)

	let content = await parseMdx(document.content.toString())

	invariantResponse(content, `Error parsing MDX file.`, { status: 404 })

	return json({ document, content, timeAgo })
}

export default function DocumentComponent() {
	const user = useOptionalUser()
	const userIsAdmin = userHasRole(user, 'admin')
	console.log({ userIsAdmin })

	const { document, content, timeAgo } = useLoaderData<typeof loader>()
	const { code } = content
	const Component = React.useMemo(() => getMDXComponent(code), [code])

	return (
		<main className="container mx-auto flex h-full min-h-[400px] max-w-4xl flex-col px-0 pb-12 md:px-8">
			<div className="w-full bg-muted pl-2 md:container md:rounded-3xl md:pr-0">
				{userIsAdmin ? (
					<div className={floatingToolbarClassName}>
						<span className="text-sm text-foreground/90 max-[524px]:hidden">
							<Icon name="clock" className="scale-125">
								{timeAgo} ago
							</Icon>
						</span>
						<div className="grid flex-1 grid-cols-2 justify-end gap-2 min-[525px]:flex md:gap-4">
							<Button asChild className="min-[525px]:max-md:aspect-square min-[525px]:max-md:px-0">
								<Link to="edit">
									<Icon name="pencil-1" className="scale-125 max-md:scale-150">
										<span className="max-md:hidden">Edit</span>
									</Icon>
								</Link>
							</Button>
						</div>
					</div>
				) : null}
				<h1 className="my-6 mb-2 border-b-2 pb-2 text-center text-3xl">{document.title}</h1>
				<Component />
			</div>
		</main>
	)
}
