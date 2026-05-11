export const exerciseLibrary = {
  CHEST: [
    { name: 'Incline Dumbbell Press', defaultSets: 3, defaultReps: '10-12', cue: 'Keep elbows at 45 degrees. Control the descent — 3 seconds down. Drive up and squeeze at the top. Keep lower back pressed to the bench.' },
    { name: 'Flat Dumbbell Press', defaultSets: 3, defaultReps: '10-12', cue: 'Retract shoulder blades into the bench. Lower slowly, feel the stretch. Drive up explosively and squeeze chest at the top.' },
    { name: 'Decline Dumbbell Press', defaultSets: 3, defaultReps: '10-12', cue: 'Keep core tight. Lower dumbbells to lower chest. Drive up and squeeze hard at the top.' },
    { name: 'Hammer Strength Chest Press', defaultSets: 3, defaultReps: '10-12', cue: 'Keep back flat against pad. Drive through your chest not shoulders. Control the return.' },
    { name: 'Hammer Strength Incline Press', defaultSets: 3, defaultReps: '10-12', cue: 'Set seat height so handles are at upper chest. Drive up and in. Squeeze at the top.' },
    { name: 'Cable Fly (Low to High)', defaultSets: 3, defaultReps: '12-15', cue: 'Start with cables at the bottom. Sweep arms up and together like hugging a tree. Squeeze chest hard at the top.' },
    { name: 'Cable Fly (High to Low)', defaultSets: 3, defaultReps: '12-15', cue: 'Start with cables high. Pull down and together. Keep slight bend in elbows throughout. Squeeze at the bottom.' },
    { name: 'Cable Crossover', defaultSets: 3, defaultReps: '12-15', cue: 'Keep slight bend in elbows. Bring hands together in front of chest. Squeeze hard. Control the return.' },
    { name: 'Dumbbell Pullover', defaultSets: 3, defaultReps: '12-15', cue: 'Keep slight bend in elbows. Lower weight behind head until you feel lat stretch. Pull back over chest. Keep hips down.' },
    { name: 'Dips (Weighted)', defaultSets: 3, defaultReps: '8-10', cue: 'Lean forward slightly to target chest. Lower until upper arms parallel to floor. Drive up without locking elbows.' },
  ],

  BACK: [
    { name: 'Hammer Strength Lat Pulldown', defaultSets: 3, defaultReps: '10-12', cue: 'Pull elbows down and back. Squeeze lats at the bottom. Control the return — feel the stretch at the top.' },
    { name: 'Hammer Strength Row', defaultSets: 3, defaultReps: '10-12', cue: 'Drive elbows back. Squeeze shoulder blades together at the end. Keep chest against pad.' },
    { name: 'Cable Seated Row', defaultSets: 3, defaultReps: '10-12', cue: 'Pull to your belly button. Squeeze shoulder blades together. Control the return and feel the stretch.' },
    { name: 'Cable Straight Arm Pulldown', defaultSets: 3, defaultReps: '12-15', cue: 'Keep arms straight. Pull bar down to hips using your lats. Squeeze at the bottom. Slow return.' },
    { name: 'Cable Single Arm Row', defaultSets: 3, defaultReps: '12-15', cue: 'Pull elbow back and up. Rotate slightly at the top to squeeze the lat. Control the return.' },
    { name: 'Dumbbell Single Arm Row', defaultSets: 3, defaultReps: '10-12', cue: 'Brace on bench. Pull elbow straight back. Squeeze lat at the top. Keep hips square.' },
    { name: 'Dumbbell Shrug', defaultSets: 3, defaultReps: '15-20', cue: 'Hold dumbbells at sides. Shrug straight up — no rolling. Squeeze traps at the top. Slow return.' },
    { name: 'Face Pull (Cable)', defaultSets: 3, defaultReps: '15-20', cue: 'Set cable at face height. Pull rope to face, hands going past ears. Squeeze rear delts. Keep elbows high.' },
    { name: 'Rear Delt Fly (Dumbbell)', defaultSets: 3, defaultReps: '15-20', cue: 'Hinge forward at hips. Raise dumbbells out to sides with slight bend in elbows. Squeeze rear delts at the top.' },
  ],

  SHOULDERS: [
    { name: 'Dumbbell Overhead Press', defaultSets: 3, defaultReps: '10-12', cue: 'Press straight up. Keep core tight. Lower to ear level. Do not flare elbows too wide. Control the descent.' },
    { name: 'Dumbbell Lateral Raise', defaultSets: 3, defaultReps: '15-20', cue: 'Lead with elbows. Raise to shoulder height only. Slight forward tilt. Control the return slowly.' },
    { name: 'Cable Lateral Raise', defaultSets: 3, defaultReps: '15-20', cue: 'Lead with elbow not wrist. Stop at shoulder height. Stand tall — no leaning. Control the return.' },
    { name: 'Cable Front Raise', defaultSets: 3, defaultReps: '12-15', cue: 'Keep slight bend in elbow. Raise to shoulder height. Control the return. No swinging.' },
    { name: 'Hammer Strength Shoulder Press', defaultSets: 3, defaultReps: '10-12', cue: 'Set seat so handles are at shoulder height. Drive straight up. Control the return. Keep back against pad.' },
    { name: 'Dumbbell Front Raise', defaultSets: 3, defaultReps: '12-15', cue: 'Alternate arms. Raise to shoulder height. Keep slight bend in elbow. Control the descent.' },
    { name: 'Rear Delt Cable Fly', defaultSets: 3, defaultReps: '15-20', cue: 'Cross cables. Pull apart and back. Squeeze rear delts. Keep arms at shoulder height. Control the return.' },
    { name: 'Arnold Press', defaultSets: 3, defaultReps: '10-12', cue: 'Start with palms facing you. Rotate as you press up. Full rotation at the top. Reverse on the way down.' },
  ],

  LEGS: [
    { name: 'Barbell Squat', defaultSets: 4, defaultReps: '8-10', cue: 'Feet shoulder width. Bar on upper traps. Squat to parallel. Drive through heels. Keep chest up throughout.' },
    { name: 'Dumbbell Goblet Squat', defaultSets: 3, defaultReps: '12-15', cue: 'Hold dumbbell at chest. Squat deep. Keep elbows inside knees. Drive up through heels.' },
    { name: 'Hammer Strength Leg Press', defaultSets: 4, defaultReps: '10-12', cue: 'Feet shoulder width on platform. Lower until 90 degrees. Drive through heels. Do not lock knees at the top.' },
    { name: 'Hammer Strength Leg Curl', defaultSets: 3, defaultReps: '10-12', cue: 'Curl heels to glutes. Squeeze hamstrings at the top. Control the return — 3 seconds down.' },
    { name: 'Hammer Strength Leg Extension', defaultSets: 3, defaultReps: '12-15', cue: 'Extend fully. Squeeze quads at the top. Control the return slowly. Keep back against pad.' },
    { name: 'Dumbbell Romanian Deadlift', defaultSets: 3, defaultReps: '10-12', cue: 'Hinge at hips. Keep back flat. Lower dumbbells along legs. Feel hamstring stretch. Drive hips forward to stand.' },
    { name: 'Dumbbell Walking Lunges', defaultSets: 3, defaultReps: '12 each leg', cue: 'Long stride. Back knee to just above floor. Keep chest up. Drive through front heel to stand.' },
    { name: 'Cable Kickback', defaultSets: 3, defaultReps: '15 each side', cue: 'Attach ankle strap. Hinge slightly forward. Kick leg straight back. Squeeze glute at the top. Control the return.' },
    { name: 'Calf Raise (Machine)', defaultSets: 4, defaultReps: '15-20', cue: 'Full range of motion. Rise all the way up. Lower all the way down. Pause at the bottom for a stretch.' },
    { name: 'Dumbbell Stiff Leg Deadlift', defaultSets: 3, defaultReps: '10-12', cue: 'Keep legs almost straight. Hinge at hips. Lower dumbbells to shins. Feel the hamstring stretch. Drive hips forward.' },
  ],

  BICEPS: [
    { name: 'Dumbbell Curl', defaultSets: 3, defaultReps: '10-12', cue: 'Keep elbows pinned at sides. Curl fully. Squeeze bicep at the top. Control the descent — 3 seconds down.' },
    { name: 'Dumbbell Hammer Curl', defaultSets: 3, defaultReps: '10-12', cue: 'Neutral grip — thumbs up. Keep elbows pinned. Curl to shoulder. Squeeze at the top. Slow return.' },
    { name: 'Dumbbell Incline Curl', defaultSets: 3, defaultReps: '10-12', cue: 'Sit on incline bench. Let arms hang. Curl up fully. Great for bicep stretch at the bottom.' },
    { name: 'Cable Curl (Straight Bar)', defaultSets: 3, defaultReps: '12-15', cue: 'Keep elbows pinned. Curl to chin. Squeeze at the top. Control the return — feel the stretch.' },
    { name: 'Cable Curl (Rope)', defaultSets: 3, defaultReps: '12-15', cue: 'Split the rope at the top. Curl and supinate. Squeeze hard. Control the descent.' },
    { name: 'Cable Single Arm Curl', defaultSets: 3, defaultReps: '12-15', cue: 'Keep elbow pinned. Curl fully. Squeeze at the top. Full range of motion.' },
    { name: 'Concentration Curl', defaultSets: 3, defaultReps: '12-15', cue: 'Elbow braced on inner thigh. Curl fully. Squeeze hard at the top. Slow controlled descent.' },
  ],

  TRICEPS: [
    { name: 'Cable Pushdown (Straight Bar)', defaultSets: 3, defaultReps: '12-15', cue: 'Keep elbows pinned at sides. Push down fully. Squeeze triceps at the bottom. Control the return.' },
    { name: 'Cable Pushdown (Rope)', defaultSets: 3, defaultReps: '12-15', cue: 'Split the rope at the bottom. Squeeze triceps hard. Keep elbows pinned. Control the return.' },
    { name: 'Cable Overhead Tricep Extension', defaultSets: 3, defaultReps: '12-15', cue: 'Face away from cable. Keep elbows close to head. Extend fully. Control the return — feel the stretch.' },
    { name: 'Dumbbell Overhead Extension', defaultSets: 3, defaultReps: '10-12', cue: 'Keep elbows close to head. Lower behind head until stretch. Extend fully. Squeeze at the top.' },
    { name: 'Dumbbell Skull Crusher', defaultSets: 3, defaultReps: '10-12', cue: 'Lower to forehead. Keep elbows pointing up. Extend fully. Squeeze triceps at the top.' },
    { name: 'Dips (Bodyweight)', defaultSets: 3, defaultReps: '10-15', cue: 'Keep torso upright for triceps focus. Lower until 90 degrees. Drive up without locking elbows.' },
  ],

  CORE: [
    { name: 'Cable Crunch', defaultSets: 3, defaultReps: '15-20', cue: 'Kneel facing cable. Pull rope to sides of head. Crunch down — lead with chest to knees. Squeeze abs at the bottom.' },
    { name: 'Cable Woodchop', defaultSets: 3, defaultReps: '12-15 each side', cue: 'Set cable high. Pull diagonally down across body. Rotate through core. Control the return.' },
    { name: 'Plank', defaultSets: 3, defaultReps: '45-60 sec', cue: 'Forearms on floor. Body in straight line. Squeeze glutes and abs. Do not let hips sag or rise.' },
    { name: 'Dumbbell Side Bend', defaultSets: 3, defaultReps: '15-20 each side', cue: 'Hold dumbbell on one side. Bend to the side. Feel oblique stretch. Return upright. Do not rotate.' },
    { name: 'Hanging Knee Raise', defaultSets: 3, defaultReps: '12-15', cue: 'Hang from bar. Raise knees to chest. Squeeze abs at the top. Lower slowly — do not swing.' },
    { name: 'Ab Wheel Rollout', defaultSets: 3, defaultReps: '10-12', cue: 'Start on knees. Roll forward until body is extended. Keep core tight. Pull back using abs not arms.' },
  ],

  CARDIO: [
    { name: 'Treadmill', defaultSets: 1, defaultReps: '20-30 min', cue: 'Warm up 5 min at easy pace. Maintain conversational pace for steady state or push harder for intervals.' },
    { name: 'Stationary Bike', defaultSets: 1, defaultReps: '20-30 min', cue: 'Adjust seat so leg is almost fully extended at the bottom. Keep cadence steady. Low impact — great for recovery days.' },
    { name: 'Rowing Machine', defaultSets: 1, defaultReps: '15-20 min', cue: 'Drive with legs first, then lean back, then pull arms. Reverse the sequence on the return. Keep back straight.' },
    { name: 'Stairmaster', defaultSets: 1, defaultReps: '15-20 min', cue: 'Stand tall — do not lean on handles. Drive through whole foot. Great for glutes and cardio conditioning.' },
    { name: 'HIIT Intervals', defaultSets: 1, defaultReps: '20 min', cue: '30 sec max effort, 30 sec rest. Repeat 10-15 rounds. Use treadmill, bike or rower. Push hard on work intervals.' },
  ],
};

export const muscleGroups = ['CHEST', 'BACK', 'SHOULDERS', 'LEGS', 'BICEPS', 'TRICEPS', 'CORE', 'CARDIO'];