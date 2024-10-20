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

	console.timeEnd(`🌱 Database has been seeded`)
}
