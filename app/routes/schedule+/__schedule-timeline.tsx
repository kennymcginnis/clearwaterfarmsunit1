import { Badge } from '#app/components/ui/badge.tsx'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#app/components/ui/card'
import { formatHours } from '#app/utils/misc'
import { backgroundColor } from '#app/utils/user-schedule.ts'

export function UserScheduleTimeline({
	user,
	userSchedule,
}: {
	user: {
		id: string
		display: string | null
	}
	userSchedule: {
		port: {
			id: string
			ditch: number
		}
		first: boolean | null
		crossover: boolean | null
		last: boolean | null
		hours: number | null
		schedule: string[]
	}
}) {
	const ditch = userSchedule.port.ditch
	const schedule = userSchedule.hours
		? userSchedule.schedule
		: ['You did not sign up for', 'Irrigation on this schedule.']
	return (
		<Card className="mb-1">
			<CardHeader>
				<CardTitle>Ditch {ditch}</CardTitle>
				<CardDescription>
					{user.display} {formatHours(userSchedule.hours)}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-2">
				<div key={ditch} className="flex flex-row justify-between">
					<div id="charges-pills" className="flex flex-col items-start">
						{userSchedule.first && (
							<Badge className={`mb-1 capitalize ${backgroundColor('first')}`} variant="outline">
								{'First'}
							</Badge>
						)}
						{userSchedule.crossover && (
							<Badge className={`capitalize ${backgroundColor('crossover')}`} variant="outline">
								{'Crossover'}
							</Badge>
						)}
						{userSchedule.last && (
							<Badge className={`mb-1 capitalize ${backgroundColor('last')}`} variant="outline">
								{'Last'}
							</Badge>
						)}
					</div>
					<div className="flex flex-col gap-2">
						{schedule.map((row, r) => (
							<span
								key={`row-${r}`}
								className="overflow-hidden text-ellipsis text-right text-body-sm text-muted-foreground"
							>
								{row}
							</span>
						))}
					</div>
				</div>
			</CardContent>
			<CardFooter></CardFooter>
		</Card>
	)
}
