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

      const prompt = `You are an AI assistant tasked with helping users improve their LaTeX-formatted resumes to better match specific job descriptions.\n\n      Instructions:\n      - Rewrite the given LaTeX resume to better align with the job description.\n      - Only rephrase or reorder existing information. Do not invent or add new content.\n      - Preserve all LaTeX formatting and structure.\n      - The match score should reflect the following weights:\n      - Technical skill overlap: 40%\n      - Educational relevance: 25%\n      - Experience alignment (e.g., labs, internships): 25%\n      - Format/tone alignment with job role: 10%\n\n      - If core technical skills, tools, or location flexibility are missing from the resume, deduct accordingly.\n      - Provide a match_score (integer 0–100) and a match_score_explanation (1–2 sentences).\n      - Return your output strictly as a valid JSON object with the following format:\n      \n      {\n        "rewritten_resume": "string (LaTeX)",\n        "analysis": {\n          "summary_of_changes": {\n            "enhanced_parts": [ { "item": "string", "description": "string", "reason": "string" } ],\n            "removed_parts": [ { "item": "string", "description": "string", "reason": "string" } ]\n          },\n          "match_score": integer (0–100),\n          "match_score_explanation": "string"\n        }\n      }\n      \n      LaTeX Resume:\n      ${latexInput}\n      \n      Job Description:\n      ${jobDescription}\n      \n      Only return the JSON object, with no explanation or commentary. Ensure it is valid and parsable.`;
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