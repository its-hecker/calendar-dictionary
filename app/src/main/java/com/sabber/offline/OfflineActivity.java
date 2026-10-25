package com.sabber.offline;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/** Hosts only the bundled page, keeping its CSS, JavaScript and local storage intact. */
public class OfflineActivity extends Activity {
    protected static final String PAGE_URL = "file:///android_asset/index.html";
    protected WebView web;
    private android.window.OnBackInvokedCallback backCallback;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(getColor(getResources().getIdentifier("bg", "color", getPackageName())));
        web = new WebView(this);
        web.setBackgroundColor(android.graphics.Color.TRANSPARENT);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);

        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets safe = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return WindowInsets.CONSUMED;
            }
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets().consumeDisplayCutout();
        });
        root.requestApplyInsets();

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        // Android assets remain accessible even when general filesystem access is disabled.
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setBlockNetworkLoads(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= 33) settings.setAlgorithmicDarkeningAllowed(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (PAGE_URL.equals(url.toString())) return false;
                // Never load remote content in the WebView that has the native voice bridge.
                if (request.isForMainFrame()
                        && ("https".equals(url.getScheme()) || "http".equals(url.getScheme()))) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, url));
                    } catch (ActivityNotFoundException ignored) { }
                }
                return true;
            }
        });
        web.addJavascriptInterface(new ThemeBridge(root), "AppTheme");
        configureWebView(web);
        web.loadUrl(PAGE_URL);
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = this::requestBack;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
        }
    }

    protected void configureWebView(WebView view) { }

    private void requestBack() {
        if (web == null) { finish(); return; }
        web.evaluateJavascript("window.AppUi ? AppUi.back() : false", handled -> {
            if (!"true".equals(handled)) finish();
        });
    }

    @Override
    public void onBackPressed() { requestBack(); }

    public final class ThemeBridge {
        private final View root;
        ThemeBridge(View root) { this.root = root; }

        @JavascriptInterface
        public void setPalette(String background, boolean dark) {
            if (background == null || !background.matches("#[0-9a-fA-F]{6}")) return;
            setDark(dark);
            runOnUiThread(() -> {
                if (isDestroyed() || web == null) return;
                int color = android.graphics.Color.parseColor(background);
                root.setBackgroundColor(color);
                web.setBackgroundColor(color);
            });
        }

        @JavascriptInterface
        public void setDark(boolean dark) {
            runOnUiThread(() -> {
                if (isDestroyed() || web == null) return;
                int color = getColor(getResources().getIdentifier(
                        dark ? "page_dark" : "page_light", "color", getPackageName()));
                root.setBackgroundColor(color);
                web.setBackgroundColor(color);
                if (Build.VERSION.SDK_INT >= 30) {
                    android.view.WindowInsetsController controller = getWindow().getInsetsController();
                    int mask = android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                            | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                    if (controller != null) controller.setSystemBarsAppearance(dark ? 0 : mask, mask);
                } else {
                    View decor = getWindow().getDecorView();
                    int mask = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    decor.setSystemUiVisibility(dark ? decor.getSystemUiVisibility() & ~mask
                            : decor.getSystemUiVisibility() | mask);
                }
            });
        }
    }

    protected void evaluatePage(String script) {
        runOnUiThread(() -> {
            if (web != null && !isFinishing() && !isDestroyed() && PAGE_URL.equals(web.getUrl())) {
                web.evaluateJavascript(script, null);
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= 33 && backCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
        }
        if (web != null) {
            web.removeJavascriptInterface("AppTheme");
            web.removeJavascriptInterface("AndroidVoice");
            web.stopLoading();
            ((FrameLayout) web.getParent()).removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
