package com.sabber.urdudictionary;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.ByteArrayOutputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.util.Locale;
import java.util.ArrayList;
import java.util.Collections;
import java.io.SequenceInputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.GZIPInputStream;

/** Read-only indexed dictionary. Installation and queries run away from the UI thread. */
final class DictionaryStore implements AutoCloseable {
    interface PageCallback { void evaluate(String javascript); }
    private final Context context;
    private final PageCallback page;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private SQLiteDatabase database;
    private SQLiteDatabase examplesDatabase;
    private JSONObject metadata;
    private volatile boolean closed;

    DictionaryStore(Context context, PageCallback page) {
        this.context = context.getApplicationContext();
        this.page = page;
    }

    private void reply(String method, Object... args) {
        if (closed) return;
        StringBuilder js = new StringBuilder("if(window.DictionaryNative)DictionaryNative.").append(method).append('(');
        for (int i=0; i<args.length; i++) {
            if (i>0) js.append(',');
            Object value=args[i];
            js.append(value instanceof String ? JSONObject.quote((String)value) : String.valueOf(value));
        }
        page.evaluate(js.append(");").toString());
    }

    private void task(String token, Runnable job) {
        if (closed || token == null || token.length()>80) return;
        worker.execute(() -> {
            if (closed) return;
            try {
                ensureDatabase();
                if (!closed) job.run();
            } catch (Exception error) {
                reply("onError",token,"The offline library could not be opened. Please try again.");
            }
        });
    }

    private void ensureDatabase() throws Exception {
        if (database != null && examplesDatabase != null) return;
        if (metadata == null) metadata=assetJson("data/metadata.json");
        if (database == null) {
            File file=installDatabase("lexicon-v2",metadata,this::compressedAssets,true);
            database=SQLiteDatabase.openDatabase(file.getPath(),null,
                    SQLiteDatabase.OPEN_READONLY|SQLiteDatabase.NO_LOCALIZED_COLLATORS);
        }
        if (examplesDatabase == null) {
            JSONObject info=assetJson("data/examples-metadata.json");
            File file=installDatabase("examples-v1",info,
                    () -> context.getAssets().open("data/examples.db.gz"),false);
            examplesDatabase=SQLiteDatabase.openDatabase(file.getPath(),null,
                    SQLiteDatabase.OPEN_READONLY|SQLiteDatabase.NO_LOCALIZED_COLLATORS);
            metadata.put("examples",info);
        }
    }

