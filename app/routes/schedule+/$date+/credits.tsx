import { parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs, json, type LoaderFunctionArgs } from '@remix-run/node'
import { useFetcher, useLoaderData, useSubmit } from '@remix-run/react'
import { useState } from 'react'
import { Resend } from 'resend'
import { z } from 'zod'
import { ScheduleCreditEmail } from '#app/components/email/ScheduleCreditEmail.tsx'
import { HoldToConfirmButton } from '#app/components/HoldToConfirmButton.tsx'
import { QuickbooksCombobox } from '#app/components/quickbooks-combobox.tsx'
import { Button } from '#app/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon'
import { Input } from '#app/components/ui/input.tsx'
import { Separator } from '#app/components/ui/separator'
import { StatusButton } from '#app/components/ui/status-button'
import { prisma } from '#app/utils/db.server.ts'
import { useDoubleCheck } from '#app/utils/misc.tsx'
import { requireUserWithRole } from '#app/utils/permissions'
import { generatePublicId } from '#app/utils/public-id.ts'
import { DateSchema } from '#app/utils/user-validation.ts'

type OptionType = {
	value: string
	label: string
}
type UserType = {
	id: string
	display: string
	quickbooks: string
	primaryEmail: string
}
type QuickbooksMapType = {
	[quickbooks: string]: UserType
}
type TransactionData = {
	schedule: { id: string; date: string }
	transactions: Transaction[]
	creditsTotal: number
	quickbooksMap: QuickbooksMapType
	newUserOptions: OptionType[]
}
type Transaction = {
	id: string
	date: string
	debit: number
	note: string | null
	user: UserType
	emailed: boolean
}
type ChangesType = {
	id: string
	intent: string
	debit?: string
	note?: string
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	await requireUserWithRole(request, 'admin')

	const schedule = await prisma.schedule.findFirst({
		select: { id: true, date: true },
		where: { date: params.date },
	})
	invariantResponse(schedule, 'Schedule Not found', { status: 404 })

	const transactions = await prisma.transactions.findMany({
		select: {
			id: true,
			debit: true,
			note: true,
			emailed: true,
			user: { select: { id: true, display: true, primaryEmail: true, quickbooks: true } },
		},
		where: {
			scheduleId: schedule.id,
			debit: { not: 0 },
		},
	})

	const creditsTotal = transactions.reduce((acc, { debit }) => acc + debit, 0)

	const quickbooksMap: QuickbooksMapType = await prisma.user
		.findMany({
			select: { id: true, display: true, quickbooks: true, primaryEmail: true },
			orderBy: { quickbooks: 'asc' },
		})
		.then(users =>
			users
				.filter(u => Boolean(u.quickbooks))
				.reduce((acc, user) => ({ ...acc, [user.quickbooks?.toLowerCase() as string]: user }), {}),
		)

	const newUserOptions: OptionType[] = Object.values(quickbooksMap).map(({ quickbooks }) => ({
		value: quickbooks.toLowerCase(),
		label: quickbooks,
	}))

	return { schedule, transactions, creditsTotal, quickbooksMap, newUserOptions }
}

