package com.sabber.urdudictionary;

import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.InputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class OnlineFallbackTest {
    private JSONObject fixture(String name) throws Exception {
        try (InputStream input=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open(name)) {
            java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();
            byte[] buffer=new byte[4096];int n;
            while ((n=input.read(buffer))!=-1) out.write(buffer,0,n);
            return new JSONObject(new String(out.toByteArray(),StandardCharsets.UTF_8));
        }
    }
    private JSONObject entry(String word) throws Exception {
        return new JSONObject().put("word",word).put("entries",new JSONArray().put(new JSONObject()
                .put("language",new JSONObject().put("code","en"))
                .put("senses",new JSONArray().put(new JSONObject().put("definition","A greeting.")))));
    }
    @Test public void missingCapitalizedEntryRetriesLowercase() throws Exception {
        List<String> urls=new ArrayList<>();
        try (OnlineLookup lookup=new OnlineLookup(script -> {}) {
            @Override JSONObject get(String url,long request) throws Exception {
                urls.add(url);
                return url.contains("/Hello?")?new JSONObject().put("entries",new JSONArray()):entry("hello");
            }
        }) {
            assertEquals("hello",lookup.lookupEntry("Hello","en",0,"test").getString("word"));
            assertEquals(2,urls.size());assertTrue(urls.get(1).contains("/hello?"));
        }
    }
    @Test public void exactCaseMeaningsArePreserved() throws Exception {
        List<String> urls=new ArrayList<>();
        try (OnlineLookup lookup=new OnlineLookup(script -> {}) {
            @Override JSONObject get(String url,long request) throws Exception { urls.add(url);return entry("US"); }
        }) {
            assertEquals("US",lookup.lookupEntry("US","en",0,"test").getString("word"));assertEquals(1,urls.size());
        }
    }
    @Test public void failedPrimaryUsesUrduBackupAndStripsHtml() throws Exception {
        JSONObject backup=fixture("wiktionary-ur.json");
        try (OnlineLookup lookup=new OnlineLookup(script -> {}) {
            @Override JSONObject get(String url,long request) throws Exception {
                if (url.contains("freedictionaryapi.com")) throw new IOException("Simulated primary network failure");
                return backup;
            }
        }) {
            JSONObject result=lookup.lookupEntry("پانی","ur",0,"test");
            assertEquals("Wiktionary",result.getJSONObject("source").getString("provider"));
            JSONArray entries=result.getJSONArray("entries");assertTrue(entries.length()>0);
            for (int i=0;i<entries.length();i++) assertEquals("ur",entries.getJSONObject(i).getJSONObject("language").getString("code"));
            String definition=entries.getJSONObject(0).getJSONArray("senses").getJSONObject(0).getString("definition");
            assertEquals("water",definition);assertFalse(definition.contains("<"));
        }
    }
    @Test public void malformedPrimaryUsesEnglishBackup() throws Exception {
        JSONObject backup=fixture("wiktionary-en.json");
        try (OnlineLookup lookup=new OnlineLookup(script -> {}) {
            @Override JSONObject get(String url,long request) throws Exception {
                return url.contains("freedictionaryapi.com")?new JSONObject().put("unexpected",true):backup;
            }
        }) {
            JSONObject result=lookup.lookupEntry("hello","en",0,"test");
            assertEquals("Wiktionary",result.getJSONObject("source").getString("provider"));
            String text=result.getJSONArray("entries").getJSONObject(0).getJSONArray("senses").getJSONObject(0).getString("definition");
            assertTrue(text.contains("greeting"));assertFalse(text.contains("<a"));
        }
    }
    @Test public void nativeBackupConnectsWhenPrimaryIsUnavailable() throws Exception {
        try (OnlineLookup lookup=new OnlineLookup(script -> {}) {
            @Override JSONObject get(String url,long request) throws Exception {
                if (url.contains("freedictionaryapi.com")) throw new IOException("Simulated primary outage");
                return super.get(url,request);
            }
        }) {
            assertTrue(lookup.lookupEntry("hello","en",0,"test").getJSONArray("entries").length()>0);
            assertTrue(lookup.lookupEntry("پانی","ur",0,"test").getJSONArray("entries").length()>0);
        }
    }
}
