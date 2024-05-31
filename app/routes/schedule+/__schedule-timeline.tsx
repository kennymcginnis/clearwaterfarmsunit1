import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#app/components/ui/card'
import { formatHours } from '#app/utils/misc'

export function UserScheduleTimeline({
	user,
	userSchedule,
}: {
	user: {
		id: string
		username: string
	}
	userSchedule: {
		ditch: number
		hours: number | null
		schedule: string[]
	}
}) {
	const schedule = userSchedule.hours
		? userSchedule.schedule
		: ['You did not sign up for Irrigation', 'on this schedule.']
	return (
		<Card>
			<CardHeader>
				<CardTitle>Ditch {userSchedule.ditch}</CardTitle>
				<CardDescription>
					{user.username} {formatHours(userSchedule.hours)}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-2">
				<div key={userSchedule.ditch} className="flex flex-col">
					{schedule.map((row, r) => (
						<span
							key={`row-${r}`}
							className="overflow-hidden text-ellipsis text-right text-body-sm text-muted-foreground"
						>
							{row}
						</span>
					))}
				</div>
			</CardContent>
			<CardFooter></CardFooter>
		</Card>
	)
}
