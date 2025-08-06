const functions = require("firebase-functions");
const cors = require("cors")({origin: true});
const {GoogleGenerativeAI} = require("@google/generative-ai");

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
        throw new Error("Gemini API key is not configured.");
      }

      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({model: "gemini-1.5-pro"});

      const prompt = `You are an AI assistant. Your task is to analyze a LaTeX resume against a job description.

      **Step 1: Assess Resume Quality**
      - If the resume is sparse or lacks meaningful content, it's \"low-quality.\"
      - Otherwise, it's \"high-quality.\"

      **Step 2: Generate Output**

      **If the resume is \"low-quality:\"**
      1.  First, return the original LaTeX resume exactly as provided.
      2.  Then, on a new line, add the separator: '---JSON_SEPARATOR---'
      3.  Finally, provide a JSON object with a low match_score and an explanation. The 'enhanced_parts' and 'removed_parts' arrays should be empty.

      **If the resume is \"high-quality:\"**
      1.  First, return the rewritten, improved LaTeX resume.
      2.  Then, on a new line, add the separator: '---JSON_SEPARATOR---'
      3.  Finally, provide the JSON analysis object with the match score and changes.

      **CRITICAL OUTPUT FORMAT:**
      1.  Provide the raw LaTeX content first.
      2.  Then, on a new line, THIS EXACT SEPARATOR: ---JSON_SEPARATOR---
      3.  Then, on a new line, a JSON object for the analysis.

      **CRITICAL JSON RULES:**
      - The JSON object MUST be perfectly valid.
      - All string values inside the JSON (like 'match_score_explanation') must have special characters properly escaped. For example, a string containing "a quote" must be written as \"a quote\".

      **JSON object format:**
      {
        \"analysis\": {
          \"summary_of_changes\": {
            \"enhanced_parts\": [ { \"item\": \"string\", \"description\": \"string\", \"reason\": \"string\" } ],
            \"removed_parts\": [ { \"item\": \"string\", \"description\": \"string\", \"reason\": \"string\" } ]
          },
          \"match_score\": integer (0–100),
          \"match_score_explanation\": \"string\"
        }
      }

      Resume to process:
      ${latexInput}

      Job Description:
      ${jobDescription}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = await response.text();

      const parts = text.split('---JSON_SEPARATOR---');

      if (parts.length !== 2) {
        throw new Error("AI response did not contain the expected separator. Raw response: " + text.substring(0, 500));
      }

      const rewritten_resume = parts[0].trim();
      const jsonString = parts[1].trim();

      let analysisData;
      try {
        const jsonMatch = jsonString.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          analysisData = JSON.parse(jsonMatch[1]);
        } else {
          analysisData = JSON.parse(jsonString);
        }
      } catch (parseError) {
        console.error("Error parsing JSON part of AI response:", parseError, "\nJSON String was:", jsonString);
        return res.status(500).send(`Error parsing AI JSON response: ${parseError.message}`);
      }

      const finalResponse = {
        rewritten_resume: rewritten_resume,
        ...analysisData
      };

      res.status(200).json(finalResponse);

    } catch (error) {
      console.error("Error processing resume with Gemini:", error);
      res.status(500).send(`Error processing resume with AI: ${error.message}`);
    }
  });
});