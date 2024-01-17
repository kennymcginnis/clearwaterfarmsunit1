// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
// prettier-ignore

import { users, details } from './seed.users'

const emailType = ['primary', 'secondary']
const phoneType = ['home', 'celluar', 'secondary']
// eslint-disable-next-line no-sequences
const input = users.reduce((a, c) => ((a[c.username] = c), a), {})
const output = {}
for (const detail of details) {
	const {
		username: found,
		member,
		address,
		homePhone,
		primaryCellPhone,
		secondaryCellPhone,
		primaryEmail,
		secondaryEmail,
		parcel,
		lot,
	} = detail

	if (found) {
		if (!input[found]) {
			console.log(found)
		}
		const { username, restricted, ports, deposits, schedules } = input[found]

		if (output[detail.username]) {
			const prevaddress = output[detail.username].address.find(a => a.address === address)
			if (prevaddress) {
				prevaddress.parcelAndLot.push({
					parcel,
					lot,
				})
			} else {
				output[detail.username].address.push({
					address,
					parcelAndLot: [
						{
							parcel,
							lot,
						},
					],
				})
			}
		} else {
			const tmp = {
				username,
				member,
				address: [
					{
						address,
						parcelAndLot: [
							{
								parcel,
								lot,
							},
						],
					},
				],
				email: [primaryEmail, secondaryEmail]
					.map((address, i) =>
						!address
							? null
							: {
									address,
									type: emailType[i],
							  },
					)
					.filter(Boolean),
				phone: [homePhone, primaryCellPhone, secondaryCellPhone]
					.map((number, i) =>
						!number
							? null
							: {
									number,
									type: phoneType[i],
							  },
					)
					.filter(Boolean),
				ports,
				deposits,
				schedules,
				restricted,
			}
			output[detail.username] = tmp
		}
	}
}
