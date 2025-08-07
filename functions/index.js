const functions = require("firebase-functions");
const cors = require("cors")({origin: true});
const {GoogleGenerativeAI} = require("@google/generative-ai");

// Fix 1: Add helper functions for JSON escaping
function sanitizeForJSON(str) {
  if (typeof str !== 'string') return str;
  
  // Replace problematic characters that can break JSON parsing
  return str
    .replace(/\\/g, '\\')  // Escape backslashes
    .replace(/"/g, '\"')    // Escape quotes
    .replace(/\n/g, '\n')   // Escape newlines
    .replace(/\r/g, '\r')   // Escape carriage returns
    .replace(/\t/g, '\t')   // Escape tabs
    .replace(/\f/g, '\f')   // Escape form feeds
    .replace(/\b/g, '\b');  // Escape backspaces
}

function sanitizeResponse(obj) {
  if (typeof obj === 'string') {
    return sanitizeForJSON(obj);
  } else if (Array.isArray(obj)) {
    return obj.map(sanitizeResponse);
  } else if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeResponse(value);
    }
    return sanitized;
  }
  return obj;
}

// Fix 4: Improved parseAIOutput function
function parseAIOutput(text) {
  const result = {};
  const sections = ["rewritten_resume", "analysis"];

  for (const section of sections) {
    const regex = new RegExp(`<${section}>([\s\S]*?)<\/${section}>`, 'i');
    const match = text.match(regex);
    if (match && match[1]) {
      result[section] = match[1].trim();
    }
  }

  if (!result.analysis) {
    throw new Error("Missing <analysis> section in AI response");
  }

  const analysisData = {};
  const analysisSections = ["summary_of_changes", "match_score", "match_score_explanation"];
  
  for (const section of analysisSections) {
    const regex = new RegExp(`<${section}>([\s\S]*?)<\/${section}>`, 'i');
    const match = result.analysis.match(regex);
    if (match && match[1]) {
      analysisData[section] = match[1].trim();
    }
  }

  if (analysisData.match_score) {
    const score = parseInt(analysisData.match_score, 10);
    analysisData.match_score = isNaN(score) ? 0 : score;
  }

  if (analysisData.summary_of_changes) {
    const summary = {};
    const changeTypes = ["enhanced_parts", "removed_parts"];
    
    for (const type of changeTypes) {
      const regex = new RegExp(`<${type}>([\s\S]*?)<\/${type}>`, 'i');
      const match = analysisData.summary_of_changes.match(regex);
      
      if (match && match[1]) {
        const parts = match[1].trim().split('---').map(part => {
          const lines = part.trim().split('\n');
          const item = lines.find(line => line.startsWith('item:'))?.replace('item:', '').trim() || '';
          const description = lines.find(line => line.startsWith('description:'))?.replace('description:', '').trim() || '';
          const reason = lines.find(line => line.startsWith('reason:'))?.replace('reason:', '').trim() || '';
          
          return { item, description, reason };
        }).filter(p => p.item || p.description || p.reason);
        
        summary[type] = parts;
      } else {
        summary[type] = [];
      }
    }
    analysisData.summary_of_changes = summary;
  }

  return {
    rewritten_resume: result.rewritten_resume || "",
    analysis: analysisData,
  };
}


// Helper function for retrying with exponential backoff
const withRetry = async (fn, retries = 3, delay = 1000) => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (error.message.includes("503")) {
        console.log(`Attempt ${i + 1} failed with 503. Retrying in ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
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
      const model = genAI.getGenerativeModel({model: "gemini-1.5-pro"});

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

      // Fix 2: Update response handling
      try {
        const finalResponse = parseAIOutput(text);
        
        // Sanitize the response before sending as JSON
        const sanitizedResponse = sanitizeResponse(finalResponse);
        
        res.status(200).json(sanitizedResponse);
      } catch (parseError) {
        console.error("Error parsing custom AI output:", parseError, "\nRaw AI response was:", text);
        return res.status(500).send(`Error parsing custom AI output: ${parseError.message}`);
      }

    } catch (error) {
      console.error("Error processing resume with Gemini:", error);
      res.status(500).send(`Error processing resume with AI: ${error.message}`);
    }
  });
});
