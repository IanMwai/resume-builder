const functions = require("firebase-functions");
const cors = require("cors")({origin: true});
const {GoogleGenerativeAI} = require("@google/generative-ai");

// Helper function for retrying with exponential backoff (v3)
const withRetry = async (fn, retries = 3, delay = 1000) => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (error.message.includes("503")) {
        console.log(`Attempt ${i + 1} failed with 503. Retrying in ${delay}ms...`);
        await new Promise(res => require('timers').setTimeout(res, delay * Math.pow(2, i)));
      } else {
        throw error; // Re-throw non-retriable errors immediately
      }
    }
  }
  throw lastError;
};

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
      const model = genAI.getGenerativeModel({model: "gemini-2.5-pro"});

      const prompt = `You are an AI assistant. Your task is to analyze a LaTeX resume against a job description.
      CRITICAL: You MUST follow the custom output format below. Do NOT use JSON.

      **Step 1: Assess Resume Quality**
      - If the resume is sparse or lacks meaningful content, it's "low-quality."
      - Otherwise, it's "high-quality."

      **Step 2: Generate Output in the Custom Format**

      **If the resume is "low-quality":**
      - The <rewritten_resume> section should contain the original, unchanged LaTeX.
      - The <analysis> section should contain a low match_score and an explanation.

      **If the resume is "high-quality":**
      - The <rewritten_resume> section should contain the improved LaTeX.
      - The <analysis> section should contain the full analysis.

      **CUSTOM OUTPUT FORMAT:**

      <rewritten_resume>
      (Raw LaTeX code goes here)
      </rewritten_resume>

      <analysis>
        <summary_of_changes>
          <enhanced_parts>
            item: (item1)
            description: (description1)
            reason: (reason1)
            ---
            item: (item2)
            description: (description2)
            reason: (reason2)
          </enhanced_parts>
          <removed_parts>
            (Similar format as enhanced_parts)
          </removed_parts>
        </summary_of_changes>
        <match_score>
        (Integer 0-100)
        </match_score>
        <match_score_explanation>
        (1-2 sentence explanation)
        </match_score_explanation>
      </analysis>

      Resume to process:
      ${latexInput}

      Job Description:
      ${jobDescription}`;

      const generationTask = () => model.generateContent(prompt);
      const result = await withRetry(generationTask);
      
      const response = await result.response;
      const text = await response.text();

      // Send the raw text response to the frontend
      res.set('Content-Type', 'text/plain');
      res.status(200).send(text);

    } catch (error) {
      console.error("Error processing resume with Gemini:", error);
      res.set('Content-Type', 'text/plain');
      res.status(500).send(`Error processing resume with AI: ${error.message}`);
    }
  });
});