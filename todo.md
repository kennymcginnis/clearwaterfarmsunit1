# // TODO

- What is the goal of this website?
  - CityProperty will manage all financials
    - They only have one account per member with the POA dues
  - We're handling all Irrigation
    - We are tracking irrigation balances and fees

## Application

- [ ] `Technical debit` Upgrade application to use `Vite` instead of `ESBuild`

## Home page

- [x] Add contact information for `water master`
- [x] Make the `home page` a landing page?
  - [x] Add `agenda` or `Highlights` on home page on the bottom half of the home page
- [x] Link from CFPOA website to City Property's portal (button on home screen)
- [x] Currently shows `No Closed schedules found!` when the schedules doesn't have start/stop dates.
- [x] Disable edits for a restricted user
- [x] Add single homepage showing most recent schedule and signup for any open schedule
  - [x] Show current irrigation balance
  - [x] Add [default] and [previous] buttons to speed up signup
  - [x] Add indication of whether I'm currently signed up or not
- [x] Make responsive enough for mobile, tablet, laptop, desktop usage
- [x] Update Icon to point to home page

## Footer page

- [x] Links
- [x] Contact
  - [x] Add `social` links (or remove icons)
    - [x] Facebook
    - [x] Nextdoor

## Document pages

- [x] rename `trade list` to `Trades & Resources`
- [ ] Button to take you back to the top of the page
- [x] Credits should not be negative
- [ ] Add Rules and Regulations
  - [ ] Rules and Regulations page added, content still missing.
- [x] Add pdf download link so documents can be shared
  - [x] Add this to the Markdown:
    - [Open AofInc.pdf](/pdf/AofInc.pdf)
    - [Open Bylaws.pdf](/pdf/Bylaws.pdf)
    - [Open CCR.pdf](/pdf/CCR.pdf)
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

- [x] Hide members list for users not logged in
- [x] Can change Username name
  - [x] Irrigation `display` name is export on downloads
- [x] Make responsive enough for mobile, tablet, laptop, desktop usage
- [x] Add filter to search for members
- [x] replace member name with username
- [x] Add horizontal scrollbar at the top of the list so I don't have to scroll to the bottom
- [x] Hide member list from non-admins
- [x] Empty columns in filtered tables still have headers

## Irrigation pages

### Admin page

- [ ] "Are you sure?" button for those wanting 140" head of water instead of the default 70"
- [x] If `head` is 140, don't allow half hour intervals
- [ ] Create resource routes to post directly to database
  - [x] Get user/`username`
  - [x] Put user/`username`/roles
  - [x] Put user/`username`/restricted
  - [x] Get schedule/`date`
  - [x] Put `schedule`
  - [x] Get `sessions`
  - [x] Get `transactions`
  - [ ] Delete `transactions`
  - [ ] Update `transactions`  
- [x] Can `close` a locked schedule once timelines have been finalized
  - [x] Closing a schedule will update the min start and max stop dates on the schedule
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
- [x] `Removed` Delayed irrigation schedule when it rains.
  - Prefer to not do that so we can calculate the schedule, roll it out, and order water and be a second pair of eyes prior to publishing.

### Irrigation Information

- [ ] Emails notifications for upcoming schedules
- [ ] Irrigation tips sheet for new irrigators or people who need a reference.
  - [ ] Irrigation tips sheet page added, content still missing.
- [ ] Text message notifications

### Sign-up page

- [ ] Admin user can edit any member
- [x] Source: well - capitalize "Well" /grin
- [x] Members cannot submit hours after schedule is `locked`
- [x] Component width is setup to 100% and looks a bit odd
- [x] Admin user can lock/close from this screen
- [x] Admin user can view /timeline screen even once `locked`
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

- [x] Shortcut button to jump directly to yourself for a logged in user
  - [x] Button exists, but display page does not
- [x] Timeline upload did nothing
- [x] Timeline upload is incorrectly centered
- [x] Filterable by search box
- [x] Make responsive enough for mobile, tablet, laptop, desktop usage
- [x] Report to show timeline for irrigation.
- [x] Uploadable sheet for an Admin to schedule timelines
- [x] Total hours by ditch
- [x] Button to Show/hide members who have not signed up

## Profile pages

- [x] Make theme switch more obvious for a non-tech user
- [x] Record of who has signed in.  This way we can find out why others haven't utilized our CFPOA website to sign up for irrigation.
- [x] Make responsive enough for mobile, tablet, laptop, desktop usage
- [x] Theme switch so I can use Dark Mode! /grin

### Trade List

- [ ] See if I can add a search box
- [ ] A `hyperlink` to request to be added to the trade list

### Contact information

- [x] Hide this page for members unless viewing self
- [ ] Email domain needs to be configured and confirmed.
- [x] Add phone numbers array into edit section
- [ ] Q: Should we mark one phone number as `primary`?
  - [ ] `Attempted` was surprisingly harder than I expected - unless we add it to the edit form and require submit
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

- [x] Move `USER ACCOUNT RESTRICTED` to Irrigation page - currently it's on `Property`
- [ ] Viewing a `pending` schedule for a user with more than one ditch, shows an error twice
- [x] Add a max-width to the Irrigation history components
- [x] Cannot edit if currently restricted
  - [x] Display reason for restriction
  - [x] Allow an Admin user to edit
- [ ] Add default hours and head for irrigation
  - [x] `Moved` This is currently under property info due to spacing, may make more sense under the irrigation tab
  - [ ] Allow Editing default hours and head for a logged in user
- [ ] Simple button to restrict people from irrigating
- [ ] `Restricted`: A text box for the administrator providing the reason why they're restricted.
- [x] Irrigation tab is becoming unhighlighted after clicking schedule
- [x] Add page for Irrigation information
- [x] Displays the history of all scheduled irrigation cycles
- [x] Can edit if schedule is still open

### Transactions information

- [ ] Create a report formatted for QuickBooks upload
  - [ ] Get the QB format from Katy
- [ ] Add `insert new` transaction
- [x] Add ditch and position columns
  - [x] Add schedule date columns?
- [x] Make columns sortable
- [x] Add `items per page`
- [x] Add filter
  - [x] by date
  - [x] by ditch
  - [x] by schedule date
- [x] Add download
- [ ] Allow an Admin user to edit
- [x] Add page for Transactions information
- [x] Shows the initial starting balance in the irrigation account
- [x] Shows all deposits and withdrawls from balance
- [x] Shows current irrigation balance
