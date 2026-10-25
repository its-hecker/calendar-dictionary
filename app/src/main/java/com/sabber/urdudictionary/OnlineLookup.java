package com.sabber.urdudictionary;

import android.webkit.JavascriptInterface;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicLong;
import javax.net.ssl.HttpsURLConnection;

/** Opt-in, bounded HTTPS requests. Remote pages never enter the bridged WebView. */
final class OnlineLookup implements AutoCloseable {
    private final DictionaryStore.PageCallback page;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final AtomicLong generation=new AtomicLong();
    private volatile HttpsURLConnection connection;
    private volatile boolean closed;
    private Future<?> pending;

    OnlineLookup(DictionaryStore.PageCallback page) { this.page=page; }

    private void reply(long request,String method,String token,Object value) {
        if (closed || generation.get()!=request) return;
        String payload=value instanceof String ? JSONObject.quote((String)value) : value.toString();
        page.evaluate("if(window.OnlineNative)OnlineNative."+method+"("
                +JSONObject.quote(token)+","+payload+");");
    }

    @JavascriptInterface
    public synchronized void cancel() {
        generation.incrementAndGet();
        HttpsURLConnection active=connection;
        if (active!=null) active.disconnect();
        if (pending!=null) pending.cancel(true);
    }

    private boolean validToken(String token) { return token!=null && token.matches("[a-z0-9-]{1,80}"); }
    private String encode(String value) { return android.net.Uri.encode(value); }

    @JavascriptInterface
    public synchronized void lookup(String query,String language,String token) {
        if (closed || !validToken(token)) return;
        cancel();
        final long request=generation.get();
        if (query==null || query.trim().isEmpty() || query.length()>80
                || !("en".equals(language)||"ur".equals(language))) {
            reply(request,"onError",token,"Enter an English or Urdu word, up to 80 characters.");
            return;
        }
        final String url="https://freedictionaryapi.com/api/v1/entries/"+language+"/"+encode(query.trim())+"?translations=true";
        pending=worker.submit(() -> {
            try { reply(request,"onLookup",token,get(url,request)); }
            catch (ProviderError error) { reply(request,"onError",token,error.getMessage()); }
            catch (Exception error) { reply(request,"onError",token,"Could not reach the online dictionary. Check your connection or use Offline."); }
        });
    }

    @JavascriptInterface
    public synchronized void translate(String text,String language,String token) {
        if (closed || !validToken(token)) return;
        cancel();
        final long request=generation.get();
        if (text==null || text.trim().isEmpty() || text.getBytes(StandardCharsets.UTF_8).length>500
                || !("en".equals(language)||"ur".equals(language))) {
            reply(request,"onError",token,"This example is too long to translate. Choose an example under 500 UTF-8 bytes.");
            return;
        }
        final String pair="en".equals(language)?"en|ur":"ur|en";
        final String url="https://api.mymemory.translated.net/get?q="+encode(text)+"&langpair="+encode(pair);
        pending=worker.submit(() -> {
            try {
                JSONObject result=get(url,request);
                if (result.optBoolean("quotaFinished") || result.optInt("responseStatus",500)==429)
                    throw new ProviderError("The translation service's free daily limit has been reached. Try again later; dictionary lookup and Offline still work.");
                if (result.optInt("responseStatus",500)!=200)
                    throw new ProviderError("The translation service could not translate this example. Try again later.");
                JSONObject response=result.optJSONObject("responseData");
                String translated=response==null?"":response.optString("translatedText","").trim();
                if (translated.isEmpty() || translated.length()>2000)
                    throw new ProviderError("No example translation was returned.");
                reply(request,"onTranslation",token,translated);
            } catch (ProviderError error) { reply(request,"onError",token,error.getMessage()); }
            catch (Exception error) { reply(request,"onError",token,"Could not connect to the example translation service. The original example is still available."); }
        });
    }

    private JSONObject get(String address,long request) throws Exception {
        if (closed || generation.get()!=request || Thread.currentThread().isInterrupted()) throw new IOException("Cancelled");
        URL url=new URL(address);
        if (!"https".equals(url.getProtocol()) || !("freedictionaryapi.com".equals(url.getHost())
                || "api.mymemory.translated.net".equals(url.getHost()))) throw new IOException("Unsupported endpoint");
        HttpsURLConnection active=(HttpsURLConnection)url.openConnection();
        connection=active;
        try {
            active.setConnectTimeout(8000);
            active.setReadTimeout(12000);
            active.setInstanceFollowRedirects(false);
            active.setRequestProperty("Accept","application/json");
            active.setRequestProperty("User-Agent","UrduDictionary/2.2 (Android; https://github.com/its-hecker/calendar-dictionary)");
            int code=active.getResponseCode();
            if (code==404) throw new ProviderError("No online entry was found. Try another spelling or search the offline library.");
            if (code==429) throw new ProviderError("The online service is busy or has reached its usage limit. Try again later or use Offline.");
            if (code!=200) throw new ProviderError("The online service is unavailable right now. Try again later or use Offline.");
            try (InputStream input=active.getInputStream(); ByteArrayOutputStream bytes=new ByteArrayOutputStream()) {
                byte[] buffer=new byte[8192];int count;
                while ((count=input.read(buffer))!=-1) {
                    if (closed || generation.get()!=request || Thread.currentThread().isInterrupted()) throw new IOException("Cancelled");
                    if (bytes.size()+count>1048576) throw new ProviderError("This entry is too large to load. Try a more specific word or use Offline.");
                    bytes.write(buffer,0,count);
                }
                return new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));
            }
        } finally {
            active.disconnect();
            if (connection==active) connection=null;
        }
    }

    private static final class ProviderError extends Exception {
        ProviderError(String message) { super(message); }
    }

    @Override
    public synchronized void close() {
        closed=true;cancel();worker.shutdownNow();
    }
}
