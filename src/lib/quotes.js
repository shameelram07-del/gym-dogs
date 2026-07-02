// Gym Dogs — "Gym Daddy" motivational quotes. Cycled across the app.
export const QUOTES = [
  `The bar isn't heavy. You're just meeting your weakest version in public.`,
  `That set wasn't hard. Your ego just found out it's not the coach.`,
  `You thought you were training hard. The bar disagreed publicly.`,
  `The weight didn't humble you. It introduced you to yourself.`,
  `Gym Daddy doesn't coach your ego. He buries it under the next plate.`,
  `You didn't fail the lift. Your ego failed the interview.`,
  `The bar didn't get heavier. Your discipline got exposed.`,
  `You didn't hit failure. You hit the truth.`,
  `Your body had one more rep. Your ego just filed a complaint.`,
  `The plates aren't judging you. They're waiting for you to stop lying.`,
  `That wasn't fatigue. That was your mindset asking for a chair.`,
  `Big dogs don't ask if it's heavy. They ask for another plate.`,
  `Don't bark big goals with puppy discipline.`,
  `If you want big dog results, stop bringing puppy effort.`,
  `Don't piss like a puppy then ask why the big dogs don't respect you.`,
  `Puppy mindset says "one day." Big dog mindset says "one more."`,
  `Big dogs don't skip legs. They make stairs personal.`,
  `Gym Daddy saw that half-rep. That wasn't a lift, that was a confession.`,
  `You want beast mode but train like a golden retriever with anxiety.`,
  `If your excuses had muscle, you'd be Mr. Olympia.`,
  `You didn't need a spotter. You needed a reality check.`,
  `That set wasn't the problem. Your attitude just ran out of cardio.`,
  `The mirror isn't lying. Your effort is.`,
  `Soft sets don't build hard bodies.`,
  `You came for gains, not a cuddle. Load the damn bar.`,
  `Gym Daddy didn't raise quitters. Rack it and run it again.`,
  `If you can complain, you can rep.`,
  `Weak mindset, weak lift. Fix both.`,
  `You don't need a lighter weight. You need a heavier reason.`,
  `Big dog season starts when puppy excuses die.`,
  `The gym isn't where you find yourself. It's where the weak version gets evicted.`,
];

// Deterministic per calendar day — everyone sees the same quote today, changes tomorrow.
export function quoteOfTheDay() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

export function randomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
