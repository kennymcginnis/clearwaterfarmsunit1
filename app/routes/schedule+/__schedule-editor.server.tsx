import { parse } from '@conform-to/zod'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { requireUserId } from '#app/utils/auth.server.ts'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'

const UserScheduleEditorSchema = z.object({
	userId: z.string(),
	scheduleId: z.string(),
	portId: z.string(),
	ditch: z.number(),
	hours: z.number().min(0).max(12).optional().default(0),
})

export async function action({ request }: ActionFunctionArgs) {
	const currentUser = await requireUserId(request)
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)

	const submission = await parse(formData, { schema: UserScheduleEditorSchema, async: true })
	if (submission.intent !== 'submit') return json({ status: 'idle', submission })

	if (submission.value) {
		const { userId, scheduleId, portId, ditch, hours } = submission.value

		await prisma.userSchedule.upsert({
			select: { userId: true, scheduleId: true, portId: true },
			where: { userId_scheduleId_portId: { userId, scheduleId, portId } },
			create: {
				userId,
				scheduleId,
				portId,
				hours,
				updatedBy: currentUser,
			},
			update: {
				hours,
				updatedBy: currentUser,
			},
		})

		return redirectWithToast('', {
			type: 'success',
			title: 'Success',
			description: hours ? `${hours} hours saved for ditch ${ditch}.` : `Hours removed from ditch ${ditch}.`,
		})
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}
