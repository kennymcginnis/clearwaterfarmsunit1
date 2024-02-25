import { invariantResponse } from '@epic-web/invariant'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'

export const action = async ({ request, params }: ActionFunctionArgs) => {
	const user = await prisma.user.findFirstOrThrow({
		select: { id: true },
		where: { username: params.username },
	})

	switch (request.method) {
		case 'PUT': {
			switch (params.intent) {
				case 'restricted': {
					const PutUserRolesSchema = z.object({ restricted: z.boolean(), restriction: z.string().optional() })
					const result = PutUserRolesSchema.safeParse(await request.json())
					if (!result.success) {
						return json({ status: 'error', error: result.error.message } as const, {
							status: 400,
						})
					}
					const { restricted, restriction } = result.data
					return await prisma.user.update({
						select: { id: true, username: true, restricted: true, restriction: true },
						data: { restricted, restriction },
						where: { id: user.id },
					})
				}
				case 'roles': {
					const PutUserRolesSchema = z.object({ connect: z.object({ name: z.string() }).array() })
					const result = PutUserRolesSchema.safeParse(await request.json())
					if (!result.success) {
						return json({ status: 'error', error: result.error.message } as const, {
							status: 400,
						})
					}
					return await prisma.user.update({
						select: { id: true, username: true, roles: { select: { name: true } } },
						data: { roles: result.data },
						where: { id: user.id },
					})
				}
			}
		}
		case 'PATCH': {
			switch (params.intent) {
				case 'roles':
			}
		}
	}
	invariantResponse(params.intent, `${request.method} Intent not handled.`, { status: 404 })
}
