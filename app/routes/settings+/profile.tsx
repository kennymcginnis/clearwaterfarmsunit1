import { invariantResponse } from '@epic-web/invariant'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, Outlet, useMatches } from '@remix-run/react'
import { z } from 'zod'
import { Button } from '#app/components/ui/button'
import { Icon } from '#app/components/ui/icon.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { cn } from '#app/utils/misc.tsx'
import { useUser } from '#app/utils/user.ts'

export const BreadcrumbHandle = z.object({ breadcrumb: z.any() })
export type BreadcrumbHandle = z.infer<typeof BreadcrumbHandle>

export const handle: BreadcrumbHandle & SEOHandle = {
	breadcrumb: <Icon name="file-text">Edit Profile</Icon>,
	getSitemapEntries: () => null,
}

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const user = await prisma.user.findUnique({
		select: { username: true },
		where: { id: userId },
	})
	invariantResponse(user, 'User not found', { status: 404 })
	return json({})
}

const BreadcrumbHandleMatch = z.object({
	handle: BreadcrumbHandle,
})

export default function EditUserProfile() {
	const user = useUser()
	const matches = useMatches()
	const breadcrumbs = matches
		.map(m => {
			const result = BreadcrumbHandleMatch.safeParse(m)
			if (!result.success || !result.data.handle.breadcrumb) return null
			return (
				<Link key={m.id} to={m.pathname} className="flex items-center">
					{result.data.handle.breadcrumb}
				</Link>
			)
		})
		.filter(Boolean)

	return (
		<div className="flex-1">
			<div className="container mb-48 mt-6 flex flex-col items-center justify-center">
				<div className="container">
					<ul className="flex gap-3">
						<li>
							<Button variant="outline" className="pb-2">
								<Link className="text-muted-foreground" to={`/member/${user.username}/contact`}>
									Profile
								</Link>
							</Button>
						</li>
						{breadcrumbs.map((breadcrumb, i, arr) => (
							<li key={i} className={cn('flex items-center gap-3', { 'text-muted-foreground': i < arr.length - 1 })}>
								<span className="text-lg">{'/'}</span>
								<Button variant="outline" className="pb-2">
									{breadcrumb}
								</Button>
							</li>
						))}
					</ul>
				</div>
				<div className="mt-6" />
				<main className="mx-auto bg-muted px-6 py-8 md:container md:rounded-3xl">
					<Outlet />
				</main>
			</div>
		</div>
	)
}
