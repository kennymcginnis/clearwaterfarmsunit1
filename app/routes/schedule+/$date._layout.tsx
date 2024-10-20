import { json, redirect, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
import { useLoaderData, Outlet } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { formatDay } from '#app/utils/misc'

export async function loader({ params }: LoaderFunctionArgs) {
	if (!params?.date) return redirect('/schedules')
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
		<>
			<div className="container my-8 flex flex-col items-center justify-center gap-6">
				<h1 className="text-center text-h1">Irrigation Sign-up Schedule for {schedule.date}</h1>
				<h2 className="text-h2">Sign-up Deadline {formatDay(schedule.deadline)} at 7pm</h2>
				<h3 className="text-h3 capitalize">
					Source: {schedule.source} | Cost Per Hour: ${schedule.costPerHour}
				</h3>
			</div>
			<Outlet />
		</>
	)
}

export const meta: MetaFunction<null, { 'routes/schedule+/$date_': typeof loader }> = ({ params }) => {
	return [
		{ title: `Irrigation ${params.date} | Clearwater Farms 1` },
		{
			name: 'description',
			content: `Irrigation for ${params.date} Clearwater Farms 1`,
		},
	]
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
