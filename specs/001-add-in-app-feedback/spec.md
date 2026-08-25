# Feature Specification: Add In-App Feedback

**Feature Branch**: `feat/in-app-feedback`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Add an authenticated in-app feedback flow to Cadence."

## Clarifications

### Session 2026-08-25

- Q: Should Cadence intentionally cap each feedback message at 5,000 characters for the initial release? → A: Keep a 5,000-character product limit.
- Q: When may Cadence show a submission-success message to the user? → A: When the trusted administrative delivery channel has accepted the feedback for delivery; final inbox delivery, reading, or human acknowledgement is not required.
- Q: May Cadence process a minimal authenticated user identifier solely to prevent abusive feedback submissions, while excluding it from the feedback payload unless follow-up contact is enabled? → A: Yes; it must be purpose-limited, excluded from the feedback payload, never used for analytics or tracking, and retained no longer than necessary, with any persistence documented during planning.
- Q: What measurable MVP acceptance criterion should replace the moderated usability-study requirement? → A: In acceptance testing, the complete feedback flow can be completed in under two minutes without leaving Cadence; no formal moderated usability study is required.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Submit a bug report (Priority: P1)

An authenticated Cadence user can open feedback from the protected application, choose
"Bug or problem", describe the problem, what happened, and what they expected, then
send the report without leaving Cadence.

**Why this priority**: It gives users a contextual route to report product failures
while details are still fresh.

**Independent Test**: With an authenticated session, open feedback from a protected
page, submit a valid bug report, and confirm that the user sees an unambiguous
submission-success message and that the trusted administrative channel receives it.

**Acceptance Scenarios**:

1. **Given** an authenticated user is viewing any protected Cadence page, **When**
   they choose the feedback entry point, **Then** they can open the shared feedback
   interface without leaving the application.
2. **Given** the feedback interface is open, **When** the user selects "Bug or
   problem", **Then** the form prompts them to explain what happened and what they
   expected to happen.
3. **Given** a bug report has a selected category and a non-empty message, **When**
   it is submitted successfully, **Then** the report reaches the trusted
   administrative channel and the user receives a clear success message.

---

### User Story 2 - Submit an improvement suggestion (Priority: P1)

An authenticated Cadence user can classify feedback as an improvement suggestion and
describe what they would like changed or improved.

**Why this priority**: Suggestions are the other stated feedback purpose and use the
same small, coherent flow as bug reports.

**Independent Test**: With an authenticated session, select "Improvement suggestion",
provide a message, submit it, and verify success feedback and delivery to the trusted
administrative channel.

**Acceptance Scenarios**:

1. **Given** the feedback interface is open, **When** the user selects "Improvement
   suggestion", **Then** the form prompts them to explain what they would like
   improved.
2. **Given** a suggestion has a selected category and a non-empty message, **When**
   it is submitted successfully, **Then** it is delivered and the user sees a clear
   confirmation without receiving any further in-app notification.

---

### User Story 3 - Control contact and contextual data (Priority: P1)

An authenticated user can submit feedback without their identity or contact details
being attached, and can explicitly opt in to share their authenticated email address
solely for a follow-up response.

**Why this priority**: The flow must be useful to administrators while preserving
Cadence's privacy-by-default and data-minimization commitments.

**Independent Test**: Submit once without opting in and once with explicit follow-up
consent; verify that only the opted-in report includes the authenticated email address,
and that both reports exclude prohibited automatic context.

**Acceptance Scenarios**:

1. **Given** the user has not explicitly allowed follow-up contact, **When** they
   submit feedback, **Then** no user identity or contact information is attached.
2. **Given** the user explicitly allows follow-up contact, **When** they submit
   feedback, **Then** only their authenticated email address may be included and only
   to respond to that feedback.
3. **Given** feedback is submitted from a protected page, **When** safe context is
   attached, **Then** it may contain the current application pathname only, never a
   full URL or query parameters.

---

### User Story 4 - Receive a safe failure outcome (Priority: P2)

An authenticated user is told clearly when feedback cannot be submitted and can retain
or re-enter their message to try again, without exposure of internal operational
details.

**Why this priority**: Clear failure feedback avoids a false impression that a report
was received and keeps an ordinary recoverable failure from blocking feedback.

**Independent Test**: Cause a delivery failure or an abuse-control rejection and
confirm that the user sees a plain-language failure message, is not told that the
report was sent, and can act on the stated next step where retry is allowed.

**Acceptance Scenarios**:

1. **Given** feedback cannot be accepted or delivered, **When** the user submits the
   form, **Then** they receive a clear failure message that does not expose sensitive
   system details or falsely claim success.
2. **Given** a normal user submits several valid reports within the permitted usage
   level, **When** each is submitted, **Then** the flow remains available; excessive
   repeated submissions are safely limited with an understandable message.

### Edge Cases

- An unauthenticated visitor who tries to reach the feedback flow cannot open it or
  submit feedback.
- The submit control remains unavailable until the user chooses a category and enters
  a meaningful, non-whitespace message; a message longer than 5,000 characters is
  rejected with a clear, safe validation message.
- A failed, timed-out, or interrupted submission never produces a success state unless
  the trusted administrative delivery channel has accepted the feedback for delivery;
  final inbox delivery, reading, and human acknowledgement are not required.
