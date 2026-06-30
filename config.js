// ════════════════════════════════════════════════════
//  HealthHub · Configuration
//  Fill in your Supabase credentials below, then save.
//  Get these from: supabase.com → your project → Settings → API
// ════════════════════════════════════════════════════

const SUPABASE_URL = "https://oshuhhrvdmnsqvuavndu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zaHVoaHJ2ZG1uc3F2dWF2bmR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MzkwNzEsImV4cCI6MjA5ODExNTA3MX0.6xTkWRMVI1bJiEJquYpgsDfcXp47hU7W2kH7hwdtLP4";

// Do not edit below this line
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
