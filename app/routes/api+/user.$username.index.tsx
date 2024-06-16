import { type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'

export async function loader({ params }: LoaderFunctionArgs) {
	return await prisma.user.findFirstOrThrow({
		select: {
			id: true,
			username: true,
			member: true,
			quickbooks: true,
			defaultHours: true,
			active: true,
			restricted: true,
			userAddress: {
				select: {
					id: true,
					address: { select: { id: true, address: true, parcelAndLot: { select: { parcel: true, lot: true } } } },
				},
			},
			primaryEmail: true,
			secondaryEmail: true,
			phones: {
				select: {
					type: true,
					number: true,
				},
			},
			ports: {
				select: {
					ditch: true,
					position: true,
					entry: true,
				},
			},
			transactions: {
				select: {
					date: true,
					debit: true,
					credit: true,
					note: true,
				},
			},
			schedules: {
				select: {
					schedule: { select: { date: true, deadline: true, source: true, costPerHour: true } },
					hours: true,
					ditch: true,
				},
			},
			image: { select: { id: true } },
			createdAt: true,
		},
		where: { username: params.username },
	})
}
