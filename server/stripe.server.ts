import Stripe from 'stripe'

export function getDomainUrl(request: Request) {
	const host = request.headers.get('X-Forward-Host') ?? request.headers.get('host')
	if (!host) throw new Error('Could not find the url')
	const protocol = host.includes('localhost') ? 'http' : 'https'
	return `${protocol}://${host}`
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
	apiVersion: '2024-06-20',
	typescript: true,
})
