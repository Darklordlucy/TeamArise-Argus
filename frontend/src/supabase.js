import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[ArgusAI] Supabase env vars missing. ' +
    'Ensure REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_KEY are set in frontend/.env and restart the dev server.'
  )
}

// Guard: only create client when both values are present to avoid runtime crash
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

export default supabase
