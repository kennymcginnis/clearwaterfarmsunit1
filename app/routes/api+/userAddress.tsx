import { type ActionFunctionArgs, json } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'

export const action = async ({ request }: ActionFunctionArgs) => {
	switch (request.method) {
		case 'DELETE':
			const DeleteUserAddressSchema = z.object({
				username: z.string(),
				address: z.string(),
			})
			const result = DeleteUserAddressSchema.safeParse(await request.json())
			if (!result.success) {
				return json({ status: 'error', error: result.error.message } as const, { status: 400 })
			}
			const { username, address } = result.data
			try {
				const { count } = await prisma.userAddress.deleteMany({
					where: {
						user: { username },
						address: { address },
					},
				})
				return json({ status: 'deleted', count } as const, { status: 200 })
			} catch (error) {
				console.error("Error deleting a user's address", error)
				return json({ status: 'error', error } as const, { status: 400 })
			}
		case 'POST':
		case 'PUT':
		case 'PATCH':
	}
}
