import { json, type MetaFunction, type LoaderFunctionArgs } from '@remix-run/node'
import { requireUserId } from '#app/utils/auth.server.ts'
import { MeetingEditor, action } from './__meeting-editor.tsx'

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserId(request)
	return json({})
}

export { action }
export default MeetingEditor

export const meta: MetaFunction<null, { 'routes/meetings+/$date_+/meeting': typeof loader }> = () => {
	return [
		{ title: `New Meeting | Clearwater Farms 1` },
		{
			name: 'description',
			content: `New Clearwater Farms 1 Board Meeting`,
		},
	]
}
