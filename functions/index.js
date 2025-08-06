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
      const model = genAI.getGenerativeModel({model: "gemini-1.5-pro"});

      const prompt = `You are an AI assistant tasked with helping users improve their LaTeX-formatted resumes to better match specific job descriptions.

      **Step 1: Initial Resume Quality Check**
      First, assess the quality of the provided LaTeX resume.
      - If the resume is sparse, lacks meaningful content, or is poorly structured (e.g., just a name and email), it is considered "low-quality."
      - Otherwise, it is "high-quality."

      **Step 2: Conditional Logic**

      **If the resume is "low-quality":**
      - Do NOT generate a new resume.
      - Return a low 'match_score' (less than 40).
      - In the 'match_score_explanation', explain that the resume is too sparse and provide specific, actionable feedback on what sections and information are missing.
      - The 'rewritten_resume' should be the original 'latexInput'.
      - The 'enhanced_parts' and 'removed_parts' arrays in the JSON output should be empty.

      **If the resume is "high-quality":**
      - Proceed with the original instructions to rewrite the resume.

      **Step 3: JSON Output**
      Return your output strictly as a valid JSON object.
      CRITICAL: The 'rewritten_resume' field MUST be a valid JSON string. This means all backslashes (\) must be double-escaped (\\) and all quotation marks (") must be escaped (\"). For example, '\documentclass{article}' must become '\\documentclass{article}'.

      The output format must be:
      {
        "rewritten_resume": "string (JSON-escaped LaTeX)",
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
      // The AI is now responsible for generating valid JSON, so we can simplify the parsing.
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);

      if (jsonMatch && jsonMatch[1]) {
        try {
          jsonResponse = JSON.parse(jsonMatch[1]);
        } catch (parseError) {
          console.error("Error parsing JSON from markdown block:", parseError);
          return res.status(500).send(`Error parsing AI response (markdown): ${parseError.message}`);
        }
      } else {
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
