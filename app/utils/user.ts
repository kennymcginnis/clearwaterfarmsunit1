import { type SerializeFrom } from '@remix-run/node'
import { useRouteLoaderData } from '@remix-run/react'
import { type loader as rootLoader } from '#app/root.tsx'

interface User {
	id: string
	username: string
	display: string | null
	member: string | null
	image: {
		id: string
	} | null
	roles: {
		name: string
		permissions: {
			action: string
			entity: string
			access: string
		}[]
	}[]
}

function isUser(user: any): user is SerializeFrom<typeof rootLoader>['user'] {
	return user && typeof user === 'object' && typeof user.id === 'string'
}

export function useOptionalUser(): User | null | undefined {
	const data = useRouteLoaderData<typeof rootLoader>('root')
	if (!data || !isUser(data.user)) {
		return undefined
	}
	return data.user
}

export function useOptionalAdminUser() {	
	return useOptionalUser()?.roles.some(r => r.name === 'admin')
}

export function useUser(): User {
	const maybeUser = useOptionalUser()
	if (!maybeUser) {
		throw new Error(
			'No user found in root loader, but user is required by useUser. If user is optional, try useOptionalUser instead.',
		)
	}
	return maybeUser
}
