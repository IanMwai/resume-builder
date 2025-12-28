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

        const prompt = `Enhance this resume for the job. Follow this format EXACTLY.

<rewritten_resume>
[Enhanced LaTeX code]
</rewritten_resume>

<analysis>
<summary_of_changes>
<enhanced_parts>
item: Professional Summary
description: Added Tesla-specific keywords and energy storage terms
reason: Better match for Tesla's mission and role requirements
---
item: Technical Skills
description: Reordered skills to highlight battery and power systems
reason: Emphasize most relevant technical competencies
---
item: Experience Bullets
description: Added quantified results and stronger action verbs
reason: Demonstrate concrete impact and achievements
</enhanced_parts>
<removed_parts>
item: General Coursework
description: Removed non-technical coursework and outdated content
reason: Focus space on relevant engineering experience
</removed_parts>
</summary_of_changes>
<match_score>78</match_score>
<match_score_explanation>Strong engineering background with relevant experience, but lacks specific Tesla/automotive industry exposure.</match_score_explanation>
</analysis>

CRITICAL RULES:
- Only enhance existing content, never fabricate
- Every item MUST have a description AND reason
- Keep descriptions under 10 words
- Keep reasons under 8 words
- Replace the example score with your real assessment

RESUME:
${latexInput.trim()}

JOB:
${jobDescription.trim()}

Follow the exact format above. Do not leave description or reason fields empty.`;

        console.log(`Processing resume request from ${clientIP}`);

        const generationTask = () => model.generateContent(prompt);
        const result = await withRetry(generationTask);
        
        const response = await result.response;
        const text = await response.text();

        console.log("AI Response preview:", text.substring(0, 500));

        const requiredSections = ['<rewritten_resume>', '<analysis>', '<match_score>'];
        const missingSections = requiredSections.filter(section => !text.includes(section));
        if (missingSections.length > 0) {
          console.error("Missing sections:", missingSections);
          throw new Error(`AI response missing required sections: ${missingSections.join(', ')}`);
        }

        console.log(`Successfully processed resume for ${clientIP}`);
        
        res.set('Content-Type', 'text/plain');
        res.status(200).send(text);

      } catch (error) {
        console.error("Resume processing error:", {
          message: error.message,
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