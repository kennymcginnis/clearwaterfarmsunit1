import { invariantResponse } from '@epic-web/invariant'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'

export async function loader() {
	return await prisma.user.findMany()
}

/**
 * To divide a ditch into two sections
 * Sample payload to assign positions 1-15=West and 16+=East
 *
 *  {
 * 		"ditch": 9,
 * 		"divisor": 16,
 * 		"sections": ["West","East"]
 *  }
 */
export const action = async ({ request, params }: ActionFunctionArgs) => {
	// const body: any = await request.json()
	switch (params.intent) {
		case 'section':
			const PortSectionSchema = z.object({
				ditch: z.number(),
				divisor: z.number(),
				sections: z.string().array().length(2),
			})
			const result = PortSectionSchema.safeParse(await request.json())
			if (!result.success) {
				return json({ status: 'error', error: result.error.message } as const, {
					status: 400,
				})
			}

			const { ditch, divisor, sections } = result.data
			const [left, right] = sections
			const ports = await prisma.port.findMany({ where: { ditch } })
			ports.forEach(async ({ id, position }) => {
				await prisma.port.update({
					data: { section: position < divisor ? left : right },
					where: { id },
				})
			})
			return `Complete. ${ports.length} updated.`
		default:
			invariantResponse(params.intent, `Intent not handled.`, { status: 404 })
			break
	}
}
