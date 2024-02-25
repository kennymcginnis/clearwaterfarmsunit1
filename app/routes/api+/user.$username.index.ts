import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs, json, type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'

export async function loader({ params }: LoaderFunctionArgs) {
	const user = await prisma.user.findFirst({
		select: {
			id: true,
			username: true,
			member: true,
			userAddress: {
				select: {
					id: true,
					active: true,
					address: {
						select: {
							id: true,
							address: true,
							parcelAndLot: {
								select: {
									id: true,
									parcel: true,
									lot: true,
								},
							},
						},
					},
				},
			},
			primaryEmail: true,
			secondaryEmail: true,
			phones: {
				select: {
					id: true,
					type: true,
					number: true,
				},
			},
			ports: {
				select: {
					id: true,
					ditch: true,
					position: true,
					entry: true,
				},
			},
			transactions: {
				select: {
					id: true,
					date: true,
					debit: true,
					credit: true,
					note: true,
				},
			},
			schedules: {
				select: {
					scheduleId: true,
					ditch: true,
					hours: true,
					head: true,
					start: true,
					stop: true,
				},
			},

			defaultHours: true,
			defaultHead: true,

			restricted: true,
			restriction: true,

			image: { select: { id: true } },
			roles: { select: { id: true, name: true } },

			createdBy: true,
			createdAt: true,
			updatedBy: true,
			updatedAt: true,
		},
		where: {
			username: params.username,
		},
	})

	invariantResponse(user, 'User not found', { status: 404 })
	return json(user)
}

export const action = async ({ request }: ActionFunctionArgs) => {
	switch (request.method) {
		case 'POST': {
			/* handle "POST" */
		}
		case 'PUT': {
			/* handle "PUT" */
		}
		case 'PATCH': {
			/* handle "PATCH" */
		}
		case 'DELETE': {
			/* handle "DELETE" */
		}
	}
}
