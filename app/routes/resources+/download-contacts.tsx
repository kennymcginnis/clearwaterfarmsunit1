import { Readable } from 'node:stream'
import { createReadableStreamFromReadable } from '@remix-run/node'
import { format } from 'date-fns'
import { prisma } from '#app/utils/db.server.ts'

export async function loader() {
	const users = await prisma.user.findMany({
		select: {
			id: true,
			display: true,
			member: true,
			phones: { select: { type: true, number: true } },
			userAddress: {
				select: {
					address: {
						select: {
							address: true,
							parcelAndLot: {
								select: { parcel: true, lot: true },
							},
						},
					},
				},
			},
			ports: { select: { ditch: true } },
			primaryEmail: true,
			secondaryEmail: true,
			updatedAt: true,
		},
	})

	let stringArray = users.map(({ id, display, member, phones, userAddress, ports, primaryEmail, secondaryEmail, updatedAt }) => {
		const userAddressString = userAddress.map(ua => `${ua.address.address}`).join(`
`)
		const ditchesString = ports.map(port => `${port.ditch}`).join(' & ')
		const phonesString = phones.filter(p => p.number && p.number !== 'N/A').map(p => `${p.type}: ${p.number}`).join(`
`)
		const emailsString = `${primaryEmail ? `primary: ${primaryEmail}` : ''} ${
			secondaryEmail
				? `
secondary: ${secondaryEmail}`
				: ''
		}`

		const parcelString = userAddress.map(
			ua =>
				`${ua.address.parcelAndLot.map(pnl => pnl.parcel).join(`
`)}`,
		).join(`
`)
		const lotString = userAddress.map(
			ua =>
				`${ua.address.parcelAndLot.map(pnl => pnl.lot).join(`
`)}`,
		).join(`
`)

	const updatedAtString = format(updatedAt, 'MMM dd, h:mmaaa')

		return [
			id,
			`"${display}"`,
			`"${member}"`,
			`"${userAddressString}"`,
			`"${ditchesString}"`,
			`"${phonesString}"`,
			`"${emailsString}"`,
			`"${parcelString}"`,
			`"${lotString}"`,
			`"${updatedAtString}"`,
		].join(',')
	})

	const file = createReadableStreamFromReadable(
		Readable.from(
			[
				[
					'UserId',
					'Display Name',
					'Member Name',
					'Physical Address',
					'Ditch Numbers',
					'Phone Numbers',
					'Email Addresses',
					'Parcels',
					'Lots',
					'Last Updated',
				].join(','),
				...stringArray,
			].join('\n'),
		),
	)

	return new Response(file, {
		headers: {
			'Content-Disposition': `attachment; filename="member-contacts-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
			'Content-Type': 'application/csv',
		},
	})
}