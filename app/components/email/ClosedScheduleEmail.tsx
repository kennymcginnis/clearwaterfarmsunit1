import * as E from '@react-email/components'

const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'localhost:3000'
export function ClosedScheduleEmail({
	scheduleId,
	date,
	schedules,
	userId,
	emailSubject,
}: {
	scheduleId: string
	date: string
	schedules: {
		portId: string
		ditch: number
		entry: string
		hours: string
		schedule: string
		first: boolean | null
		crossover: boolean | null
		last: boolean | null
	}[]
	userId: string
	emailSubject: string
}) {
	const enabled = true
	const responseUrl = (acknowledge: string, type: string, portId: string): string =>
		`${baseUrl}/api/userSchedule/${acknowledge}/${type}?userId=${userId}&scheduleId=${scheduleId}&portId=${portId}`

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
								We recently closed the irrigation schedule that starts on {date}.
							</E.Heading>
							<E.Text style={{ fontSize: 18 }}>Here is your upcoming watering schedule:</E.Text>
							{schedules.map(({ portId, ditch, entry, hours, schedule, first, crossover, last }) => (
								<>
									<E.Text key={ditch} style={{ fontSize: 20, marginTop: -5 }}>
										<b>
											Ditch {ditch}:&nbsp;({hours}):&nbsp;
										</b>
										{schedule}
									</E.Text>

									{/* First Irrigator */}
									{enabled && first && (
										<E.Section style={{ borderTop: '#f8fafc solid' }}>
											<E.Heading as="h2" style={{ fontSize: 26, fontWeight: 'bold' }}>
												***Please note:
											</E.Heading>
											<E.Heading as="h3" style={{ fontSize: 18, fontWeight: 'bold' }}>
												Responsibilities as the First Irrigator on Ditch {ditch}:
											</E.Heading>
											<E.Text style={{ fontSize: 16 }}>
												As the first irrigator on your ditch, you are responsible for making the gate change for your
												ditch.
											</E.Text>

											<E.Heading as="h3" style={{ fontSize: 18, fontWeight: 'bold' }}>
												Timing:
											</E.Heading>
											<E.Text style={{ fontSize: 16 }}>
												This gate change should be done 15–20 minutes before your scheduled start time.
											</E.Text>

											<E.Heading as="h3" style={{ fontSize: 18, fontWeight: 'bold' }}>
												Water Credit:
											</E.Heading>
											<E.Text style={{ fontSize: 16 }}>
												As a first irrigator, you will receive a 30-minute water credit to your irrigation account.
											</E.Text>

											<E.Heading as="h3" style={{ fontSize: 18, fontWeight: 'bold' }}>
												Assistance:
											</E.Heading>
											<E.Text style={{ fontSize: 16 }}>
												If you are unable or unwilling to complete this gate change, volunteers are available to assist
												you.
											</E.Text>
											<E.Text style={{ fontSize: 16 }}>
												First-time irrigators are encouraged to reach out for help to ensure proper setup and operation.
												support@clearwaterfarmsunit1.com | (623) 703-6126
											</E.Text>
											<E.Text style={{ fontSize: 16 }}>
												<E.Link href={responseUrl('acknowledge', 'first', portId)}>
													Click here to confirm that you will complete the gate change.
												</E.Link>
											</E.Text>
											<E.Text style={{ fontSize: 16 }}>
												<E.Link href={responseUrl('assistance', 'first', portId)}>
													Click here to request assistance.
												</E.Link>
											</E.Text>

											<E.Heading as="h3" style={{ fontSize: 18, fontWeight: 'bold' }}>
												Reference Video:
											</E.Heading>
											<E.Text style={{ fontSize: 16 }}>
												For detailed instructions, please refer to the video uploaded on our Facebook group:{' '}
												<E.Link href="https://www.facebook.com/1803766961/videos/497550569428361/">
													Gate Change Instruction Video.
												</E.Link>
											</E.Text>
										</E.Section>
									)}

									{/* Crossover */}
									{enabled && crossover && (
										<E.Section style={{ borderTop: '#f8fafc solid' }}>
											<E.Heading as="h3" style={{ fontSize: 18, fontWeight: 'bold' }}>
												Crossover:
											</E.Heading>
											<E.Text style={{ fontSize: 16 }}>
												You are the first irrigator
												{ditch === 9
													? entry === '10-01'
														? ' east of 185th '
														: ' east of 181st '
													: ' south of the Orangewood crossover '}
												on Ditch {ditch}. You will be responsible to ensure that the crossover (under the street) is
												cleared of debris that would obstruct water flow.
											</E.Text>

											<E.Heading as="h3" style={{ fontSize: 18, fontWeight: 'bold' }}>
												Water Credit:
											</E.Heading>
											<E.Text style={{ fontSize: 16 }}>
												For clearing the crossover, you will receive a 15-minute water credit to your irrigation
												account.
											</E.Text>

											<E.Heading as="h3" style={{ fontSize: 18, fontWeight: 'bold' }}>
												Assistance:
											</E.Heading>
											<E.Text style={{ fontSize: 16 }}>
												If you are unable or unwilling to complete this gate change, volunteers are available to assist
												you.
											</E.Text>
											<E.Text style={{ fontSize: 16 }}>
												<E.Link href={responseUrl('acknowledge', 'crossover', portId)}>
													Click here to confirm that you will clear the crossover of debris.
												</E.Link>
											</E.Text>
											<E.Text style={{ fontSize: 16 }}>
												<E.Link href={responseUrl('assistance', 'crossover', portId)}>
													Click here to request assistance.
												</E.Link>
											</E.Text>
										</E.Section>
									)}

									{/* Last Irrigator */}
									{last && (
										<E.Section style={{ borderTop: '#f8fafc solid' }}>
											<E.Heading as="h3" style={{ fontSize: 18, fontWeight: 'bold' }}>
												Last Irrigator:
											</E.Heading>
											<E.Text style={{ fontSize: 16 }}>
												You are the last irrigator on Ditch {ditch}. Please do not pull your checks at the end of your
												scheduled run.
											</E.Text>
										</E.Section>
									)}
								</>
							))}
						</E.Column>
					</E.Row>
				</E.Section>
			</E.Container>
		</E.Html>
	)
}
