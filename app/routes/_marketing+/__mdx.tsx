import { invariantResponse } from '@epic-web/invariant'
import { json, type MetaFunction, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData, useLocation } from '@remix-run/react'
import { formatDistanceToNow } from 'date-fns'
import { getMDXComponent } from 'mdx-bundler/client/index.js'
import * as React from 'react'
import { Button } from '#app/components/ui/button.tsx'
import { Card, CardContent, CardHeader } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { parseMdx } from '#app/utils/mdx-bundler.server'
import { useOptionalAdminUser } from '#app/utils/user.ts'

export async function loader({ params, request }: LoaderFunctionArgs) {
	const requestUrl = new URL(request.url)
	const type = params.type || requestUrl.pathname.substring(1)
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

	return json({ type, document, content, timeAgo })
}

export default function DocumentComponent() {
	const userIsAdmin = useOptionalAdminUser()

	const location = useLocation()
	React.useEffect(() => {
		if (location.hash) {
			const el = document.querySelector(location.hash)
			if (el) el.scrollIntoView()
		}
	}, [location])

	const { type, content, timeAgo } = useLoaderData<typeof loader>()
	const { code } = content
	const Component = React.useMemo(() => getMDXComponent(code), [code])

	return (
		<Card className="container mb-6 rounded-none bg-muted px-0 pb-12 xl:rounded-3xl">
			<CardHeader className="mx-0">
				{userIsAdmin ? (
					<div className="flex w-full items-center justify-between gap-2 p-4 pb-0 pl-5">
						<span className="text-sm text-foreground/90 max-md:hidden">
							<Icon name="clock" className="scale-125">
								Last Modified {timeAgo} ago
							</Icon>
						</span>
						<Button>
							<Link to={`/${type}/edit`}>
								<Icon name="pencil-1" className="scale-125 max-md:scale-150">
									Edit
								</Icon>
							</Link>
						</Button>
					</div>
				) : null}
			</CardHeader>
			<CardContent className="p-10 pt-6">
				<div className="prose prose-zinc max-w-none dark:prose-invert lg:prose-lg">
					<Component />
				</div>
			</CardContent>
		</Card>
	)
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `${data?.document.title} | Clearwater Farms 1` },
		{
			name: 'description',
			content: `${data?.document.title} | Clearwater Farms 1`,
		},
	]
}
