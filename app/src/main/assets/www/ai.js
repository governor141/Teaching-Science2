(function () {
  "use strict";

  var PROVIDER_STORAGE = "ts_ai_provider"; // "gemini" | "openai"
  var GEMINI_KEY_STORAGE = "ts_gemini_api_key";
  var GEMINI_MODEL_STORAGE = "ts_gemini_model";
  var OPENAI_KEY_STORAGE = "ts_openai_api_key";
  var OPENAI_MODEL_STORAGE = "ts_openai_model";

  var DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
  var DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

  var els = {};
  var current = null; // { className, term, subject, week, topic, content }
  var lastGeneratedText = "";
  var chatHistory = []; // [{ role: "user"|"assistant", text: "..." }]

  function $(id) { return document.getElementById(id); }
  function lsGet(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
  }
  function lsSet(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }

  function getProvider() { return lsGet(PROVIDER_STORAGE, "gemini"); }
  function setProvider(p) { lsSet(PROVIDER_STORAGE, p); }

  function getGeminiKey() { return lsGet(GEMINI_KEY_STORAGE, ""); }
  function getGeminiModel() { return lsGet(GEMINI_MODEL_STORAGE, DEFAULT_GEMINI_MODEL); }
  function getOpenAIKey() { return lsGet(OPENAI_KEY_STORAGE, ""); }
  function getOpenAIModel() { return lsGet(OPENAI_MODEL_STORAGE, DEFAULT_OPENAI_MODEL); }

  function activeKeyPresent() {
    return getProvider() === "openai" ? !!getOpenAIKey() : !!getGeminiKey();
  }

  function providerLabel() {
    return getProvider() === "openai" ? "ChatGPT" : "Gemini";
  }

  // ---------- Settings screen ----------
  function initSettingsUI() {
    els.providerToggle = $("provider-toggle");
    els.geminiPanel = $("gemini-settings");
    els.openaiPanel = $("openai-settings");
    els.geminiKeyInput = $("gemini-key-input");
    els.geminiModelInput = $("gemini-model-input");
    els.openaiKeyInput = $("openai-key-input");
    els.openaiModelInput = $("openai-model-input");
    els.saveBtn = $("save-settings-btn");
    els.savedMsg = $("settings-saved-msg");

    els.providerToggle.addEventListener("click", function (e) {
      var btn = e.target.closest(".provider-btn");
      if (!btn) return;
      var provider = btn.getAttribute("data-provider");
      selectProviderUI(provider);
    });

    document.querySelectorAll(".settings-toggle-visibility").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = $(btn.getAttribute("data-target"));
        if (target.type === "password") {
          target.type = "text";
          btn.textContent = "Hide key";
        } else {
          target.type = "password";
          btn.textContent = "Show key";
        }
      });
    });

    els.saveBtn.addEventListener("click", function () {
      lsSet(GEMINI_KEY_STORAGE, els.geminiKeyInput.value.trim());
      lsSet(GEMINI_MODEL_STORAGE, els.geminiModelInput.value.trim() || DEFAULT_GEMINI_MODEL);
      lsSet(OPENAI_KEY_STORAGE, els.openaiKeyInput.value.trim());
      lsSet(OPENAI_MODEL_STORAGE, els.openaiModelInput.value.trim() || DEFAULT_OPENAI_MODEL);

      var selected = els.providerToggle.querySelector(".provider-btn.active");
      setProvider(selected ? selected.getAttribute("data-provider") : "gemini");

      els.savedMsg.classList.add("show");
      setTimeout(function () { els.savedMsg.classList.remove("show"); }, 1800);
    });
  }

  function selectProviderUI(provider) {
    els.providerToggle.querySelectorAll(".provider-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-provider") === provider);
    });
    els.geminiPanel.classList.toggle("hidden", provider !== "gemini");
    els.openaiPanel.classList.toggle("hidden", provider !== "openai");
  }

  function onSettingsOpen() {
    els.geminiKeyInput.value = getGeminiKey();
    els.geminiModelInput.value = getGeminiModel();
    els.openaiKeyInput.value = getOpenAIKey();
    els.openaiModelInput.value = getOpenAIModel();
    selectProviderUI(getProvider());
  }

  // ---------- Note screen state machine ----------
  function showNoteState(name) {
    ["note-idle", "note-loading", "note-error", "note-result"].forEach(function (id) {
      $(id).classList.toggle("hidden", id !== name);
    });
  }

  function open(weekData) {
    current = weekData;
    lastGeneratedText = "";
    chatHistory = [];
    $("chat-messages").innerHTML = "";
    $("chat-input").value = "";

    $("note-screen-title").textContent = weekData.topic;
    $("note-screen-subtitle").textContent =
      weekData.className + " \u2014 " + weekData.term + " \u2014 Week " + weekData.week;
    $("note-topic-value").textContent = weekData.topic;
    $("note-content-value").textContent = weekData.content && weekData.content !== "\u2014"
      ? weekData.content
      : "";
    $("note-provider-badge").textContent = "Using " + providerLabel();

    var hasKey = activeKeyPresent();
    $("note-key-warning").classList.toggle("show", !hasKey);

    showNoteState("note-idle");
    document.querySelectorAll(".screen").forEach(function (s) { s.classList.remove("active"); });
    $("note-screen").classList.add("active");
  }

  function buildNotePrompt(w) {
    return (
      "You are an experienced Nigerian secondary school chemistry teacher preparing an official lesson note.\n\n" +
      "Subject: Chemistry\n" +
      "Class: " + w.className + "\n" +
      "Term: " + w.term + "\n" +
      "Week: " + w.week + "\n" +
      "Topic: " + w.topic + "\n" +
      "Scheme of work content for this week: " + (w.content || "N/A") + "\n\n" +
      "Write a complete, ready-to-teach lesson note for this topic, following the standard Nigerian " +
      "secondary school (WAEC/NECO-aligned) lesson note format, with these clearly labeled sections " +
      "in capital letters, in this order:\n" +
      "BEHAVIOURAL OBJECTIVES (3-4 measurable objectives)\n" +
      "INSTRUCTIONAL MATERIALS\n" +
      "PREVIOUS KNOWLEDGE\n" +
      "CONTENT / PRESENTATION (clear step-by-step teaching points, definitions, explanations, worked " +
      "examples and simple equations where relevant)\n" +
      "EVALUATION (5 short questions to check understanding)\n" +
      "ASSIGNMENT (2-3 homework questions)\n\n" +
      "Write in plain text only. Do not use markdown symbols such as **, ##, or bullet dashes - use " +
      "plain numbered or lettered lists instead. Keep the language clear and appropriate for Nigerian " +
      "senior secondary students."
    );
  }

  // ---------- Unified AI call ----------
  function callAI(userText, historyForContext) {
    if (getProvider() === "openai") {
      return callOpenAI(userText, historyForContext);
    }
    return callGemini(userText, historyForContext);
  }

  function callGemini(userText, historyForContext) {
    var key = getGeminiKey();
    var model = getGeminiModel();
    var url = "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key);

    var contents = (historyForContext || []).map(function (m) {
      return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.text }] };
    });
    contents.push({ role: "user", parts: [{ text: userText }] });

    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: contents })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          var msg = (data && data.error && data.error.message) ? data.error.message : "Request failed (" + res.status + ")";
          throw new Error(msg);
        }
        var candidate = data.candidates && data.candidates[0];
        var parts = candidate && candidate.content && candidate.content.parts;
        var text = parts ? parts.map(function (p) { return p.text || ""; }).join("\n").trim() : "";
        if (!text) throw new Error("No response text was returned.");
        return text;
      });
    });
  }

  function callOpenAI(userText, historyForContext) {
    var key = getOpenAIKey();
    var model = getOpenAIModel();
    var url = "https://api.openai.com/v1/chat/completions";

    var messages = (historyForContext || []).map(function (m) {
      return { role: m.role === "assistant" ? "assistant" : "user", content: m.text };
    });
    messages.push({ role: "user", content: userText });

    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key
      },
      body: JSON.stringify({ model: model, messages: messages })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          var msg = (data && data.error && data.error.message) ? data.error.message : "Request failed (" + res.status + ")";
          throw new Error(msg);
        }
        var text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!text) throw new Error("No response text was returned.");
        return text.trim();
      });
    });
  }

  // ---------- Generate lesson note ----------
  function generate() {
    if (!current) return;
    if (!activeKeyPresent()) {
      showNoteState("note-idle");
      $("note-key-warning").classList.add("show");
      return;
    }

    showNoteState("note-loading");

    callAI(buildNotePrompt(current), [])
      .then(function (text) {
        lastGeneratedText = text;
        $("note-output").textContent = text;
        showNoteState("note-result");
      })
      .catch(function (err) {
        $("note-error-text").textContent = "Couldn't generate the note: " + err.message;
        showNoteState("note-error");
      });
  }

  // ---------- Follow-up chat ----------
  function appendChatBubble(role, text) {
    var wrap = document.createElement("div");
    wrap.className = "chat-bubble chat-bubble-" + role;
    wrap.textContent = text;
    $("chat-messages").appendChild(wrap);
    $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
  }

  function appendChatTyping() {
    var wrap = document.createElement("div");
    wrap.className = "chat-bubble chat-bubble-assistant chat-typing";
    wrap.id = "chat-typing-indicator";
    wrap.innerHTML = '<span></span><span></span><span></span>';
    $("chat-messages").appendChild(wrap);
    $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
  }

  function removeChatTyping() {
    var el = $("chat-typing-indicator");
    if (el) el.remove();
  }

  function sendChatMessage() {
    var input = $("chat-input");
    var text = input.value.trim();
    if (!text) return;
    if (!activeKeyPresent()) {
      appendChatBubble("assistant", "Please set your " + providerLabel() + " API key in Settings first.");
      return;
    }

    input.value = "";
    appendChatBubble("user", text);
    chatHistory.push({ role: "user", text: text });
    appendChatTyping();

    var contextPrefix = "You are helping a Nigerian secondary school chemistry teacher with the topic \"" +
      (current ? current.topic : "") + "\". Answer clearly and concisely.\n\nQuestion: ";

    callAI(contextPrefix + text, chatHistory.slice(0, -1))
      .then(function (reply) {
        removeChatTyping();
        appendChatBubble("assistant", reply);
        chatHistory.push({ role: "assistant", text: reply });
      })
      .catch(function (err) {
        removeChatTyping();
        appendChatBubble("assistant", "Error: " + err.message);
      });
  }

  // ---------- Voice input ----------
  window.onVoiceResult = function (text) {
    var input = $("chat-input");
    $("mic-btn").classList.remove("listening");
    if (text) {
      input.value = text;
      input.focus();
    }
  };

  function startVoice() {
    $("mic-btn").classList.add("listening");
    if (window.AndroidBridge && window.AndroidBridge.startVoiceInput) {
      window.AndroidBridge.startVoiceInput();
      return;
    }
    // Browser fallback for desktop testing
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      var rec = new SR();
      rec.lang = "en-US";
      rec.onresult = function (e) {
        window.onVoiceResult(e.results[0][0].transcript);
      };
      rec.onerror = function () { window.onVoiceResult(null); };
      rec.onend = function () { $("mic-btn").classList.remove("listening"); };
      rec.start();
    } else {
      $("mic-btn").classList.remove("listening");
      alert("Voice input isn't supported here.");
    }
  }

  // ---------- Download / Share ----------
  function currentFilenameBase() {
    var safeTopic = (current.topic || "note").replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
    return current.className + "_" + current.term.replace(/\s+/g, "") + "_Wk" + current.week + "_" + safeTopic;
  }

  function csvEscape(val) {
    var s = String(val == null ? "" : val);
    if (/[",\n]/.test(s)) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function buildCsv() {
    var header = ["Class", "Term", "Subject", "Week", "Topic", "SchemeContent", "LessonNote"];
    var row = [
      current.className,
      current.term,
      current.subject,
      current.week,
      current.topic,
      current.content || "",
      lastGeneratedText
    ];
    return header.map(csvEscape).join(",") + "\n" + row.map(csvEscape).join(",") + "\n";
  }

  function buildTxt() {
    return (
      "TEACHING SCIENCE - LESSON NOTE\n" +
      "================================\n" +
      "Class: " + current.className + "\n" +
      "Term: " + current.term + "\n" +
      "Subject: " + current.subject + "\n" +
      "Week: " + current.week + "\n" +
      "Topic: " + current.topic + "\n" +
      "--------------------------------\n\n" +
      lastGeneratedText + "\n"
    );
  }

  function downloadFile(filename, content, mimeType) {
    if (window.AndroidBridge && window.AndroidBridge.saveFile) {
      window.AndroidBridge.saveFile(filename, content, mimeType);
      return;
    }
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadTxt() {
    if (!lastGeneratedText) return;
    downloadFile(currentFilenameBase() + ".txt", buildTxt(), "text/plain");
  }

  function downloadCsv() {
    if (!lastGeneratedText) return;
    downloadFile(currentFilenameBase() + ".csv", buildCsv(), "text/csv");
  }

  function shareNote() {
    if (!lastGeneratedText) return;
    var text = buildTxt();
    if (window.AndroidBridge && window.AndroidBridge.shareText) {
      window.AndroidBridge.shareText(text, "Lesson Note: " + current.topic);
      return;
    }
    if (navigator.share) {
      navigator.share({ title: "Lesson Note", text: text }).catch(function () {});
    } else {
      downloadTxt();
    }
  }

  // ---------- Wire up buttons ----------
  function initNoteUI() {
    $("generate-note-btn").addEventListener("click", generate);
    $("note-retry-btn").addEventListener("click", generate);
    $("regenerate-btn").addEventListener("click", generate);
    $("download-txt-btn").addEventListener("click", downloadTxt);
    $("download-csv-btn").addEventListener("click", downloadCsv);
    $("share-btn").addEventListener("click", shareNote);

    $("send-chat-btn").addEventListener("click", sendChatMessage);
    $("chat-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") sendChatMessage();
    });
    $("mic-btn").addEventListener("click", startVoice);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initSettingsUI();
    initNoteUI();
  });

  window.TSNote = {
    open: open,
    onSettingsOpen: onSettingsOpen
  };
})();
