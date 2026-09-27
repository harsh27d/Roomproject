document.addEventListener('DOMContentLoaded', () => {
  const chatHistory = document.getElementById('chat-history');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const matchModal = document.getElementById('match-modal');

  let step = 0;

  const questions = [
    "Got it! Do you prefer hosting friends often, or keeping the space strictly quiet and private?",
    "Nice! One last question: how strict are you about chores on a scale of 1 to 10?",
    "Perfect! Give me a few seconds while I analyze thousands of profiles..."
  ];

  function scrollToBottom() {
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  function addMessage(text, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    
    msgDiv.innerHTML = `
      <div class="avatar">${isUser ? 'U' : '🤖'}</div>
      <div class="bubble">${text}</div>
    `;
    
    chatHistory.appendChild(msgDiv);
    scrollToBottom();
  }

  function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai-message typing';
    typingDiv.id = 'typing-indicator';
    
    typingDiv.innerHTML = `
      <div class="avatar">🤖</div>
      <div class="bubble typing-indicator">
        <span></span><span></span><span></span>
      </div>
    `;
    
    chatHistory.appendChild(typingDiv);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    const typingDiv = document.getElementById('typing-indicator');
    if (typingDiv) typingDiv.remove();
  }

  function handleSend() {
    const text = chatInput.value.trim();
    if (!text) return;

    // Add user message
    addMessage(text, true);
    chatInput.value = '';
    
    // Disable input while AI replies
    chatInput.disabled = true;
    sendBtn.disabled = true;

    // AI typing...
    setTimeout(() => {
      showTypingIndicator();
      
      setTimeout(() => {
        removeTypingIndicator();
        
        if (step < questions.length) {
          addMessage(questions[step]);
          step++;
          chatInput.disabled = false;
          sendBtn.disabled = false;
          chatInput.focus();
          
          if (step === questions.length) {
             // Simulate searching and showing modal
             setTimeout(() => {
               showTypingIndicator();
               setTimeout(() => {
                 removeTypingIndicator();
                 addMessage("I found an incredible match for you! Meet Alex.");
                 setTimeout(() => {
                   matchModal.classList.add('show');
                 }, 1000);
               }, 2000);
             }, 1000);
          }
        }
      }, 1500 + Math.random() * 1000);
    }, 500);
  }

  sendBtn.addEventListener('click', handleSend);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSend();
  });
});
