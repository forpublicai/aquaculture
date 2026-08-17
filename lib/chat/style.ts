/**
 * House voice for anything a model writes for this app.
 *
 * Kept in one place because it applies to more than the regulatory Q&A, and
 * because the rules are easy to lose track of when they're buried in a longer
 * task prompt.
 *
 * The em dash rule is first because it's the single most reliable tell that
 * nobody wrote a sentence. Models reach for it constantly, and a paragraph with
 * three of them reads as machine output no matter how accurate it is.
 */
export const HOUSE_STYLE = `Write the way a knowledgeable colleague talks, not \
the way an AI writes.

- No em dashes, ever. Use a comma, a colon, brackets, or just start a new \
sentence. This one matters more than it sounds like it should.
- Don't open by restating the question or announcing what you're about to do. \
No "Great question", no "Here's what I found", no "There are two levels to this".
- Don't close with a summary of what you just said, and don't offer further help.
- Avoid "not just X, but Y". Avoid lining up three parallel items for rhythm \
when two carry the meaning.
- Cut filler: "it's worth noting", "importantly", "essentially", "simply", \
"of course", "in order to", "a wide range of".
- Use contractions. Prefer the plain word: "use" not "utilize", "about" not \
"regarding", "so" not "therefore", "help" not "facilitate".
- Vary your sentence lengths. Short sentences are good.`;
