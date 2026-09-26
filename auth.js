/**
 * RoomMate Authentication & LocalStorage State Manager
 * Handles user registration, login, session management, and persistent room data storage.
 */

const AUTH_KEYS = {
  USERS: 'roommate_users',
  SESSION: 'roommate_session',
  ROOM_PREFIX: 'roommate_data_'
};

// ===================== USER MANAGEMENT =====================
function getAllUsers() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEYS.USERS)) || [];
  } catch (e) {
    return [];
  }
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEYS.SESSION)) || null;
  } catch (e) {
    return null;
  }
}

async function registerUser({ name, email, password, roomName, roomCode, avatar }) {
  const users = getAllUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  const userAvatar = avatar || '👤';

  const generatedRoomCode = roomCode && roomCode.trim() 
    ? roomCode.trim().toUpperCase() 
    : 'ROOM-' + Math.floor(1000 + Math.random() * 9000);

  const finalRoomName = roomName && roomName.trim() ? roomName.trim() : `${cleanName}'s Room`;
  const userRole = roomCode && roomCode.trim() ? 'Member' : 'Admin';

  // 1. Try Supabase Auth Sign Up
  if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured()) {
    try {
      await sbSignUp(normalizedEmail, password, {
        name: cleanName,
        avatar: userAvatar,
        roomName: finalRoomName,
        roomCode: generatedRoomCode,
        role: userRole
      });
    } catch (err) {
      console.warn('Supabase auth warning during register:', err);
    }

    // 2. Insert Room & Member in Supabase tables
    if (typeof sbCreateOrJoinRoom === 'function') {
      try {
        await sbCreateOrJoinRoom({
          roomCode: generatedRoomCode,
          roomName: finalRoomName,
          userName: cleanName,
          avatar: userAvatar,
          role: userRole
        });
      } catch (err) {
        console.warn('Supabase room insert warning:', err);
      }
    }
  }

  if (users.some(u => u.email === normalizedEmail)) {
    return { success: false, message: 'An account with this email already exists locally.' };
  }

  const newUser = {
    id: 'user_' + Date.now(),
    name: cleanName,
    email: normalizedEmail,
    password: password,
    avatar: userAvatar,
    roomName: finalRoomName,
    roomCode: generatedRoomCode,
    role: userRole,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(users));

  // Initialize room data locally as well
  const existingRoom = getRoomStorage(generatedRoomCode);
  if (!existingRoom) {
    saveRoomStorage(generatedRoomCode, {
      roomName: finalRoomName,
      roomCode: generatedRoomCode,
      roomStatus: '🎧 Chill Vibe',
      roommates: [newUser.name],
      expenses: [],
      tasks: [],
      supplies: [],
      polls: [],
      announcements: [],
      activityLog: [{
        icon: '🏠',
        text: `Room created by <strong>${newUser.name}</strong>`,
        time: new Date()
      }]
    });
  } else {
    if (!existingRoom.roommates.includes(newUser.name)) {
      existingRoom.roommates.push(newUser.name);
      existingRoom.activityLog.unshift({
        icon: '👤',
        text: `<strong>${newUser.name}</strong> joined the room`,
        time: new Date()
      });
      saveRoomStorage(generatedRoomCode, existingRoom);
    }
  }

  setSession(newUser);
  return { success: true, user: newUser };
}

async function loginUser(email, password) {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Try Supabase Cloud Sign In
  if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured()) {
    const sbRes = await sbSignIn(normalizedEmail, password);
    if (sbRes && sbRes.success && sbRes.data && sbRes.data.user) {
      const meta = sbRes.data.user.user_metadata || {};
      const userName = meta.name || normalizedEmail.split('@')[0];
      const roomCode = (meta.roomCode || 'ROOM-1001').toUpperCase();
      const roomName = meta.roomName || `${userName}'s Room`;
      const avatar = meta.avatar || '😎';
      const role = meta.role || 'Member';

      const user = {
        id: sbRes.data.user.id,
        name: userName,
        email: normalizedEmail,
        avatar,
        roomName,
        roomCode,
        role
      };

      // Add to local storage users list if missing
      const users = getAllUsers();
      if (!users.some(u => u.email === normalizedEmail)) {
        users.push({ ...user, password });
        localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(users));
      }

      // Ensure room is synced in background
      if (typeof sbCreateOrJoinRoom === 'function') {
        sbCreateOrJoinRoom({ roomCode, roomName, userName, avatar, role }).catch(() => {});
      }

      setSession(user);
      return { success: true, user };
    } else if (sbRes && !sbRes.success) {
      const errMsg = sbRes.error || '';
      if (errMsg.toLowerCase().includes('email not confirmed')) {
        return {
          success: false,
          message: 'Supabase email confirmation is enabled. Please confirm the link sent to your email, or turn off "Confirm Email" in Supabase Auth settings!'
        };
      }
    }
  }

  // 2. Fallback to Local Storage Users
  const users = getAllUsers();
  const user = users.find(u => u.email === normalizedEmail && u.password === password);

  if (!user) {
    return { success: false, message: 'Invalid email or password. Please check your credentials or create an account.' };
  }

  setSession(user);
  return { success: true, user };
}

