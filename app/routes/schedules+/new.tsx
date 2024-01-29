import { json, type MetaFunction, type LoaderFunctionArgs } from '@remix-run/node'
import { requireUserId } from '#app/utils/auth.server.ts'
import { ScheduleEditor, action } from './__schedules-editor.tsx'

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserId(request)
	return json({})
}

export { action }
export default ScheduleEditor

export const meta: MetaFunction<null, { 'routes/schedules+/new': typeof loader }> = () => {
	return [
		{ title: `New Irrigation Schedule | Clearwater Farms 1` },
		{
			name: 'description',
			content: `New Irrigation Schedule for Clearwater Farms 1`,
		},
	]
}
