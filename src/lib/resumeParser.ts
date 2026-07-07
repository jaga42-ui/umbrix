const SKILLS_DICTIONARY = [
  "javascript", "typescript", "python", "rust", "go", "golang", "c++", "c#", "ruby", "php", "java", "kotlin", "swift", "scala", "solidity", "sql", "html", "css", "sass", "graphql", "bash",
  "react", "next.js", "nextjs", "vue", "angular", "svelte", "remix", "nuxt", "node.js", "nodejs", "express", "nestjs", "fastapi", "django", "flask", "rails", "spring boot", "laravel", "tailwind", "bootstrap",
  "aws", "gcp", "azure", "docker", "kubernetes", "k8s", "terraform", "ansible", "jenkins", "github actions", "ci/cd", "nginx", "cloudflare",
  "postgresql", "postgres", "mysql", "mongodb", "redis", "dynamodb", "sqlite", "prisma", "sequelize", "mongoose",
  "figma", "sketch", "adobe xd", "photoshop", "illustrator", "git", "jira", "confluence", "trello",
  "jest", "cypress", "playwright", "mocha", "chai", "selenium",
  "agile", "scrum", "machine learning", "artificial intelligence", "ai", "deep learning", "nlp", "llm", "data science", "system design", "microservices", "web3", "qa"
];

const SKILL_MAP: { [key: string]: string } = {
  "javascript": "JavaScript",
  "typescript": "TypeScript",
  "python": "Python",
  "rust": "Rust",
  "go": "Go",
  "golang": "Go",
  "c++": "C++",
  "c#": "C#",
  "ruby": "Ruby",
  "php": "PHP",
  "java": "Java",
  "kotlin": "Kotlin",
  "swift": "Swift",
  "scala": "Scala",
  "solidity": "Solidity",
  "sql": "SQL",
  "html": "HTML",
  "css": "CSS",
  "sass": "Sass",
  "graphql": "GraphQL",
  "bash": "Bash",
  "react": "React",
  "next.js": "Next.js",
  "nextjs": "Next.js",
  "vue": "Vue",
  "angular": "Angular",
  "svelte": "Svelte",
  "remix": "Remix",
  "nuxt": "Nuxt",
  "node.js": "Node.js",
  "nodejs": "Node.js",
  "express": "Express",
  "nestjs": "NestJS",
  "fastapi": "FastAPI",
  "django": "Django",
  "flask": "Flask",
  "rails": "Ruby on Rails",
  "spring boot": "Spring Boot",
  "laravel": "Laravel",
  "tailwind": "TailwindCSS",
  "bootstrap": "Bootstrap",
  "aws": "AWS",
  "gcp": "GCP",
  "azure": "Azure",
  "docker": "Docker",
  "kubernetes": "Kubernetes",
  "k8s": "Kubernetes",
  "terraform": "Terraform",
  "ansible": "Ansible",
  "jenkins": "Jenkins",
  "github actions": "GitHub Actions",
  "ci/cd": "CI/CD",
  "nginx": "Nginx",
  "cloudflare": "Cloudflare",
  "postgresql": "PostgreSQL",
  "postgres": "PostgreSQL",
  "mysql": "MySQL",
  "mongodb": "MongoDB",
  "redis": "Redis",
  "dynamodb": "DynamoDB",
  "sqlite": "SQLite",
  "prisma": "Prisma",
  "sequelize": "Sequelize",
  "mongoose": "Mongoose",
  "figma": "Figma",
  "sketch": "Sketch",
  "adobe xd": "Adobe XD",
  "photoshop": "Photoshop",
  "illustrator": "Illustrator",
  "git": "Git",
  "jira": "Jira",
  "confluence": "Confluence",
  "trello": "Trello",
  "jest": "Jest",
  "cypress": "Cypress",
  "playwright": "Playwright",
  "mocha": "Mocha",
  "chai": "Chai",
  "selenium": "Selenium",
  "agile": "Agile",
  "scrum": "Scrum",
  "machine learning": "Machine Learning",
  "artificial intelligence": "AI",
  "ai": "AI",
  "deep learning": "Deep Learning",
  "nlp": "NLP",
  "llm": "LLM",
  "data science": "Data Science",
  "system design": "System Design",
  "microservices": "Microservices",
  "web3": "Web3",
  "qa": "QA"
};

export function extractSkills(text: string): string[] {
  const lowercaseText = text.toLowerCase();
  const matchedSkills = new Set<string>();

  for (const skill of SKILLS_DICTIONARY) {
    // Escape regex characters (like C++)
    const escapedSkill = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    
    // We want word boundaries, but C++ or .NET don't play well with \b.
    // So we use custom regex boundary checks.
    let regex: RegExp;
    if (skill.includes("+") || skill.includes(".")) {
      regex = new RegExp(`(?:[^a-zA-Z0-9]|^)${escapedSkill}(?:[^a-zA-Z0-9]|$)`, "gi");
    } else {
      regex = new RegExp(`\\b${escapedSkill}\\b`, "gi");
    }

    if (regex.test(lowercaseText)) {
      const normalized = SKILL_MAP[skill];
      if (normalized) {
        matchedSkills.add(normalized);
      }
    }
  }

  return Array.from(matchedSkills);
}

