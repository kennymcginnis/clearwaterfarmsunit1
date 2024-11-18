import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'

export async function loader() {
	return await prisma.user.findMany()
}

export const action = async ({ params }: ActionFunctionArgs) => {
	switch (params.intent) {
		default:
			invariantResponse(params.intent, `Intent not handled.`, { status: 404 })
			break
	}
}
