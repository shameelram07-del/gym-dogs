// Equipment categories used across the app (coach builder filters, labels).
export const equipmentTypes = ['Plate Loaded', 'Cable', 'Pin Loaded', 'Free Weight', 'Bodyweight', 'Cardio'];

export const exerciseLibrary = {
  CHEST: [
    { name: 'Plate-Loaded Incline Chest Press', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Set the seat so the handles sit at upper-chest height. Keep your back flat against the pad. Drive up and in, squeeze at the top. Control the return — do not let the plates slam down.' },
    { name: 'Plate-Loaded Seated Chest Press', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Adjust the seat so the handles are at mid-chest. Retract your shoulder blades. Press forward smoothly and squeeze the chest. Control the negative all the way back.' },
    { name: 'Plate-Loaded Decline Chest Press', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Handles at lower-chest height. Drive forward and slightly down, squeeze at the top. Keep wrists neutral and the movement controlled.' },
    { name: 'Incline Dumbbell Press', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Keep elbows at 45 degrees. Control the descent — 3 seconds down. Drive up and squeeze at the top. Keep lower back pressed to the bench.' },
    { name: 'Flat Dumbbell Press', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Retract shoulder blades into the bench. Lower slowly, feel the stretch. Drive up explosively and squeeze chest at the top.' },
    { name: 'Decline Dumbbell Press', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Keep core tight. Lower dumbbells to lower chest. Drive up and squeeze hard at the top.' },
    { name: 'Hammer Strength Chest Press', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Keep back flat against pad. Drive through your chest not shoulders. Control the return.' },
    { name: 'Hammer Strength Incline Press', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Set seat height so handles are at upper chest. Drive up and in. Squeeze at the top.' },
    { name: 'Cable Fly (Low to High)', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Start with cables at the bottom. Sweep arms up and together like hugging a tree. Squeeze chest hard at the top.' },
    { name: 'Cable Fly (High to Low)', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Start with cables high. Pull down and together. Keep slight bend in elbows throughout. Squeeze at the bottom.' },
    { name: 'Cable Crossover', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Keep slight bend in elbows. Bring hands together in front of chest. Squeeze hard. Control the return.' },
    { name: 'Dumbbell Pullover', equipment: 'Free Weight', defaultSets: 3, defaultReps: '12-15', cue: 'Keep slight bend in elbows. Lower weight behind head until you feel lat stretch. Pull back over chest. Keep hips down.' },
    { name: 'Dips (Weighted)', equipment: 'Bodyweight', defaultSets: 3, defaultReps: '8-10', cue: 'Lean forward slightly to target chest. Lower until upper arms parallel to floor. Drive up without locking elbows.' },
  ],

  BACK: [
    { name: 'Plate-Loaded High Row', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Chest against the pad. Drive your elbows down and back. Squeeze the lats at the bottom. Control the stretch on the return — do not let the plates yank you forward.' },
    { name: 'Plate-Loaded Lat Pulldown', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Secure your thighs under the pad. Pull the handles down to your collarbone, elbows driving down. Squeeze the lats, then control the stretch back up.' },
    { name: 'Plate-Loaded Seated Row', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Chest on the pad, back flat. Row the handles to your torso and squeeze your shoulder blades together. Slow return — feel the stretch.' },
    { name: 'Plate-Loaded Low Row', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Brace your chest on the pad. Pull low and into your stomach. Squeeze the mid-back. Keep it smooth — no jerking with the lower back.' },
    { name: 'Hammer Strength Lat Pulldown', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Pull elbows down and back. Squeeze lats at the bottom. Control the return — feel the stretch at the top.' },
    { name: 'Hammer Strength Row', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Drive elbows back. Squeeze shoulder blades together at the end. Keep chest against pad.' },
    { name: 'Cable Lat Pulldown', equipment: 'Cable', defaultSets: 3, defaultReps: '10-12', cue: 'Secure thighs under the pad. Pull the bar to your collarbone, driving elbows down. Squeeze lats, control the stretch back up. No leaning back to cheat.' },
    { name: 'Cable Seated Row', equipment: 'Cable', defaultSets: 3, defaultReps: '10-12', cue: 'Pull to your belly button. Squeeze shoulder blades together. Control the return and feel the stretch.' },
    { name: 'Cable Straight Arm Pulldown', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Keep arms straight. Pull bar down to hips using your lats. Squeeze at the bottom. Slow return.' },
    { name: 'Cable Single Arm Row', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Pull elbow back and up. Rotate slightly at the top to squeeze the lat. Control the return.' },
    { name: 'Dumbbell Single Arm Row', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Brace on bench. Pull elbow straight back. Squeeze lat at the top. Keep hips square.' },
    { name: 'Dumbbell Shrug', equipment: 'Free Weight', defaultSets: 3, defaultReps: '15-20', cue: 'Hold dumbbells at sides. Shrug straight up — no rolling. Squeeze traps at the top. Slow return.' },
    { name: 'Face Pull (Cable)', equipment: 'Cable', defaultSets: 3, defaultReps: '15-20', cue: 'Set cable at face height. Pull rope to face, hands going past ears. Squeeze rear delts. Keep elbows high.' },
    { name: 'Rear Delt Fly (Dumbbell)', equipment: 'Free Weight', defaultSets: 3, defaultReps: '15-20', cue: 'Hinge forward at hips. Raise dumbbells out to sides with slight bend in elbows. Squeeze rear delts at the top.' },
  ],

  SHOULDERS: [
    { name: 'Plate-Loaded Shoulder Press', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Set the seat so the handles are at shoulder height. Brace your core, press straight up without slamming the lockout. Control the descent to ear level.' },
    { name: 'Dumbbell Overhead Press', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Press straight up. Keep core tight. Lower to ear level. Do not flare elbows too wide. Control the descent.' },
    { name: 'Dumbbell Lateral Raise', equipment: 'Free Weight', defaultSets: 3, defaultReps: '15-20', cue: 'Lead with elbows. Raise to shoulder height only. Slight forward tilt. Control the return slowly.' },
    { name: 'Cable Lateral Raise', equipment: 'Cable', defaultSets: 3, defaultReps: '15-20', cue: 'Lead with elbow not wrist. Stop at shoulder height. Stand tall — no leaning. Control the return.' },
    { name: 'Cable Front Raise', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Keep slight bend in elbow. Raise to shoulder height. Control the return. No swinging.' },
    { name: 'Hammer Strength Shoulder Press', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Set seat so handles are at shoulder height. Drive straight up. Control the return. Keep back against pad.' },
    { name: 'Dumbbell Front Raise', equipment: 'Free Weight', defaultSets: 3, defaultReps: '12-15', cue: 'Alternate arms. Raise to shoulder height. Keep slight bend in elbow. Control the descent.' },
    { name: 'Rear Delt Cable Fly', equipment: 'Cable', defaultSets: 3, defaultReps: '15-20', cue: 'Cross cables. Pull apart and back. Squeeze rear delts. Keep arms at shoulder height. Control the return.' },
    { name: 'Arnold Press', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Start with palms facing you. Rotate as you press up. Full rotation at the top. Reverse on the way down.' },
  ],

  LEGS: [
    { name: 'Plate-Loaded Leg Press', equipment: 'Plate Loaded', defaultSets: 4, defaultReps: '10-12', cue: 'Feet shoulder-width on the platform. Lower under control to about 90 degrees. Drive through your heels. Never lock the knees out hard at the top.' },
    { name: 'Plate-Loaded Hack Squat', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Shoulders and back flat against the pad. Feet mid-platform. Descend slow and deep, drive through heels. Keep knees tracking over your toes.' },
    { name: 'Plate-Loaded Pendulum Squat', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Back flat on the pad, feet mid-platform. Descend deep and controlled, then drive up through your heels. Keep your core braced throughout.' },
    { name: 'Plate-Loaded Glute Drive', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '12-15', cue: 'Pad sits low across the hips. Drive your hips up and squeeze the glutes hard at the top. Lower under control — do not overextend the lower back.' },
    { name: 'Plate-Loaded Calf Raise', equipment: 'Plate Loaded', defaultSets: 4, defaultReps: '15-20', cue: 'Balls of your feet on the platform. Rise all the way up onto the toes and pause. Lower slowly for a full stretch at the bottom.' },
    { name: 'Barbell Squat', equipment: 'Free Weight', defaultSets: 4, defaultReps: '8-10', cue: 'Feet shoulder width. Bar on upper traps. Squat to parallel. Drive through heels. Keep chest up throughout.' },
    { name: 'Dumbbell Goblet Squat', equipment: 'Free Weight', defaultSets: 3, defaultReps: '12-15', cue: 'Hold dumbbell at chest. Squat deep. Keep elbows inside knees. Drive up through heels.' },
    { name: 'Hammer Strength Leg Press', equipment: 'Plate Loaded', defaultSets: 4, defaultReps: '10-12', cue: 'Feet shoulder width on platform. Lower until 90 degrees. Drive through heels. Do not lock knees at the top.' },
    { name: 'Hammer Strength Leg Curl', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '10-12', cue: 'Curl heels to glutes. Squeeze hamstrings at the top. Control the return — 3 seconds down.' },
    { name: 'Hammer Strength Leg Extension', equipment: 'Plate Loaded', defaultSets: 3, defaultReps: '12-15', cue: 'Extend fully. Squeeze quads at the top. Control the return slowly. Keep back against pad.' },
    { name: 'Dumbbell Romanian Deadlift', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Hinge at hips. Keep back flat. Lower dumbbells along legs. Feel hamstring stretch. Drive hips forward to stand.' },
    { name: 'Dumbbell Walking Lunges', equipment: 'Free Weight', defaultSets: 3, defaultReps: '12 each leg', cue: 'Long stride. Back knee to just above floor. Keep chest up. Drive through front heel to stand.' },
    { name: 'Cable Kickback', equipment: 'Cable', defaultSets: 3, defaultReps: '15 each side', cue: 'Attach ankle strap. Hinge slightly forward. Kick leg straight back. Squeeze glute at the top. Control the return.' },
    { name: 'Cable Hip Abduction', equipment: 'Cable', defaultSets: 3, defaultReps: '15-20 each side', cue: 'Ankle strap on the outside leg. Stand tall and brace your core. Sweep the leg out to the side, squeeze the glute. Control the return — no swinging.' },
    { name: 'Cable Hip Adduction', equipment: 'Cable', defaultSets: 3, defaultReps: '15-20 each side', cue: 'Ankle strap on the inside leg. Pull the leg across your body in front, squeeze the inner thigh. Control it back out slowly.' },
    { name: 'Calf Raise (Machine)', equipment: 'Pin Loaded', defaultSets: 4, defaultReps: '15-20', cue: 'Full range of motion. Rise all the way up. Lower all the way down. Pause at the bottom for a stretch.' },
    { name: 'Dumbbell Stiff Leg Deadlift', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Keep legs almost straight. Hinge at hips. Lower dumbbells to shins. Feel the hamstring stretch. Drive hips forward.' },
  ],

  BICEPS: [
    { name: 'Dumbbell Curl', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Keep elbows pinned at sides. Curl fully. Squeeze bicep at the top. Control the descent — 3 seconds down.' },
    { name: 'Dumbbell Hammer Curl', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Neutral grip — thumbs up. Keep elbows pinned. Curl to shoulder. Squeeze at the top. Slow return.' },
    { name: 'Dumbbell Incline Curl', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Sit on incline bench. Let arms hang. Curl up fully. Great for bicep stretch at the bottom.' },
    { name: 'Cable Curl (Straight Bar)', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Keep elbows pinned. Curl to chin. Squeeze at the top. Control the return — feel the stretch.' },
    { name: 'Cable Curl (Rope)', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Split the rope at the top. Curl and supinate. Squeeze hard. Control the descent.' },
    { name: 'Cable Single Arm Curl', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Keep elbow pinned. Curl fully. Squeeze at the top. Full range of motion.' },
    { name: 'Concentration Curl', equipment: 'Free Weight', defaultSets: 3, defaultReps: '12-15', cue: 'Elbow braced on inner thigh. Curl fully. Squeeze hard at the top. Slow controlled descent.' },
  ],

  TRICEPS: [
    { name: 'Cable Pushdown (Straight Bar)', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Keep elbows pinned at sides. Push down fully. Squeeze triceps at the bottom. Control the return.' },
    { name: 'Cable Pushdown (Rope)', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Split the rope at the bottom. Squeeze triceps hard. Keep elbows pinned. Control the return.' },
    { name: 'Cable Overhead Tricep Extension', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15', cue: 'Face away from cable. Keep elbows close to head. Extend fully. Control the return — feel the stretch.' },
    { name: 'Dumbbell Overhead Extension', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Keep elbows close to head. Lower behind head until stretch. Extend fully. Squeeze at the top.' },
    { name: 'Dumbbell Skull Crusher', equipment: 'Free Weight', defaultSets: 3, defaultReps: '10-12', cue: 'Lower to forehead. Keep elbows pointing up. Extend fully. Squeeze triceps at the top.' },
    { name: 'Dips (Bodyweight)', equipment: 'Bodyweight', defaultSets: 3, defaultReps: '10-15', cue: 'Keep torso upright for triceps focus. Lower until 90 degrees. Drive up without locking elbows.' },
  ],

  CORE: [
    { name: 'Cable Crunch', equipment: 'Cable', defaultSets: 3, defaultReps: '15-20', cue: 'Kneel facing cable. Pull rope to sides of head. Crunch down — lead with chest to knees. Squeeze abs at the bottom.' },
    { name: 'Cable Woodchop', equipment: 'Cable', defaultSets: 3, defaultReps: '12-15 each side', cue: 'Set cable high. Pull diagonally down across body. Rotate through core. Control the return.' },
    { name: 'Plank', equipment: 'Bodyweight', defaultSets: 3, defaultReps: '45-60 sec', cue: 'Forearms on floor. Body in straight line. Squeeze glutes and abs. Do not let hips sag or rise.' },
    { name: 'Dumbbell Side Bend', equipment: 'Free Weight', defaultSets: 3, defaultReps: '15-20 each side', cue: 'Hold dumbbell on one side. Bend to the side. Feel oblique stretch. Return upright. Do not rotate.' },
    { name: 'Hanging Knee Raise', equipment: 'Bodyweight', defaultSets: 3, defaultReps: '12-15', cue: 'Hang from bar. Raise knees to chest. Squeeze abs at the top. Lower slowly — do not swing.' },
    { name: 'Ab Wheel Rollout', equipment: 'Bodyweight', defaultSets: 3, defaultReps: '10-12', cue: 'Start on knees. Roll forward until body is extended. Keep core tight. Pull back using abs not arms.' },
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
