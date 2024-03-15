import { type ActionFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'

export async function loader({ params }: ActionFunctionArgs) {
	const { content, ...rest } = await prisma.document.findFirstOrThrow({
		where: { type: params.type },
	})
	return { ...rest, content: content.toString() }
}
