const functions = require("firebase-functions");
const puppeteer = require("puppeteer-core");
const cors = require("cors")({origin: true});
const {GoogleGenerativeAI} = require("@google/generative-ai");

// Modified generateResumePdf function to accept htmlContent directly
exports.generateResumePdf = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const {htmlContent} = req.body; // Expect htmlContent directly

    if (!htmlContent) {
      return res.status(400).send("HTML content is required.");
    }

    let browser;
    try {
      // Launch a headless browser. Use the bundled Chromium for Firebase Functions.
      browser = await puppeteer.launch({
        executablePath: "/usr/bin/chromium-browser", // Path for Firebase Functions environment
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.setContent(htmlContent, {waitUntil: "networkidle0"});
      const pdfBuffer = await page.pdf({format: "A4"});

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=resume.pdf");
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).send("Error generating PDF.");
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  });
});

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
      const genAI = new GoogleGenerativeAI(functions.config().gemini.key);
      const model = genAI.getGenerativeModel({model: "gemini-1.5-flash"});

      const prompt = `You are an AI assistant tasked with helping users improve their LaTeX-formatted resumes to better match specific job descriptions.

      Instructions:
      - Rewrite the given LaTeX resume to better align with the job description.
      - Only rephrase or reorder existing information. Do not invent or add new content.
      - Preserve all LaTeX formatting and structure.
      - Return your output strictly as a valid JSON object with the following format:
      
      {
        "rewritten_resume": "string (LaTeX)",
        "analysis": {
          "summary_of_changes": {
            "added_sections": [ { "item": "string", "description": "string" } ],
            "removed_parts": [ { "item": "string", "description": "string" } ],
            "reworded_bullet_points": [ { "item": "string", "description": "string" } ]
          },
          "match_score": integer (0–100)
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

      // Extract JSON from markdown code block
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
      let jsonResponse;
      if (jsonMatch && jsonMatch[1]) {
        jsonResponse = JSON.parse(jsonMatch[1]);
      } else {
        // If no markdown block, try to parse as-is (for development or unexpected formats)
        jsonResponse = JSON.parse(text);
      }
      res.status(200).json(jsonResponse);
    } catch (error) {
      console.error("Error processing resume with Gemini:", error);
      res.status(500).send("Error processing resume with AI.");
    }
  });
});
