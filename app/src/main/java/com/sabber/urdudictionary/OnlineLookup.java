package com.sabber.urdudictionary;

import android.webkit.JavascriptInterface;
import android.text.Html;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicLong;
import javax.net.ssl.HttpsURLConnection;

/** Opt-in, bounded HTTPS requests. Remote pages never enter the bridged WebView. */
public class OnlineLookup implements AutoCloseable {
    private final DictionaryStore.PageCallback page;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final ExecutorService cancellations=Executors.newSingleThreadExecutor();
    private final AtomicLong generation=new AtomicLong();
    private volatile HttpsURLConnection connection;
    private volatile boolean closed;
    private Future<?> pending;
    private volatile long deadline;

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
        connection=null;
        // A disconnect can wait for Android's socket lock; never do that on the JS bridge thread.
        if (active!=null && !cancellations.isShutdown()) cancellations.execute(active::disconnect);
        if (pending!=null) pending.cancel(true);
    }

    private boolean validToken(String token) { return token!=null && token.matches("[a-z0-9-]{1,80}"); }
    private String encode(String value) { return android.net.Uri.encode(value); }

    private void checkCurrent(long request) throws IOException {
        if (closed || generation.get()!=request || Thread.currentThread().isInterrupted()) throw new IOException("Cancelled");
        if (deadline>0 && System.nanoTime()>deadline) throw new SocketTimeoutException("Lookup timed out");
    }

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
        deadline=System.nanoTime()+java.util.concurrent.TimeUnit.SECONDS.toNanos(30);
        pending=worker.submit(() -> {
            try { reply(request,"onLookup",token,lookupEntry(query.trim(),language,request,token)); }
            catch (ProviderError error) { reply(request,"onError",token,error.getMessage()); }
            catch (Exception error) { reply(request,"onError",token,"Online lookup failed: "+reason(error)+". Check your connection or use Offline."); }
        });
    }

    /** Also exercised with controlled failures by the on-device regression tests. */
    JSONObject lookupEntry(String query,String language,long request,String token) throws Exception {
        String lower=query.toLowerCase(Locale.ROOT);
        String[] spellings="en".equals(language)&&!lower.equals(query)?new String[]{query,lower}:new String[]{query};
        Exception first=null,last=null;
        boolean onlyMissing=true;
        for (String spelling:spellings) {
            try {
                JSONObject result=get("https://freedictionaryapi.com/api/v1/entries/"+language+"/"+encode(spelling)+"?translations=true",request);
                if (hasMeanings(result,language)) return result;
                last=new ProviderError("No matching entry",true);
            } catch (Exception error) {
                checkCurrent(request);last=error;
                if (!(error instanceof ProviderError && ((ProviderError)error).missing)) { onlyMissing=false;break; }
            }
        }
        first=last;
        reply(request,"onStatus",token,"Trying the backup dictionary…");
        for (String spelling:spellings) {
            try {
                JSONObject result=fromWiktionary(get("https://en.wiktionary.org/api/rest_v1/page/definition/"+encode(spelling),request),spelling,language);
                if (hasMeanings(result,language)) return result;
                last=new ProviderError("No matching entry",true);
            } catch (Exception error) {
                checkCurrent(request);last=error;
                if (!(error instanceof ProviderError && ((ProviderError)error).missing)) { onlyMissing=false;break; }
            }
        }
        if (onlyMissing) throw new ProviderError("No online entry was found. Try another spelling or search the offline library.",true);
        throw new ProviderError("Could not load either online dictionary. FreeDictionaryAPI: "+reason(first)+"; Wiktionary: "+reason(last)+". Retry or use Offline.");
    }

    private static boolean hasDefinitions(JSONArray senses,int depth) {
        if (senses==null || depth>3) return false;
        for (int i=0;i<senses.length();i++) {
            JSONObject sense=senses.optJSONObject(i);
            if (sense!=null && (!sense.optString("definition").trim().isEmpty() || hasDefinitions(sense.optJSONArray("subsenses"),depth+1))) return true;
        }
        return false;
    }

    private static boolean hasMeanings(JSONObject result,String language) {
        JSONArray entries=result.optJSONArray("entries");
        if (entries==null) return false;
        for (int i=0;i<entries.length();i++) {
            JSONObject entry=entries.optJSONObject(i);
            JSONObject lang=entry==null?null:entry.optJSONObject("language");
            if (lang!=null && language.equals(lang.optString("code")) && hasDefinitions(entry.optJSONArray("senses"),0)) return true;
        }
        return false;
    }

    private static String plain(String html) {
        // Html.fromHtml produces text only and does not fetch or execute remote content.
        return Html.fromHtml(html,Html.FROM_HTML_MODE_LEGACY).toString().replaceAll("\\s+"," ").trim();
    }

    static JSONObject fromWiktionary(JSONObject payload,String word,String language) throws Exception {
        JSONArray entries=new JSONArray();
        java.util.Iterator<String> keys=payload.keys();
        while (keys.hasNext()) {
            JSONArray group=payload.optJSONArray(keys.next());
            if (group==null) continue;
            for (int i=0;i<group.length();i++) {
                JSONObject item=group.optJSONObject(i);
                String name=item==null?"":item.optString("language");
                if (!("en".equals(language)?"English":"Urdu").equalsIgnoreCase(name)) continue;
                JSONArray definitions=item.optJSONArray("definitions"),senses=new JSONArray();
                if (definitions!=null) for (int n=0;n<definitions.length() && n<48;n++) {
                    JSONObject definition=definitions.optJSONObject(n);
                    if (definition==null) continue;
                    String text=plain(definition.optString("definition"));
                    if (text.isEmpty()) continue;
                    JSONArray examples=new JSONArray(),raw=definition.optJSONArray("examples");
                    if (raw!=null) for (int e=0;e<raw.length() && e<2;e++) {
                        String example=plain(raw.optString(e));
                        if (!example.isEmpty()) examples.put(example);
                    }
                    senses.put(new JSONObject().put("definition",text).put("examples",examples));
                }
                entries.put(new JSONObject().put("language",new JSONObject().put("code",language).put("name",name))
                        .put("partOfSpeech",item.optString("partOfSpeech")).put("senses",senses));
            }
        }
        return new JSONObject().put("word",word).put("entries",entries).put("source",new JSONObject()
                .put("provider","Wiktionary").put("url","https://en.wiktionary.org/wiki/"+android.net.Uri.encode(word)+("ur".equals(language)?"#Urdu":"#English"))
                .put("license",new JSONObject().put("name","CC BY-SA 4.0").put("url","https://creativecommons.org/licenses/by-sa/4.0/")));
    }

    private static String reason(Exception error) {
        if (error instanceof SocketTimeoutException) return "connection timed out";
        if (error instanceof UnknownHostException) return "address could not be resolved";
        if (error instanceof javax.net.ssl.SSLException) return "secure connection failed; check the device date and network";
        if (error instanceof ProviderError) return error.getMessage();
        return "connection failed";
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
        deadline=System.nanoTime()+java.util.concurrent.TimeUnit.SECONDS.toNanos(20);
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

    JSONObject get(String address,long request) throws Exception {
        checkCurrent(request);
        URL url=new URL(address);
        if (!"https".equals(url.getProtocol()) || !("freedictionaryapi.com".equals(url.getHost())
                || "en.wiktionary.org".equals(url.getHost()) || "api.mymemory.translated.net".equals(url.getHost()))) throw new IOException("Unsupported endpoint");
        HttpsURLConnection active=(HttpsURLConnection)url.openConnection();
        connection=active;
        try {
            int remaining=deadline>0?(int)Math.max(1,java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(deadline-System.nanoTime())):12000;
            active.setConnectTimeout(Math.min(5000,remaining));
            active.setReadTimeout(Math.min(7000,remaining));
            active.setInstanceFollowRedirects(false);
            active.setRequestProperty("Accept","application/json");
            active.setRequestProperty("User-Agent","UrduDictionary/2.3 (Android; https://github.com/its-hecker/calendar-dictionary)");
            checkCurrent(request);
            int code=active.getResponseCode();
            checkCurrent(request);
            if (code==404) throw new ProviderError("No matching entry",true);
            if (code==429) throw new ProviderError("The online service is busy or has reached its usage limit. Try again later or use Offline.");
            if (code!=200) throw new ProviderError("HTTP "+code);
            String contentType=active.getContentType();
            if (contentType!=null && !contentType.toLowerCase(Locale.ROOT).contains("json")) throw new ProviderError("The service returned a web page instead of dictionary data");
            try (InputStream input=active.getInputStream(); ByteArrayOutputStream bytes=new ByteArrayOutputStream()) {
                byte[] buffer=new byte[8192];int count;
                while ((count=input.read(buffer))!=-1) {
                    checkCurrent(request);
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
        final boolean missing;
        ProviderError(String message) { this(message,false); }
        ProviderError(String message,boolean missing) { super(message);this.missing=missing; }
    }

    @Override
    public synchronized void close() {
        closed=true;cancel();worker.shutdownNow();cancellations.shutdown();
    }
}
