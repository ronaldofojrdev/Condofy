import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

export function getSupabaseClient() {
	const supabaseUrl = env.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
	const supabaseAnonKey = env.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

	if (!supabaseUrl || !supabaseAnonKey) {
		return null;
	}

	return createClient(supabaseUrl, supabaseAnonKey, {
		auth: {
			persistSession: false,
			autoRefreshToken: false
		}
	});
}
