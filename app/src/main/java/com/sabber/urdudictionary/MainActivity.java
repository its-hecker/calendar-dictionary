package com.sabber.urdudictionary;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.sabber.offline.OfflineActivity;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Locale;
import java.util.Set;

/** Native speech adapter for the supplied offline dictionary page. */
public class MainActivity extends OfflineActivity {
    private static final int VOICE_REQUEST = 100;
    private TextToSpeech tts;
    private boolean ttsReady;
    private boolean ttsFailed;
    private boolean recognizing;
    private String[] pendingSpeech;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        tts = new TextToSpeech(this, status -> runOnUiThread(() -> {
            if (isDestroyed()) return;
            ttsReady = status == TextToSpeech.SUCCESS;
            ttsFailed = !ttsReady;
            if (pendingSpeech != null) {
                String[] pending = pendingSpeech;
                pendingSpeech = null;
                speak(pending[0], pending[1], pending[2]);
            }
        }));
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { }
            @Override public void onDone(String id) { }
            @Override public void onError(String id) {
                message("Could not play audio. Check media volume and installed text-to-speech voices.");
            }
        });
    }

    @Override
    protected void configureWebView(WebView view) {
        view.addJavascriptInterface(new VoiceBridge(), "AndroidVoice");
    }

    private void message(String text) {
        evaluatePage("if (typeof msg === 'function') msg(" + JSONObject.quote(text) + ");");
    }

    private void speak(String text, String language, String roman) {
        if (!ttsReady) {
            if (ttsFailed) {
                message("No text-to-speech engine is available. Enable one in Android settings.");
            } else {
                pendingSpeech = new String[]{text, language, roman};
            }
            return;
        }
        Locale locale = Locale.forLanguageTag(language);
        if (tts.isLanguageAvailable(locale) < TextToSpeech.LANG_AVAILABLE
                && language.startsWith("ur") && !roman.isEmpty()) {
            // Preserve the supplied page's Roman/Hindi fallback when Urdu is unavailable.
            locale = Locale.forLanguageTag("hi-IN");
            text = roman;
        }
        if (tts.setLanguage(locale) < TextToSpeech.LANG_AVAILABLE) {
            message("A voice for this language is unavailable. Download it in Android text-to-speech settings.");
            return;
        }
        Set<Voice> voices = tts.getVoices();
        if (voices != null) {
            for (Voice voice : voices) {
                if (voice.getLocale().getLanguage().equals(locale.getLanguage())
                        && !voice.isNetworkConnectionRequired()) {
                    tts.setVoice(voice);
                    break;
                }
            }
        }
        message("");
        tts.setSpeechRate(0.9f);
        if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "dictionary") == TextToSpeech.ERROR) {
            message("Could not play audio. Check media volume and text-to-speech settings.");
        }
    }

    private void recognize(String language) {
        if (recognizing) return;
        recognizing = true;
        if (tts != null) tts.stop();
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT,
                "ur-PK".equals(language) ? "اردو میں لفظ بولیں" : "Say an English word");
        try {
            // The speech app owns the microphone and its permission prompt.
            startActivityForResult(intent, VOICE_REQUEST);
        } catch (ActivityNotFoundException | SecurityException error) {
            recognizing = false;
            speechResult("", "Voice input is unavailable. Enable an Android speech recognition app.");
        }
    }

    private void speechResult(String text, String error) {
        evaluatePage("if (window.onAndroidSpeechResult) window.onAndroidSpeechResult("
                + JSONObject.quote(text) + "," + JSONObject.quote(error) + ");");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != VOICE_REQUEST) return;
        recognizing = false;
        if (resultCode != RESULT_OK || data == null) {
            speechResult("", "");
            return;
        }
        ArrayList<String> results = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        if (results == null || results.isEmpty() || results.get(0) == null) {
            speechResult("", "No speech recognized. Please try again.");
        } else {
            speechResult(results.get(0).trim(), "");
        }
    }

    @Override
    protected void onStop() {
        if (tts != null) tts.stop();
        pendingSpeech = null;
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        pendingSpeech = null;
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
        super.onDestroy();
    }

    public final class VoiceBridge {
        @JavascriptInterface
        public void speak(String text, String language, String roman) {
            if (text == null || language == null || text.length() > TextToSpeech.getMaxSpeechInputLength()) return;
            if (!"ur-PK".equals(language) && !"en-US".equals(language)) return;
            String fallback = roman == null ? "" : roman;
            if (fallback.length() > TextToSpeech.getMaxSpeechInputLength()) return;
            runOnUiThread(() -> {
                if (!isDestroyed() && !isFinishing()) MainActivity.this.speak(text, language, fallback);
            });
        }

        @JavascriptInterface
        public void recognize(String language) {
            if (!"ur-PK".equals(language) && !"en-US".equals(language)) return;
            runOnUiThread(() -> {
                if (!isDestroyed() && !isFinishing()) MainActivity.this.recognize(language);
            });
        }
    }
}
