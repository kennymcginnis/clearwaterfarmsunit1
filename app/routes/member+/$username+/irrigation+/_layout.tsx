import { invariantResponse } from '@epic-web/invariant'
import { json } from '@remix-run/node'
import { NavLink, Outlet, useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Badge } from '#app/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#app/components/ui/card'
import { prisma } from '#app/utils/db.server.ts'
import { cn } from '#app/utils/misc.tsx'

export async function loader() {
	const schedules = await prisma.schedule.findMany({
		select: {
			id: true,
			date: true,
			deadline: true,
			source: true,
			costPerHour: true,
			open: true,
			closed: true,
		},
		orderBy: { date: 'desc' },
	})

	invariantResponse(schedules, 'No schedules found', { status: 404 })

	return json(schedules)
}

export default function NotesRoute() {
	const schedules = useLoaderData<typeof loader>()
	const navLinkDefaultClassName = 'line-clamp-2 block rounded-l-full py-2 pl-8 pr-6 text-base lg:text-xl'

	return (
		<Card>
			<CardHeader>
				<CardTitle>Irrigation</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				<main className="flex h-full min-h-[400px]">
					<div className="grid w-full grid-cols-4 md:rounded-lg md:pr-0">
						<div className="relative col-span-1 mt-4">
							<div className="absolute inset-0 flex flex-col">
								<ul className="overflow-y-auto overflow-x-hidden pb-12">
									{schedules.map(schedule => (
										<li key={schedule.id} className="p-1 pr-0">
											<NavLink
												to={schedule.date}
												preventScrollReset
												prefetch="intent"
												className={({ isActive }) => cn(navLinkDefaultClassName, isActive && 'bg-accent')}
											>
												{schedule.date}
												{schedule.open ? (
													<Badge className="ml-2" variant="default">
														Open
													</Badge>
												) : null}
												{schedule.closed ? (
													<Badge className="ml-2" variant="destructive">
														Closed
													</Badge>
												) : null}
											</NavLink>
										</li>
									))}
								</ul>
							</div>
						</div>
						<div className="relative col-span-3 bg-accent md:rounded-lg">
							<Outlet />
						</div>
					</div>
				</main>
			</CardContent>
		</Card>
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
