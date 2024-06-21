import { json, type ActionFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'
import { generatePublicId } from '#app/utils/public-id'

export async function loader() {
	const documents = await prisma.document.findMany({
		orderBy: { updatedAt: 'desc' },
	})
	return documents.map(({ content, ...rest }) => ({ ...rest, content: content.toString() }))
}

export const action = async ({ request }: ActionFunctionArgs) => {
	switch (request.method) {
		case 'POST':
			console.log('Not implemented')
			const PutDocumentRolesSchema = z.object({
				type: z.string(),
				title: z.string(),
				content: z.string(),
				createdBy: z.string(),
			})
			const result = PutDocumentRolesSchema.safeParse(await request.json())
			if (!result.success) {
				return json({ status: 'error', error: result.error.message } as const, {
					status: 400,
				})
			}

			const { content, ...documentData } = result.data
			await prisma.document.create({
				select: { id: true },
				data: {
					id: generatePublicId(),
					...documentData,
					content: Buffer.from(content),
				},
			})
			break
		case 'PUT':
			break
	}
}
