import { Menu, Transition } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { Fragment } from 'react'

interface DropdownProps<T> {
	items: T[]
	itemKey: string
	buttonClass?: string
	buttonChild: JSX.Element | string
	dropdownClass?: string
	defaultItem?: (active: boolean) => JSX.Element
	generateItem: (active: boolean, item: T) => JSX.Element
	defaultBottom?: boolean
	isRight?: boolean
	isTop?: boolean
}

const Dropdown = <T,>({
	itemKey,
	items,
	defaultItem,
	defaultBottom,
	generateItem,
	buttonClass,
	buttonChild,
	isRight,
	isTop,
	dropdownClass,
}: DropdownProps<T>) => (
	<Menu as="div" className="relative inline-block text-left">
		<Menu.Button className="m-4 inline-flex h-10 items-center justify-center text-nowrap rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground outline-none ring-ring ring-offset-2 ring-offset-background transition-colors focus-within:ring-2 hover:bg-secondary/80 focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50">
			{buttonChild}
			<ChevronDownIcon className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
		</Menu.Button>

		<Transition
			as={Fragment}
			enter="transition ease-out duration-100"
			enterFrom="transform opacity-0 scale-95"
			enterTo="transform opacity-100 scale-100"
			leave="transition ease-in duration-75"
			leaveFrom="transform opacity-100 scale-100"
			leaveTo="transform opacity-0 scale-95"
		>
			<Menu.Items
				className={clsx(
					isRight ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
					isTop ? 'bottom-[100%]' : '',
					'absolute z-10 mt-2 w-56 rounded-md bg-secondary shadow-lg focus:outline-none',
					dropdownClass,
				)}
			>
				<div className="py-1">
					{defaultItem && !defaultBottom && <Menu.Item>{({ active }) => defaultItem(active)}</Menu.Item>}
					{items.map((item, index) => (
						<Menu.Item key={`${itemKey}-${index}`}>{({ active }) => generateItem(active, item)}</Menu.Item>
					))}
					{defaultItem && !!defaultBottom && <Menu.Item>{({ active }) => defaultItem(active)}</Menu.Item>}
				</div>
			</Menu.Items>
		</Transition>
	</Menu>
)

export default Dropdown
