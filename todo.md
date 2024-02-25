# // TODO

## Home page

- [ ] Link from CFPOA website to City Property's portal (button on home screen)
- [x] Make responsive enough for mobile, tablet, laptop, desktop usage
- [x] Update Icon to point to home page
- [ ] Add single homepage showing most recent schedule and signup for any open schedule
  - [ ] Show current irrigation balance
  - [x] Add [default] and [previous] buttons to speed up signup
  - [x] Add indication of whether I'm currently signed up or not

## Document pages

- [ ] Add Rules and Regulations
  - [ ] Rules and Regulations page added, content still missing.
- [x] Make responsive enough for mobile, tablet, laptop, desktop usage
- [x] User Markdown for formatting
- [x] Allow Admin users to Edit markdown
- [x] Add a Table of Contents to documents
- [x] Add seperate link for Announcements after repuropsing home page
- [x] Add Articles of Incorporation
- [x] Add CC&R's
- [x] Add Bylaws
- [x] Add a Trade List for members to market their businesses
- [x] `Removed` Add Meetings Agenda and Notes
  - [x] `Removed` Add P&L information
  - [x] `Removed` Add Balance sheet
- [x] Add Contact Sheet
  - [x] Add Board Member's Email addresses - editable via markdown

## Members pages

- [x] Make responsive enough for mobile, tablet, laptop, desktop usage
- [x] Add filter to search for members
- [x] replace member name with username
- [x] Add horizontal scrollbar at the top of the list so I don't have to scroll to the bottom 
- [x] Hide member list from non-admins
- [x] Empty columns in filtered tables still have headers

## Irrigation pages

### Admin page

- [ ] Create resource routes to post directly to database
- [ ] Can `close` a locked schedule once timelines have been finalized
  - [ ] Closing a schedule will update the min start and max stop dates on the schedule
  - [x] Closing a schedule will automatically calculate the irrigation account withdrawls based on hours*costPerHour
- [x] One more scheduling state - pending -> open -> `locked` -> closed
- [x] Can create new schedules with start date, deadline, water source, and cost per hour
- [x] Add dropdown to normalize the source choice - `surface` vs `well` water
- [x] Add date input validations
- [x] Can edit a schedule it if is not already closed.
- [x] Can only `open` a pending schedule if no others are currently open.
  - [x] `Removed` Allowing people to sign up for irrigation in advance - Has been a nightmare in the past.
- [x] Can `lock` an open schedule so that members cannot signup after a given hour - currently Mon 7pm
- [x] Audit: Can always see who edited what and when
- [x] `Removed` Delayed irrigation schedule when it rains. - Prefer to not do that so we can calculate the schedule, roll it out, and order water and be a second pair of eyes prior to publishing.

### Irrigation Information

- [ ] Irrigation tips sheet for new irrigators or people who need a reference.
  - [ ] Irrigation tips sheet page added, content still missing.

### Sign-up page

- [ ] Admin user can edit any member
  - [ ] Q: Admin user can edit only while `open`?
- [x] Ditches seem to be stacking incorrently when showing only signed up members
- [x] Make responsive enough for mobile, tablet, laptop, desktop usage
- [x] Forced to choose between 70 and 140, setting the default to 70 head.
- [x] Report to show who signed up for irrigation.
- [x] Uploadable sheet for an Admin to signup those who did so on paper
- [x] Totals by ditch
- [x] Filterable by search box
- [x] Button to Show/hide members who have not signed up
- [x] Shortcut button to jump directly to yourself for a logged in user
- [x] Only editable while schedule is `open`

### Timeline page

- [ ] Timeline upload did nothing
- [ ] Shortcut button to jump directly to yourself for a logged in user
  - [ ] Button exists, but display page does not
- [x] Timeline upload is incorrectly centered
- [x] Filterable by search box
- [x] Make responsive enough for mobile, tablet, laptop, desktop usage
- [x] Report to show timeline for irrigation.
- [x] Uploadable sheet for an Admin to schedule timelines
- [x] Total hours by ditch
- [x] Button to Show/hide members who have not signed up

## Profile pages

- [ ] Q: Can you change your username?
- [ ] Q: Should we log in with user or email?
- [ ] Record of who has signed in.  This way we can find out why others haven't utilized our CFPOA website to sign up for irrigation.
- [x] Make responsive enough for mobile, tablet, laptop, desktop usage
- [x] Theme switch so I can use Dark Mode! /grin

### Contact information

- [ ] Hide this page for members unless viewing self
- [ ] Add phone numbers array into edit section
- [ ] Q: Should we mark one phone number as `primary`?
  - [ ] `Attempted` was surprisingly harder than I expected - unless we add it to the edit form and require submit
- [ ] Email domain needs to be configured and confirmed.
- [ ] Allow an Admin user to edit
- [x] Add page for Profile information
- [x] Allow Editing of Self for a logged in user
- [x] Email validations

### Property information

- [ ] Allow an Admin user to edit
- [x] Add page for Property information
- [x] Display all addresses for a member
- [x] Display all parcels and lots for a member
- [x] Include a list of all ditches and ditch positions for irrigation

### Irrigation information  

- [x] Irrigation tab is becoming unhighlighted after clicking schedule
- [ ] Cannot edit if currently restricted
  - [ ] Display reason for restriction
- [ ] Allow an Admin user to edit
- [ ] Add default hours and head for irrigation
  - [ ] This is currently under property info due to spacing, may make more sense under the irrigation tab
  - [ ] Allow Editing default hours and head for a logged in user
- [ ] Simple button to restrict people from irrigating
  - [ ] Restricted: A text box for the administrator providing the reason why they're restricted.
- [x] Add page for Irrigation information
- [x] Displays the history of all scheduled irrigation cycles
- [x] Can edit if schedule is still open

### Transactions information

- [ ] Allow an Admin user to edit
- [x] Add page for Transactions information
- [x] Shows the initial starting balance in the irrigation account
- [x] Shows all deposits and withdrawls from balance
- [x] Shows current irrigation balance
