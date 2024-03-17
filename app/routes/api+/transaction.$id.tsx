import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'

export async function loader({ params }: LoaderFunctionArgs) {
	try {
		const transaction = await prisma.transactions.findFirstOrThrow({ where: { id: params.id } })
		return json(transaction)
	} catch (error) {
		return json({ status: 'error', error } as const, { status: 400 })
	}
}
