// Equipment categories used across the app (coach builder filters, labels).
export const equipmentTypes = ['Plate Loaded', 'Cable', 'Pin Loaded', 'Free Weight', 'Bodyweight', 'Cardio'];

// One entry per movement. Machines are named by what they DO, never by brand —
// "Hammer Strength" kit is plate-loaded, so it was the same machine listed twice.
// Each muscle group is ordered: machines, then free weights, then cables, then bodyweight.
export const exerciseLibrary = {
  CHEST: [
    { name: 'Plate-Loaded Incline Chest Press', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Set the seat so the handles sit at upper-chest height. Keep your back flat against the pad. Drive up and in, squeeze at the top. Control the return — do not let the plates slam down.' },
    { name: 'Plate-Loaded Seated Chest Press', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Adjust the seat so the handles are at mid-chest. Retract your shoulder blades. Press forward smoothly and squeeze the chest. Control the negative all the way back.' },
    { name: 'Plate-Loaded Decline Chest Press', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Handles at lower-chest height. Drive forward and slightly down, squeeze at the top. Keep wrists neutral and the movement controlled.' },
    { name: 'Barbell Bench Press', equipment: 'Free Weight', defaultSets: 4, defaultReps: '6-10', cue: 'Shoulder blades pinned back and down, feet planted. Lower to mid-chest under control, touch, then drive up. Keep the bar path slightly back over the shoulders. Use a spotter when you go heavy.' },
    { name: 'Incline Barbell Bench Press', equipment: 'Free Weight', defaultSets: 3, defaultReps: '8-10', cue: 'Bench at 30 degrees — steeper turns it into a shoulder press. Lower to the top of the chest. Drive up and slightly back. Keep the ribcage down.' },
    { name: 'Incline Dumbbell Press', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Keep elbows at 45 degrees. Control the descent — 3 seconds down. Drive up and squeeze at the top. Keep lower back pressed to the bench.' },
    { name: 'Flat Dumbbell Press', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Retract shoulder blades into the bench. Lower slowly, feel the stretch. Drive up explosively and squeeze chest at the top.' },
    { name: 'Decline Dumbbell Press', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Keep core tight. Lower dumbbells to lower chest. Drive up and squeeze hard at the top.' },
    { name: 'Dumbbell Fly', equipment: 'Free Weight', defaultSets: 3, defaultReps: '12-15', cue: 'Soft bend in the elbows and keep it there. Open wide and slow until you feel the stretch across the chest — that stretch is the whole point. Hug back up, do not press.' },
    { name: 'Cable Fly (Low to High)', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Start with cables at the bottom. Sweep arms up and together like hugging a tree. Squeeze chest hard at the top. Hits the upper chest.' },
    { name: 'Cable Fly (High to Low)', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Start with cables high. Pull down and together. Keep slight bend in elbows throughout. Squeeze at the bottom. Hits the lower chest.' },
    { name: 'Chest Dip', equipment: 'Bodyweight', defaultSets: 3, defaultReps: '8-12', cue: 'Lean your torso forward to put the work on the chest. Lower until upper arms are parallel to the floor. Drive up without locking the elbows. Add a belt once bodyweight gets easy.' },
    { name: 'Deficit Push-Up', equipment: 'Bodyweight', defaultSets: 3, defaultReps: '12-20', cue: 'Hands on two low blocks or dumbbells so your chest can drop below them. Lower slow into the stretch, pause, drive up. The extra depth is what makes it worth doing.' },
  ],

  BACK: [
    { name: 'Plate-Loaded High Row', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Chest against the pad. Drive your elbows down and back. Squeeze the lats at the bottom. Control the stretch on the return — do not let the plates yank you forward.' },
    { name: 'Plate-Loaded Lat Pulldown', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Secure your thighs under the pad. Pull the handles down to your collarbone, elbows driving down. Squeeze the lats, then control the stretch back up.' },
    { name: 'Plate-Loaded Seated Row', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Chest on the pad, back flat. Row the handles to your torso and squeeze your shoulder blades together. Slow return — feel the stretch.' },
    { name: 'Plate-Loaded Low Row', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Brace your chest on the pad. Pull low and into your stomach. Squeeze the mid-back. Keep it smooth — no jerking with the lower back.' },
    { name: 'Barbell Bent-Over Row', equipment: 'Free Weight', defaultSets: 4, defaultReps: '8-10', cue: 'Hinge to about 45 degrees, back flat, core braced. Row to the belly button, elbows past the ribs. Squeeze, then lower under control. If your back rounds, the weight is too heavy.' },
    { name: 'Deficit Pendlay Row', equipment: 'Free Weight', defaultSets: 3, defaultReps: '6-8', cue: 'Bar starts on blocks or plates so it sits higher than the floor. Torso stays parallel throughout — no rising up. Explode the bar to the lower chest, then reset it dead each rep.' },
    { name: 'Dumbbell Single Arm Row', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Brace on bench. Pull elbow straight back. Squeeze lat at the top. Keep hips square.' },
    { name: 'Dumbbell Pullover', equipment: 'Free Weight', defaultSets: 3, defaultReps: '12-15', cue: 'Keep slight bend in elbows. Lower weight behind head until you feel the lat stretch. Pull back over chest. Keep hips down.' },
    { name: 'Dumbbell Shrug', equipment: 'Free Weight', defaultSets: 3, defaultReps: '15-20', cue: 'Hold dumbbells at sides. Shrug straight up — no rolling. Squeeze traps at the top. Slow return.' },
    { name: 'Cable Lat Pulldown', equipment: 'Cable', defaultSets: 3, defaultReps: '10-12', cue: 'Secure thighs under the pad. Pull the bar to your collarbone, driving elbows down. Squeeze lats, control the stretch back up. No leaning back to cheat.' },
    { name: 'Cable Seated Row', equipment: 'Cable', defaultSets: 3, defaultReps: '10-12', cue: 'Pull to your belly button. Squeeze shoulder blades together. Control the return and feel the stretch.' },
    { name: 'Cable Lat Pull-Around', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Stand side-on to a high pulley and take the handle across your body with the far hand. Sweep it down and around to the opposite hip, arm long. Huge stretch at the top, hard squeeze at the bottom.' },
    { name: 'Cable Straight Arm Pulldown', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Keep arms straight. Pull bar down to hips using your lats. Squeeze at the bottom. Slow return.' },
    { name: 'Cable Single Arm Row', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Pull elbow back and up. Rotate slightly at the top to squeeze the lat. Control the return.' },
    { name: 'Pull-Up', equipment: 'Bodyweight', defaultSets: 3, defaultReps: '6-12', cue: 'Overhand grip just outside the shoulders. Start from a dead hang, drive the elbows down, chin over the bar. Lower all the way under control. Use a band or the assist machine until the reps are there.' },
    { name: 'Chin-Up', equipment: 'Bodyweight', defaultSets: 3, defaultReps: '6-12', cue: 'Underhand, shoulder width. Same movement as a pull-up but the biceps help, so most people get more reps. Full hang at the bottom, chest to the bar at the top.' },
  ],

  SHOULDERS: [
    { name: 'Plate-Loaded Shoulder Press', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Set the seat so the handles are at shoulder height. Brace your core, press straight up without slamming the lockout. Control the descent to ear level.' },
    { name: 'Machine Lateral Raise', equipment: 'Pin Loaded', defaultSets: 3, defaultReps: '12-20', cue: 'Pads against the outside of the upper arms, not the forearms. Lead with the elbows to shoulder height. The machine keeps you honest — no swinging, so drop the weight and do it strictly.' },
    { name: 'Dumbbell Overhead Press', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Press straight up. Keep core tight. Lower to ear level. Do not flare elbows too wide. Control the descent.' },
    { name: 'Arnold Press', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Start with palms facing you. Rotate as you press up. Full rotation at the top. Reverse on the way down.' },
    { name: 'Dumbbell Lateral Raise', equipment: 'Free Weight', defaultSets: 3, defaultReps: '15-20', cue: 'Lead with elbows. Raise to shoulder height only. Slight forward tilt. Control the return slowly.' },
    { name: 'Incline Bench Lateral Raise', equipment: 'Free Weight', defaultSets: 3, defaultReps: '12-15', cue: 'Lie side-on across an incline bench, one dumbbell in the top hand. Raise from across the body up to shoulder height. The angle loads the delt at full stretch, so it will feel heavy with very little weight.' },
    { name: 'Dumbbell Front Raise', equipment: 'Free Weight', defaultSets: 3, defaultReps: '12-15', cue: 'Alternate arms. Raise to shoulder height. Keep slight bend in elbow. Control the descent.' },
    { name: 'Rear Delt Fly (Dumbbell)', equipment: 'Free Weight', defaultSets: 3, defaultReps: '15-20', cue: 'Hinge forward at hips. Raise dumbbells out to sides with slight bend in elbows. Squeeze rear delts at the top.' },
    { name: 'Cable Lateral Raise', equipment: 'Cable', defaultSets: 3, defaultReps: '15-20', cue: 'Set the pulley at hip height and stand side-on. Lead with elbow not wrist. Stop at shoulder height. Stand tall — no leaning. Control the return.' },
    { name: 'Cable Front Raise', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Keep slight bend in elbow. Raise to shoulder height. Control the return. No swinging.' },
    { name: 'Rear Delt Fly (Cable)', equipment: 'Cable', defaultSets: 3, defaultReps: '15-20', cue: 'Cross cables. Pull apart and back. Squeeze rear delts. Keep arms at shoulder height. Control the return.' },
    { name: 'Face Pull (Cable)', equipment: 'Cable', defaultSets: 3, defaultReps: '15-20', cue: 'Set cable at face height. Pull rope to face, hands going past ears. Squeeze rear delts. Keep elbows high.' },
  ],

  LEGS: [
    { name: 'Plate-Loaded Leg Press', equipment: 'Plate Loaded', defaultSets: 4, defaultReps: '10-12', cue: 'Feet shoulder-width on the platform. Lower under control to about 90 degrees. Drive through your heels. Never lock the knees out hard at the top.' },
    { name: 'Plate-Loaded Hack Squat', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Shoulders and back flat against the pad. Feet mid-platform. Descend slow and deep, drive through heels. Keep knees tracking over your toes.' },
    { name: 'Plate-Loaded Pendulum Squat', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Back flat on the pad, feet mid-platform. Descend deep and controlled, then drive up through your heels. Keep your core braced throughout.' },
    { name: 'Belt Squat', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-15', cue: 'Load hangs from the hips, nothing on your spine — this is the one to use when your lower back is cooked. Stand tall, sit straight down, drive up through the whole foot.' },
    { name: 'Smith Machine Squat', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Walk the feet slightly forward of the bar so you can sit down rather than fold over. The fixed path lets you push closer to failure safely. Depth to parallel or below.' },
    { name: 'Plate-Loaded Leg Curl', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Curl heels to glutes. Squeeze hamstrings at the top. Control the return — 3 seconds down.' },
    { name: 'Seated Leg Curl (Machine)', equipment: 'Pin Loaded', defaultSets: 3, defaultReps: '10-15', cue: 'Hips locked in, thighs pinned under the pad. Curl down hard and squeeze, then let it come back slowly to a full stretch. Seated hits the hamstring at longer length than lying does.' },
    { name: 'Plate-Loaded Leg Extension', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '12-15', cue: 'Extend fully. Squeeze quads at the top. Control the return slowly. Keep back against pad.' },
    { name: 'Plate-Loaded Glute Drive', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '12-15', cue: 'Pad sits low across the hips. Drive your hips up and squeeze the glutes hard at the top. Lower under control — do not overextend the lower back.' },
    { name: 'Machine Hip Abduction', equipment: 'Pin Loaded', defaultSets: 3, defaultReps: '15-20', cue: 'Sit tall, slight forward lean to bias the upper glute. Push the knees apart, hold the end position for a beat, then let it close slowly. Do not bounce out of the stretch.' },
    { name: '45-Degree Back Extension', equipment: 'Bodyweight', defaultSets: 3, defaultReps: '12-15', cue: 'Pad just below the hip bones. Round down slowly, then drive up by squeezing the glutes — not by yanking with the lower back. Stop level with your body; do not arch past it.' },
    { name: 'Standing Calf Raise (Plate Loaded)', equipment: 'Plate Loaded', defaultSets: 4, defaultReps: '15-20', cue: 'Balls of your feet on the platform, legs straight. Rise all the way up onto the toes and pause. Lower slowly for a full stretch at the bottom.' },
    { name: 'Seated Calf Raise (Machine)', equipment: 'Pin Loaded', defaultSets: 4, defaultReps: '15-20', cue: 'Knees bent under the pad — this one hits the lower calf. Full range: all the way up, all the way down, pause at the bottom for the stretch.' },
    { name: 'Calf Raise on Leg Press', equipment: 'Plate Loaded', defaultSets: 4, defaultReps: '15-20', cue: 'Balls of the feet on the bottom edge of the platform, legs almost straight. Push through the toes for a full extension, then let the platform stretch you back down. Keep the safeties engaged.' },
    { name: 'Barbell Squat', equipment: 'Free Weight', defaultSets: 4, defaultReps: '8-10', cue: 'Feet shoulder width. Bar on upper traps. Squat to parallel. Drive through heels. Keep chest up throughout.' },
    { name: 'Bulgarian Split Squat', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12 each leg', cue: 'Back foot up on a bench, front foot far enough forward that the knee stays over the ankle. Drop straight down, drive up through the front heel. Brutal, and the best single thing for glutes and quads.' },
    { name: 'Dumbbell Goblet Squat', equipment: 'Free Weight', defaultSets: 3, defaultReps: '12-15', cue: 'Hold dumbbell at chest. Squat deep. Keep elbows inside knees. Drive up through heels.' },
    { name: 'Barbell Romanian Deadlift', equipment: 'Free Weight', defaultSets: 4, defaultReps: '8-10', cue: 'Bar stays close to the legs the whole way. Push the hips back with a soft knee until you feel the hamstrings load, then stand by driving the hips forward. Back flat throughout — this is a hinge, not a squat.' },
    { name: 'Dumbbell Romanian Deadlift', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Hinge at hips with a soft knee. Keep back flat. Lower dumbbells along the legs until you feel the hamstring stretch. Drive hips forward to stand.' },
    { name: 'Good Morning', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Light bar on the upper back. Soft knees, hinge forward until your torso is near parallel, back dead flat. Stand by squeezing the glutes. Start much lighter than you think.' },
    { name: 'Dumbbell Walking Lunges', equipment: 'Free Weight', defaultSets: 3, defaultReps: '12 each leg', cue: 'Long stride. Back knee to just above floor. Keep chest up. Drive through front heel to stand.' },
    { name: 'Cable Kickback', equipment: 'Cable', defaultSets: 3, defaultReps: '15 each side', cue: 'Attach ankle strap. Hinge slightly forward. Kick leg straight back. Squeeze glute at the top. Control the return.' },
    { name: 'Cable Hip Abduction', equipment: 'Cable', defaultSets: 3, defaultReps: '15-20 each side', cue: 'Ankle strap on the outside leg. Stand tall and brace your core. Sweep the leg out to the side, squeeze the glute. Control the return — no swinging.' },
    { name: 'Cable Hip Adduction', equipment: 'Cable', defaultSets: 3, defaultReps: '15-20 each side', cue: 'Ankle strap on the inside leg. Pull the leg across your body in front, squeeze the inner thigh. Control it back out slowly.' },
  ],

  BICEPS: [
    { name: 'Machine Preacher Curl', equipment: 'Pin Loaded', defaultSets: 3, defaultReps: '10-15', cue: 'Armpits into the top of the pad, chest against it. Curl up and squeeze, then lower all the way until the arms are long. The pad stops you cheating with your shoulders.' },
    { name: 'Dumbbell Preacher Curl', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Upper arm flat on the pad, one arm at a time. Curl to a hard squeeze, then take three seconds to lower to a full stretch. Do not bounce out of the bottom — that is how elbows get sore.' },
    { name: 'Dumbbell Curl', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Keep elbows pinned at sides. Curl fully. Squeeze bicep at the top. Control the descent — 3 seconds down.' },
    { name: 'Dumbbell Hammer Curl', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Neutral grip — thumbs up. Keep elbows pinned. Curl to shoulder. Squeeze at the top. Slow return.' },
    { name: 'Dumbbell Incline Curl', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Sit on incline bench. Let arms hang. Curl up fully. Great for bicep stretch at the bottom.' },
    { name: 'Concentration Curl', equipment: 'Free Weight', defaultSets: 3, defaultReps: '12-15', cue: 'Elbow braced on inner thigh. Curl fully. Squeeze hard at the top. Slow controlled descent.' },
    { name: 'Cable Curl (Straight Bar)', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Keep elbows pinned. Curl to chin. Squeeze at the top. Control the return — feel the stretch.' },
    { name: 'Cable Curl (Rope)', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Split the rope at the top. Curl and supinate. Squeeze hard. Control the descent.' },
    { name: 'Cable Single Arm Curl', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Keep elbow pinned. Curl fully. Squeeze at the top. Full range of motion.' },
  ],

  TRICEPS: [
    { name: 'EZ Bar Overhead Extension', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Seated or standing, bar behind the head. Elbows point forward and stay there. Lower until you feel a deep stretch down the back of the arm, then extend. The stretch is where the growth is.' },
    { name: 'Dumbbell Overhead Extension', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Keep elbows close to head. Lower behind head until stretch. Extend fully. Squeeze at the top.' },
    { name: 'Dumbbell Skull Crusher', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Lower to forehead. Keep elbows pointing up. Extend fully. Squeeze triceps at the top.' },
    { name: 'Cable Pushdown (Straight Bar)', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Keep elbows pinned at sides. Push down fully. Squeeze triceps at the bottom. Control the return.' },
    { name: 'Cable Pushdown (Rope)', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Split the rope at the bottom. Squeeze triceps hard. Keep elbows pinned. Control the return.' },
    { name: 'Cable Overhead Tricep Extension', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Face away from cable. Keep elbows close to head. Extend fully. Control the return — feel the stretch.' },
    { name: 'Tricep Dip', equipment: 'Bodyweight', defaultSets: 3, defaultReps: '10-15', cue: 'Keep your torso upright — that keeps the work on the triceps rather than the chest. Lower until the elbows hit 90 degrees. Drive up without locking out.' },
  ],

  CORE: [
    { name: 'Cable Crunch', equipment: 'Cable', defaultSets: 3, defaultReps: '15-20', cue: 'Kneel facing cable. Pull rope to sides of head. Crunch down — lead with chest to knees. Squeeze abs at the bottom.' },
    { name: 'Cable Woodchop', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15 each side', cue: 'Set cable high. Pull diagonally down across body. Rotate through core. Control the return.' },
    { name: 'Dumbbell Side Bend', equipment: 'Free Weight', defaultSets: 3, defaultReps: '15-20 each side', cue: 'Hold dumbbell on one side. Bend to the side. Feel oblique stretch. Return upright. Do not rotate.' },
    { name: 'Hanging Knee Raise', equipment: 'Bodyweight', defaultSets: 3, defaultReps: '12-15', cue: 'Hang from bar. Raise knees to chest. Squeeze abs at the top. Lower slowly — do not swing.' },
    { name: 'Ab Wheel Rollout', equipment: 'Bodyweight', defaultSets: 3, defaultReps: '10-12', cue: 'Start on knees. Roll forward until body is extended. Keep core tight. Pull back using abs not arms.' },
    { name: 'Plank', equipment: 'Bodyweight', defaultSets: 3, defaultReps: '45-60 sec', cue: 'Forearms on floor. Body in straight line. Squeeze glutes and abs. Do not let hips sag or rise.' },
  ],

  CARDIO: [
    { name: 'Treadmill', equipment: 'Cardio', defaultSets: 1, defaultReps: '20-30 min', cue: 'Warm up 5 min at easy pace. Maintain conversational pace for steady state or push harder for intervals.' },
    { name: 'Stationary Bike', equipment: 'Cardio', defaultSets: 1, defaultReps: '20-30 min', cue: 'Adjust seat so leg is almost fully extended at the bottom. Keep cadence steady. Low impact — great for recovery days.' },
    { name: 'Rowing Machine', equipment: 'Cardio', defaultSets: 1, defaultReps: '15-20 min', cue: 'Drive with legs first, then lean back, then pull arms. Reverse the sequence on the return. Keep back straight.' },
    { name: 'Stairmaster', equipment: 'Cardio', defaultSets: 1, defaultReps: '15-20 min', cue: 'Stand tall — do not lean on handles. Drive through whole foot. Great for glutes and cardio conditioning.' },
    { name: 'HIIT Intervals', equipment: 'Cardio', defaultSets: 1, defaultReps: '20 min', cue: '30 sec max effort, 30 sec rest. Repeat 10-15 rounds. Use treadmill, bike or rower. Push hard on work intervals.' },
  ],
};

export const muscleGroups = ['CHEST', 'BACK', 'SHOULDERS', 'LEGS', 'BICEPS', 'TRICEPS', 'CORE', 'CARDIO'];
