import { invariantResponse } from '@epic-web/invariant'
import { json } from '@remix-run/node'
import { NavLink, Outlet, useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Badge } from '#app/components/ui/badge'
import { Icon } from '#app/components/ui/icon.tsx'
import { Separator } from '#app/components/ui/separator'
import { prisma } from '#app/utils/db.server.ts'
import { cn, getVariantForState } from '#app/utils/misc.tsx'
import { useOptionalAdminUser } from '#app/utils/user.ts'

export async function loader() {
	const schedules = await prisma.schedule.findMany({
		select: {
			id: true,
			date: true,
			deadline: true,
			source: true,
			costPerHour: true,
			state: true,
		},
		orderBy: { date: 'desc' },
	})

	invariantResponse(schedules, 'No schedules found', { status: 404 })

	return json(schedules)
}

export default function NotesRoute() {
	const schedules = useLoaderData<typeof loader>()
	const canCreate = useOptionalAdminUser()
	const navLinkDefaultClassName = 'line-clamp-2 block rounded-l-full py-2 pl-8 pr-6 text-base lg:text-xl'
	return (
		<main className="container mb-6 flex h-full min-h-[400px] px-0 pb-12 md:px-6">
			<div className="grid w-full grid-cols-4 bg-muted pl-2 md:container md:rounded-3xl md:pr-0">
				<div className="relative col-span-1 mt-6">
					<div className="absolute inset-0 flex flex-col">
						<h1 className="text-center text-base font-bold md:text-lg lg:text-left lg:text-2xl">Schedules:</h1>
						<Separator className="mb-2 mt-4" />
						<ul className="overflow-y-auto overflow-x-hidden pb-12">
							{canCreate ? (
								<li className="p-1 pr-0">
									<NavLink to="new" className={({ isActive }) => cn(navLinkDefaultClassName, isActive && 'bg-accent')}>
										<Icon name="plus">New Schedule</Icon>
									</NavLink>
								</li>
							) : null}
							{schedules.map(schedule => (
								<li key={schedule.id} className="p-1 pr-0">
									<NavLink
										to={schedule.date}
										preventScrollReset
										prefetch="intent"
										className={({ isActive }) => cn(navLinkDefaultClassName, isActive && 'bg-accent')}
									>
										{schedule.date}
										<Badge className="ml-2 capitalize" variant={getVariantForState(schedule.state)}>
											{schedule.state}
										</Badge>
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
				404: () => <p>No Schedules found...</p>,
			}}
		/>
	)
}
