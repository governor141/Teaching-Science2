package com.teachingscience.app

import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.speech.RecognizerIntent
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val STORAGE_PERMISSION_CODE = 1001

    // ---- Voice input launchers ----
    private val speechLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val matches = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
        val text = matches?.firstOrNull()
        deliverVoiceResult(text)
    }

    private val micPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            launchSpeechRecognizer()
        } else {
            Toast.makeText(this, "Microphone permission is needed for voice input", Toast.LENGTH_LONG).show()
            deliverVoiceResult(null)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        webView.layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
        setContentView(webView)

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = true
        settings.cacheMode = android.webkit.WebSettings.LOAD_DEFAULT

        webView.webViewClient = WebViewClient()
        webView.addJavascriptInterface(AndroidBridge(), "AndroidBridge")
        webView.loadUrl("file:///android_asset/www/index.html")

        // Let in-app screens handle back navigation first; only exit when JS says so.
        onBackPressedDispatcher.addCallback(this) {
            webView.evaluateJavascript(
                "(function(){" +
                    "var active=document.querySelector('.screen.active');" +
                    "if(active && (active.id==='term-screen' || active.id==='scheme-screen' || " +
                    "active.id==='note-screen' || active.id==='settings-screen')){" +
                    "window.dispatchEvent(new Event('ts:back'));return 'handled';}" +
                    "return 'exit';" +
                    "})();"
            ) { result ->
                if (result != null && result.contains("exit")) {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                }
            }
        }
    }

    private fun hasLegacyStoragePermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this, android.Manifest.permission.WRITE_EXTERNAL_STORAGE
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasMicPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this, android.Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun launchSpeechRecognizer() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Ask your question")
        }
        try {
            speechLauncher.launch(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "Voice input isn't available on this device", Toast.LENGTH_LONG).show()
            deliverVoiceResult(null)
        }
    }

    /** Sends the recognized text (or null on failure/cancel) back into the web page. */
    private fun deliverVoiceResult(text: String?) {
        val jsValue = if (text == null) "null" else JSONObject.quote(text)
        webView.post {
            webView.evaluateJavascript(
                "window.onVoiceResult && window.onVoiceResult($jsValue);", null
            )
        }
    }

    inner class AndroidBridge {

        @JavascriptInterface
        fun saveFile(filename: String, content: String, mimeType: String): Boolean {
            return try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    saveFileModern(filename, content, mimeType)
                } else {
                    saveFileLegacy(filename, content)
                }
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Saved to Downloads: $filename", Toast.LENGTH_LONG).show()
                }
                true
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Could not save file: ${e.message}", Toast.LENGTH_LONG).show()
                }
                false
            }
        }

        private fun saveFileModern(filename: String, content: String, mimeType: String) {
            val resolver = contentResolver
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, filename)
                put(MediaStore.Downloads.MIME_TYPE, mimeType)
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            }
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw Exception("Could not create file")
            resolver.openOutputStream(uri)?.use { out ->
                out.write(content.toByteArray(Charsets.UTF_8))
            }
        }

        private fun saveFileLegacy(filename: String, content: String) {
            if (!hasLegacyStoragePermission()) {
                ActivityCompat.requestPermissions(
                    this@MainActivity,
                    arrayOf(android.Manifest.permission.WRITE_EXTERNAL_STORAGE),
                    STORAGE_PERMISSION_CODE
                )
                throw Exception("Storage permission needed \u2014 please try again")
            }
            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            if (!downloadsDir.exists()) downloadsDir.mkdirs()
            val file = File(downloadsDir, filename)
            FileOutputStream(file).use { out ->
                out.write(content.toByteArray(Charsets.UTF_8))
            }
        }

        @JavascriptInterface
        fun shareText(text: String, subject: String) {
            runOnUiThread {
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, subject)
                    putExtra(Intent.EXTRA_TEXT, text)
                }
                startActivity(Intent.createChooser(intent, "Share lesson note"))
            }
        }

        /** Called from JS when the mic button is tapped. Result comes back via window.onVoiceResult(text). */
        @JavascriptInterface
        fun startVoiceInput() {
            runOnUiThread {
                if (hasMicPermission()) {
                    launchSpeechRecognizer()
                } else {
                    micPermissionLauncher.launch(android.Manifest.permission.RECORD_AUDIO)
                }
            }
        }
    }
}
