import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import UserProfile from "@/models/UserProfile";
import { parseResumeText } from "@/lib/resumeParser";
import { PDFParse } from "pdf-parse";
import { resolveUserId } from "@/lib/serverAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  ValidationError,
  reqString,
  optString,
  optStringArray,
} from "@/lib/validation";

const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5MB

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const auth = await resolveUserId(
    req,
    searchParams.get("userId") || req.headers.get("x-user-id") || "demo-user-123"
  );
  if (auth.errorResponse) return auth.errorResponse;
  const userId = auth.userId!;

  try {
    const db = await connectToDatabase();
    if (!db) {
      throw new Error("Database connection not established");
    }

    const profile = await UserProfile.findOne({ userId });

    if (!profile) {
      // Return a blank or default profile if none exists yet in DB
      return NextResponse.json({
        profile: {
          userId,
          name: "Guest Developer",
          title: "Full Stack Engineer",
          summary: "Upload your resume to get started with personalized matching.",
          skills: [],
          experience: [],
          education: [],
        }
      });
    }

    return NextResponse.json({ profile });
  } catch (dbError: any) {
    console.warn("Profile GET failed, falling back to guest profile/demo mode:", dbError);
    return NextResponse.json({
      profile: {
        userId,
        name: "Hiroshi Tanaka (Guest)",
        email: "guest@umbrix.io",
        title: "Full Stack Engineer",
        summary: "Database is currently offline. You are running in offline fallback mode.",
        skills: ["React", "TypeScript", "Next.js", "Node.js", "TailwindCSS", "Figma", "Git"],
        experience: [
          {
            role: "Senior Product Engineer",
            company: "NextGen UI",
            duration: "2023 - Present",
            description: "Architected and built glassmorphic design systems using React, TailwindCSS, and Framer Motion."
          }
        ],
        education: ["B.S. in Computer Science"],
      },
      isDemo: true
    });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await resolveUserId(req, req.headers.get("x-user-id") || "demo-user-123");
    if (auth.errorResponse) return auth.errorResponse;
    const userId = auth.userId!;

    const rl = await checkRateLimit("write", userId);
    if (!rl.ok) return rl.response;

    const body = await req.json();

    let update;
    try {
      update = {
        name: reqString(body.name, "name", 120),
        email: optString(body.email, "email", 254),
        title: optString(body.title, "title", 160),
        summary: optString(body.summary, "summary", 4000),
        skills: optStringArray(body.skills, "skills", 100, 60),
        education: optStringArray(body.education, "education", 50, 200),
        experience: validateExperience(body.experience),
      };
    } catch (e) {
      if (e instanceof ValidationError) {
        return NextResponse.json({ success: false, error: e.message }, { status: 400 });
      }
      throw e;
    }

    try {
      const db = await connectToDatabase();
      if (!db) {
        return NextResponse.json({ success: true, isDemo: true });
      }

      const profile = await UserProfile.findOneAndUpdate(
        { userId },
        update,
        { new: true, upsert: true, runValidators: true }
      );

      return NextResponse.json({ success: true, profile, isDemo: false });
    } catch (dbError: any) {
      console.warn("Profile PUT failed, falling back to demo mode:", dbError);
      return NextResponse.json({ success: true, isDemo: true });
    }
  } catch (error: any) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: error.message || "Failed to update profile" }, { status: 500 });
  }
}

/** Validates the experience array of { role, company, duration?, description? }. */
function validateExperience(value: unknown) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ValidationError("experience must be an array");
  if (value.length > 50) throw new ValidationError("experience may contain at most 50 items");
  return value.map((item, i) => {
    if (typeof item !== "object" || item === null) {
      throw new ValidationError(`experience[${i}] must be an object`);
    }
    const exp = item as Record<string, unknown>;
    return {
      role: reqString(exp.role, `experience[${i}].role`, 160),
      company: reqString(exp.company, `experience[${i}].company`, 160),
      duration: optString(exp.duration, `experience[${i}].duration`, 80),
      description: optString(exp.description, `experience[${i}].description`, 2000),
    };
  });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveUserId(req, req.headers.get("x-user-id") || "demo-user-123");
    if (auth.errorResponse) return auth.errorResponse;
    const userId = auth.userId!;

    // PDF parsing is CPU-heavy, so upload is the strictest-limited endpoint.
    const rl = await checkRateLimit("upload", userId);
    if (!rl.ok) return rl.response;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Server-side type + size checks (never trust the client-side gate).
    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 415 });
    }
    if (file.size > MAX_RESUME_BYTES) {
      return NextResponse.json({ error: "File exceeds the 5MB size limit" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Verify the PDF magic bytes ("%PDF-") to reject mislabeled/malicious files.
    if (buffer.length < 5 || buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return NextResponse.json({ error: "Uploaded file is not a valid PDF" }, { status: 415 });
    }

    // pdf-parse v2 bundles pdfjs and manages its worker internally (it explicitly
    // supports Next.js + Vercel), so no manual pdfjs-dist wiring is needed.
    const pdfParser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await pdfParser.getText();
    const parsedData = parseResumeText(textResult.text);

    // Create the profile object from parsed data
    const profileData = {
      userId,
      name: parsedData.name,
      email: parsedData.email || undefined,
      title: parsedData.title,
      summary: parsedData.summary,
      skills: parsedData.skills,
      experience: parsedData.experience,
      education: parsedData.education,
      rawText: parsedData.rawText,
    };

    try {
      // Connect to database
      const db = await connectToDatabase();
      if (!db) {
        console.log("Database connection not established, returning parsed profile in demo mode.");
        return NextResponse.json({ success: true, profile: profileData, isDemo: true });
      }

      // Save to database
      const profile = await UserProfile.findOneAndUpdate(
        { userId },
        profileData,
        { new: true, upsert: true }
      );

      return NextResponse.json({ success: true, profile, isDemo: false });
    } catch (dbError: any) {
      console.warn("Profile POST save failed, returning parsed profile in demo/offline mode:", dbError);
      return NextResponse.json({ success: true, profile: profileData, isDemo: true });
    }
  } catch (error: any) {
    console.error("Error parsing resume:", error);
    return NextResponse.json({ error: error.message || "Failed to parse resume" }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";
// pdf-parse relies on native @napi-rs/canvas, so this route must run on Node.js.
export const runtime = "nodejs";
