import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#app/components/ui/card'
import { type UserScheduleType, type UserType } from '#app/types.ts'
import { formatHours } from '#app/utils/misc'

export function UserScheduleTimeline({ user, userSchedule }: { user: UserType; userSchedule: UserScheduleType }) {
	const ditch = userSchedule.port.ditch
	const schedule = userSchedule.hours
		? userSchedule.schedule
		: ['You did not sign up for Irrigation', 'on this schedule.']
	return (
		<Card className="mb-1">
			<CardHeader>
				<CardTitle>Ditch {ditch}</CardTitle>
				<CardDescription>
					{user.display} {formatHours(userSchedule.hours)}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-2">
				<div key={ditch} className="flex flex-col">
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
