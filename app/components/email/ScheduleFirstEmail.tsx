import * as E from '@react-email/components'

const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://fly.clearwaterfarmsunit1.com/'
export function ScheduleFirstEmail({
	date,
	schedules,
	emailSubject,
}: {
	date: string
	schedules: {
		ditch: number
		hours: string
		schedule: string
	}[]
	emailSubject: string
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
									textAlign: 'center',
								}}
							>
								Hi {emailSubject},
							</E.Heading>
							<E.Heading
								as="h2"
								style={{
									fontSize: 26,
									fontWeight: 'bold',
									textAlign: 'center',
								}}
							>
								We recently closed the irrigation schedule that starts on {date}. ***Please note: As the first irrigator
								on your Ditch, you will be responsible for making the gate change for your ditch. This gate change can
								be done 15~20minutes before your scheduled start time. For reference, there is a video uploaded on our
								Facebook group: https://www.facebook.com/1803766961/videos/497550569428361/
							</E.Heading>
							<E.Text style={{ fontSize: 16 }}>Here is your upcoming watering schedule:</E.Text>
							{schedules.map(({ ditch, hours, schedule }) => (
								<E.Text key={ditch} style={{ fontSize: 16, marginTop: -5 }}>
									<b>
										Ditch {ditch}:&nbsp;({hours}):&nbsp;
									</b>
									{schedule}
								</E.Text>
							))}
						</E.Column>
					</E.Row>
				</E.Section>
			</E.Container>
		</E.Html>
	)
}
