import { useForm } from '@conform-to/react'
import { Form } from '@remix-run/react'
import { Check, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import * as React from 'react'
import { Button } from '#app/components/ui/button'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '#app/components/ui/command'
import { Icon } from '#app/components/ui/icon.tsx'
import { Popover, PopoverContent, PopoverTrigger } from '#app/components/ui/popover'
import { cn } from '#app/utils/misc.tsx'

export const CrossoversAdminPanel = ({
	users,
	crossoverId,
	userId,
}: {
	crossoverId: string
	users: { id: string; quickbooks: string }[]
	userId: string | null
}) => {
	const [open, setOpen] = React.useState(false)
	const [volunteerId, setVolunteerId] = React.useState('')

	const [form] = useForm({ id: `crossoverId=${crossoverId}` })

	const userMap = new Map(users.map(user => [user.id, user.quickbooks]))
	const quickbooksMap = new Map(users.map(user => [user.quickbooks.toLowerCase(), user.id]))

	const handleSelect = (currentValue: string) => {
		quickbooksMap.get(currentValue) && setVolunteerId(quickbooksMap.get(currentValue) ?? '')
		setOpen(false)
	}

	return (
		<div id="admin-controls" className="flex flex-row items-center justify-end">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button variant="outline" role="combobox" aria-expanded={open} className="w-80 justify-between">
						{userMap.get(volunteerId) ?? ''}
						<ChevronsUpDown className="opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-80 p-0">
					<Command
						filter={(value, search) => {
							if (value.includes(search)) return 1
							return 0
						}}
					>
						<CommandInput placeholder="Search users..." className="h-9" />
						<CommandList>
							<CommandEmpty>No user found.</CommandEmpty>
							{users.map(user => (
								<CommandItem key={user.quickbooks} value={user.quickbooks} onSelect={handleSelect}>
									{user.quickbooks}
									<Check className={cn('ml-auto', volunteerId === user.id ? 'opacity-100' : 'opacity-0')} />
								</CommandItem>
							))}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
			<Form method="POST" {...form.props}>
				<input type="hidden" name="crossoverId" value={crossoverId} />
				<input type="hidden" name="volunteerId" value={volunteerId} />
				<Button
					type="submit"
					name="intent"
					value="volunteer"
					variant="outline"
					disabled={!volunteerId}
					className="ml-1 border-2 border-blue-700 text-primary shadow-sm shadow-gray-700"
				>
					<Icon name="exclamation-triangle" className={`h-6 w-6 text-blue-700`} aria-hidden="true" />
				</Button>

				<Button
					type="submit"
					name="intent"
					value="acknowledge"
					variant="outline"
					disabled={!userId}
					className="ml-1 border-2 border-green-700 text-primary shadow-sm shadow-gray-700"
				>
					<Icon name="check-circled" className={`h-6 w-6 text-green-700`} aria-hidden="true" />
				</Button>
				<Button
					type="submit"
					name="intent"
					value="assistance"
					variant="outline"
					disabled={!userId}
					className="ml-1 border-2 border-red-700 text-primary shadow-sm shadow-gray-700"
				>
					<Icon name="cross-circled" className={`h-6 w-6 text-red-700`} aria-hidden="true" />
				</Button>
			</Form>
		</div>
	)
}

export const CrossoverSortingButtons = ({
	crossoverId,
	scheduleId,
	order,
	start,
}: {
	crossoverId: string
	scheduleId?: string
	order?: number
	start?: number
}) => {
	const [form] = useForm({ id: `crossoverId=${crossoverId}` })
	return (
		<Form method="POST" {...form.props}>
			<input type="hidden" name="scheduleId" value={scheduleId} />
			<input type="hidden" name="crossoverId" value={crossoverId} />
			<input type="hidden" name="order" value={order} />
			<input type="hidden" name="start" value={start} />
			{/* <div className="w-full pr-2 text-center">{order}</div> */}
			<Button
				type="submit"
				name="intent"
				value="decrement"
				variant="outline"
				disabled={order === 1}
				className="ml-1 rounded-b-none border-2 text-primary shadow-sm shadow-gray-700"
			>
				<ChevronUp />
			</Button>
			<Button
				type="submit"
				name="intent"
				value="increment"
				variant="outline"
				disabled={order === 10}
				className="ml-1 rounded-t-none border-2 text-primary shadow-sm shadow-gray-700"
			>
				<ChevronDown />
			</Button>
		</Form>
	)
}
