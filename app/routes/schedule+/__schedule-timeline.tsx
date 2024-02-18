import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#app/components/ui/card'

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
		hours: number
		head: number
		schedule: string[]
	}
}) {
	const pretty = (hours: number | null) =>
		!hours ? '' : hours === 1 ? '(1-hour)' : hours % 1 === 0 ? `(${hours}-hours)` : `(${hours}-hrs)`

	return (
		<Card>
			<CardHeader>
				<CardTitle>Ditch {userSchedule.ditch}</CardTitle>
				<CardDescription>
					{user.username} {pretty(userSchedule.hours)}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2">
				<div key={userSchedule.ditch} className="flex flex-col">
					{userSchedule.schedule.map((row, r) => (
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
