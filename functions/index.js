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
        throw error;
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

// Clear old entries from cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of requestCache.entries()) {
    if (now - timestamp > 300000) { // Remove entries older than 5 minutes
      requestCache.delete(key);
    }
  }
}, 60000); // Run cleanup every minute

exports.processResumeWithGemini = functions
  .runWith({
    timeoutSeconds: 540,
    memory: "2GB"
  })
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      // Validate HTTP method
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
      }

      // Rate limiting
      const clientIP = req.ip || req.connection.remoteAddress;
      if (isRateLimited(clientIP)) {
        return res.status(429).json({ error: "Too many requests. Please wait a moment." });
      }

      try {
        // Extract and validate inputs
        const { latexInput, jobDescription } = req.body;
        validateInputs(latexInput, jobDescription);

        // Check API key
        const geminiKey = process.env.GEMINI_KEY;
        if (!geminiKey) {
          throw new Error("Gemini API key is not configured");
        }

        // Initialize Gemini AI
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-pro",
          generationConfig: {
            temperature: 0.3,
            topP: 0.8,
            maxOutputTokens: 8192,
          }
        });

        // Create the prompt
        const prompt = `Enhance this LaTeX resume for the job posting. Be concise and direct.

RULES:
1. Only improve existing content - never fabricate experiences or skills
2. Use job keywords naturally where they fit
3. Keep descriptions brief and actionable
4. Focus on impact and relevance

FORMAT:

<rewritten_resume>
[Enhanced LaTeX code]
</rewritten_resume>

<analysis>
<summary_of_changes>
<enhanced_parts>
item: Summary Section
description: Added job-relevant keywords and stronger action verbs
reason: Better ATS alignment and impact
---
item: Technical Skills
description: Reorganized by job relevance, emphasized matching technologies
reason: Highlights most relevant competencies
---
item: Experience Bullets
description: Enhanced with quantified results and stronger verbs
reason: Demonstrates concrete achievements
</enhanced_parts>
<removed_parts>
item: Outdated Content
description: Removed irrelevant or obsolete information
reason: Focus on relevant qualifications
</removed_parts>
</summary_of_changes>
<match_score>[0-100 score]</match_score>
<match_score_explanation>[Brief 1-2 sentence assessment of fit and gaps]</match_score_explanation>
</analysis>

RESUME:
${latexInput.trim()}

JOB:
${jobDescription.trim()}

Keep descriptions under 12 words. Be specific and direct.`;

        console.log(`Processing resume request from ${clientIP} - Resume: ${latexInput.length} chars, Job: ${jobDescription.length} chars`);

        // Generate content with retry logic
        const generationTask = () => model.generateContent(prompt);
        const result = await withRetry(generationTask);
        
        const response = await result.response;
        const text = await response.text();

        // Validate AI response structure
        if (!text.includes('<rewritten_resume>')) {
          throw new Error("AI response missing rewritten_resume section");
        }
        if (!text.includes('<analysis>')) {
          throw new Error("AI response missing analysis section");
        }
        if (!text.includes('<match_score>')) {
          throw new Error("AI response missing match_score section");
        }

        console.log(`Successfully processed resume for ${clientIP}`);
        
        // Send plain text response
        res.set('Content-Type', 'text/plain');
        res.status(200).send(text);

      } catch (error) {
        console.error("Resume processing error:", {
          message: error.message,
          stack: error.stack,
          clientIP: req.ip,
          timestamp: new Date().toISOString()
        });

        // Handle different error types
        if (error.message.includes("quota") || error.message.includes("QUOTA_EXCEEDED")) {
          return res.status(429).json({ 
            error: "API quota exceeded. Please try again in a few minutes." 
          });
        }
        
        if (error.message.includes("429") || error.message.includes("RATE_LIMIT")) {
          return res.status(429).json({ 
            error: "Rate limit exceeded. Please wait before trying again." 
          });
        }
        
        if (error.message.includes("too short") || error.message.includes("too long")) {
          return res.status(400).json({ error: error.message });
        }
        
        if (error.message.includes("required") || error.message.includes("input")) {
          return res.status(400).json({ error: error.message });
        }

        if (error.message.includes("API key")) {
          return res.status(500).json({ 
            error: "Service configuration error. Please contact support." 
          });
        }

        // Generic error fallback
        return res.status(500).json({ 
          error: "Unable to process resume. Please check your inputs and try again." 
        });
      }
    });
  });