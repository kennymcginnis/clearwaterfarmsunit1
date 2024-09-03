import { json, type ActionFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'

export async function loader() {
	return await prisma.featureToggle.findMany()
}

export const action = async ({ request }: ActionFunctionArgs) => {
	const PortSchema = z.object({
		name: z.string(),
		enabled: z.boolean(),
	})

	try {
		const result = PortSchema.safeParse(await request.json())
		if (!result.success) {
			return json({ status: 'error', error: result.error.message }, { status: 400 })
		}
		const { name, enabled } = result.data
		const featureToggle = await prisma.featureToggle.upsert({
			where: { name },
			create: { name, enabled },
			update: { name, enabled },
		})
		return json({ status: 'created', featureToggle })
	} catch (error) {
		return json({ status: 'error', error } as const, { status: 400 })
	}
}
