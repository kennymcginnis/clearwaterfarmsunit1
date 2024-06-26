import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node'
import { useLoaderData, Form, useActionData } from '@remix-run/react'
import { formatDistanceToNow } from 'date-fns'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { ErrorList, TextareaField } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Card, CardContent, CardHeader } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { useOptionalAdminUser } from '#app/utils/user'

const DocumentEditorSchema = z.object({
	documentId: z.string(),
	content: z.string(),
})

export async function loader({ params, request }: LoaderFunctionArgs) {
	const requestUrl = new URL(request.url)
	const type = params.type || requestUrl.pathname.substring(1)
	console.log({ type })
	const document = await prisma.document.findFirst({
		select: {
			id: true,
			title: true,
			content: true,
			meeting: { select: { date: true } },
			images: { select: { id: true } },
			updatedBy: true,
			updatedAt: true,
		},
		where: { type },
		orderBy: { updatedAt: 'desc' },
	})

	invariantResponse(document, `No ${params.type} document found`, {
		status: 404,
	})

	const date = new Date(document.updatedAt)
	const timeAgo = formatDistanceToNow(date)

	return json({ document, content: document.content.toString(), timeAgo })
}

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)

	const submission = await parse(formData, {
		schema: () => DocumentEditorSchema.transform(async (data, ctx) => data),
		async: true,
	})

	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}

	if (submission.value) {
		const { documentId, content } = submission.value

		const contentBuffer = Buffer.from(content)

		await prisma.document.update({
			select: { id: true },
			where: { id: documentId },
			data: {
				content: contentBuffer,
				updatedBy: userId,
			},
		})
	}

	return redirectWithToast('', {
		type: 'success',
		title: 'Success',
		description: `Document content saved.`,
	})
}

export default function DocumentComponent() {
	const userIsAdmin = useOptionalAdminUser()

	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()

	const [form, fields] = useForm({
		id: 'note-editor',
		constraint: getFieldsetConstraint(DocumentEditorSchema),
		lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: DocumentEditorSchema })
		},
		defaultValue: {
			content: data.content ?? '',
		},
	})

	// <main className="h-full w-full px-0 pb-12 md:px-8">
	return (
		<Card className="container mb-6 rounded-none bg-muted px-0 pb-12 lg:rounded-3xl">
			<CardHeader className="mx-0">
				{userIsAdmin ? (
					<div className="flex w-full items-center justify-between gap-2 p-4 pb-0 pl-5">
						<span className="text-sm text-foreground/90 max-md:hidden">
							<Icon name="clock" className="scale-125">
								Last Modified {data.timeAgo} ago
							</Icon>
						</span>
						<div className="flex flex-row gap-2">
							<Button form={form.id} variant="destructive" type="reset">
								Reset
							</Button>
							<StatusButton form={form.id} type="submit" disabled={isPending} status={isPending ? 'pending' : 'idle'}>
								Submit
							</StatusButton>
						</div>
					</div>
				) : null}
			</CardHeader>
			<CardContent className="p-10 pt-6">
				<Form
					method="POST"
					className="overflow-y-auto overflow-x-hidden px-10 pb-28 pt-12"
					{...form.props}
					encType="multipart/form-data"
				>
					<AuthenticityTokenInput />
					{/*
					This hidden submit button is here to ensure that when the user hits
					"enter" on an input field, the primary form function is submitted
					rather than the first button in the form (which is delete/add image).
				*/}
					<button type="submit" className="hidden" />
					<input type="hidden" name="documentId" value={data.document.id} />
					<TextareaField
						labelProps={{ children: 'Content' }}
						textareaProps={{
							style: { height: '50vh' },
							...conform.textarea(fields.content, { ariaAttributes: true }),
						}}
						errors={fields.content.errors}
					/>
					<ErrorList id={form.errorId} errors={form.errors} />
				</Form>
			</CardContent>
		</Card>
	)
}