    private JSONObject assetJson(String path) throws Exception {
        try (InputStream input=context.getAssets().open(path)) {
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            byte[] buffer=new byte[4096];
            int count;
            while ((count=input.read(buffer))!=-1) bytes.write(buffer,0,count);
            return new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));
        }
    }

    private interface CompressedData { InputStream open() throws Exception; }

    private File installDatabase(String prefix,JSONObject info,CompressedData source,boolean showProgress) throws Exception {
        String expected=info.getString("databaseSha256");
        File file=new File(context.getNoBackupFilesDir(),prefix+"-"+expected.substring(0,12)+".db");
        if (!file.exists()) {
            File temporary=new File(file.getPath()+".tmp");
            MessageDigest digest=MessageDigest.getInstance("SHA-256");
            long total=info.getLong("databaseBytes"), written=0, lastProgress=0;
            try (InputStream input=new GZIPInputStream(source.open());
                    FileOutputStream output=new FileOutputStream(temporary)) {
                byte[] buffer=new byte[65536];
                int count;
                while ((count=input.read(buffer))!=-1) {
                    if (closed) throw new java.io.IOException("Activity closed");
                    output.write(buffer,0,count);
                    digest.update(buffer,0,count);
                    written+=count;
                    if (showProgress && written-lastProgress>4*1024*1024) {
                        reply("onProgress",Math.min(99,written*100/total));
                        lastProgress=written;
                    }
                }
                output.getFD().sync();
            } catch (Exception error) {
                temporary.delete();
                throw error;
            }
            StringBuilder actual=new StringBuilder();
            for (byte value:digest.digest()) actual.append(String.format(Locale.ROOT,"%02x",value&255));
            if (!expected.contentEquals(actual) || written!=total || !temporary.renameTo(file)) {
                temporary.delete();
                throw new java.io.IOException("Invalid dictionary asset");
            }
        }
        return file;
    }

    private InputStream compressedAssets() throws Exception {
        JSONArray parts=metadata.getJSONArray("parts");
        ArrayList<InputStream> streams=new ArrayList<>();
        try {
            for (int i=0;i<parts.length();i++) streams.add(context.getAssets().open("data/"+parts.getString(i)));
            return new SequenceInputStream(Collections.enumeration(streams));
        } catch (Exception error) {
            for (InputStream stream:streams) stream.close();
            throw error;
        }
    }

    static String normalize(String input) {
        return Normalizer.normalize(input,Normalizer.Form.NFKD).toLowerCase(Locale.ROOT)
                .replaceAll("\\p{M}+","")
                .replace('ي','ی').replace('ى','ی').replace('ك','ک')
                .replace("ـ","").replace('’','\'').replace('‘','\'')
                .replaceAll("\\s+"," ").trim();
    }

    private JSONObject summary(Cursor cursor) throws Exception {
        JSONObject item=new JSONObject();
        String[] columns={"id","word","ur","roman","pos","preview","kind"};
        for (int i=0;i<columns.length;i++) item.put(columns[i],cursor.getString(i));
        return item;
    }

    private String kindClause(String filter) {
        return "bilingual".equals(filter) ? " AND e.kind='ur'" : "english".equals(filter) ? " AND e.kind='en'" : "";
    }

    @JavascriptInterface
    public void init() {
        task("init",() -> reply("onReady",metadata));
    }

    @JavascriptInterface
    public void search(String query,String filter,String token,int offset) {
        if (query==null || query.length()>160 || offset<0 || offset>300000) return;
        final String text=normalize(query);
        task(token,() -> {
            try {
                JSONArray items=new JSONArray();
                String columns="e.id,e.word,e.ur,e.roman,e.pos,e.preview,e.kind";
                String sql;
                String[] values;
                if (text.isEmpty()) {
                    sql="SELECT "+columns+" FROM entries e WHERE 1=1"+kindClause(filter)
                            +" ORDER BY e.sort_key LIMIT 31 OFFSET ?";
                    values=new String[]{String.valueOf(offset)};
                } else {
                    sql="SELECT "+columns+" FROM lookup l JOIN entries e ON e.id=l.id"
                            +" WHERE l.key>=? AND l.key<?"+kindClause(filter)
                            +" GROUP BY e.id ORDER BY MIN(CASE WHEN l.key=? THEN 0 ELSE 1 END),"
                            +"MIN(l.rank),CASE WHEN e.kind='ur' THEN 0 ELSE 1 END,LENGTH(e.word),e.word LIMIT 31 OFFSET ?";
                    values=new String[]{text,text+'\uffff',text,String.valueOf(offset)};
                }
                boolean more;
                try (Cursor cursor=database.rawQuery(sql,values)) {
                    while (cursor.moveToNext() && items.length()<30) items.put(summary(cursor));
                    more=cursor.getCount()>30;
                }
                // Retain the original page's Urdu substring matching when no prefix matches.
                if (items.length()==0 && !"english".equals(filter)
                        && text.matches(".*[\\u0600-\\u06ff].*")) {
                    try (Cursor cursor=database.rawQuery("SELECT "+columns
                            +" FROM entries e WHERE e.kind='ur' AND instr(e.sort_key,?)>0"
                            +" ORDER BY LENGTH(e.word),e.word LIMIT 31 OFFSET ?",
                            new String[]{text,String.valueOf(offset)})) {
                        while (cursor.moveToNext() && items.length()<30) items.put(summary(cursor));
                        more=cursor.getCount()>30;
                    }
                }
                reply("onResults",token,items,more,offset);
            } catch (Exception error) { reply("onError",token,"Search could not finish. Please try again."); }
        });
    }

    @JavascriptInterface
    public void entry(String id,String token) {
        if (id==null || id.length()>256) return;
        task(token,() -> {
            try (Cursor cursor=database.rawQuery("SELECT data FROM entries WHERE id=?",new String[]{id})) {
                if (cursor.moveToFirst()) {
                    JSONObject entry=new JSONObject(cursor.getString(0));
                    entry.put("bilingualExamples",examples(id));
                    reply("onEntry",token,entry);
                }
                else reply("onError",token,"This word is not in this library version.");
            } catch (Exception error) { reply("onError",token,"This entry could not be opened."); }
        });
    }

    private JSONArray examples(String id) throws Exception {
        JSONArray items=new JSONArray();
        try (Cursor cursor=examplesDatabase.rawQuery(
                "SELECT x.data FROM entry_examples l JOIN examples x ON x.id=l.example_id"
                +" WHERE l.entry_id=? ORDER BY l.rank LIMIT 5",new String[]{id})) {
            while (cursor.moveToNext()) items.put(new JSONObject(cursor.getString(0)));
        }
        return items;
    }

    @JavascriptInterface
    public void daily(int day,String token) {
        task(token,() -> {
            try {
                int offset=Math.floorMod(day,metadata.getInt("urduHeadwords"));
                try (Cursor cursor=database.rawQuery("SELECT data FROM entries WHERE kind='ur' ORDER BY sort_key LIMIT 1 OFFSET ?",
                        new String[]{String.valueOf(offset)})) {
                    if (cursor.moveToFirst()) reply("onEntry",token,new JSONObject(cursor.getString(0)));
                }
            } catch (Exception error) { reply("onError",token,"The daily word could not be opened."); }
        });
    }

    @JavascriptInterface
    public void summaries(String jsonIds,String token) {
        if (jsonIds==null || jsonIds.length()>200000) return;
        task(token,() -> {
            try {
                JSONArray ids=new JSONArray(jsonIds),items=new JSONArray();
                for (int i=0;i<Math.min(ids.length(),1000);i++) {
                    try (Cursor cursor=database.rawQuery("SELECT id,word,ur,roman,pos,preview,kind FROM entries WHERE id=?",
                            new String[]{ids.getString(i)})) {
                        if (cursor.moveToFirst()) items.put(summary(cursor));
                    }
                }
                reply("onSummaries",token,items);
            } catch (Exception error) { reply("onError",token,"Saved words could not be opened."); }
        });
    }

    @Override
    public void close() {
        closed=true;
        worker.execute(() -> {
            if (database!=null) { database.close(); database=null; }
            if (examplesDatabase!=null) { examplesDatabase.close(); examplesDatabase=null; }
        });
        worker.shutdown();
    }
}
