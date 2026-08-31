// Vercel Serverless Function to expose configuration
export default function handler(req, res) {
  res.status(200).json({
    supabaseUrl: process.env.VAACHAN_SUPABASE_URL || "",
    supabaseKey: process.env.VAACHAN_SUPABASE_KEY || ""
  });
}
