'use client'
import { Link } from '@remix-run/react'
import { Droplet, Droplets } from 'lucide-react'
import React from 'react'
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
	navigationMenuTriggerStyle,
} from '#app/components/ui/navigation-menu'
import { cn } from '#app/utils/misc.tsx'

const nav = {
	irrigation: [
		{
			title: 'Sign Up',
			href: '/irrigation/sign-up',
			description: 'Sign Up or modify schedule',
		},
		{
			title: 'Schedule',
			href: '/irrigation/schedule',
			description: 'View the current schedule',
		},
	],
	documents: [
		{
			title: 'Articles of Incorporation',
			href: '/documents/articles-of-incorporation',
			description:
				'Articles of Incorporation of Clearwater Farms Unit #1 Property Owners Association',
		},
		{
			title: "CC&R's",
			href: '/documents/cc-and-r-s',
			description:
				'Clearwater Farms | Declaration of Conditions, Covenants and Restrictions',
		},
		{
			title: 'Bylaws',
			href: '/documents/by-laws',
			description: 'By-Laws of Clearwater Farms Property Owners Association',
		},
	],
	other: [
		{
			title: 'Meetings',
			href: '/meetings',
		},
		{
			title: 'Trade List',
			href: '/trade-list',
		},
		{
			title: 'Contact Us',
			href: '/contact-us',
		},
	],
}

export function MainNavigationMenu() {
	return (
		<NavigationMenu>
			<NavigationMenuList>
				<NavigationMenuItem>
					<Link to="/announcements">
						<NavigationMenuLink className={navigationMenuTriggerStyle()}>
							Home
						</NavigationMenuLink>
					</Link>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<NavigationMenuTrigger>Irrigation</NavigationMenuTrigger>
					<NavigationMenuContent>
						<ul className="grid gap-3 p-4 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
							<li className="row-span-3">
								<NavigationMenuLink asChild>
									<Link to="/users">
										<div className="flex h-full w-full select-none flex-col items-center justify-center rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md">
											<div className="flex flex-row">
												<Droplet className="h-8 w-8" aria-hidden="true" />
												<Droplets className="h-8 w-8" aria-hidden="true" />
											</div>
											<div className="mb-2 mt-4 text-lg font-medium">
												Schedule for:
											</div>
											<p className="text-sm leading-tight text-muted-foreground">
												Jan 11th to Jan 15th
											</p>
										</div>
									</Link>
								</NavigationMenuLink>
							</li>

							{nav.irrigation.map(link => (
								<ListItem key={link.href} title={link.title} href={link.href}>
									<div className="mb-2 mt-4 text-sm font-medium">
										{link.description}
									</div>
								</ListItem>
							))}
						</ul>
					</NavigationMenuContent>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<NavigationMenuTrigger>POA Documents</NavigationMenuTrigger>
					<NavigationMenuContent>
						<ul className="grid w-[400px] gap-3 p-4">
							{nav.documents.map(doc => (
								<ListItem key={doc.title} title={doc.title} href={doc.href}>
									{doc.description}
								</ListItem>
							))}
						</ul>
					</NavigationMenuContent>
				</NavigationMenuItem>

				{nav.other.map(link => (
					<NavigationMenuItem key={link.href}>
						<Link to={link.href}>
							<NavigationMenuLink className={navigationMenuTriggerStyle()}>
								{link.title}
							</NavigationMenuLink>
						</Link>
					</NavigationMenuItem>
				))}
			</NavigationMenuList>
		</NavigationMenu>
	)
}

const ListItem = React.forwardRef<
	React.ElementRef<'a'>,
	React.ComponentPropsWithoutRef<'a'>
>(({ className, title, children, ...props }, ref) => {
	return (
		<li>
			<NavigationMenuLink asChild>
				<a
					ref={ref}
					className={cn(
						'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
						className,
					)}
					{...props}
				>
					<div className="text-lg font-medium leading-none">{title}</div>
					<p className="text-l line-clamp-2 leading-snug text-muted-foreground">
						{children}
					</p>
				</a>
			</NavigationMenuLink>
		</li>
	)
})
ListItem.displayName = 'ListItem'
