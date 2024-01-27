import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, Outlet } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { prisma } from '#app/utils/db.server.ts'

export async function loader({ params }: LoaderFunctionArgs) {
	if (!params?.date) {
		return redirect('/schedules')
	}

	const schedule = await prisma.schedule.findFirstOrThrow({
		select: { date: true, deadline: true, costPerHour: true, source: true },
		where: { date: params.date },
	})

	return json({ status: 'idle', schedule } as const)
}

export default function UsersRoute() {
	const data = useLoaderData<typeof loader>()
	const { schedule } = data

	return (
		<div className="container mb-48 mt-36 flex flex-col items-center justify-center gap-6">
			<h1 className="text-h1">Irrigation Sign-up Schedule for {schedule.date}</h1>
			<h2 className="text-h2">Sign-up deadline {schedule.deadline}</h2>
			<h3 className="text-h3">
				Source: {schedule.source} | Cost Per Hour: ${schedule.costPerHour}
			</h3>
			<main>
				<Outlet />
			</main>
		</div>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
