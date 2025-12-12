import { GoogleGenAI, Type } from "@google/genai";
import { Job, UserProfile } from "../types";

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY is missing. AI features will run in mock mode.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateCVContent = async (profile: UserProfile): Promise<string> => {
  const ai = getAIClient();
  const prompt = `
    Create a professional, concise CV summary and structure for a job seeker in Pakistan.
    
    Personal Details:
    Name: ${profile.name}
    Phone: ${profile.phone}
    Email: ${profile.email}
    Address: ${profile.address}
    
    Professional Info:
    Skills: ${profile.skills.join(', ')}
    Languages: ${profile.languages.join(', ')}
    Experience: ${profile.experience}
    Education: ${profile.education}
    
    Output format: a clean, plain text resume suitable for WhatsApp sharing or PDF generation. 
    Start with a strong Objective/Summary.
    Focus on highlighting skills for blue-collar or entry-level white-collar jobs.
  `;

  if (!ai) {
    return `[MOCK CV]\nName: ${profile.name}\nPhone: ${profile.phone}\n\nObjective: Seeking a position in ${profile.categoryPreference}.\n\nSkills: ${profile.skills.join(', ')}\nExperience: ${profile.experience}`;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Could not generate CV.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Error generating CV. Please try again.";
  }
};

export const rankJobsWithAI = async (profile: UserProfile, jobs: Job[]): Promise<{ jobId: string; reason: string }[]> => {
  const ai = getAIClient();
  
  if (!ai) {
    // Mock logic: simply return the first 2 jobs
    return jobs.slice(0, 2).map(j => ({ jobId: j.id, reason: "Mock Match: Fits your profile." }));
  }

  const jobsContext = jobs.map(j => ({
    id: j.id,
    title: j.title,
    requirements: j.requirements,
    salary: j.salary,
    description: j.description
  }));

  const prompt = `
    Analyze this user profile against the provided job list.
    
    User Profile:
    - Skills: ${profile.skills.join(', ')}
    - Experience: ${profile.experience}
    - Preferred Salary: ${profile.preferredSalary}

    Job List JSON:
    ${JSON.stringify(jobsContext)}

    Task: Identify the top 3 best matching jobs.
    Return ONLY a JSON array of objects with keys: "jobId" (string) and "reason" (string, max 15 words, explaining why).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              jobId: { type: Type.STRING },
              reason: { type: Type.STRING }
            }
          }
        }
      }
    });

    const jsonText = response.text || "[]";
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("AI Matching Error:", error);
    return [];
  }
};