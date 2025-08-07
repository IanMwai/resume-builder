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

// Rate limiting helper (simple in-memory cache)
const requestCache = new Map();
const isRateLimited = (identifier) => {
  const now = Date.now();
  const lastRequest = requestCache.get(identifier);
  if (lastRequest && now - lastRequest < 5000) { // 5 second cooldown
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

      // Basic rate limiting
      const clientIP = req.ip || req.connection.remoteAddress;
      if (isRateLimited(clientIP)) {
        return res.status(429).json({ error: "Too many requests. Please wait a moment." });
      }

      try {
        const { latexInput, jobDescription } = req.body;
        
        // Validate inputs
        validateInputs(latexInput, jobDescription);

        const geminiKey = process.env.GEMINI_KEY;
        if (!geminiKey) {
          throw new Error("Gemini API key is not configured.");
        }

        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-2.0-flash-exp",
          generationConfig: {
            temperature: 0.3, // Lower temperature for more consistent output
            topP: 0.8,
            maxOutputTokens: 8192,
          }
        });

        const prompt = `Analyze this LaTeX resume against the job description. CRITICAL RULES:

1. NEVER invent experiences, skills, or achievements not in the original resume
2. Only enhance, reword, or reformat existing content
3. If resume lacks relevant content, indicate inadequacy rather than fabricating

ASSESSMENT CRITERIA:
- High-quality: Has substantial, relevant content that can be enhanced
- Low-quality: Sparse content, major gaps, or insufficient experience for the role

OUTPUT FORMAT (exactly as shown):

<rewritten_resume>
[Enhanced LaTeX - keep original structure, improve wording only]
</rewritten_resume>

<analysis>
<summary_of_changes>
<enhanced_parts>
item: [specific section enhanced]
description: [what was improved]
reason: [why it helps job match]
---
[repeat for each enhancement]
</enhanced_parts>
<removed_parts>
[same format for removed items]
</removed_parts>
</summary_of_changes>
<match_score>[0-100]</match_score>
<match_score_explanation>[Brief explanation of score and gaps]</match_score_explanation>
</analysis>

RESUME:
${latexInput.trim()}

JOB DESCRIPTION:
${jobDescription.trim()}`;

        console.log(`Processing request from ${clientIP} - Resume length: ${latexInput.length}, Job desc length: ${jobDescription.length}`);

        const generationTask = () => model.generateContent(prompt);
        const result = await withRetry(generationTask);
        
        const response = await result.response;
        const text = await response.text();

        // Validate response contains required sections
        if (!text.includes('<rewritten_resume>') || !text.includes('<analysis>')) {
          throw new Error("AI response missing required sections");
        }

        console.log(`Successfully processed request from ${clientIP}`);
        
        res.set('Content-Type', 'text/plain');
        res.status(200).send(text);

      } catch (error) {
        console.error("Error processing resume:", {
          message: error.message,
          stack: error.stack,
          clientIP: req.ip
        });

        // Return appropriate error messages
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

// Helper function to clean up rate limiting cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of requestCache.entries()) {
    if (now - timestamp > 300000) { // Remove entries older than 5 minutes
      requestCache.delete(key);
    }
  }
}, 60000); // Clean up every minute