function setSession(user) {
  const sessionData = {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    roomName: user.roomName,
    roomCode: user.roomCode,
    role: user.role
  };
  localStorage.setItem(AUTH_KEYS.SESSION, JSON.stringify(sessionData));
}

async function logoutUser() {
  if (typeof sbSignOut === 'function') {
    await sbSignOut();
  }
  localStorage.removeItem(AUTH_KEYS.SESSION);
  window.location.reload();
}

// ===================== ROOM STORAGE MANAGER =====================
function getRoomStorage(roomCode) {
  if (!roomCode) return null;
  try {
    const data = localStorage.getItem(AUTH_KEYS.ROOM_PREFIX + roomCode.toUpperCase());
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

function saveRoomStorage(roomCode, data) {
  if (!roomCode || !data) return;
  try {
    localStorage.setItem(AUTH_KEYS.ROOM_PREFIX + roomCode.toUpperCase(), JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save room storage', e);
  }
}

// ===================== NAVBAR AUTH RENDERER =====================
function renderNavbarAuth() {
  const authContainer = document.querySelector('.navbar-cta');
  if (!authContainer) return;

  const user = getCurrentUser();

  if (user) {
    authContainer.innerHTML = `
      <div class="user-nav-profile" style="position:relative; display:flex; align-items:center; gap:10px;">
        <div class="user-avatar-btn" id="userMenuBtn" style="display:flex; align-items:center; gap:8px; padding:6px 14px; background:rgba(255,255,255,0.06); border:1px solid var(--card-border); border-radius:30px; cursor:pointer; transition:0.3s;">
          <span style="font-size:1.1rem;">${user.avatar || '👤'}</span>
          <span style="font-size:0.9rem; font-weight:600; color:#fff;">${user.name.split(' ')[0]}</span>
          <span style="font-size:0.75rem; color:var(--text-muted);">▾</span>
        </div>

        <div class="user-dropdown-menu" id="userDropdownMenu" style="display:none; position:absolute; top:calc(100% + 10px); right:0; width:220px; background:var(--dark-bg-2); border:1px solid var(--card-border); border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5); padding:12px; z-index:1001; animation:fadeInUp 0.2s ease;">
          <div style="padding-bottom:10px; border-bottom:1px solid var(--card-border); margin-bottom:8px;">
            <div style="font-weight:700; color:#fff; font-size:0.95rem;">${user.name}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${user.email}</div>
            <div style="display:inline-block; font-size:0.7rem; font-weight:600; color:var(--accent); background:rgba(0,212,170,0.1); padding:2px 8px; border-radius:4px; margin-top:6px;">
              🏠 ${user.roomCode} (${user.role})
            </div>
          </div>
          <a href="features.html#room-hub" style="display:flex; align-items:center; gap:8px; padding:8px; color:var(--text-secondary); font-size:0.85rem; border-radius:6px; text-decoration:none; transition:0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#fff';" onmouseout="this.style.background='transparent'; this.style.color='var(--text-secondary)';">
            <span>⚡</span> Room Workspace
          </a>
          <button onclick="logoutUser()" style="width:100%; display:flex; align-items:center; gap:8px; padding:8px; color:#ff6b6b; font-size:0.85rem; background:transparent; border:none; border-radius:6px; cursor:pointer; text-align:left; transition:0.2s; font-family:'Outfit',sans-serif;" onmouseover="this.style.background='rgba(255,107,107,0.1)';" onmouseout="this.style.background='transparent';">
            <span>🚪</span> Sign Out
          </button>
        </div>
      </div>
    `;

    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdownMenu = document.getElementById('userDropdownMenu');

    if (userMenuBtn && userDropdownMenu) {
      userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = userDropdownMenu.style.display === 'block';
        userDropdownMenu.style.display = isOpen ? 'none' : 'block';
      });

      document.addEventListener('click', () => {
        userDropdownMenu.style.display = 'none';
      });
    }
  } else {
    authContainer.innerHTML = `
      <a href="auth.html" class="btn btn-outline" style="padding: 8px 18px; font-size: 0.85rem;">Log In</a>
      <a href="auth.html?tab=signup" class="btn btn-primary" style="padding: 8px 20px; font-size: 0.85rem;">Register</a>
    `;
  }
}

// Automatically render on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  renderNavbarAuth();
});
