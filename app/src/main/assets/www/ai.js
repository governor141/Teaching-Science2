(function () {
  "use strict";

  var KEY_STORAGE = "ts_gemini_api_key";
  var MODEL_STORAGE = "ts_gemini_model";
  var DEFAULT_MODEL = "gemini-2.5-flash";

  var els = {};
  var current = null; // { className, term, subject, week, topic, content }
  var lastGeneratedText = "";

  function $(id) { return document.getElementById(id); }

  function getKey() {
    try { return localStorage.getItem(KEY_STORAGE) || ""; } catch (e) { return ""; }
  }
  function getModel() {
    try { return localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL; } catch (e) { return DEFAULT_MODEL; }
  }
  function setKey(v) { try { localStorage.setItem(KEY_STORAGE, v); } catch (e) {} }
  function setModel(v) { try { localStorage.setItem(MODEL_STORAGE, v || DEFAULT_MODEL); } catch (e) {} }

  // ---------- Settings screen ----------
  function initSettingsUI() {
    els.keyInput = $("gemini-key-input");
    els.modelInput = $("gemini-model-input");
    els.toggleVis = $("toggle-key-visibility");
    els.saveBtn = $("save-settings-btn");
    els.savedMsg = $("settings-saved-msg");

    els.toggleVis.addEventListener("click", function () {
      if (els.keyInput.type === "password") {
        els.keyInput.type = "text";
        els.toggleVis.textContent = "Hide key";
      } else {
        els.keyInput.type = "password";
        els.toggleVis.textContent = "Show key";
      }
    });

    els.saveBtn.addEventListener("click", function () {
      setKey(els.keyInput.value.trim());
      setModel(els.modelInput.value.trim());
      els.savedMsg.classList.add("show");
      setTimeout(function () { els.savedMsg.classList.remove("show"); }, 1800);
    });
  }

  function onSettingsOpen() {
    els.keyInput.value = getKey();
    els.modelInput.value = getModel();
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

    $("note-screen-title").textContent = weekData.topic;
    $("note-screen-subtitle").textContent =
      weekData.className + " \u2014 " + weekData.term + " \u2014 Week " + weekData.week;
    $("note-topic-value").textContent = weekData.topic;
    $("note-content-value").textContent = weekData.content && weekData.content !== "\u2014"
      ? weekData.content
      : "";

    var hasKey = !!getKey();
    $("note-key-warning").classList.toggle("show", !hasKey);
    $("generate-note-btn").disabled = false;

    showNoteState("note-idle");
    document.querySelectorAll(".screen").forEach(function (s) { s.classList.remove("active"); });
    $("note-screen").classList.add("active");
  }

  function buildPrompt(w) {
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

  function generate() {
    if (!current) return;
    var key = getKey();
    if (!key) {
      showNoteState("note-idle");
      $("note-key-warning").classList.add("show");
      return;
    }

    showNoteState("note-loading");

    var model = getModel();
    var url = "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key);

    var body = {
      contents: [
        { parts: [ { text: buildPrompt(current) } ] }
      ]
    };

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            var msg = (data && data.error && data.error.message) ? data.error.message : "Request failed (" + res.status + ")";
            throw new Error(msg);
          }
          return data;
        });
      })
      .then(function (data) {
        var text = extractText(data);
        if (!text) throw new Error("No response text was returned.");
        lastGeneratedText = text;
        renderResult(text);
        showNoteState("note-result");
      })
      .catch(function (err) {
        $("note-error-text").textContent = "Couldn't generate the note: " + err.message;
        showNoteState("note-error");
      });
  }

  function extractText(data) {
    try {
      var candidate = data.candidates && data.candidates[0];
      var parts = candidate && candidate.content && candidate.content.parts;
      if (!parts) return "";
      return parts.map(function (p) { return p.text || ""; }).join("\n").trim();
    } catch (e) {
      return "";
    }
  }

  function renderResult(text) {
    var out = $("note-output");
    out.textContent = text;
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
    // Fallback for browser testing
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
