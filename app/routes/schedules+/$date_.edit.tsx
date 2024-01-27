import { invariantResponse } from '@epic-web/invariant'
import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { ScheduleEditor, action } from './__schedules-editor.tsx'

export { action }

export async function loader({ params }: LoaderFunctionArgs) {
	if (!params?.date) {
		return redirect('/schedules')
	}

	const schedule = await prisma.schedule.findFirst({
		select: {
			id: true,
			date: true,
			deadline: true,
			source: true,
			costPerHour: true,
		},
		where: { date: params.date },
	})

	invariantResponse(schedule, `Schedule not found for ${params.date}`, {
		status: 404,
	})

	console.log({ schedule })
	return json({ schedule })
}

export default function ScheduleEdit() {
	const { schedule } = useLoaderData<typeof loader>()

	return <ScheduleEditor schedule={schedule} />
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => <p>No schedule exists for "{params.date}" </p>,
			}}
		/>
	)
}
