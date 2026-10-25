// Keep the supplied page and its browser fallback; use Android speech inside the APK.
(function () {
  if (!window.AndroidVoice) return;

  say = function (text, language) {
    AndroidVoice.speak(String(text), language, '');
  };
  sayUr = function (text, roman) {
    AndroidVoice.speak(String(text), 'ur-PK', String(roman || ''));
  };

  const mic = document.getElementById('mic');
  let activeButton = null;
  let previousLabel = '';

  window.onAndroidSpeechResult = function (text, error) {
    if (activeButton) activeButton.textContent = previousLabel;
    activeButton = null;
    mic.querySelectorAll('button').forEach(button => { button.disabled = false; });
    msg(error || '');
    if (text) {
      q.value = text.trim();
      q.oninput();
    }
  };

  mic.onclick = function (event) {
    const button = event.target.closest('button');
    if (!button || activeButton) return;
    activeButton = button;
    previousLabel = button.textContent;
    button.textContent = '🎤 Listening…';
    mic.querySelectorAll('button').forEach(item => { item.disabled = true; });
    msg('');
    try {
      AndroidVoice.recognize(button.dataset.l);
    } catch (error) {
      window.onAndroidSpeechResult('', 'Voice input could not start. Please try again.');
    }
  };
}());
