import * as E from '@react-email/components'

export function EmailChangeNoticeEmail({ userId }: { userId: string }) {
	return (
		<E.Html lang="en" dir="ltr">
			<E.Container>
				<h1>
					<E.Text>Your Clearwater Farms Unit 1 primary email has been changed</E.Text>
				</h1>
				<p>
					<E.Text>
						We're writing to let you know that your Clearwater Farms Unit 1 primary email has been changed.
					</E.Text>
				</p>
				<p>
					<E.Text>
						If you changed your email address, then you can safely ignore this. But if you did not change your email
						address, then please contact support immediately.
					</E.Text>
				</p>
				<p>
					<E.Text>Your Account ID: {userId}</E.Text>
				</p>
			</E.Container>
		</E.Html>
	)
}
