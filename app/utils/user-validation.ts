import { z } from 'zod'

export const UsernameSchema = z
	.string({ required_error: 'Username is required' })
	.min(3, { message: 'Username is too short' })
	.max(20, { message: 'Username is too long' })
	.regex(/^[a-zA-Z0-9_-]+$/, {
		message: 'Username can only include letters, numbers, an underscore, and a dash',
	})
	// users can type the username in any case, but we store it in lowercase
	.transform(value => value.toLowerCase())

export const PhoneNumberSchema = z
	.string({ required_error: 'Phone number required' })
	.regex(/^((\+1|1)?( |-)?)?(\([2-9][0-9]{2}\)|[2-9][0-9]{2})( |-)?([2-9][0-9]{2}( |-)?[0-9]{4})$/, {
		message: 'Invalid phone number',
	})
export const PhoneSchema = z.object({
	number: PhoneNumberSchema,
	type: z.string(),
})

export const DateSchema = z
	.string({ required_error: 'Date required' })
	.regex(/^\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])$/, {
		message: 'Invalid date',
	})

export const PasswordSchema = z
	.string({ required_error: 'Password is required' })
	.min(6, { message: 'Password is too short' })
	.max(100, { message: 'Password is too long' })
export const NameSchema = z
	.string({ required_error: 'Name is required' })
	.min(3, { message: 'Name is too short' })
	.max(40, { message: 'Name is too long' })
export const EmailSchema = z
	.string({ required_error: 'Email is required' })
	.email({ message: 'Email is invalid' })
	.min(3, { message: 'Email is too short' })
	.max(100, { message: 'Email is too long' })
	.transform(value => value.toLowerCase())
	
export const PasswordAndConfirmPasswordSchema = z
	.object({ password: PasswordSchema, confirmPassword: PasswordSchema })
	.superRefine(({ confirmPassword, password }, ctx) => {
		if (confirmPassword !== password) {
			ctx.addIssue({
				path: ['confirmPassword'],
				code: 'custom',
				message: 'The passwords must match',
			})
		}
	})

export const AddressSchema = z.object({
	address: z.string(),
	parcelAndLot: z
		.object({
			parcel: z.string(),
			lot: z.string(),
		})
		.array(),
})
export const PortsSchema = z.object({
	ditch: z.number(),
	position: z.number(),
	entry: z.enum(['10-01', '10-03']),
	section: z.enum(['North', 'South', 'East', 'West']),
})
export const DepositsSchema = z.object({
	amount: z.number(),
	note: z.string(),
	date: DateSchema,
})
