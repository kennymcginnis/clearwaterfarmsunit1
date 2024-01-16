import { invariantResponse } from '@epic-web/invariant'
import { json } from '@remix-run/node'
import { NavLink, Outlet, useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { Separator } from '#app/components/ui/separator'
import { prisma } from '#app/utils/db.server.ts'
import { cn } from '#app/utils/misc.tsx'
import { userHasPermission } from '#app/utils/permissions'
import { useOptionalUser } from '#app/utils/user.ts'

export async function loader() {
	const meetings = await prisma.meeting.findMany({
		select: {
			id: true,
			date: true,
		},
		orderBy: { date: 'desc' },
	})

	invariantResponse(meetings, 'No meetings found', { status: 404 })

	return json(meetings)
}

export default function NotesRoute() {
	const meetings = useLoaderData<typeof loader>()
	const user = useOptionalUser()
	const canCreate = userHasPermission(user, 'create:meeting')
	const navLinkDefaultClassName =
		'line-clamp-2 block rounded-l-full py-2 pl-8 pr-6 text-base lg:text-xl'
	return (
		<main className="container flex h-full min-h-[400px] px-0 pb-12 md:px-8">
			<div className="grid w-full grid-cols-4 bg-muted pl-2 md:container md:rounded-3xl md:pr-0">
				<div className="relative col-span-1 mt-6">
					<div className="absolute inset-0 flex flex-col">
						<h1 className="text-center text-base font-bold md:text-lg lg:text-left lg:text-2xl">
							Meetings:
						</h1>
						<Separator className="mb-2 mt-4" />
						<ul className="overflow-y-auto overflow-x-hidden pb-12">
							{canCreate ? (
								<li className="p-1 pr-0">
									<NavLink
										to="new"
										className={({ isActive }) =>
											cn(navLinkDefaultClassName, isActive && 'bg-accent')
										}
									>
										<Icon name="plus">New Meeting</Icon>
									</NavLink>
								</li>
							) : null}
							{meetings.map(meeting => (
								<li key={meeting.id} className="p-1 pr-0">
									<NavLink
										to={meeting.date}
										preventScrollReset
										prefetch="intent"
										className={({ isActive }) =>
											cn(navLinkDefaultClassName, isActive && 'bg-accent')
										}
									>
										{meeting.date}
									</NavLink>
								</li>
							))}
						</ul>
					</div>
				</div>
				<div className="relative col-span-3 bg-accent md:rounded-r-3xl">
					<Outlet />
				</div>
			</div>
		</main>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: () => <p>No Meetings found...</p>,
			}}
		/>
	)
}
