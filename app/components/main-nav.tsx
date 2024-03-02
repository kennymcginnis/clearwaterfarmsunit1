import { Link } from '@remix-run/react'
import { useOptionalAdminUser } from '#app/utils/user'
import { Icon, ToolTipIcon } from './ui/icon'
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
	NavigationSubMenuItem,
	navigationMenuTriggerStyle,
} from './ui/navigation-menu'

const iconStyle = 'mr-1 mt-0.5 w-5 h-5 md:max-2xl:hidden max-md:w-6 max-md:h-6'

export function MainNavigationMenu({
	open,
	closed,
}: {
	open: { date: string } | null
	closed: { date: string } | null
}) {
	return (
		<NavigationMenu>
			<NavigationMenuList>
				<NavigationMenuItem>
					<Link to="/">
						<NavigationMenuLink className={navigationMenuTriggerStyle()}>
							<ToolTipIcon className={iconStyle} name="home" tooltip="Home" aria-hidden="true" />
							<p className="max-md:hidden">Home</p>
						</NavigationMenuLink>
					</Link>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<Link to="/announcements">
						<NavigationMenuLink className={navigationMenuTriggerStyle()}>
							<ToolTipIcon
								className={iconStyle}
								name="exclamation-triangle"
								tooltip="Announcements"
								aria-hidden="true"
							/>
							<p className="max-md:hidden">Announcements</p>
						</NavigationMenuLink>
					</Link>
				</NavigationMenuItem>
				<IrrigationNavigationMenu open={open} closed={closed} />
				<DocumentsNavigationMenu />
				<NavigationMenuItem>
					<Link to="/members">
						<NavigationMenuLink className={navigationMenuTriggerStyle()}>
							<ToolTipIcon className={iconStyle} name="person" tooltip="Members" aria-hidden="true" />
							<p className="max-md:hidden">Members</p>
						</NavigationMenuLink>
					</Link>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<Link to="/trade-list">
						<NavigationMenuLink className={navigationMenuTriggerStyle()}>
							<ToolTipIcon className={iconStyle} name="id-card" tooltip="Trade List" aria-hidden="true" />
							<p className="text-ellipsis text-nowrap max-md:hidden">Trade List</p>
						</NavigationMenuLink>
					</Link>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<Link to="/contact-us">
						<NavigationMenuLink className={navigationMenuTriggerStyle()}>
							<ToolTipIcon className={iconStyle} name="envelope-closed" tooltip="Contact Us" aria-hidden="true" />
							<p className="text-ellipsis text-nowrap max-md:hidden">Contact Us</p>
						</NavigationMenuLink>
					</Link>
				</NavigationMenuItem>
			</NavigationMenuList>
		</NavigationMenu>
	)
}

export function DocumentsNavigationMenu() {
	const documents = [
		{
			title: 'Articles of Incorporation',
			href: '/documents/articles-of-incorporation',
			description: 'Articles of Incorporation of Clearwater Farms Unit #1 Property Owners Association',
		},
		{
			title: "CC&R's",
			href: '/documents/cc-and-r-s',
			description: 'Clearwater Farms | Declaration of Conditions, Covenants and Restrictions',
		},
		{
			title: 'Bylaws',
			href: '/documents/by-laws',
			description: 'By-Laws of Clearwater Farms Property Owners Association',
		},
		{
			title: 'Rules and Regulations',
			href: '/documents/rules-and-regulations',
			description: 'Rules and Regulations of Clearwater Farms Property Owners Association',
		},
	]
	return (
		<NavigationMenu>
			<NavigationMenuList>
				<NavigationMenuItem>
					<NavigationMenuTrigger>
						<Icon className={iconStyle} name="file-text" aria-hidden="true" />
						<p className="max-md:hidden">Documents</p>
					</NavigationMenuTrigger>
					<NavigationMenuContent>
						<ul className="grid w-[300px] gap-3 p-4 md:w-[400px]">
							{documents.map(doc => (
								<NavigationSubMenuItem key={doc.title} title={doc.title} href={doc.href}>
									{doc.description}
								</NavigationSubMenuItem>
							))}
						</ul>
					</NavigationMenuContent>
				</NavigationMenuItem>
			</NavigationMenuList>
		</NavigationMenu>
	)
}

export function IrrigationNavigationMenu({
	open,
	closed,
}: {
	open: { date: string } | null
	closed: { date: string } | null
}) {
	const userIsAdmin = useOptionalAdminUser()
	return (
		<NavigationMenu>
			<NavigationMenuList>
				<NavigationMenuItem>
					<NavigationMenuTrigger>
						<Icon className={iconStyle} name="droplets" aria-hidden="true" />
						<p className="max-md:hidden">Irrigation</p>
					</NavigationMenuTrigger>
					<NavigationMenuContent className="hover:z-10">
						<ul className="grid w-[300px] grid-cols-1 gap-3 p-4 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
							<li className="row-span-3">
								<NavigationMenuLink asChild>
									<Link to="/schedules" className={userIsAdmin ? '' : 'pointer-events-none'}>
										<div className="z-1 flex h-full w-full select-none flex-col items-center justify-center rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md">
											<div className="flex flex-row">
												<Icon name="droplet" className="h-8 w-8" aria-hidden="true" />
												<Icon name="droplets" className="h-8 w-8" aria-hidden="true" />
											</div>
											<div className="mb-2 mt-4 text-lg font-medium">Irrigation</div>
											<p className="text-sm leading-tight text-muted-foreground">Schedules</p>
										</div>
									</Link>
								</NavigationMenuLink>
							</li>
							<Link to="/irrigation-information">
								<NavigationSubMenuItem key="irrigation-information" title="Irrigation Info">
									<div className="mb-2 mt-4 text-sm font-medium">Basic Irrigation Information</div>
								</NavigationSubMenuItem>
							</Link>
							<Link to={`/schedule/${open?.date}/signup`} className={open ? '' : 'pointer-events-none'}>
								<NavigationSubMenuItem key="signup" title="Sign Up">
									<div className="mb-2 mt-4 text-sm font-medium">
										Sign Up or modify schedule {open ? `for ${open.date}` : ''}
									</div>
								</NavigationSubMenuItem>
							</Link>
							<Link to={`/schedule/${closed?.date}/timeline`} className={closed ? '' : 'pointer-events-none'}>
								<NavigationSubMenuItem key="schedule" title="Timeline">
									<div className="mb-2 mt-4 text-sm font-medium">
										View the current schedule {closed ? `for ${closed.date}` : ''}
									</div>
								</NavigationSubMenuItem>
							</Link>
						</ul>
					</NavigationMenuContent>
				</NavigationMenuItem>
			</NavigationMenuList>
		</NavigationMenu>
	)
}
