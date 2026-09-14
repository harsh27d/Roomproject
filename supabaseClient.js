/**
 * Supabase Client Configuration & Live Database Sync
 * Permanently connected to RoomMate Supabase Backend: https://uqizibytsqnvxlaqhxon.supabase.co
 */

const SUPABASE_CONFIG = {
  URL: 'https://uqizibytsqnvxlaqhxon.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxaXppYnl0c3FudnhsYXFoeG9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzODExODYsImV4cCI6MjEwNDk1NzE4Nn0.4CS43qMU7MCRMjzLNgaWFKOwgpu8Mr84i01eRSeLduk'
};

let supabaseClient = null;

// Initialize Supabase client
function initSupabase() {
  if (typeof window.supabase !== 'undefined') {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
      console.log('⚡ Supabase Client Active:', SUPABASE_CONFIG.URL);
      return true;
    } catch (err) {
      console.warn('Supabase initialization warning:', err);
      return false;
    }
  }
  return false;
}

function isSupabaseConfigured() {
  if (!supabaseClient && typeof window !== 'undefined') {
    initSupabase();
  }
  return supabaseClient !== null;
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
    console.warn('sbSignUp error:', err);
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
    console.warn('sbSignIn error:', err);
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

/**
 * Ensures room exists in `rooms` table and registers the member in `room_members` table.
 */
async function sbCreateOrJoinRoom({ roomCode, roomName, userName, avatar, role }) {
  if (!isSupabaseConfigured()) return null;
  try {
    const cleanCode = roomCode.toUpperCase().trim();

    // 1. Check if room exists
    let { data: room, error: roomErr } = await supabaseClient
      .from('rooms')
      .select('*')
      .eq('room_code', cleanCode)
      .maybeSingle();

    if (!room) {
      // Create new room
      const { data: newRoom, error: createErr } = await supabaseClient
        .from('rooms')
        .insert([{
          room_code: cleanCode,
          room_name: roomName || `${userName}'s Room`,
          room_status: '🎧 Chill Vibe'
        }])
        .select()
        .single();

      if (createErr) throw createErr;
      room = newRoom;

      // Add initial activity log
      await supabaseClient.from('activity_logs').insert([{
        room_id: room.id,
        icon: '🏠',
        text: `Room created by <strong>${userName}</strong>`
      }]);
    }

    // 2. Add member to room_members if not already there
    const { data: existingMembers } = await supabaseClient
      .from('room_members')
      .select('*')
      .eq('room_id', room.id)
      .eq('name', userName);

    if (!existingMembers || existingMembers.length === 0) {
      await supabaseClient.from('room_members').insert([{
        room_id: room.id,
        name: userName,
        avatar: avatar || '👤',
        role: role || 'Member'
      }]);

      await supabaseClient.from('activity_logs').insert([{
        room_id: room.id,
        icon: '👤',
        text: `<strong>${userName}</strong> joined the room`
      }]);
    }

    return { success: true, room };
  } catch (err) {
    console.warn('sbCreateOrJoinRoom error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch full room details (expenses, chores, supplies, polls, announcements) from Supabase
 */
async function sbFetchRoomData(roomCode) {
  if (!isSupabaseConfigured()) return null;
  try {
    const cleanCode = (roomCode || '').toUpperCase().trim();
    if (!cleanCode) return null;

    const { data: room, error: roomErr } = await supabaseClient
      .from('rooms')
      .select('*')
      .eq('room_code', cleanCode)
      .maybeSingle();

    if (roomErr || !room) return null;

    const [membersRes, expensesRes, choresRes, suppliesRes, pollsRes, announcementsRes, activityRes] = await Promise.all([
      supabaseClient.from('room_members').select('*').eq('room_id', room.id),
      supabaseClient.from('expenses').select('*').eq('room_id', room.id).order('created_at', { ascending: false }),
      supabaseClient.from('chores').select('*').eq('room_id', room.id).order('created_at', { ascending: false }),
      supabaseClient.from('supplies').select('*').eq('room_id', room.id).order('created_at', { ascending: false }),
      supabaseClient.from('polls').select('*').eq('room_id', room.id).order('created_at', { ascending: false }),
      supabaseClient.from('announcements').select('*').eq('room_id', room.id).order('created_at', { ascending: false }),
      supabaseClient.from('activity_logs').select('*').eq('room_id', room.id).order('created_at', { ascending: false }).limit(25)
    ]);

    return {
      roomId: room.id,
      roomName: room.room_name,
      roomCode: room.room_code,
      roomStatus: room.room_status,
      roommates: (membersRes.data || []).map(m => m.name),
      expenses: (expensesRes.data || []).map(e => ({
        id: e.id,
        name: e.name,
        amount: parseFloat(e.amount),
        paidBy: e.paid_by,
        emoji: e.emoji || '🛒'
      })),
      tasks: (choresRes.data || []).map(c => ({
        id: c.id,
        name: c.name,
        priority: c.priority || 'med',
        assignee: c.assignee || 'Everyone',
        done: !!c.done
      })),
      supplies: (suppliesRes.data || []).map(s => ({
        id: s.id,
        name: s.name,
        cost: parseFloat(s.cost || 0),
        by: s.added_by,
        bought: !!s.bought
      })),
      polls: (pollsRes.data || []).map(p => ({
        id: p.id,
        question: p.question,
        by: p.created_by,
        opt1: p.opt1,
        votes1: p.votes1 || 0,
        opt2: p.opt2,
        votes2: p.votes2 || 0
      })),
      announcements: (announcementsRes.data || []).map(a => ({
        id: a.id,
        msg: a.message,
        type: a.type || 'info',
        by: a.posted_by,
        time: a.created_at
      })),
      activityLog: (activityRes.data || []).map(l => ({
        icon: l.icon || '📌',
        text: l.text,
        time: l.created_at
      }))
    };
  } catch (err) {
    console.warn('sbFetchRoomData error:', err);
    return null;
  }
}

// Add Expense to Supabase
async function sbAddExpense(roomCode, { name, amount, paidBy, emoji }) {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data: room } = await supabaseClient.from('rooms').select('id').eq('room_code', roomCode.toUpperCase()).single();
    if (!room) return null;

    const { data, error } = await supabaseClient.from('expenses').insert([{
      room_id: room.id,
      name,
      amount: parseFloat(amount),
      paid_by: paidBy,
      emoji: emoji || '🛒'
    }]).select().single();

    if (error) throw error;

    await supabaseClient.from('activity_logs').insert([{
      room_id: room.id,
      icon: '💸',
      text: `<strong>${paidBy}</strong> added ₹${amount} for ${name}`
    }]);

    return data;
  } catch (err) {
    console.warn('sbAddExpense error:', err);
    return null;
  }
}

// Add Chore to Supabase
async function sbAddChore(roomCode, { name, priority, assignee }) {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data: room } = await supabaseClient.from('rooms').select('id').eq('room_code', roomCode.toUpperCase()).single();
    if (!room) return null;

    const { data, error } = await supabaseClient.from('chores').insert([{
      room_id: room.id,
      name,
      priority: priority || 'med',
      assignee: assignee || 'Everyone',
      done: false
    }]).select().single();

    if (error) throw error;

    await supabaseClient.from('activity_logs').insert([{
      room_id: room.id,
      icon: '🧹',
      text: `New chore <strong>${name}</strong> assigned to ${assignee}`
    }]);

    return data;
  } catch (err) {
    console.warn('sbAddChore error:', err);
    return null;
  }
}

