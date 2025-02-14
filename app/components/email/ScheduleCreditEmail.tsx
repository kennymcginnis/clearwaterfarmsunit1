import { formatCurrency } from '#app/utils/misc.tsx'
import * as E from '@react-email/components'

const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.clearwaterfarmsunit1.com'
export function ScheduleCreditEmail({
	date,
	emailSubject,
	amount,
	note,
}: {
	date: string
	emailSubject: string
	amount: number
	note: string
}) {
	return (
		<E.Html lang="en" dir="ltr">
			<E.Container>
				<E.Section
					style={{
						border: '1px solid rgb(0,0,0, 0.1)',
						borderRadius: '3px',
						overflow: 'hidden',
					}}
				>
					<E.Row style={{ backgroundColor: '#020817', borderBottom: '1px solid rgb(0, 0, 0, 0.1)' }}>
						<E.Column style={{ padding: '20px 30px 15px' }}>
							<E.Heading
								style={{
									color: '#f8fafc',
									fontSize: '2.5rem',
									lineHeight: '2.5rem',
									fontWeight: 700,
								}}
							>
								Clearwater Farms&nbsp;
							</E.Heading>
							<E.Text
								style={{
									color: '#f8fafc',
									fontSize: '1.5rem',
									fontWeight: 300,
								}}
							>
								Unit 1
							</E.Text>
						</E.Column>
						<E.Column>
							<E.Img src={`${baseUrl}/favicons/android-chrome-192x192.png`} className="h-12" alt="CWF" />
						</E.Column>
					</E.Row>
					<E.Row style={{ padding: '20px', paddingBottom: '0' }}>
						<E.Column>
							<E.Heading
								style={{
									fontSize: 32,
									fontWeight: 'bold',
								}}
							>
								Hi {emailSubject},
							</E.Heading>
							<E.Heading
								as="h2"
								style={{
									fontSize: 18,
									fontWeight: 'bold',
								}}
							>
								We recently issued you a credit for the irrigation schedule dated: {date}.
							</E.Heading>
							<E.Heading as="h3" key="amount" style={{ fontSize: 18, fontWeight: 'bold', marginTop: -5 }}>
								{`You have been credited $${formatCurrency(amount)} for the following reason:`}
							</E.Heading>
							<E.CodeBlock
								key="amount"
								style={{ fontSize: 16, marginTop: -5 }}
								code={note}
								fontFamily="'CommitMono', monospace"
								language="javascript"
								lineNumbers={false}
								theme={E.darcula}
							></E.CodeBlock>
						</E.Column>
					</E.Row>
				</E.Section>
			</E.Container>
		</E.Html>
	)
}