export async function action({ request, params }: ActionFunctionArgs) {
	const formData = await request.formData()
	const { id: scheduleId, date } = await prisma.schedule.findFirstOrThrow({
		select: { id: true, date: true },
		where: { date: params.date },
	})
	invariantResponse(scheduleId, 'Invalid schedule', { status: 400 })

	const updatedBy = await requireUserWithRole(request, 'admin')
	const intent = formData.get('intent')
	switch (intent) {
		case 'create-transaction': {
			const submission = parse(formData, {
				schema: z.object({
					userId: z.string(),
					scheduleId: z.string(),
					date: DateSchema,
					debit: z.preprocess(x => (x ? x : 0), z.coerce.number()),
					note: z.string(),
				}),
			})
			invariantResponse(submission?.value, 'Invalid submission', { status: 404 })
			await prisma.transactions.create({ data: { id: generatePublicId(), ...submission.value, updatedBy } })
			return null
		}
		case 'delete-transaction': {
			const submission = parse(formData, { schema: z.object({ id: z.string() }) })
			invariantResponse(submission?.value, 'Invalid submission', { status: 404 })
			const { id } = submission.value
			await prisma.transactions.delete({ where: { id } })
			return null
		}
		case 'debit':
		case 'note':
			const submission = parse(formData, {
				schema: z.object({
					id: z.string(),
					debit: z.preprocess(x => (x ? x : 0), z.coerce.number()).optional(),
					note: z.string().optional(),
				}),
			})
			invariantResponse(submission?.value, 'Invalid submission', { status: 404 })
			const { id } = submission.value
			if (submission.value[intent]) {
				await prisma.transactions.update({ data: { [intent]: submission.value[intent] }, where: { id } })
			}
			return null
		case 'email-transaction':
			const transactionId = String(formData.get('transactionId'))
			const transaction = await prisma.transactions.findFirst({
				select: {
					user: { select: { primaryEmail: true, emailSubject: true } },
					debit: true,
					note: true,
				},
				where: { id: transactionId },
			})
			invariantResponse(transaction, 'Transaction not found', { status: 404 })
			invariantResponse(transaction.user, 'Transaction missing user', { status: 404 })
			const {
				user: { primaryEmail, emailSubject },
				debit,
				note,
			} = transaction
			if (emailSubject && note) {
				const payload = {
					from: 'clearwat@clearwaterfarmsunit1.com',
					to: primaryEmail,
					subject: `Clearwater Farms Unit 1 - Credit Issued`,
					react: <ScheduleCreditEmail date={date} emailSubject={emailSubject} amount={debit} note={note} />,
				}

				const resend = new Resend(process.env.RESEND_API_KEY)
				// @ts-ignore
				const { error } = await resend.batch.send([payload])
				if (error) return json({ status: 'error', error } as const, { status: 500 })
				await prisma.transactions.update({ data: { emailed: true }, where: { id: transactionId } })
			}
			return null
		case 'email-all': {
			const transactions = await prisma.transactions.findMany({
				select: {
					id: true,
					user: { select: { primaryEmail: true, emailSubject: true } },
					debit: true,
					note: true,
				},
				where: {
					scheduleId,
					debit: { not: 0 },
					emailed: false,
				},
			})
			const batchEmails = transactions
				.map(({ user, debit, note }) => {
					if (user && debit && note) {
						const { primaryEmail, emailSubject } = user
						return {
							from: 'clearwat@clearwaterfarmsunit1.com',
							to: primaryEmail,
							subject: `Clearwater Farms Unit 1 - Credit Issued`,
							react: <ScheduleCreditEmail date={date} emailSubject={emailSubject ?? ''} amount={debit} note={note} />,
						}
					} else return false
				})
				.filter(Boolean)

			const resend = new Resend(process.env.RESEND_API_KEY)
			// @ts-ignore
			const { error } = await resend.batch.send(batchEmails)
			if (error) return json({ status: 'error', error } as const, { status: 500 })

			transactions.forEach(
				async ({ id }) => await prisma.transactions.update({ data: { emailed: true }, where: { id } }),
			)
			return null
		}
		default:
			return json({ status: 'error', error: 'Invalid intent' } as const, { status: 400 })
	}
}