// Toggle Chore in Supabase
async function sbToggleChore(roomCode, choreName, isDone) {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data: room } = await supabaseClient.from('rooms').select('id').eq('room_code', roomCode.toUpperCase()).single();
    if (!room) return null;

    await supabaseClient.from('chores').update({ done: isDone }).eq('room_id', room.id).eq('name', choreName);
  } catch (err) {
    console.warn('sbToggleChore error:', err);
  }
}

// Add Supply item to Supabase
async function sbAddSupply(roomCode, { name, cost, by }) {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data: room } = await supabaseClient.from('rooms').select('id').eq('room_code', roomCode.toUpperCase()).single();
    if (!room) return null;

    const { data, error } = await supabaseClient.from('supplies').insert([{
      room_id: room.id,
      name,
      cost: parseFloat(cost || 0),
      added_by: by,
      bought: false
    }]).select().single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('sbAddSupply error:', err);
    return null;
  }
}

// Add Announcement to Supabase
async function sbAddAnnouncement(roomCode, { message, type, by }) {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data: room } = await supabaseClient.from('rooms').select('id').eq('room_code', roomCode.toUpperCase()).single();
    if (!room) return null;

    const { data, error } = await supabaseClient.from('announcements').insert([{
      room_id: room.id,
      message,
      type: type || 'info',
      posted_by: by
    }]).select().single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('sbAddAnnouncement error:', err);
    return null;
  }
}

// Add Poll to Supabase
async function sbAddPoll(roomCode, { question, opt1, opt2, by }) {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data: room } = await supabaseClient.from('rooms').select('id').eq('room_code', roomCode.toUpperCase()).single();
    if (!room) return null;

    const { data, error } = await supabaseClient.from('polls').insert([{
      room_id: room.id,
      question,
      opt1,
      votes1: 0,
      opt2,
      votes2: 0,
      created_by: by
    }]).select().single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('sbAddPoll error:', err);
    return null;
  }
}

// Initialize on script load
if (typeof window !== 'undefined') {
  initSupabase();
}
