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
    if (now - timestamp > 300000) {
      requestCache.delete(key);
    }
  }
}, 60000);

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
          throw new Error("Gemini API key is not configured");
        }

        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-pro",
          generationConfig: {
            temperature: 0.1,
            topP: 0.9,
            maxOutputTokens: 8192,
          }
        });

        const prompt = `You are a resume optimizer. Enhance the LaTeX resume for the job posting. 

CRITICAL: You MUST output in this EXACT format. Do not deviate from this structure.

<rewritten_resume>
[Enhanced LaTeX code goes here]
</rewritten_resume>

<analysis>
<summary_of_changes>
<enhanced_parts>
item: Summary
description: Added relevant keywords
reason: Better ATS matching
---
item: Skills
description: Reorganized by relevance
reason: Highlight job requirements
</enhanced_parts>
<removed_parts>
item: Old content
description: Removed outdated info
reason: Focus on relevant skills
</removed_parts>
</summary_of_changes>
<match_score>75</match_score>
<match_score_explanation>Good technical match but missing some requirements.</match_score_explanation>
</analysis>

RULES:
- Only enhance existing content, never fabricate
- Keep descriptions under 8 words
- Be honest about qualifications
- Calculate real match score 0-100

RESUME:
${latexInput.trim()}

JOB:
${jobDescription.trim()}`;

        console.log(`Processing resume request from ${clientIP}`);

        const generationTask = () => model.generateContent(prompt);
        const result = await withRetry(generationTask);
        
        const response = await result.response;
        const text = await response.text();

        // Log the response for debugging
        console.log("AI Response length:", text.length);
        console.log("AI Response preview:", text.substring(0, 500));

        // More thorough validation
        const requiredSections = [
          '<rewritten_resume>',
          '</rewritten_resume>',
          '<analysis>',
          '</analysis>',
          '<match_score>',
          '</match_score>'
        ];

        const missingSections = requiredSections.filter(section => !text.includes(section));
        if (missingSections.length > 0) {
          console.error("Missing sections:", missingSections);
          console.error("Full AI response:", text);
          throw new Error(`AI response missing required sections: ${missingSections.join(', ')}`);
        }

        console.log(`Successfully processed resume for ${clientIP}`);
        
        res.set('Content-Type', 'text/plain');
        res.status(200).send(text);

      } catch (error) {
        console.error("Resume processing error:", {
          message: error.message,
          stack: error.stack,
          clientIP: req.ip,
          timestamp: new Date().toISOString()
        });

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

        return res.status(500).json({ 
          error: "Unable to process resume. Please check your inputs and try again." 
        });
      }
    });
  });