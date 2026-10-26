package com.onehao.littledays;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.Toast;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity {

    private WebView webView;
    private LinearLayout loadingView;
    private LinearLayout errorView;
    private boolean mainFrameFailed = false;
    private String appUrl;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        getWindow().setStatusBarColor(Color.parseColor("#FFF9F5"));
        getWindow().setNavigationBarColor(Color.parseColor("#FFF9F5"));
        int flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        getWindow().getDecorView().setSystemUiVisibility(flags);

        webView = findViewById(R.id.web_view);
        loadingView = findViewById(R.id.loading_view);
        errorView = findViewById(R.id.error_view);
        Button retryButton = findViewById(R.id.retry_button);
        retryButton.setOnClickListener(view -> loadApp());

        appUrl = BuildConfig.APP_URL;
        if (appUrl == null || !appUrl.startsWith("https://")) {
            fail();
            return;
        }

        configureWebView();
        loadApp();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebView.setWebContentsDebuggingEnabled(false);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setGeolocationEnabled(false);
        settings.setSafeBrowsingEnabled(true);
        settings.setUserAgentString(settings.getUserAgentString() + " OurLittleDays/1.0");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            settings.setForceDark(WebSettings.FORCE_DARK_OFF);
        }

        webView.setBackgroundColor(Color.parseColor("#FFF9F5"));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(Uri.parse(url));
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                mainFrameFailed = false;
                showLoading();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (!mainFrameFailed) showWebView();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) fail();
            }

            @Override
            public void onReceivedHttpError(
                    WebView view,
                    WebResourceRequest request,
                    WebResourceResponse errorResponse
            ) {
                if (request.isForMainFrame() && errorResponse.getStatusCode() >= 400) fail();
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) ->
                exportCsv(url, userAgent, mimeType));
    }

    private boolean handleUrl(Uri uri) {
        String scheme = uri.getScheme();
        if (scheme == null) return true;

        if ("http".equals(scheme) || "https".equals(scheme)) {
            Uri base = Uri.parse(appUrl);
            String baseHost = base.getHost();
            String targetHost = uri.getHost();
            if (baseHost != null && baseHost.equalsIgnoreCase(targetHost)) {
                String path = uri.getPath();
                if (path != null && path.contains("/api/export")) {
                    exportCsv(uri.toString(), webView.getSettings().getUserAgentString(), "text/csv");
                    return true;
                }
                return false;
            }
            openExternal(uri);
            return true;
        }

        if ("mailto".equals(scheme) || "tel".equals(scheme)) {
            openExternal(uri);
        }
        return true;
    }

    private void openExternal(Uri uri) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (ActivityNotFoundException ignored) {
            Toast.makeText(this, "没有找到可以打开这个链接的应用", Toast.LENGTH_SHORT).show();
        }
    }

    private void loadApp() {
        mainFrameFailed = false;
        errorView.setVisibility(View.GONE);
        showLoading();
        webView.loadUrl(appUrl);
    }

    private void showLoading() {
        if (loadingView == null) return;
        loadingView.animate().cancel();
        loadingView.setAlpha(1f);
        loadingView.setVisibility(View.VISIBLE);
        webView.setVisibility(View.INVISIBLE);
    }

    private void showWebView() {
        if (loadingView == null) return;
        loadingView.animate()
                .alpha(0f)
                .setDuration(220)
                .withEndAction(() -> loadingView.setVisibility(View.GONE))
                .start();
        webView.setAlpha(0f);
        webView.setVisibility(View.VISIBLE);
        webView.animate().alpha(1f).setDuration(220).start();
    }

    private void fail() {
        mainFrameFailed = true;
        if (loadingView != null) loadingView.setVisibility(View.GONE);
        if (webView != null) webView.setVisibility(View.INVISIBLE);
        if (errorView != null) errorView.setVisibility(View.VISIBLE);
    }

    private void exportCsv(String url, String userAgent, String mimeType) {
        Uri uri = Uri.parse(url);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            openExternal(uri);
            return;
        }

        try {
            String stamp = new SimpleDateFormat("yyyy-MM-dd-HHmmss", Locale.CHINA).format(new Date());
            DownloadManager.Request request = new DownloadManager.Request(uri);
            if (userAgent != null) request.addRequestHeader("User-Agent", userAgent);
            request.setMimeType(mimeType != null && !mimeType.isEmpty() ? mimeType : "text/csv");
            request.setTitle("我们的小日子记录");
            request.setDescription("正在导出全部记录");
            request.setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(
                    Environment.DIRECTORY_DOWNLOADS,
                    "our-little-days-" + stamp + ".csv");

            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager == null) {
                openExternal(uri);
                return;
            }
            manager.enqueue(request);
            Toast.makeText(this, "正在导出，好了会通知你", Toast.LENGTH_SHORT).show();
        } catch (Exception error) {
            openExternal(uri);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
