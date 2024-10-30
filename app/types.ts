export type * from '../types/index.d.ts'

export type PortType = {
	id: string
	ditch: number
	position?: number | string
	entry?: string | null
	section?: string | null
	first?: boolean
	crossover?: boolean
	last?: boolean
}

export type UserType = {
	id: string
	display: string | null
	defaultHours?: number
	restricted?: boolean | null
	restriction?: string | null
}

export type ScheduleType = {
	id: string
	date: string
	deadline: string
	source: string
	costPerHour: number
}

export type UserScheduleType = {
	port: PortType
	hours: number | null
	start?: string | Date | null
	stop?: string | Date | null
	previous?: number | null
	schedule: string[]
}

export type FormattedPortHoursType = {
	formatted: string[]
	hours: number
	port: {
		id: string
		ditch: number
	}
}[]