import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { Outlet, Link, useLoaderData } from '@remix-run/react'
import { Card, CardContent } from '#app/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '#app/components/ui/tabs'

export async function loader({ request, params }: LoaderFunctionArgs) {
	if (!params.type) {
		return redirect(`${request.url}/agenda`)
	}

	const meetingTypes = [
		{ type: 'agenda', descrption: 'Agenda' },
		{ type: 'minutes', descrption: 'Minutes' },
	]
	return json({ meetingTypes, date: params.date })
}

export default function ProfileRoute() {
	const { meetingTypes, date } = useLoaderData<typeof loader>()

	return (
		<div className="inset-0 flex flex-col px-10">
			<h2 className="mb-2 pt-12 text-h2 lg:mb-6">Meeting Documents dated: {date}</h2>
			<Tabs defaultValue="account">
				<TabsList className="m-2 flex flex-row justify-start">
					{meetingTypes.map(type => (
						<Link key={type.type} to={type.type} defaultChecked={type.type === 'agenda'}>
							<TabsTrigger value={type.type}>{type.descrption}</TabsTrigger>
						</Link>
					))}
				</TabsList>

				<Card className="prose mb-4 min-h-screen max-w-full lg:prose-lg dark:prose-invert">
					<CardContent className="space-y-2">
						<Outlet />
					</CardContent>
				</Card>
			</Tabs>
		</div>
	)
}
