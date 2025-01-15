/* eslint-disable remix-react-routes/use-link-for-routes */
import { Link, useLoaderData } from '@remix-run/react'
import { DisplayField } from '#app/components/forms'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon'
import { formatDay } from '#app/utils/misc'
import AnnouncementsComponent from './_marketing+/announcements'
import { loader } from './index.server'
import { PaymentCancelled } from './payment+/__cancelled-dialog'
import { PaymentsDialog } from './payment+/__continue-dialog'
import { PaymentSuccess } from './payment+/__success-dialog'
import { UserScheduleEditor, action } from './schedule+/__schedule-editor'
import { UserScheduleTimeline } from './schedule+/__schedule-timeline'

export { action, loader }

export default function HomeRoute() {
	const USDollar = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
	const {
		user,
		balance,
		open,
		closed,
		userSchedules,
		payment: { enabled, success, cancelled },
	} = useLoaderData<typeof loader>()
	if (user) {
		return (
			<div className="flex w-full flex-col items-center">
				<h2 className="flex flex-nowrap pt-3 text-3xl font-semibold leading-none tracking-tight">
					Clearwater Farms Unit 1
				</h2>
				<div className="mb-0 text-xl">Irrigation Schedules</div>

				<div
					style={{ width: 'clamp(352px, 75%, 720px)' }}
					className="m-auto mt-2 rounded-md border-2 border-secondary px-3 py-1 text-center align-bottom"
				>
					<div className="text-lg">
						If you have any questions, comments, or concerns regarding our community, irrigation protocols, or any other
						matter we can assist with, please feel free to reach out to us:
					</div>
					<br />
					<ul className="font-medium text-gray-500 dark:text-gray-400">
						<li>
							Call or Text to: <Icon className="mb-1 mr-1 h-6 w-6 text-blue-700" name="mobile" />
							<a href="tel:6237036126">(623) 703-6126</a>
						</li>
						<li>
							Email: <Icon className="mb-1 mr-1 h-6 w-6 text-blue-700" name="id-card" />
							<a href="mailto:support@clearwaterfarmsunit1.com" className="mb-4">
								support@clearwaterfarmsunit1.com
							</a>
						</li>
					</ul>
				</div>

				{user.restricted ? (
					<div
						style={{ width: 'clamp(352px, 75%, 720px)' }}
						className="m-auto mt-2 flex flex-col rounded-md border-2 border-destructive px-3 py-2"
					>
						<div className="text-center text-xl font-semibold uppercase text-foreground-destructive">
							User Account Restricted
						</div>
						<div className="text-center text-lg text-foreground-destructive">{user.restriction}</div>
					</div>
				) : null}
				{balance !== null ? (
					<div
						style={{ width: 'clamp(352px, 75%, 720px)' }}
						className={`m-auto mt-2 flex flex-col rounded-md border-2 ${balance < 0 ? 'border-destructive' : 'border-green-900'} px-3 py-2`}
					>
						<div
							className={`flex items-center text-xl font-semibold ${balance < 0 ? 'text-foreground-destructive' : 'text-green-900'}`}
						>
							<div className="w-full text-center">Irrigation Balance: {USDollar.format(balance)}</div>
							{enabled ? (
								<>
									<PaymentsDialog userId={user.id} stripeId={user.stripeId} balance={balance} />
									<PaymentSuccess open={success} username={user.username} />
									<PaymentCancelled open={cancelled} username={user.username} />
								</>
							) : null}
						</div>
					</div>
				) : null}
				<Link
					to="/irrigation"
					style={{ width: 'clamp(352px, 75%, 720px)' }}
					className="border-1 my-1 flex justify-center rounded-lg border-secondary-foreground bg-sky-800 p-2 text-xl text-white"
				>
					<Icon name="link-2" className="mx-1 h-8 w-8 p-1 hover:scale-125" aria-hidden="true" />
					<Icon name="droplets" className="mx-1 mr-0 h-8 w-8 p-1" aria-hidden="true" />
					Where is the water currently?
					<Icon name="droplet" className="mx-1 ml-0 h-8 w-8 p-1" aria-hidden="true" />
					<Icon name="arrow-right" className="mx-1 ml-0 h-8 w-8 p-1 hover:scale-125" aria-hidden="true" />
				</Link>
				<Link
					to={`schedule/${closed.date}/crossovers`}
					style={{ width: 'clamp(352px, 75%, 720px)' }}
					className="border-1 my-1 flex justify-center rounded-lg border-secondary-foreground bg-yellow-700 p-2 text-xl text-white"
				>
					<Icon name="link-2" className="mx-1 h-8 w-8 p-1 hover:scale-125" aria-hidden="true" />
					<Icon name="exclamation-triangle" className="mx-1 mr-0 h-8 w-8 p-1" aria-hidden="true" />
					&nbsp;<strong>Acknowledgements &</strong>&nbsp;Volunteer Signup<strong>&nbsp;| {closed.date}</strong>
					<Icon name="exclamation-triangle" className="mx-1 ml-0 h-8 w-8 p-1" aria-hidden="true" />
					<Icon name="arrow-right" className="mx-1 ml-0 h-8 w-8 p-1 hover:scale-125" aria-hidden="true" />
				</Link>
				<div id="columns" className="m-auto flex h-full flex-wrap justify-center gap-4 p-4">
					<div id="closed" className="w-[352px] flex-col">
						<CardDescription className="text-center">Most Recently Closed Schedule:</CardDescription>
						{closed ? (
							<ClosedSchedule closed={closed} userSchedules={userSchedules} user={user} />
						) : (
							<Card className="bg-muted">
								<CardHeader>
									<CardTitle>No Closed schedules found!</CardTitle>
								</CardHeader>
								<CardContent />
							</Card>
						)}
					</div>

					<div id="open" className="w-[352px] flex-col">
						<CardDescription className="text-center">Currently Open for Sign-Up:</CardDescription>
						{open ? (
							<OpenSchedule open={open} userSchedules={userSchedules} user={user} />
						) : (
							<Card className="bg-muted">
								<CardHeader>
									<CardTitle>No schedules are currently open for Sign-Up!</CardTitle>
								</CardHeader>
								<CardContent />
							</Card>
						)}
					</div>
				</div>
				<AnnouncementsComponent />
			</div>
		)
	} else {
		return (
			<>
				<div
					style={{ width: 'clamp(352px, 75%, 720px)' }}
					className="m-auto mt-2 rounded-md border-2 border-secondary px-3 py-1 text-center align-bottom"
				>
					For website access, questions or comments, please send an email to:
					<br />
					<strong>Member Support&nbsp;</strong>
					<Icon className="mb-1 mr-1 h-6 w-6 text-blue-700" name="id-card" />
					support@clearwaterfarmsunit1.com
				</div>
				<Card className="m-6 flex flex-col items-center gap-5">
					<CardHeader className="m-auto w-[50%] flex-col items-center border-none">
						<CardTitle className="pt-3">Clearwater Farms Unit 1</CardTitle>
						<CardDescription className="pb-3">Log in to sign up for the current schedule.</CardDescription>
					</CardHeader>
				</Card>
				<AnnouncementsComponent />
			</>
		)
	}
}

