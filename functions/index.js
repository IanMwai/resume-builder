const functions = require("firebase-functions");
const cors = require("cors")({origin: true});
const {GoogleGenerativeAI} = require("@google/generative-ai");

// Input validation helper
const validateInputs = (latexInput, jobDescription) => {
  if (!latexInput?.trim()) {
    throw new Error("LaTeX input is required");
  }
  if (!jobDescription?.trim()) {
    throw new Error("Job description is required");
  }
  if (latexInput.length < 200) {
    throw new Error("Resume content is too short (minimum 200 characters)");
  }
  if (latexInput.length > 50000) {
    throw new Error("Resume content is too long (maximum 50,000 characters)");
  }
  if (jobDescription.length > 10000) {
    throw new Error("Job description is too long (maximum 10,000 characters)");
  }
};

// Helper function for retrying with exponential backoff
const withRetry = async (fn, retries = 3, delay = 1000) => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (error.message.includes("503") || error.message.includes("429")) {
        console.log(`Attempt ${i + 1} failed with ${error.message.includes("429") ? "rate limit" : "503"}. Retrying in ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
      } else {
        throw error; // Re-throw non-retriable errors immediately
      }
    }
  }
  throw lastError;
};

// Rate limiting helper
const requestCache = new Map();
const isRateLimited = (identifier) => {
  const now = Date.now();
  const lastRequest = requestCache.get(identifier);
  if (lastRequest && now - lastRequest < 5000) {
    return true;
  }
  requestCache.set(identifier, now);
  return false;
};

exports.processResumeWithGemini = functions
  .runWith({
    timeoutSeconds: 540,
    memory: "2GB"
  })
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
      }

      const clientIP = req.ip || req.connection.remoteAddress;
      if (isRateLimited(clientIP)) {
        return res.status(429).json({ error: "Too many requests. Please wait a moment." });
      }

      try {
        const { latexInput, jobDescription } = req.body;
        validateInputs(latexInput, jobDescription);

        const geminiKey = process.env.GEMINI_KEY;
        if (!geminiKey) {
          throw new Error("Gemini API key is not configured.");
        }

        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-pro",
          generationConfig: {
            temperature: 0.1,
            topP: 0.9,
            maxOutputTokens: 8192,
          }
        });

        const prompt = `Optimize this LaTeX resume for the job posting. CRITICAL: Follow the EXACT format below.

RULES:
- Only enhance existing content, never invent new experiences
- If resume is inadequate, reflect this in the match score
- Use stronger action verbs and better keyword alignment
- Maintain complete honesty about qualifications

EXACT FORMAT REQUIRED:

<rewritten_resume>
[Enhanced LaTeX code here]
</rewritten_resume>

<analysis>
<summary_of_changes>
<enhanced_parts>
item: Summary Section
description: Rewrote summary to emphasize software engineering skills and added relevant keywords from job posting
reason: Better ATS optimization and alignment with role requirements
---
item: Technical Skills
description: Reorganized programming languages by relevance and added missing frameworks mentioned in resume
reason: Highlights most relevant technologies for this specific role
---
item: Project Descriptions
description: Enhanced bullet points with quantified results and technical details using stronger action verbs
reason: Makes achievements more impactful and demonstrates technical competency
</enhanced_parts>
<removed_parts>
item: Irrelevant coursework
description: Removed outdated academic courses not related to the target role
reason: Creates more space for relevant technical experience and skills
</removed_parts>
</summary_of_changes>
<match_score>78</match_score>
<match_score_explanation>Strong technical skills match job requirements, but lacks specific experience with cloud platforms mentioned in posting. Resume shows solid foundation but missing some advanced requirements.</match_score_explanation>
</analysis>

RESUME:
${latexInput.trim()}

JOB POSTING:
${jobDescription.trim()}

IMPORTANT: Every "item:" must have a complete "description:" and "reason:" on the lines that follow. No empty fields.`;

        console.log(`Processing request from ${clientIP}`);

        const generationTask = () => model.generateContent(prompt);
        const result = await withRetry(generationTask);
        
        const response = await result.response;
        let text = await response.text();

        // Clean up any malformed output
        text = text.replace(/description:\s*\n/g, 'description: Enhanced content for better job alignment\n');
        text = text.replace(/reason:\s*\n/g, 'reason: Improves relevance to job requirements\n');
        text = text.replace(/description:\s*$/gm, 'description: Enhanced content for better job alignment');
        text = text.replace(/reason:\s*$/gm, 'reason: Improves relevance to job requirements');

        // Validate response
        if (!text.includes('<rewritten_resume>') || !text.includes('<analysis>')) {
          throw new Error("AI response missing required sections");
        }

        console.log(`Successfully processed request from ${clientIP}`);
        
        res.set('Content-Type', 'text/plain');
        res.status(200).send(text);

      } catch (error) {
        console.error("Error processing resume:", {
          message: error.message,
          clientIP: req.ip
        });

        if (error.message.includes("quota") || error.message.includes("429")) {
          res.status(429).json({ error: "API quota exceeded. Please try again later." });
        } else if (error.message.includes("too short") || error.message.includes("too long")) {
          res.status(400).json({ error: error.message });
        } else if (error.message.includes("required")) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: "Failed to process resume. Please try again." });
        }
      }
    });
  });

// Cleanup cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of requestCache.entries()) {
    if (now - timestamp > 300000) {
      requestCache.delete(key);
    }
  }
}, 60000);
