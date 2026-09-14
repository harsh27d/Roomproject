/**
 * Supabase Client Configuration & Database Helpers
 * Plug in your Supabase project credentials below or set them via the in-app settings modal.
 */

const SUPABASE_CONFIG = {
  // Replace these with your Supabase Project URL and Anon API Key
  URL: localStorage.getItem('supabase_url') || 'https://your-project-id.supabase.co',
  ANON_KEY: localStorage.getItem('supabase_anon_key') || 'your-anon-public-key-here'
};

let supabaseClient = null;

// Initialize Supabase if library is available
function initSupabase() {
  if (typeof window.supabase !== 'undefined' && SUPABASE_CONFIG.URL !== 'https://your-project-id.supabase.co') {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
      console.log('⚡ Supabase Client Initialized Successfully');
      return true;
    } catch (err) {
      console.warn('Supabase initialization failed, running in local mode:', err);
      return false;
    }
  }
  return false;
}

// Check if Supabase is active
function isSupabaseConfigured() {
  return supabaseClient !== null;
}

// Update Supabase keys dynamically
function setSupabaseKeys(url, anonKey) {
  if (!url || !anonKey) return false;
  localStorage.setItem('supabase_url', url.trim());
  localStorage.setItem('supabase_anon_key', anonKey.trim());
  SUPABASE_CONFIG.URL = url.trim();
  SUPABASE_CONFIG.ANON_KEY = anonKey.trim();
  return initSupabase();
}

// ===================== SUPABASE AUTH HELPERS =====================
async function sbSignUp(email, password, metadata) {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: {
        data: metadata
      }
    });
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function sbSignIn(email, password) {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function sbSignOut() {
  if (!isSupabaseConfigured()) return null;
  try {
    await supabaseClient.auth.signOut();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ===================== SUPABASE DATABASE SYNC HELPERS =====================
async function sbFetchRoomData(roomCode) {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data: room, error: roomErr } = await supabaseClient
      .from('rooms')
      .select('*')
      .eq('room_code', roomCode)
      .single();

    if (roomErr) throw roomErr;

    // Fetch related tables
    const [members, expenses, chores, supplies, polls, announcements, activity] = await Promise.all([
      supabaseClient.from('room_members').select('*').eq('room_id', room.id),
      supabaseClient.from('expenses').select('*').eq('room_id', room.id).order('created_at', { ascending: false }),
      supabaseClient.from('chores').select('*').eq('room_id', room.id).order('created_at', { ascending: false }),
      supabaseClient.from('supplies').select('*').eq('room_id', room.id).order('created_at', { ascending: false }),
      supabaseClient.from('polls').select('*').eq('room_id', room.id).order('created_at', { ascending: false }),
      supabaseClient.from('announcements').select('*').eq('room_id', room.id).order('created_at', { ascending: false }),
      supabaseClient.from('activity_logs').select('*').eq('room_id', room.id).order('created_at', { ascending: false }).limit(20)
    ]);

    return {
      roomName: room.room_name,
      roomCode: room.room_code,
      roomStatus: room.room_status,
      roommates: (members.data || []).map(m => m.name),
      expenses: (expenses.data || []).map(e => ({ name: e.name, amount: e.amount, paidBy: e.paid_by, emoji: e.emoji })),
      tasks: (chores.data || []).map(c => ({ name: c.name, priority: c.priority, assignee: c.assignee, done: c.done })),
      supplies: (supplies.data || []).map(s => ({ name: s.name, cost: s.cost, by: s.added_by, bought: s.bought })),
      polls: (polls.data || []).map(p => ({ id: p.id, question: p.question, by: p.created_by, opt1: p.opt1, votes1: p.votes1, opt2: p.opt2, votes2: p.votes2 })),
      announcements: (announcements.data || []).map(a => ({ msg: a.message, type: a.type, by: a.posted_by, time: a.created_at })),
      activityLog: (activity.data || []).map(l => ({ icon: l.icon, text: l.text, time: l.created_at }))
    };
  } catch (err) {
    console.warn('Supabase fetch failed:', err);
    return null;
  }
}

// Initialize on script load
if (typeof window !== 'undefined') {
  initSupabase();
}