function OpenSchedule({
	open,
	userSchedules,
	user,
}: {
	open: {
		id: string
		date: string
		deadline: string
		source: string
		costPerHour: number
	}
	userSchedules: {
		open: {
			port: {
				id: string
				ditch: number
			}
			first: boolean | null
			crossover: boolean | null
			last: boolean | null
			hours: number | null
			previous?: number | null
		}[]
	}
	user: {
		id: string
		display: string | null
		defaultHours: number
		restricted: boolean | null
		restriction: string | null
	}
}) {
	return (
		<Card className="bg-muted">
			<CardHeader className="flex-col items-center">
				<CardTitle>Schedule Dated: {open.date}</CardTitle>
				<CardDescription>Open until: {formatDay(open.deadline)}, 7:00pm</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-2">
				{userSchedules.open ? (
					userSchedules.open.map(userSchedule => (
						<UserScheduleEditor
							key={`schedule-${userSchedule.port.ditch}`}
							user={user}
							schedule={open}
							previous={userSchedule.previous}
							userSchedule={userSchedule}
						/>
					))
				) : (
					<MissingUserSchedule schedule={open} />
				)}
			</CardContent>
		</Card>
	)
}

function ClosedSchedule({
	closed,
	userSchedules,
	user,
}: {
	closed: {
		date: string
		start: string | null
		stop: string | null
		schedule: string[]
	}
	userSchedules: {
		closed: {
			port: {
				id: string
				ditch: number
			}
			first: boolean | null
			crossover: boolean | null
			last: boolean | null
			hours: number | null
			schedule: string[]
		}[]
	}
	user: {
		id: string
		display: string | null
	}
}) {
	return (
		<Card className="bg-muted">
			<CardHeader className="flex-col items-center">
				<CardTitle>Schedule Dated: {closed.date}</CardTitle>
				{closed.start && closed.stop ? <CardDescription>{closed.schedule.join(' ─ ')}</CardDescription> : null}
			</CardHeader>
			<CardContent className="flex-col">
				{userSchedules.closed ? (
					userSchedules.closed.map(userSchedule => (
						<UserScheduleTimeline key={`timeline-${userSchedule.port.ditch}`} user={user} userSchedule={userSchedule} />
					))
				) : (
					<MissingUserSchedule schedule={userSchedules.closed} />
				)}
			</CardContent>
		</Card>
	)
}

function MissingUserSchedule({
	schedule,
}: {
	schedule: {
		date?: string
		deadline?: string
		source?: string
		costPerHour?: number
	}
}) {
	return (
		<>
			<DisplayField labelProps={{ children: 'Date' }} inputProps={{ defaultValue: schedule.date }} />
			<DisplayField labelProps={{ children: 'Deadline' }} inputProps={{ defaultValue: schedule.deadline }} />
			<DisplayField labelProps={{ children: 'Source' }} inputProps={{ defaultValue: schedule.source }} />
			<DisplayField labelProps={{ children: 'Cost Per Hour' }} inputProps={{ defaultValue: schedule.costPerHour }} />
		</>
	)
}
