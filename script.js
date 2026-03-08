addEventListener('DOMContentLoaded', () => {
  const screens = document.querySelectorAll('.screen');
  const loginScreen = document.getElementById('login-screen');
  const mainScreen = document.getElementById('main-screen');
  const loginForm = document.getElementById('login-form');
  const logoutBtn = document.getElementById('logout');

  function showScreen(screenId) {
    screens.forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  }

  // Check if already logged in
  if (localStorage.getItem('fitUser')) {
    showScreen('main-screen');
  } else {
    showScreen('login-screen');
  }

  // Login handler
  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    if (username) {
      localStorage.setItem('fitUser', username);
      showScreen('main-screen');
      // Optional: reset form or show welcome
      alert(`Welcome, ${username}!`);
    } else {
      alert('Please enter a username');
    }
  });

  // Logout
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      localStorage.removeItem('fitUser');
      showScreen('login-screen');
    };
  }

  // ... rest of your code (profile, dashboard, workout, music, etc.)
});