import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zovjcaarsrjzaiexftjw.supabase.co'
const supabasePublishableKey = 'sb_publishable_Ur4OcDJfHt5Lkwwl6Jj8AQ_-v2AS3Mh'

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
)
