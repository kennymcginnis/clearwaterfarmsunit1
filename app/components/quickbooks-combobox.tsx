import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons'
import * as React from 'react'
import { Button } from '#app/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '#app/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '#app/components/ui/popover'
import { cn } from '#app/utils/misc.tsx'

type OptionType = {
	value: string
	label: string
}

export function QuickbooksCombobox({
	options,
	value,
	setValue,
}: {
	options: OptionType[]
	value: string
	setValue: Function
}) {
	const [open, setOpen] = React.useState(false)

	function handleSelect(currentValue: string) {
		setValue(currentValue === value ? null : currentValue)
		setOpen(false)
	}
	const [inputValue, setInputValue] = React.useState('')

	const handleValueChange = (value: string) => {
		setInputValue(value)
		setOpen(!!value)
	}

	const filteredCommands = Array.isArray(options)
		? options.filter(command => command.label.toLowerCase().includes(inputValue.toLowerCase()))
		: []

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
					{value ? options.find(framework => framework.value === value)?.label : 'Select member...'}
					<CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-full p-0">
				<Command>
					<CommandInput placeholder="Search member..." onValueChange={handleValueChange} />
					<CommandList>
						<CommandEmpty>No member found.</CommandEmpty>
						<CommandGroup>
							{open &&
								filteredCommands.length > 0 &&
								filteredCommands.map(command => (
									<CommandItem className="w-full" key={command.value} value={command.value} onSelect={handleSelect}>
										{command.label}
										<CheckIcon
											className={cn('ml-auto h-4 w-4', value === command.value ? 'opacity-100' : 'opacity-0')}
										/>
									</CommandItem>
								))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