export function parseResumeText(text: string) {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  
  // Extract email
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex);
  const email = emails && emails.length > 0 ? emails[0] : "";

  // Extract Name (usually first line of resume)
  let name = "Developer Profile";
  if (lines.length > 0) {
    const firstLine = lines[0];
    if (firstLine.length < 50 && !firstLine.includes("@") && !firstLine.toLowerCase().includes("resume") && !firstLine.toLowerCase().includes("cv")) {
      name = firstLine;
    }
  }

  // Extract Title (usually second line if it looks like a title)
  let title = "Software Engineer";
  for (let i = 1; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    if (
      line.length < 60 && 
      !line.includes("@") && 
      !line.match(/\d{4}/) && // no years
      (line.toLowerCase().includes("engineer") || 
       line.toLowerCase().includes("developer") || 
       line.toLowerCase().includes("designer") || 
       line.toLowerCase().includes("manager") ||
       line.toLowerCase().includes("lead") ||
       line.toLowerCase().includes("architect"))
    ) {
      title = line;
      break;
    }
  }

  // Extract Skills
  const skills = extractSkills(text);

  // Extract Career Summary
  let summary = "";
  const summaryHeaderIndex = lines.findIndex(l => 
    l.toLowerCase() === "summary" || 
    l.toLowerCase() === "professional summary" || 
    l.toLowerCase() === "profile" || 
    l.toLowerCase() === "about me"
  );
  if (summaryHeaderIndex !== -1 && summaryHeaderIndex + 1 < lines.length) {
    summary = lines[summaryHeaderIndex + 1];
    // Concatenate lines until we hit another header or empty line (in original text, but here we just grab the next 1-2 sentences)
    if (summaryHeaderIndex + 2 < lines.length && lines[summaryHeaderIndex + 2].length > 40 && !lines[summaryHeaderIndex + 2].includes("@")) {
      summary += " " + lines[summaryHeaderIndex + 2];
    }
  } else {
    // Fallback: search for first short paragraph
    summary = `Experienced ${title} with key expertise in ${skills.slice(0, 5).join(", ")}.`;
  }

  // Simple Experience parser (mocking out structured items)
  const experience: { role: string; company: string; duration?: string; description?: string }[] = [];
  
  // Look for Experience section
  const expIndex = lines.findIndex(l => 
    l.toLowerCase().includes("experience") || 
    l.toLowerCase().includes("employment") || 
    l.toLowerCase().includes("work history")
  );

  if (expIndex !== -1) {
    // Find some company/role pairs
    let count = 0;
    for (let i = expIndex + 1; i < lines.length && count < 3; i++) {
      const line = lines[i];
      // A company line often has format: "Role at Company" or "Company | Role" or contains words like "Inc.", "Co.", "Ltd"
      // or "Software Engineer" on one line and company on next
      const separatorMatch = line.match(/(.+?)\s+(?:-|\||at|@)\s+(.+)/);
      if (separatorMatch && separatorMatch[1].length < 40 && separatorMatch[2].length < 40) {
        experience.push({
          role: separatorMatch[1].trim(),
          company: separatorMatch[2].trim(),
          duration: "Present",
          description: lines[i+1] && lines[i+1].length > 30 ? lines[i+1] : "Responsibilities included developing, deploying, and maintaining core features."
        });
        count++;
        i += 2; // skip description
      }
    }
  }

  // No fallback experiences added to keep profile parsing accurate to the uploaded resume
  
  // Extract Education
  const education: string[] = [];
  const eduIndex = lines.findIndex(l => 
    l.toLowerCase().includes("education") || 
    l.toLowerCase().includes("academic") || 
    l.toLowerCase().includes("university") || 
    l.toLowerCase().includes("college")
  );
  if (eduIndex !== -1) {
    for (let i = eduIndex + 1; i < Math.min(lines.length, eduIndex + 4); i++) {
      const line = lines[i];
      if (line.length < 80 && (line.toLowerCase().includes("bachelor") || line.toLowerCase().includes("master") || line.toLowerCase().includes("bs") || line.toLowerCase().includes("ms") || line.toLowerCase().includes("university") || line.toLowerCase().includes("college") || line.toLowerCase().includes("institute"))) {
        education.push(line);
      }
    }
  }

  return {
    name,
    email,
    title,
    summary,
    skills,
    experience,
    education,
    rawText: text
  };
}
