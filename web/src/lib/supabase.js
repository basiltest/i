import { createClient } from '@supabase/supabase-js';

const url = 'https://uyepkmdpakwkpqxsofoi.supabase.co/rest/v1/'; 


const key = ' eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZXBrbWRwYWt3a3BxeHNvZm9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMjE2NjksImV4cCI6MjA5NjU5NzY2OX0.ouew2xdbBNBVY1PDcNGK81HYP5A5ibspbkcM9BtUGEQ';

export const supabase = createClient(url, key);
