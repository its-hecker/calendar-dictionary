package com.sabber.urdudictionary;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Real APK, real JavaScript bridge and real HTTPS; no browser network shim. */
@RunWith(AndroidJUnit4.class)
public class OnlineWebViewTest {
    private Instrumentation instrumentation;
    private Activity activity;
    private WebView web;

    private WebView findWeb(View view) {
        if (view instanceof WebView) return (WebView)view;
        if (view instanceof ViewGroup) {
            ViewGroup group=(ViewGroup)view;
            for (int i=0;i<group.getChildCount();i++) {
                WebView found=findWeb(group.getChildAt(i));
                if (found!=null) return found;
            }
        }
        return null;
    }
    @Before public void launch() throws Exception {
        instrumentation=InstrumentationRegistry.getInstrumentation();
        Intent intent=new Intent(instrumentation.getTargetContext(),MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity=instrumentation.startActivitySync(intent);
        instrumentation.runOnMainSync(() -> web=findWeb(activity.findViewById(android.R.id.content)));
        assertNotNull(web);
        waitFor("typeof onlineSearch==='function'",15000);
        js("window.__smokeError='';window.addEventListener('error',e=>window.__smokeError=e.message);setMode('online');");
    }
    @After public void finish() { if (activity!=null) instrumentation.runOnMainSync(() -> activity.finish()); }
    private String js(String script) throws Exception {
        CountDownLatch done=new CountDownLatch(1);
        AtomicReference<String> value=new AtomicReference<>();
        instrumentation.runOnMainSync(() -> web.evaluateJavascript(script,result -> { value.set(result);done.countDown(); }));
        assertTrue("JavaScript evaluation timed out",done.await(5,TimeUnit.SECONDS));
        return value.get();
    }
    private void waitFor(String condition,long millis) throws Exception {
        long until=System.currentTimeMillis()+millis;
        while (System.currentTimeMillis()<until) {
            if ("true".equals(js(condition))) return;
            Thread.sleep(250);
        }
        fail("Timed out: "+condition+"; page: "+js("JSON.stringify({status:$('onlineStatus').textContent,error:$('msg').textContent,js:window.__smokeError,token:state.onlineToken})"));
    }
    private void lookup(String query) throws Exception {
        js("q.value="+JSONObject.quote(query)+";q.dispatchEvent(new Event('input'));$('searchOnline').click();");
        waitFor("!state.onlineToken",55000);
        assertEquals("Lookup failed for "+query+": "+js("$('msg').textContent"),"true",js("!!state.onlineItem?.senses?.length"));
        assertEquals("Search must be re-enabled","false",js("$('searchOnline').disabled"));
    }
    @Test public void englishLookupAndCachedReading() throws Exception {
        lookup("hello");
        js("openEntry(state.onlineItem.id)");
        assertEquals("true",js("$('entryDialog').open"));
        assertEquals("true",js("$('entryContent').textContent.includes('Wiktionary')"));
        js("$('entryDialog').close();setMode('offline');openEntry('online:en:hello');");
        assertEquals("true",js("$('entryDialog').open&&state.currentEntry.online"));
    }
    @Test public void urduLookup() throws Exception { lookup("پانی"); }
    @Test public void capitalizedWordLookup() throws Exception { lookup("Hello"); }
}
