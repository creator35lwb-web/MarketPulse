# Feedback form

The **Feedback** button under each Telegram post, and the **Give feedback** button on the dashboard, open this Google Form. The details of the brief the reader was looking at are already filled in. Alton owns the form, and its responses go to Alton's Google Sheet.

**Status:** live since 2026-10-08.
- Short link, for posts and messages: https://forms.gle/UPscnXPE8oKkDHHx5
- Question 5 is `entry.857131096`. The buttons fill it in.
- The dashboard card appears with the Pages deploy of this change. The Telegram button switches from the dashboard to the form with the next workflow deploy.
- **W26, 2026-10-08:** the form was renamed from MarketPulse. Its title, description and questions 1 and 2 now use the wording below. Its address and question IDs did not change, so every link still works.

To replace the form, set the two values from the new form's pre-filled link, `FEEDBACK_FORM` and `FEEDBACK_DETAILS_FIELD`:
- in `src/n8n/public-links.js`
- in the `LINKS` block of `docs/app.js`

`tests/share-feedback.test.mjs` keeps the two copies equal. With both empty, the dashboard hides its feedback card and the Telegram button opens the dashboard.

## Settings

- **Responses → Collect email addresses:** *Do not collect.*
- **Responses → Limit to 1 response:** *Off.* This keeps the form free of any Google sign-in.
- **Responses → Link to Sheets:** *On*, to track feedback over time.
- **Presentation → Confirmation message:** "Thank you. We read every response."

## Title and description

**Title:** MoatPillar · Feedback

**Description:**
- Four quick questions; about a minute.
- Anonymous: please don't include your name, phone number or any account details.
- MoatPillar is information only, not financial advice, so we can't answer questions about what to buy or sell.

## Questions

1. **Linear scale, 1 to 5 (required):** "How useful is MoatPillar for your own research?"
   - Label 1: Not useful
   - Label 5: Very useful
2. **Multiple choice (required):** "How would you feel if you could no longer get MoatPillar?"
   - Very disappointed
   - Somewhat disappointed
   - Not disappointed
   - I've only just started reading it

   This is the standard product-market-fit question; keep the first three options word for word. Answers of "I've only just started reading it" are left out of the score, because they come before the reader has formed a view.
3. **Multiple choice (required):** "What is your feedback about?"
   - Something is useful
   - Something is confusing
   - A number looks wrong
   - An idea or request
   - Other
4. **Paragraph (optional):** "Tell us more (optional)"
5. **Short answer (optional, filled in automatically):** "Brief details (filled in automatically)"
   - The buttons fill this in with where the reader was and which brief it was, for example `telegram · US · 2026-10-07` or `dashboard · CN · 2026-10-07`.
   - When a reader reports that a number looks wrong, the report can be checked against the exact brief they saw.

## Getting the pre-filled link

1. In the form, open **⋮ → Get pre-filled link**.
2. Type `DETAILS` in question 5 and leave the other questions empty.
3. Click **Get link** and copy it.

The form's address and the ID of question 5 (`entry.<number>`) are read from that link. Nothing else in it is used.

## Privacy

- The form asks for no personal data and needs no sign-in.
- The only details filled in automatically are the channel (`telegram` or `dashboard`), the edition and the date.
- Links shared from the dashboard carry no tracking parameters, and the dashboard has no analytics.
