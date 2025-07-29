const functions = require("firebase-functions");
const cors = require("cors")({origin: true});
const {GoogleGenerativeAI} = require("@google/generative-ai");

// Existing processResumeWithGemini function
exports.processResumeWithGemini = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const {latexInput, jobDescription} = req.body;

    if (!latexInput || !jobDescription) {
      return res.status(400).send("Missing latexInput or jobDescription.");
    }

    try {
      const geminiKey = process.env.GEMINI_KEY;
      if (!geminiKey) {
        throw new Error("Gemini API key is not configured. Please set the GEMINI_KEY environment variable.");
      }

      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({model: "gemini-1.5-flash"});

      const prompt = `You are an AI assistant tasked with helping users improve their LaTeX-formatted resumes to better match specific job descriptions.

      Instructions:
      - Update the resume to match the job description, ensuring the following:
      - Use consistent formatting throughout.
      - Highlight relevant keywords and skills that match the job description—both technical and soft.
      - Use clear, concise action verbs to describe responsibilities and achievements.
      - Maintain the original tone and voice.
      - Prefer directly related roles, but still reflect transferable skills (e.g., leadership, initiative, adaptability) from unrelated experiences.
      - Check for and correct any grammar or formatting issues.
      - Limit the resume to strictly one page in 11 pt font. Prioritize relevance; shorten sentences as needed without losing key information.
      - Only rephrase or reorder existing information. Do not invent or add new content.
      - Preserve all LaTeX formatting and structure.
      - The match score should reflect the following weights:
      - Technical skill overlap: 40%
      - Educational relevance: 25%
      - Experience alignment (e.g., labs, internships): 25%
      - Format/tone alignment with job role: 10%

      - If core technical skills, tools, or location flexibility are missing from the resume, deduct accordingly.
      - Provide a match_score (integer 0–100) and a match_score_explanation (1–2 sentences).
      - Return your output strictly as a valid JSON object with the following format:
      
      {
        "rewritten_resume": "string (LaTeX)",
        "analysis": {
          "summary_of_changes": {
            "enhanced_parts": [ { "item": "string", "description": "string", "reason": "string" } ],
            "removed_parts": [ { "item": "string", "description": "string", "reason": "string" } ]
          },
          "match_score": integer (0–100),
          "match_score_explanation": "string"
        }
      }
      
      LaTeX Resume:
      ${latexInput}
      
      Job Description:
      ${jobDescription}
      
      Only return the JSON object, with no explanation or commentary. Ensure it is valid and parsable.`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = await response.text();

      let jsonResponse;
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);

      if (jsonMatch && jsonMatch[1]) {
        try {
          jsonResponse = JSON.parse(jsonMatch[1]);
        } catch (parseError) {
          console.error("Error parsing JSON from markdown block:", parseError);
          return res.status(500).send(`Error parsing AI response (markdown): ${parseError.message}`);
        }
      } else {
        // If no markdown block, try to parse as-is
        try {
          jsonResponse = JSON.parse(text);
        } catch (parseError) {
          console.error("Error parsing raw AI response as JSON:", parseError);
          return res.status(500).send(`Error parsing AI response (raw): ${parseError.message}. Raw response: ${text.substring(0, 200)}...`);
        }
      }
      res.status(200).json(jsonResponse);
    } catch (error) {
      console.error("Error processing resume with Gemini:", error);
      res.status(500).send(`Error processing resume with AI: ${error.message}`);
    }
  });
});