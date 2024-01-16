import { promiseHash } from 'remix-utils/promise'
import { prisma } from '#app/utils/db.server.ts'
import { cleanupDb, createPassword, img } from '#tests/db-utils.ts'
import documents from './seed.documents'
import users from './seed.users'

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

	await cleanupDb(prisma)

	const meetingId = await seedMeetings()
	await seedDocuments(meetingId)

	await seedPermissions()
	await seedRoles()
	const scheduleId = await seedSchedules()
	await seedUsers(scheduleId)
	await seedAdminUsers(scheduleId)

	console.timeEnd(`🌱 Database has been seeded`)
}

async function seedMeetings() {
	console.time('👑 Created meetings...')
	const meeting = await prisma.meeting.create({
		select: { id: true },
		data: {
			date: '2023-07-02',
		},
	})
	console.timeEnd('👑 Created meetings...')
	return meeting.id
}

async function seedDocuments(meetingId: string) {
	const totalDocuments = documents.length
	console.time(`👤 Created ${totalDocuments} documents...`)

	const meetingTypes = ['agenda', 'minutes', 'balance-sheet', 'profit-loss']
	for (let index = 0; index < totalDocuments; index++) {
		const { content, ...documentData } = documents[index]
		await prisma.document
			.create({
				select: { id: true },
				data: {
					...documentData,
					content: Buffer.from(content),
					meetingId: meetingTypes.includes(documentData.type)
						? meetingId
						: null,
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
	const mcginnisImages = await promiseHash({
		mcginnisUser: img({
			filepath: './tests/fixtures/images/user/mcginnis.png',
		}),
		cuteKoala: img({
			altText: 'an adorable koala cartoon illustration',
			filepath: './tests/fixtures/images/mcginnis-notes/cute-koala.png',
		}),
		koalaEating: img({
			altText: 'a cartoon illustration of a koala in a tree eating',
			filepath: './tests/fixtures/images/mcginnis-notes/koala-eating.png',
		}),
		koalaCuddle: img({
			altText: 'a cartoon illustration of koalas cuddling',
			filepath: './tests/fixtures/images/mcginnis-notes/koala-cuddle.png',
		}),
		mountain: img({
			altText: 'a beautiful mountain covered in snow',
			filepath: './tests/fixtures/images/mcginnis-notes/mountain.png',
		}),
		koalaCoder: img({
			altText: 'a koala coding at the computer',
			filepath: './tests/fixtures/images/mcginnis-notes/koala-coder.png',
		}),
		koalaMentor: img({
			altText:
				'a koala in a friendly and helpful posture. The Koala is standing next to and teaching a woman who is coding on a computer and shows positive signs of learning and understanding what is being explained.',
			filepath: './tests/fixtures/images/mcginnis-notes/koala-mentor.png',
		}),
		koalaSoccer: img({
			altText: 'a cute cartoon koala kicking a soccer ball on a soccer field ',
			filepath: './tests/fixtures/images/mcginnis-notes/koala-soccer.png',
		}),
	})
	await prisma.user.create({
		select: { id: true },
		data: {
			email: 'mcginnis@example.com',
			username: 'mcginnis',
			name: 'McGinnis',
			image: { create: mcginnisImages.mcginnisUser },
			password: { create: createPassword('mcginnis') },
			roles: { connect: [{ name: 'admin' }, { name: 'user' }] },
			orangewood: 'South',
			ports: { create: [{ id: '7-27', ditch: 7, position: 27 }] },
			deposits: {
				create: [
					{
						date: new Date(2024, 0, 1),
						amount: 165,
						note: '2024 Starting Balance',
					},
				],
			},
			schedules: {
				create: [{ scheduleId, ditch: 7, hours: 3.1 }],
			},
		},
	})
	console.timeEnd(`🐨 Created admin user "mcginnis"`)
}

async function seedUsers(scheduleId: string) {
	const totalUsers = users.length
	console.time(`👤 Created ${totalUsers} users...`)
	// const noteImages = await getNoteImages()
	// const userImages = await getUserImages()
	for (let index = 0; index < totalUsers; index++) {
		const { ports, deposits, schedules, ...userData } = users[index]
		await prisma.user
			.create({
				select: { id: true },
				data: {
					...userData,
					email: `${userData.username}@example.com`,
					password: { create: createPassword(userData.username) },
					roles: { connect: { name: 'user' } },
					ports: {
						create: ports.map(port => ({
							id: `${port.ditch}-${port.position}`,
							...port,
						})),
					},
					deposits: {
						create: (deposits || []).map(deposit => ({
							...deposit,
							date: new Date(2024, 0, 1),
						})),
					},
					schedules: {
						create: (schedules || []).map(schedule => ({
							scheduleId: scheduleId,
							...schedule,
						})),
					},
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
			date: new Date(2024, 0, 12),
			source: 'Well water',
			deadline: new Date(2024, 0, 8),
			costPerHour: 10,
		},
	})
	console.timeEnd('👑 Created schedules...')
	return schedule.id
}

async function seedPermissions() {
	console.time('🔑 Created permissions...')
	const entities = ['user', 'note']
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
