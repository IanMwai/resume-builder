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

        const prompt = `You are an expert Technical Recruiter and Resume Writer with 15+ years of experience. Your goal is to rewrite a candidate's resume to maximize their chances of getting an interview for the specific job provided.

JOB DESCRIPTION:
${jobDescription.trim()}

CANDIDATE RESUME (LaTeX):
${latexInput.trim()}

### INSTRUCTIONS:
1. **Analyze Strategy:** First, identify the hard skills, soft skills, and core competencies required by the job description.
2. **Rewrite Content (Deep Optimization):**
   - **Structure:** Keep the exact same LaTeX template and structure. Only modify the text content.
   - **Professional Summary:** Rewrite the summary to be a powerful elevator pitch that immediately aligns the candidate with the specific role.
   - **Bullet Points (STAR Method):** Rewrite experience bullet points using the STAR method (Situation, Task, Action, Result).
   - **Keywords:** Naturally integrate specific keywords from the job description into the skills and experience sections to pass ATS (Applicant Tracking Systems).
   - **Impact:** Change passive language to active, results-oriented language (e.g., "Responsible for..." -> "Spearheaded...").
   - **Quantification:** If exact numbers are missing, frame the bullets to highlight impact. *Do not invent numbers*, but you can use placeholders like "[increased efficiency by X%]" if the context strongly implies a missing metric.
3. **Filtering:** Remove irrelevant hobbies or outdated experience that doesn't add value to this specific application.

### OUTPUT FORMAT:
You must strictly follow this XML-like format. Do not add any markdown blocks (like \`\`\`xml) around the tags.

<rewritten_resume>
[Insert the FULL, valid, compilable LaTeX code here. Do not truncate.]
</rewritten_resume>

<analysis>
<match_score>[0-100]</match_score>
<match_score_explanation>[Concise explanation of the score and the main gap closed]</match_score_explanation>
<summary_of_changes>
<enhanced_parts>
item: [Brief Title of Change]
description: [What specifically was improved]
reason: [Strategic reason relating to the Job Description]
---
item: [Next Change]
description: [Description]
reason: [Reason]
---
[Include 3-5 major improvements]
</enhanced_parts>
<removed_parts>
item: [Title of Removal]
description: [What was removed]
reason: [Why it was distraction or irrelevant]
---
[Include only if applicable]
</removed_parts>
</summary_of_changes>
</analysis>

### CRITICAL RULES:
- **NO HALLUCINATIONS:** Do not invent companies, degrees, or job titles. Only enhance existing content.
- **LaTeX INTEGRITY:** The code in <rewritten_resume> MUST be compilable. Do not break braces {} or commands.
- **TONE:** Professional, confident, and concise.
`;

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