import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'

export async function loader() {
	return await prisma.port.findMany()
}

/*
const eastOrWest = (position: number) => {
	if (position < 8) return 'West'
	if (position < 15) return 'East'
	if (position < 20) return 'West'
	return 'East'
}
const leftOrRight = (ditch: number, section: string | null) => {
	if (ditch < 5) return 'left'
	if (ditch < 9) return 'right'
	return section === 'West' ? 'left' : 'right'
}
*/

export const action = async ({ params }: ActionFunctionArgs) => {
	switch (params.intent) {
		case 'position': {
			const users = await prisma.user.findMany({
				select: {
					display: true,
					userAddress: {
						select: {
							address: true
						}
					},
					ports: {
						select: {
							id: true,
							position: true
						}
					}
				}
			})
			for (const user of users) {
				const address = user.display === 'Mills' ? 7212 : Number(user?.userAddress?.[0]?.address?.address.split(' ')[0])
				if (!address) continue
				for (const { id } of user.ports) {
					await prisma.port.update({ where: { id }, data: { address } })
				}
			}
			return `Complete.`
		}
		default:
			invariantResponse(params.intent, `Intent not handled.`, { status: 404 })
			break
	}
}
