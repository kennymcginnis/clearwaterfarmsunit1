import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons'
import * as React from 'react'
import { Button } from '#app/components/ui/button'
import { Command, CommandGroup, CommandItem } from '#app/components/ui/command'
import { Label } from '#app/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '#app/components/ui/popover'
import { cn } from '#app/utils/misc.tsx'

const options = [
	{
		value: '70',
		label: '70-inch head',
	},
	{
		value: '140',
		label: '140-inch head',
	},
]

export function HeadCombobox({ value, setValue }: { value: string; setValue: Function }) {
	const [open, setOpen] = React.useState(false)

	return (
		<>
			<Label htmlFor="head" children="Head" />
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button variant="outline" role="combobox" aria-expanded={open} className="w-[250px] justify-between">
						{value ? options.find(framework => framework.value === value)?.label : 'Select head size...'}
						<CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[250px] p-0">
					<Command>
						<CommandGroup>
							{options.map(framework => (
								<CommandItem
									key={framework.value}
									value={framework.value}
									onSelect={(currentValue: string) => {
										setValue(currentValue === value ? '70' : currentValue)
										setOpen(false)
									}}
								>
									{framework.label}
									<CheckIcon
										className={cn('ml-auto h-4 w-4', value === framework.value ? 'opacity-100' : 'opacity-0')}
									/>
								</CommandItem>
							))}
						</CommandGroup>
					</Command>
				</PopoverContent>
			</Popover>
		</>
	)
}