- Repeated submission attempts, including rapid retries, are controlled to prevent
  obvious abuse without blocking normal use.
- If the current pathname cannot be determined safely, the report is still eligible
  for submission without pathname context.
- If an opted-in email address is unavailable, the report is submitted without it and
  the user is not represented as contactable.
- Messages are user-supplied free text and may contain sensitive information despite
  the warning; the product must not add further automatic sensitive context or expose
  the message in product logs or error details.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST make one shared feedback interface reachable from every
  protected area of Cadence and MUST restrict access and submission to authenticated
  users.
- **FR-002**: The interface MUST require the user to choose exactly one feedback type:
  bug/problem or improvement suggestion.
- **FR-003**: The interface MUST require a free-text feedback message and reject
  empty, whitespace-only, or messages longer than 5,000 characters before accepting
  submission. The 5,000-character limit is an intentional initial-release product
  requirement.
- **FR-004**: When bug/problem is selected, the interface MUST guide the user to
  describe both the observed result and the expected result.
- **FR-005**: When improvement suggestion is selected, the interface MUST guide the
  user to describe the desired improvement.
- **FR-006**: Before submission, the interface MUST visibly warn users not to include
  passwords, banking information, credentials, or other sensitive information.
- **FR-007**: The system MUST deliver accepted feedback to a trusted administrative
  channel while keeping the user inside Cadence.
- **FR-008**: Each accepted report MUST contain only the selected feedback type and
  user-entered message, plus the current application pathname when it is safely
  available and useful for triage.
- **FR-009**: The system MUST NOT automatically collect or attach full URLs, query
  parameters, financial data, page state, cookies, request bodies, console or network
  logs, credentials, tokens, IP addresses, geolocation, unrelated user or workspace
  data, or other telemetry.
- **FR-010**: The system MUST NOT attach user identity or contact information by
  default. It MAY attach the authenticated email address only after a separate,
  explicit, unselected-by-default follow-up-contact choice and only for replying to
  that report.
- **FR-011**: The system MUST show a clear success outcome only after the feedback is
  accepted for delivery by the trusted administrative delivery channel. Final inbox
  delivery, reading, or human acknowledgement MUST NOT be required for that success
  outcome; the system MUST show a clear, safe failure outcome when channel acceptance
  is not confirmed.
- **FR-012**: The system MUST prevent obvious abusive or automated repeated
  submissions while allowing normal feedback usage. A minimal authenticated user
  identifier MAY be processed solely for that purpose but MUST NOT be attached to the
  feedback payload, used for analytics or tracking, or retained longer than necessary.
  Any persistence and retention treatment MUST be documented during planning.
  Rejection messaging MUST not reveal controls that would make evasion easier.
- **FR-013**: The initial release MUST NOT offer screenshots or attachments, public
  submission, voting, comments, feedback status tracking, an in-app administrative
  dashboard, AI classification, automatic telemetry capture, or user notifications
  beyond the immediate success/failure result.
- **FR-014**: Feedback content and any optional email address MUST NOT be recorded in
  Cadence application logs or ordinary diagnostic records.
- **FR-015**: Before release, the chosen trusted administrative channel and its
  handling of feedback data MUST have documented retention, access, deletion, and
  portability treatment consistent with Cadence's Constitution and durable
  privacy/security contracts. This requirement does not require persistence in the
  Cadence database.

### Key Entities

- **Feedback submission**: A single user-initiated report consisting of a selected
  type, free-text message, and optional safe pathname context.
- **Follow-up permission**: The user's explicit, report-specific choice that permits
  the authenticated email address to be included solely for a response.
- **Trusted administrative channel**: The restricted recipient destination that
  receives accepted feedback and whose lifecycle handling must be documented before
  release.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In acceptance testing, authenticated users can complete the feedback
  flow—open it, select a type, enter a valid message, and submit it successfully—in
  under two minutes without leaving Cadence. No formal moderated usability study is
  required for this MVP.
- **SC-002**: In acceptance testing, 100% of successfully submitted reports arrive at
  the trusted administrative channel with the selected type and message, and with no
  prohibited automatically collected context.
- **SC-003**: In acceptance testing, 100% of reports submitted without follow-up
  permission omit identity and contact information; 100% submitted with permission
  include no contact information other than the authenticated email address.
- **SC-004**: In acceptance testing, 100% of failed or rejected submissions present a
  clear non-success outcome and reveal no user-provided content or internal delivery
  details in ordinary diagnostics.
- **SC-005**: In abuse-control testing, normal feedback usage remains possible while
  repeated automated or rapid submissions are rejected or limited before they reach
  the trusted administrative channel.

## Assumptions

- Cadence's existing authenticated protected application provides an appropriate
  product entry point for the flow; the specification deliberately does not prescribe
  its presentation or component structure.
- An authenticated email address is available from the established Google sign-in
  identity for users who explicitly allow follow-up; no additional contact field is
  requested.
- The feedback flow is report-by-report and does not create a user-visible history,
  status, conversation, notification, or database record in Cadence.
- The future planning phase will select the delivery mechanism, request interface,
  abuse-control method, and trusted administrative channel, subject to the data
  minimization and lifecycle requirements above.
- Documentation and human privacy/security review of the selected external recipient
  channel are required before release because feedback messages can contain personal
  data voluntarily entered by users despite the warning.
