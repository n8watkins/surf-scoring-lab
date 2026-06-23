export const LOCKED_MODEL = "gemini-3.1-flash-lite";
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const RECOMMENDED_SECONDS = 30;

export const starterPrompt = `Analyze the supplied surfing video.

Focus only on details that are visibly supported by the video.

Use the supplied rubric to evaluate the ride.

For each criterion:
- provide a score using the rubric's scoring range
- briefly explain the score
- cite a timestamp when possible
- state when visibility prevents a reliable judgment

Identify visible maneuver attempts and whether each appears:
- completed
- partially completed
- failed
- unclear

Do not assume the surfer's identity, age, experience, or intention.

If the video is too unclear to evaluate, say that it is ungradable and explain why.

Follow the requested JSON response format.`;

export const rubricPresets = [
  {
    name: "General ride coaching",
    content: `Score each category from 1 to 10:

1. Wave positioning
   How effectively the surfer uses the pocket and wave face.

2. Speed
   How effectively the surfer creates and maintains speed.

3. Balance and control
   How stable and controlled the surfer appears.

4. Maneuver execution
   How successfully visible maneuvers are initiated and completed.

5. Difficulty
   How challenging the visible maneuvers and sections appear.

6. Flow
   How smoothly the ride connects from beginning to end.`,
  },
  {
    name: "Simple beginner review",
    content: `Review the ride for a beginner surfer.

Consider:
1. Staying on the wave
2. Balance
3. Speed
4. Direction changes
5. Ride completion

Use plain coaching language. Only score details that are visible.`,
  },
  {
    name: "Maneuver-focused",
    content: `Evaluate visible maneuver attempts.

Consider:
1. Setup
2. Initiation
3. Body and board control
4. Criticality
5. Completion
6. Exit speed

Describe uncertainty when the camera angle, distance, or obstruction makes completion unclear.`,
  },
  {
    name: "No numerical scoring",
    content: `Do not provide numerical scores.

Report:
- what happened
- what worked
- what failed or looked unclear
- what to practice next
- confidence in the analysis`,
  },
];

export const outputPresets = [
  {
    name: "Basic coaching",
    mode: "example" as const,
    content: JSON.stringify(
      {
        gradable: true,
        summary: "",
        strengths: [],
        improvements: [],
        confidence: "medium",
      },
      null,
      2,
    ),
  },
  {
    name: "Basic scoring",
    mode: "example" as const,
    content: JSON.stringify(
      {
        gradable: true,
        overallScore: 0,
        criteria: [
          {
            name: "",
            score: 0,
            reason: "",
          },
        ],
        summary: "",
      },
      null,
      2,
    ),
  },
  {
    name: "Evidence-based analysis",
    mode: "example" as const,
    content: JSON.stringify(
      {
        gradable: true,
        ungradableReason: null,
        criteria: [
          {
            name: "",
            score: 0,
            confidence: 0,
            evidence: [
              {
                timestamp: 0,
                observation: "",
              },
            ],
            feedback: "",
          },
        ],
        maneuvers: [
          {
            name: "",
            timestamp: 0,
            completion: "completed",
          },
        ],
        uncertainties: [],
        summary: "",
      },
      null,
      2,
    ),
  },
];
