// One rule for "which plan is this", shared by Home and Train. They used to
// read the workoutPlans response differently: Home accepted a list or a single
// plan, Train only a single plan, so the same data could show PUSH DAY on Home
// and "No session (undefined · Invalid Date)" on Train.

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Normalise a workoutPlans response (list, single plan, or nothing) to one plan or null. */
export function pickPlan(data, now = new Date()) {
  if (!data) return null;
  const plan = Array.isArray(data) ? data[0] : data;
  if (!plan || typeof plan !== 'object') return null;
  const chosen = plan.schedule?.[DAY_NAMES[now.getDay()]] || plan.sessions?.[0] || plan;
  return chosen && Array.isArray(chosen.exercises) ? chosen : null;
}