export default function ViewTransactions() {
	const { schedule, transactions, creditsTotal, quickbooksMap, newUserOptions } = useLoaderData<TransactionData>()
	const USDollar = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

	const [newUser, setNewUser] = useState({} as UserType)
	const [addNew, setAddNew] = useState(false)
	const [transaction, setTransaction] = useState({} as Transaction)

	const handleQuickbooksSelect = (quickbooks: string) => {
		const selectedUser = quickbooksMap[quickbooks] ?? {}
		setNewUser(selectedUser)
	}
	const handleTransactionValueChanged = (field: string, value: string) =>
		setTransaction({ ...transaction, [field]: value })
	const saveNewDisabled = newUser.id && transaction.debit && transaction.note ? false : true
	const handleSaveNew = () => {
		const submission = {
			intent: 'create-transaction',
			userId: newUser.id,
			scheduleId: schedule.id,
			date: schedule.date,
			debit: transaction.debit,
			note: transaction.note,
		}
		fetcher.submit(submission, { method: 'POST' })
		setNewUser({} as UserType)
		setTransaction({} as Transaction)
		setAddNew(false)
	}

	const fetcher = useFetcher()
	const handleChange = (changes: ChangesType) => fetcher.submit(changes, { method: 'POST' })

	return (
		<Card className="m-auto mt-2 flex w-full flex-col items-center justify-center gap-1 rounded-none bg-accent px-0 pb-4">
			<CardHeader className="flex w-full flex-col flex-wrap items-center gap-2 self-center p-4">
				<CardTitle className="text-h2">Irrigation Credits for {schedule.date}</CardTitle>
				<CardDescription className="flex w-full justify-between pr-8">
					<div className="w-36"></div>
					<div className="text-xl">Credits Total: {USDollar.format(creditsTotal)}</div>
					<Button className="w-32" variant="secondary" onClick={() => setAddNew(!addNew)}>
						New Credit
					</Button>
				</CardDescription>
			</CardHeader>
			<CardContent className="w-full space-y-2">
				{addNew ? (
					<fetcher.Form method="POST" key="create-transaction">
						<div className="grid grid-cols-12 gap-1">
							<div className="col-span-1 px-3 text-lg">Display</div>
							<div className="col-span-2 px-3 text-lg">Quickbooks</div>
							<div className="col-span-2 px-3 text-lg">Primary Email</div>
							<div className="col-span-1 px-3 text-right text-lg">Amount</div>
							<div className="col-span-5 px-3 text-lg">Note</div>
						</div>
						<div key="row-create" className="grid grid-cols-12 gap-1 disabled:cursor-default">
							<button type="submit" className="hidden" />
							<input type="hidden" name="scheduleId" value={schedule.id} />
							<input type="hidden" name="date" value={schedule.date} />
							<input type="hidden" name="userId" value={newUser.id} />
							<Input
								id="display"
								className="col-span-1 disabled:cursor-default"
								disabled={true}
								defaultValue={newUser.display}
							/>
							<div key="quickbooks" className="col-span-2">
								<QuickbooksCombobox
									options={newUserOptions}
									value={newUser.quickbooks?.toLowerCase() ?? ''}
									setValue={handleQuickbooksSelect}
								/>
							</div>
							<Input
								id="primaryEmail"
								className="col-span-2 disabled:cursor-default"
								disabled={true}
								defaultValue={newUser.primaryEmail}
							/>
							<Input
								id="debit"
								className="col-span-1 text-right"
								value={transaction.debit ?? 0}
								onChange={e => handleTransactionValueChanged('debit', e.currentTarget.value)}
							/>
							<Input
								id="note"
								className="col-span-5 mr-1"
								value={transaction.note ?? ''}
								onChange={e => handleTransactionValueChanged('note', e.currentTarget.value)}
							/>
							<div className="col-span-1 flex flex-row gap-1">
								<StatusButton
									className="bg-blue-700"
									type="submit"
									name="intent"
									value="create-transaction"
									variant="outline"
									onClick={handleSaveNew}
									disabled={saveNewDisabled}
									status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
								>
									<Icon name="save" className="h-4 w-4" />
								</StatusButton>
							</div>
						</div>
						<Separator />
					</fetcher.Form>
				) : null}
				<div className="grid grid-cols-12 gap-1">
					<div className="col-span-1 px-3 text-lg">Display</div>
					<div className="col-span-2 px-3 text-lg">Quickbooks</div>
					<div className="col-span-2 px-3 text-lg">Primary Email</div>
					<div className="col-span-1 px-3 text-right text-lg">Amount</div>
					<div className="col-span-5 px-3 text-lg">Note</div>
					<div className="col-span-1 pl-[52px]">
						<EmailButton all={true} />
					</div>
				</div>
				{transactions && transactions.length ? (
					transactions.map(
						({ id: transactionId, user: { display, quickbooks, primaryEmail }, debit, note, emailed }: Transaction) => (
							<div key={`row-${transactionId}`} className="grid grid-cols-12 gap-1 disabled:cursor-default">
								<Input id="display" className="col-span-1 disabled:cursor-default" disabled={true} value={display} />
								<Input
									id="quickbooks"
									className="col-span-2 disabled:cursor-default"
									disabled={true}
									value={quickbooks}
								/>
								<Input
									id="primaryEmail"
									className="col-span-2 disabled:cursor-default"
									disabled={true}
									value={primaryEmail}
								/>
								<Input
									id="debit"
									className="col-span-1 text-right disabled:cursor-default"
									defaultValue={USDollar.format(debit) ?? ''}
									onBlur={e => handleChange({ id: transactionId, intent: 'debit', debit: e.currentTarget.value })}
								/>
								<Input
									id="note"
									className="col-span-5 mr-1"
									defaultValue={note ?? ''}
									onBlur={e => handleChange({ id: transactionId, intent: 'note', note: e.currentTarget.value })}
								/>
								<div className="col-span-1 flex flex-row gap-1">
									<DeleteButton transactionId={transactionId} />
									<EmailButton transactionId={transactionId} emailed={emailed} />
								</div>
							</div>
						),
					)
				) : (
					<div className="flex w-full justify-center py-4">
						<h4 className="font-medium tracking-wider text-gray-600">No results found</h4>
					</div>
				)}
			</CardContent>
		</Card>
	)
}

function DeleteButton({ transactionId }: { transactionId: string }) {
	const fetcher = useFetcher<typeof action>()
	const dc = useDoubleCheck()
	return (
		<fetcher.Form method="POST" key={`delete-${transactionId}`}>
			<input type="hidden" name="id" value={transactionId} />
			<StatusButton
				{...dc.getButtonProps({
					type: 'submit',
					name: 'intent',
					value: 'delete-transaction',
				})}
				className={`${dc.doubleCheck ? 'text-destructive' : 'text-primary'}`}
				variant={dc.doubleCheck ? 'default' : 'destructive'}
				status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
			>
				<Icon name="trash" className="h-4 w-4" />
			</StatusButton>
		</fetcher.Form>
	)
}

function EmailButton({ transactionId, emailed, all }: { transactionId?: string; emailed?: boolean; all?: boolean }) {
	const submit = useSubmit()
	const intent = `email-${all ? 'all' : 'transaction'}`
	const handleSendEmailClicked = () => {
		if (transactionId) submit({ intent, transactionId }, { method: 'POST' })
		else submit({ intent }, { method: 'POST' })
	}
	return (
		<div key={`email-${all ? 'all' : transactionId}`}>
			{emailed ? (
				<Button variant="outline" className="border-1 border-secondary-foreground bg-green-700 hover:bg-green-700">
					<Icon name="envelope-open" className="h-4 w-4" />
				</Button>
			) : (
				<HoldToConfirmButton
					variant="outline"
					className="border-1 border-secondary-foreground"
					onSubmit={handleSendEmailClicked}
				>
					<Icon name="envelope-closed" className="h-4 w-4" />
				</HoldToConfirmButton>
			)}
		</div>
	)
}
