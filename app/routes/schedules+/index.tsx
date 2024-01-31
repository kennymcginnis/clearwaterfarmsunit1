import { type MetaFunction } from '@remix-run/react'
import { type loader as scheduleLoader } from './_layout.tsx'

export default function ScheduleIndexRoute() {
	return (
		<div className="container pt-12">
			<p className="text-body-md">Select a schedule</p>
		</div>
	)
}

export const meta: MetaFunction<null, { 'routes/schedules': typeof scheduleLoader }> = () => {
	return [
		{ title: `Irrigation Schedules | Clearwater Farms 1` },
		{
			name: 'description',
			content: `Clearwater Farms 1 Irrigation Schedules`,
		},
	]
}
