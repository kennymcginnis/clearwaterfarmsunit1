import { prisma } from '#app/utils/db.server.ts'
import { generatePublicId } from '#app/utils/public-id'
import { cleanupDb, createPassword } from '#tests/db-utils.ts'
import documents from './seed.documents'
import { timeline } from './seed.timeline'
import { users } from './seed.users'

const preSeeded = false

seed()
	.catch(e => {
		console.error(e)
		process.exit(1)
	})
	.finally(async () => {
		// await prisma.$disconnect()
	})

async function seed() {
	console.log('🌱 Seeding...')
	console.time(`🌱 Database has been seeded`)

	if (!preSeeded) {
		await cleanupDb(prisma)

		const meetingId = await seedMeetings()
		await seedDocuments(meetingId)

		await seedPermissions()
		await seedRoles()
		const scheduleId = await seedSchedules()
		await seedUsers(scheduleId)
		await seedTimeline()
		await seedAdminUsers(scheduleId)
	}

	console.timeEnd(`🌱 Database has been seeded`)
}

async function seedTimeline() {
	for (let t of timeline) {
		if (t.start && t.end) {
			await prisma.userSchedule.updateMany({
				data: {
					start: new Date(t.start),
					stop: new Date(t.end),
				},
				where: {
					user: { username: t.username },
					ditch: t.ditch,
					schedule: { date: '2024-01-12' },
				},
			})
		}
	}
}

async function seedMeetings() {
	console.time('👑 Created meetings...')
	const meeting = await prisma.meeting.create({
		select: { id: true },
		data: {
			id: generatePublicId(),
			date: '2023-07-02',
		},
	})
	console.timeEnd('👑 Created meetings...')
	return meeting.id
}

async function seedDocuments(meetingId: string) {
	const totalDocuments = documents.length
	console.time(`👤 Created ${totalDocuments} documents...`)

	const meetingTypes = ['agenda', 'minutes']
	for (let index = 0; index < totalDocuments; index++) {
		const { content, ...documentData } = documents[index]
		await prisma.document
			.create({
				select: { id: true },
				data: {
					id: generatePublicId(),
					...documentData,
					content: Buffer.from(content),
					meetingId: meetingTypes.includes(documentData.type) ? meetingId : null,
				},
			})
			.catch(e => {
				console.error('Error creating a document:', e)
				return null
			})
	}
	console.timeEnd(`👤 Created ${totalDocuments} documents...`)
}

async function seedAdminUsers(scheduleId: string) {
	console.time(`🐨 Created admin user "mcginnis"`)
	await prisma.user.update({
		select: { id: true },
		data: {
			roles: { connect: [{ name: 'admin' }, { name: 'user' }] },
		},
		where: { username: 'mcginnis' },
	})
	console.timeEnd(`🐨 Created admin user "mcginnis"`)
}

async function seedUsers(scheduleId: string) {
	const totalUsers = users.length
	console.time(`👤 Created ${totalUsers} users...`)

	for (let index = 0; index < totalUsers; index++) {
		const userData = users[index]

		await prisma.user
			.create({
				select: { id: true },
				data: {
					id: generatePublicId(),
					username: userData.username,
					member: userData.member,
					userAddress: {
						create: userData?.address?.map(ua => ({
							id: generatePublicId(),
							active: true,
							address: {
								create: {
									id: generatePublicId(),
									address: ua.address,
									parcelAndLot: {
										create: (ua.parcelAndLot || []).map(pl => ({ id: generatePublicId(), ...pl })),
									},
								},
							},
						})),
					},
					primaryEmail: userData.primaryEmail,
					secondaryEmail: userData.secondaryEmail,
					phones: { create: (userData.phone || []).map(v => ({ id: generatePublicId(), ...v })) },
					ports: { create: (userData.ports || []).map(v => ({ id: generatePublicId(), ...v })) },
					password: { create: createPassword(userData.username) },
					transactions: {
						create: (userData.deposits || []).map(({ amount, ...deposit }) => ({
							id: generatePublicId(),
							...deposit,
							credit: amount < 0 ? amount : null,
							debit: amount > 0 ? amount : null,
							date: '2024-01-01',
						})),
					},
					roles: { connect: { name: 'user' } },
					schedules: {
						create: (userData.schedules || []).map(schedule => ({
							scheduleId,
							...schedule,
						})),
					},
					restricted: userData.restricted,
				},
			})
			.catch(e => {
				console.error('Error creating a user:', e)
				return null
			})
	}
	console.timeEnd(`👤 Created ${totalUsers} users...`)
}

async function seedSchedules() {
	console.time('👑 Created schedules...')
	const schedule = await prisma.schedule.create({
		select: { id: true },
		data: {
			id: generatePublicId(),
			date: '2024-01-12',
			source: 'Well water',
			deadline: '2024-01-08',
			costPerHour: 10,
		},
	})
	console.timeEnd('👑 Created schedules...')
	return schedule.id
}

async function seedPermissions() {
	console.time('🔑 Created permissions...')
	const entities = ['user', 'document']
	const actions = ['create', 'read', 'update', 'delete']
	const accesses = ['own', 'any'] as const
	for (const entity of entities) {
		for (const action of actions) {
			for (const access of accesses) {
				await prisma.permission.create({ data: { entity, action, access } })
			}
		}
	}
	console.timeEnd('🔑 Created permissions...')
}

async function seedRoles() {
	console.time('👑 Created roles...')
	await prisma.role.create({
		data: {
			id: generatePublicId(),
			name: 'admin',
			permissions: {
				connect: await prisma.permission.findMany({
					select: { id: true },
					where: { access: 'any' },
				}),
			},
		},
	})

	await prisma.role.create({
		data: {
			id: generatePublicId(),
			name: 'user',
			permissions: {
				connect: await prisma.permission.findMany({
					select: { id: true },
					where: { access: 'own' },
				}),
			},
		},
	})
	console.timeEnd('👑 Created roles...')
}
