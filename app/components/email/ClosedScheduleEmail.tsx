import * as E from '@react-email/components'

import { format } from 'date-fns'
import { type CSSProperties } from 'react'

const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.clearwaterfarmsunit1.com'
export function ClosedScheduleEmail({
	date,
	schedules,
	user: { emailSubject, trained },
}: {
	date: string
	schedules: {
		ditch: number
		entry: string | null
		hours: string
		schedule: string
		first: boolean | null
		crossover: boolean | null
		last: boolean | null
		firstId?: string | null
		crossoverId?: string | null
	}[]
	user: { emailSubject: string; trained: boolean }
}) {
	const enabled = true
	const scheduleDate = format(date, 'eeee, MMM do')

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
								We recently closed the irrigation schedule that starts on {scheduleDate}.
							</E.Heading>
							<E.Text style={{ fontSize: 18 }}>Here is your upcoming watering schedule:</E.Text>
							{schedules.map(({ ditch, entry, hours, schedule, first, crossover, last, firstId, crossoverId }) => (
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

											{firstId && (
												<>
													<ResponseButton type="first" crossoverId={firstId} acknowledged={true} />
													{!trained && (
														<ResponseButton
															type="first"
															crossoverId={firstId}
															acknowledged={true}
															requestsTraining={true}
														/>
													)}
													<ResponseButton type="first" crossoverId={firstId} acknowledged={false} />
												</>
											)}

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

											{crossoverId && (
												<>
													<ResponseButton type="crossover" crossoverId={crossoverId} acknowledged={true} />
													{!trained && (
														<ResponseButton
															type="crossover"
															crossoverId={crossoverId}
															acknowledged={true}
															requestsTraining={true}
														/>
													)}
													<ResponseButton type="crossover" crossoverId={crossoverId} acknowledged={false} />
												</>
											)}
										</E.Section>
									)}

									{/* Last Irrigator */}
									{last && (
										<E.Section style={{ borderTop: '#f8fafc solid' }}>
											<E.Heading as="h3" style={{ fontSize: 18, fontWeight: 'bold' }}>
												Last Irrigator:
											</E.Heading>
											<E.Text style={{ fontSize: 16 }} className="text-center">
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

	function ResponseButton({
		type,
		crossoverId,
		acknowledged,
		requestsTraining,
	}: {
		type: string
		crossoverId: string
		acknowledged: boolean
		requestsTraining?: boolean
	}) {
		const responseUrl = `${baseUrl}/api/userSchedule/${acknowledged ? 'acknowledge' : 'assistance'}?crossoverId=${crossoverId}${requestsTraining ? '&requestsTraining=true' : ''}`
		const duty = type === 'first' ? 'gate change' : 'crossover'

		const { backgroundColor, buttonText, labelText } = acknowledged
			? requestsTraining
				? {
						backgroundColor: '#f3ab23', // yellow
						buttonText: 'Request Training',
						labelText: `Click here if you would like to attempt the ${duty} but need guidance or support.`,
					}
				: {
						backgroundColor: '#167c3c', // green
						buttonText: 'Acknowledge',
						labelText: `Click here to confirm that you will complete the ${duty}.`,
					}
			: {
					backgroundColor: '#af1a1a', // red
					buttonText: 'Request Help',
					labelText: `Click here if you do not wish to make the ${duty} yourself and would like a volunteer to handle it.`,
				}

		return (
			<E.Row>
				<E.Column style={buttonContainer} colSpan={1}>
					<E.Button style={{ ...button, backgroundColor }} href={responseUrl}>
						{buttonText}
					</E.Button>
				</E.Column>
				<E.Column style={textContainer} colSpan={1}>
					<E.Text style={{ fontSize: 16, margin: 0 }}>{labelText}</E.Text>
				</E.Column>
			</E.Row>
		)
	}
}

const buttonContainer = {
	width: '100px',
	padding: '8px',
}

const textContainer = {
	width: '100%',
	padding: '8px',
}

const button: CSSProperties = {
	borderRadius: 3,
	width: '120px',
	textAlign: 'center',
	color: '#FFF',
	fontWeight: 'bold',
	border: '1px solid rgb(0,0,0, 0.1)',
	cursor: 'pointer',
	padding: '12px 30px',
}
