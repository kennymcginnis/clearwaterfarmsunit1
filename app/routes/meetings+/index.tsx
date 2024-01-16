import { type MetaFunction } from '@remix-run/react'
import { type loader as meetingLoader } from '#app/routes/meetings+/_meetings'

export default function MeetingIndexRoute() {
	return (
		<div className="container pt-12">
			<p className="text-body-md">Select a meeting</p>
		</div>
	)
}

export const meta: MetaFunction<
	null,
	{ 'routes/meetings+/$date_+/meeting': typeof meetingLoader }
> = ({ params }) => {
	return [
		{ title: `${params.date}'s Meeting | Clearwater Farms 1` },
		{
			name: 'description',
			content: `Clearwater Farms 1 Board Meeting: ${params.date}`,
		},
	]
}
